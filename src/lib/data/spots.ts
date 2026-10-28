import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
  updateDoc,
  Timestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase/client';
import {
  Spot,
  VisibilityScope,
  LocationMode,
  PlaceScope,
  SpotLocation,
} from '../domain/types';
import { getSavedPlaceKey } from '../domain/schemas';
import { mergeUniqueSorted } from '../domain/feed-merge';
import { authedFetch, readApiError } from './api';

const PLACE_SPOT_PAGE_SIZE = 50;

export interface CreateSpotParams {
  placeId: string;
  realPlaceKey: string;
  realPlaceScope: PlaceScope;
  locationMode: LocationMode;
  category: string;
  priceVnd: number | null;
  rating: number | null;
  caption: string;
  visibility: VisibilityScope;
  visitedAt?: Date;
  imageFiles: File[];
}

/**
 * Tạo một Spot mới:
 * 1. Cấp spotId trước, upload ảnh (đã bỏ EXIF ở client) dưới dạng object path
 * 2. Ghi Spot + spotLocations (nếu ẩn vị trí) + savedPlaces + media trong transaction
 * 3. Lỗi sau upload ⇒ dọn ảnh vừa tải, không báo thành công giả
 *
 * imagePaths lưu object path (`spots/{uid}/{spotId}/{file}`), KHÔNG lưu URL token.
 */
export async function createSpot(
  params: CreateSpotParams,
  authorUid: string
): Promise<string> {
  if (params.locationMode === 'hidden' && !params.realPlaceKey) {
    throw new Error('Spot ẩn vị trí phải có tham chiếu địa điểm thật');
  }
  if (params.locationMode === 'exact' && !params.placeId) {
    throw new Error('Spot chia sẻ vị trí phải gắn với một Place');
  }

  const spotId = 'spot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const uploadedPaths: string[] = [];

  try {
    for (let i = 0; i < params.imageFiles.length; i++) {
      const file = params.imageFiles[i];
      const storagePath = `spots/${authorUid}/${spotId}/photo_${i + 1}.jpg`;
      await uploadBytes(ref(storage, storagePath), file, {
        contentType: file.type || 'image/jpeg',
      });
      uploadedPaths.push(storagePath);
    }

    const visitedAt = params.visitedAt
      ? Timestamp.fromDate(params.visitedAt)
      : serverTimestamp();
    const created = serverTimestamp();
    const effectivePlaceId = params.realPlaceKey;
    const effectiveScope = params.realPlaceScope;

    const spotRef = doc(db, 'spots', spotId);
    const savedRef = doc(
      db,
      `users/${authorUid}/savedPlaces`,
      getSavedPlaceKey(effectiveScope, effectivePlaceId)
    );
    const secretRef = doc(db, `users/${authorUid}/spotLocations`, spotId);

    await runTransaction(db, async (tx) => {
      // Đọc trước mọi ghi trong transaction
      const savedSnap = await tx.get(savedRef);

      tx.set(spotRef, {
        authorId: authorUid,
        placeId: params.locationMode === 'hidden' ? null : params.placeId,
        locationMode: params.locationMode,
        imagePaths: uploadedPaths,
        category: params.category,
        priceVnd: params.priceVnd,
        rating: params.rating,
        caption: params.caption,
        visibility: params.visibility,
        visitedAt,
        createdAt: created,
        updatedAt: created,
        status: 'active',
      });

      if (params.locationMode === 'hidden') {
        const location: SpotLocation = {
          placeScope: effectiveScope,
          placeKey: effectivePlaceId,
        };
        tx.set(secretRef, location);
      }

      const isBookmarked = savedSnap.exists()
        ? Boolean(savedSnap.data().isBookmarked)
        : false;
      tx.set(
        savedRef,
        {
          placeScope: effectiveScope,
          placeId: effectivePlaceId,
          hasVisited: true,
          isBookmarked,
          lastVisitedAt: visitedAt,
        },
        { merge: true }
      );

      uploadedPaths.forEach((objectPath, index) => {
        tx.set(doc(db, 'media', `${spotId}_${index + 1}`), {
          ownerId: authorUid,
          spotId,
          objectPath,
          status: 'attached',
          createdAt: serverTimestamp(),
        });
      });
    });

    return spotId;
  } catch (error) {
    await Promise.all(
      uploadedPaths.map(async (path) => {
        try {
          await deleteObject(ref(storage, path));
        } catch {
          // Ảnh chưa tồn tại hoặc đã bị dọn: bỏ qua để không che lỗi gốc
        }
      })
    );
    throw error;
  }
}

/**
 * Xóa Spot qua Route Handler: server đánh dấu deleting, dọn likes/media/liên kết ẩn
 * rồi tính lại hasVisited một cách idempotent.
 */
export async function deleteSpot(spotId: string): Promise<void> {
  const res = await authedFetch(`/api/spots/${encodeURIComponent(spotId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
}

/**
 * Đổi phạm vi bài viết. Quyền đọc ảnh trong Storage Rules đọc trực tiếp Spot
 * nên thay đổi này có hiệu lực ngay, không cần cập nhật URL ảnh.
 */
export async function updateSpotVisibility(
  spotId: string,
  visibility: VisibilityScope
): Promise<void> {
  await updateDoc(doc(db, 'spots', spotId), {
    visibility,
    updatedAt: serverTimestamp(),
  });
}

function mapSpot(snap: DocumentSnapshot): Spot {
  return { id: snap.id, ...snap.data() } as Spot;
}

/**
 * Lấy danh sách Spot của một người dùng (dùng cho trang cá nhân của chính mình).
 */
export async function fetchUserSpots(userId: string): Promise<Spot[]> {
  const q = query(
    collection(db, 'spots'),
    where('authorId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(PLACE_SPOT_PAGE_SIZE)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapSpot);
}

/**
 * Lấy Spot của người khác trong phạm vi người xem được phép đọc.
 * Không tải cả collection rồi lọc ở client.
 */
export async function fetchUserSpotsForViewer(
  authorId: string,
  viewerUid: string | null | undefined,
  areFriends: boolean
): Promise<Spot[]> {
  if (viewerUid === authorId) {
    return fetchUserSpots(authorId);
  }
  if (!viewerUid) return [];

  const q = query(
    collection(db, 'spots'),
    where('authorId', '==', authorId),
    where('visibility', 'in', areFriends ? ['public', 'friends'] : ['public']),
    orderBy('createdAt', 'desc'),
    limit(PLACE_SPOT_PAGE_SIZE)
  );

  const snap = await getDocs(q);
  return snap.docs.map(mapSpot);
}

async function fetchVisibleSpotsAtPlace(
  placeId: string,
  authorId: string
): Promise<Spot[]> {
  const q = query(
    collection(db, 'spots'),
    where('placeId', '==', placeId),
    where('authorId', '==', authorId),
    where('visibility', 'in', ['public', 'friends']),
    orderBy('createdAt', 'desc'),
    limit(PLACE_SPOT_PAGE_SIZE)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapSpot);
}

async function fetchOwnExactSpotsAtPlace(placeId: string, viewerUid: string): Promise<Spot[]> {
  const q = query(
    collection(db, 'spots'),
    where('placeId', '==', placeId),
    where('authorId', '==', viewerUid),
    orderBy('createdAt', 'desc'),
    limit(PLACE_SPOT_PAGE_SIZE)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapSpot);
}

/**
 * Spot ẩn vị trí của chính người xem: placeId = null nên phải tra
 * users/{uid}/spotLocations/{spotId} rồi đọc từng Spot.
 */
async function fetchOwnHiddenSpotsAtPlace(
  viewerUid: string,
  placeId: string,
  placeScope: PlaceScope
): Promise<Spot[]> {
  const locationsSnap = await getDocs(
    collection(db, `users/${viewerUid}/spotLocations`)
  );
  const matchingSpotIds: string[] = [];
  locationsSnap.forEach((d) => {
    const data = d.data() as SpotLocation;
    if (data.placeKey === placeId && data.placeScope === placeScope) {
      matchingSpotIds.push(d.id);
    }
  });

  const spots = await Promise.all(
    matchingSpotIds.map(async (spotId) => {
      const snap = await getDoc(doc(db, 'spots', spotId));
      return snap.exists() ? mapSpot(snap) : null;
    })
  );
  return spots.filter((s): s is Spot => s !== null);
}

/**
 * Lấy các Spot được phép xem tại một Place:
 * - lịch sử của chính người xem (gồm cả Spot ẩn vị trí)
 * - trải nghiệm của bạn bè (public/friends)
 *
 * Trả về isPartial để UI hiển thị phần đã tải hợp lệ khi một nguồn lỗi.
 */
export async function fetchPlaceSpots(
  placeId: string,
  viewerUid: string | null | undefined,
  friendUids: string[],
  placeScope: PlaceScope
): Promise<{ spots: Spot[]; isPartial: boolean }> {
  if (!viewerUid) return { spots: [], isPartial: false };

  const batches: Spot[][] = [];
  let isPartial = false;

  try {
    batches.push(await fetchOwnExactSpotsAtPlace(placeId, viewerUid));
  } catch (error) {
    console.warn('Không tải được Spot của bạn tại Place:', error);
    isPartial = true;
  }

  try {
    batches.push(await fetchOwnHiddenSpotsAtPlace(viewerUid, placeId, placeScope));
  } catch (error) {
    console.warn('Không tải được Spot ẩn vị trí của bạn:', error);
    isPartial = true;
  }

  if (placeScope === 'shared') {
    const friendResults = await Promise.all(
      friendUids.map(async (friendUid) => {
        try {
          return await fetchVisibleSpotsAtPlace(placeId, friendUid);
        } catch (error) {
          console.warn(`Không tải được Spot của bạn bè ${friendUid}:`, error);
          isPartial = true;
          return [];
        }
      })
    );
    batches.push(...friendResults);
  }

  return { spots: mergeUniqueSorted(batches), isPartial };
}

/**
 * Toàn bộ Spot ẩn vị trí của chính người dùng, kèm tham chiếu địa điểm thật.
 */
export async function fetchOwnSpotLocations(
  uid: string
): Promise<Map<string, SpotLocation>> {
  const snap = await getDocs(collection(db, `users/${uid}/spotLocations`));
  const map = new Map<string, SpotLocation>();
  snap.forEach((d) => map.set(d.id, d.data() as SpotLocation));
  return map;
}

export async function fetchOwnSpotLocation(
  uid: string,
  spotId: string
): Promise<SpotLocation | null> {
  const snap = await getDoc(doc(db, `users/${uid}/spotLocations`, spotId));
  return snap.exists() ? (snap.data() as SpotLocation) : null;
}

export async function fetchSpotsByIds(spotIds: string[]): Promise<Spot[]> {
  const snapshots = await Promise.all(
    spotIds.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, 'spots', id));
        return snap.exists() ? mapSpot(snap) : null;
      } catch {
        return null;
      }
    })
  );
  return snapshots.filter((s): s is Spot => s !== null);
}

/**
 * Đọc một Spot theo ID. Rules quyết định quyền đọc; lỗi permission-denied
 * được ném ra để UI hiển thị "nội dung không còn khả dụng".
 */
export async function fetchSpotById(spotId: string): Promise<Spot | null> {
  const snap = await getDoc(doc(db, 'spots', spotId));
  return snap.exists() ? mapSpot(snap) : null;
}
