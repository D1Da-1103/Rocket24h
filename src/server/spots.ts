import type { DocumentReference } from 'firebase-admin/firestore';
import { adminDb, adminStorage, FieldValue } from '@/lib/firebase/admin';
import { PlaceScope } from '@/lib/domain/types';
import { getSavedPlaceKey } from '@/lib/domain/schemas';
import { canViewSpot } from '@/lib/domain/spot-access';
import { HttpError } from './errors';

export function likeNotificationId(spotId: string, actorUid: string): string {
  return `like_${spotId}_${actorUid}`;
}

/**
 * Kiểm tra quyền đọc Spot ở server (Admin SDK bỏ qua Rules nên phải tự kiểm tra).
 */
export async function canReadSpotForUser(
  actorUid: string,
  spot: { authorId: string; visibility: 'public' | 'friends' | 'private'; status?: 'active' | 'deleting' }
): Promise<boolean> {
  if (spot.authorId === actorUid) return canViewSpot(spot, actorUid, true);

  let areFriends = false;
  if (spot.visibility === 'friends') {
    const lookup = await adminDb
      .doc(`users/${spot.authorId}/friends/${actorUid}`)
      .get();
    areFriends = lookup.exists;
  }
  return canViewSpot(spot, actorUid, areFriends);
}

/**
 * Xác định địa điểm thật của Spot mà không lộ vị trí cho người không có quyền.
 */
export async function resolveRealPlace(
  ownerUid: string,
  spotId: string,
  spot: { placeId: string | null; locationMode: 'exact' | 'hidden' }
): Promise<{ placeScope: PlaceScope; placeId: string } | null> {
  if (spot.locationMode === 'hidden') {
    const locationSnap = await adminDb
      .doc(`users/${ownerUid}/spotLocations/${spotId}`)
      .get();
    if (!locationSnap.exists) return null;
    const data = locationSnap.data()!;
    return {
      placeScope: data.placeScope as PlaceScope,
      placeId: data.placeKey as string,
    };
  }

  if (!spot.placeId) return null;

  const shared = await adminDb.doc(`places/${spot.placeId}`).get();
  if (shared.exists) return { placeScope: 'shared', placeId: spot.placeId };

  const privatePlace = await adminDb
    .doc(`users/${ownerUid}/privatePlaces/${spot.placeId}`)
    .get();
  if (privatePlace.exists) return { placeScope: 'private', placeId: spot.placeId };

  return null;
}

/**
 * Đếm số Spot còn tồn tại của người dùng tại một địa điểm.
 * Bao gồm Spot chia sẻ vị trí và Spot ẩn (tra qua spotLocations).
 */
export async function countRemainingSpotsAtPlace(
  ownerUid: string,
  placeScope: PlaceScope,
  placeId: string
): Promise<number> {
  let count = 0;

  const exactSnap = await adminDb
    .collection('spots')
    .where('authorId', '==', ownerUid)
    .where('placeId', '==', placeId)
    .get();
  exactSnap.forEach((doc) => {
    const status = doc.data().status;
    if (status !== 'deleting') count += 1;
  });

  const locationsSnap = await adminDb
    .collection(`users/${ownerUid}/spotLocations`)
    .get();

  const hiddenSpotIds = locationsSnap.docs
    .filter((doc) => {
      const data = doc.data();
      return data.placeKey === placeId && data.placeScope === placeScope;
    })
    .map((doc) => doc.id);

  const hiddenSpots = await Promise.all(
    hiddenSpotIds.map((id) => adminDb.doc(`spots/${id}`).get())
  );
  hiddenSpots.forEach((snap) => {
    if (snap.exists && snap.data()?.status !== 'deleting') count += 1;
  });

  return count;
}

/**
 * Tính lại hasVisited từ các Spot còn tồn tại; không đụng tới isBookmarked.
 */
export async function recalculateSavedPlace(
  ownerUid: string,
  placeScope: PlaceScope,
  placeId: string
): Promise<void> {
  const savedRef = adminDb.doc(
    `users/${ownerUid}/savedPlaces/${getSavedPlaceKey(placeScope, placeId)}`
  );
  const savedSnap = await savedRef.get();
  if (!savedSnap.exists) return;

  const remaining = await countRemainingSpotsAtPlace(ownerUid, placeScope, placeId);
  const saved = savedSnap.data()!;

  if (remaining > 0) {
    await savedRef.set({ hasVisited: true }, { merge: true });
    return;
  }

  if (!saved.isBookmarked) {
    await savedRef.delete();
    return;
  }

  await savedRef.set({ hasVisited: false, lastVisitedAt: null }, { merge: true });
}

async function deleteDocs(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = adminDb.batch();
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteStorageObject(path: string): Promise<void> {
  if (!path || /^https?:\/\//i.test(path)) return;
  try {
    await adminStorage.bucket().file(path).delete({ ignoreNotFound: true });
  } catch (error) {
    console.warn('Không xóa được ảnh Storage:', path, error);
  }
}

/**
 * Xóa Spot theo quy trình chạy lại được:
 * 1. Đánh dấu deleting (chặn đọc ngay)
 * 2. Dọn likes, media + ảnh, spotLocations
 * 3. Xóa Spot
 * 4. Tính lại hasVisited
 *
 * Nếu bước sau lỗi, gọi lại vẫn tiếp tục được từ trạng thái deleting.
 */
export async function deleteSpotCascade(
  actorUid: string,
  spotId: string
): Promise<{ alreadyDeleted: boolean }> {
  const spotRef = adminDb.doc(`spots/${spotId}`);
  const spotSnap = await spotRef.get();

  if (!spotSnap.exists) {
    return { alreadyDeleted: true };
  }

  const spot = spotSnap.data()!;
  if (spot.authorId !== actorUid) {
    throw new HttpError('Bạn không có quyền xóa bài viết này', 403);
  }

  const realPlace = await resolveRealPlace(actorUid, spotId, {
    placeId: spot.placeId ?? null,
    locationMode: spot.locationMode,
  });

  if (spot.status !== 'deleting') {
    await spotRef.update({ status: 'deleting', updatedAt: FieldValue.serverTimestamp() });
  }

  const likesSnap = await spotRef.collection('likes').get();
  await deleteDocs(likesSnap.docs.map((d) => d.ref));

  const mediaSnap = await adminDb.collection('media').where('spotId', '==', spotId).get();
  const objectPaths = new Set<string>();
  mediaSnap.forEach((doc) => {
    const objectPath = doc.data().objectPath as string | undefined;
    if (objectPath) objectPaths.add(objectPath);
  });
  (spot.imagePaths as string[] | undefined)?.forEach((path) => objectPaths.add(path));
  await deleteDocs(mediaSnap.docs.map((d) => d.ref));
  await Promise.all(Array.from(objectPaths).map(deleteStorageObject));

  await adminDb.doc(`users/${actorUid}/spotLocations/${spotId}`).delete().catch(() => undefined);

  await spotRef.delete();

  if (realPlace) {
    await recalculateSavedPlace(actorUid, realPlace.placeScope, realPlace.placeId);
  }

  return { alreadyDeleted: false };
}
