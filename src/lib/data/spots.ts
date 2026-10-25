import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/client';
import { Spot, VisibilityScope, LocationMode, PlaceScope } from '../domain/types';
import { getSavedPlaceKey } from '../domain/schemas';

export interface CreateSpotParams {
  placeId: string | null;
  realPlaceKey?: string;
  realPlaceScope?: PlaceScope;
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
 * 1. Cấp spotId trước
 * 2. Upload ảnh lên Firebase Storage (đã được canvas strip EXIF)
 * 3. Ghi Spot document (nếu hidden thì placeId = null)
 * 4. Nếu hidden, ghi tham chiếu thật vào users/{uid}/spotLocations/{spotId}
 * 5. Cập nhật savedPlaces (hasVisited = true)
 */
export async function createSpot(
  params: CreateSpotParams,
  authorUid: string
): Promise<string> {
  const spotId = 'spot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

  // 1. Upload ảnh
  const imagePaths: string[] = [];
  for (let i = 0; i < params.imageFiles.length; i++) {
    const file = params.imageFiles[i];
    const filename = `photo_${i + 1}_${Date.now()}.jpg`;
    const storagePath = `spots/${authorUid}/${spotId}/${filename}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file, {
      contentType: file.type || 'image/jpeg',
    });

    // Lấy URL tải ảnh
    const downloadUrl = await getDownloadURL(storageRef);
    imagePaths.push(downloadUrl);
  }

  const batch = writeBatch(db);

  // 2. Ghi bản ghi Spot chính
  const spotRef = doc(db, 'spots', spotId);
  const now = serverTimestamp();

  const spotData: Record<string, unknown> = {
    id: spotId,
    authorId: authorUid,
    placeId: params.locationMode === 'hidden' ? null : params.placeId,
    locationMode: params.locationMode,
    imagePaths,
    category: params.category,
    priceVnd: params.priceVnd,
    rating: params.rating,
    caption: params.caption,
    visibility: params.visibility,
    visitedAt: params.visitedAt ? params.visitedAt : now,
    createdAt: now,
    updatedAt: now,
  };

  batch.set(spotRef, spotData);

  // 3. Nếu là hidden location: ghi tham chiếu thật vào users/{authorUid}/spotLocations/{spotId}
  if (params.locationMode === 'hidden' && params.realPlaceKey) {
    const secretRef = doc(db, `users/${authorUid}/spotLocations`, spotId);
    batch.set(secretRef, {
      placeScope: params.realPlaceScope || 'shared',
      placeKey: params.realPlaceKey,
    });
  }

  // 4. Cập nhật savedPlaces: hasVisited = true
  const effectivePlaceId = params.locationMode === 'hidden' ? params.realPlaceKey : params.placeId;
  const effectivePlaceScope: PlaceScope = params.realPlaceScope || 'shared';

  if (effectivePlaceId) {
    const savedKey = getSavedPlaceKey(effectivePlaceScope, effectivePlaceId);
    const savedRef = doc(db, `users/${authorUid}/savedPlaces`, savedKey);
    batch.set(
      savedRef,
      {
        placeScope: effectivePlaceScope,
        placeId: effectivePlaceId,
        hasVisited: true,
        lastVisitedAt: params.visitedAt || now,
      },
      { merge: true }
    );
  }

  await batch.commit();
  return spotId;
}

/**
 * Xóa một bài Spot và tính toán lại cờ hasVisited
 */
export async function deleteSpot(spotId: string, currentUid: string): Promise<void> {
  const spotRef = doc(db, 'spots', spotId);
  const snap = await getDoc(spotRef);
  if (!snap.exists()) {
    throw new Error('Spot không tồn tại hoặc đã bị xóa');
  }

  const spotData = snap.data();
  if (spotData.authorId !== currentUid) {
    throw new Error('Bạn không có quyền xóa bài viết này');
  }

  const targetPlaceId = spotData.placeId;

  // Xóa tài liệu Spot
  await deleteDoc(spotRef);

  // Xóa liên kết ẩn nếu có
  if (spotData.locationMode === 'hidden') {
    try {
      await deleteDoc(doc(db, `users/${currentUid}/spotLocations`, spotId));
    } catch {
      // Bỏ qua nếu không tồn tại
    }
  }

  // Tính lại hasVisited nếu Spot này từng gắn với một Place
  if (targetPlaceId) {
    // Đếm xem còn bài viết nào khác của user tại place này không
    const remainingQuery = query(
      collection(db, 'spots'),
      where('authorId', '==', currentUid),
      where('placeId', '==', targetPlaceId)
    );
    const remainingSnap = await getDocs(remainingQuery);

    const savedKey = getSavedPlaceKey('shared', targetPlaceId);
    const savedRef = doc(db, `users/${currentUid}/savedPlaces`, savedKey);
    const savedSnap = await getDoc(savedRef);

    if (savedSnap.exists()) {
      const savedData = savedSnap.data();
      const stillVisited = remainingSnap.size > 0;
      if (!stillVisited && !savedData.isBookmarked) {
        // Không còn ghé và cũng không bookmark -> xóa bản ghi
        await deleteDoc(savedRef);
      } else {
        // Cập nhật lại trạng thái hasVisited
        await setDoc(savedRef, { hasVisited: stillVisited }, { merge: true });
      }
    }
  }
}

/**
 * Lấy danh sách Spot của một người dùng cụ thể
 */
export async function fetchUserSpots(userId: string): Promise<Spot[]> {
  const q = query(
    collection(db, 'spots'),
    where('authorId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  const spots: Spot[] = [];
  snap.forEach((d) => {
    spots.push({ id: d.id, ...d.data() } as Spot);
  });
  return spots;
}

/**
 * Lấy danh sách Spot tại một Place cụ thể
 */
export async function fetchPlaceSpots(placeId: string): Promise<Spot[]> {
  const q = query(
    collection(db, 'spots'),
    where('placeId', '==', placeId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  const spots: Spot[] = [];
  snap.forEach((d) => {
    spots.push({ id: d.id, ...d.data() } as Spot);
  });
  return spots;
}
