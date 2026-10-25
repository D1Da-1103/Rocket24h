import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/client';
import { SavedPlace, PlaceScope } from '../domain/types';
import { getSavedPlaceKey } from '../domain/schemas';

/**
 * Lấy toàn bộ danh sách địa điểm đã lưu/đã ghé của người dùng
 */
export async function fetchUserSavedPlaces(userId: string): Promise<SavedPlace[]> {
  const snap = await getDocs(collection(db, `users/${userId}/savedPlaces`));
  const list: SavedPlace[] = [];
  snap.forEach((d) => {
    list.push(d.data() as SavedPlace);
  });
  return list;
}

/**
 * Đổi trạng thái bookmark (lưu địa điểm)
 */
export async function togglePlaceBookmark(
  userId: string,
  placeScope: PlaceScope,
  placeId: string,
  newBookmarked: boolean
): Promise<void> {
  const key = getSavedPlaceKey(placeScope, placeId);
  const ref = doc(db, `users/${userId}/savedPlaces`, key);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    if (!newBookmarked && !data.hasVisited) {
      // Nếu bỏ bookmark và chưa từng ghé -> xóa bản ghi
      await deleteDoc(ref);
    } else {
      await setDoc(ref, { isBookmarked: newBookmarked }, { merge: true });
    }
  } else {
    // Tạo mới với isBookmarked = true, hasVisited = false
    await setDoc(ref, {
      placeScope,
      placeId,
      hasVisited: false,
      isBookmarked: newBookmarked,
      lastVisitedAt: null,
    });
  }
}
