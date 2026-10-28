import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  startAt,
  endAt,
  limit,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { Place, PrivatePlace } from '../domain/types';
import { GeoPoint, PlaceWithDistance, filterAndSortPlacesByDistance, getGeohash, getQueryBounds } from '../geo';
import { normalizeVietnamese } from '../domain/schemas';

/**
 * Truy vấn các địa điểm gần tọa độ chỉ định (cả dùng chung và riêng tư của user)
 */
export async function fetchNearbyPlaces(
  center: GeoPoint,
  radiusMeters: number,
  currentUid?: string,
  userVisitedPlaceIds?: Set<string>
): Promise<{ places: PlaceWithDistance[]; isPartial: boolean }> {
  const bounds = getQueryBounds(center, radiusMeters);
  const placesMap = new Map<string, Place>();
  let hasQueryError = false;

  // 1. Truy vấn các Place dùng chung (shared places)
  for (const b of bounds) {
    try {
      const q = query(
        collection(db, 'places'),
        orderBy('geohash'),
        startAt(b[0]),
        endAt(b[1])
      );
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const data = d.data();
        placesMap.set(d.id, {
          id: d.id,
          name: data.name,
          nameNormalized: data.nameNormalized,
          category: data.category,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          geohash: data.geohash,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          isPrivate: false,
        });
      });
    } catch (err) {
      console.warn('Lỗi khi truy vấn một khoảng geohash:', err);
      hasQueryError = true;
    }
  }

  // 2. Truy vấn các Place riêng tư của chính user (nếu có currentUid)
  if (currentUid) {
    try {
      const privatePlaces = await fetchUserPrivatePlaces(currentUid);
      privatePlaces.forEach((place) => placesMap.set(place.id, place));
    } catch (err) {
      console.warn('Lỗi khi tải privatePlaces của người dùng:', err);
      hasQueryError = true;
    }
  }

  const rawPlaces = Array.from(placesMap.values());
  const sorted = filterAndSortPlacesByDistance(rawPlaces, center, radiusMeters, userVisitedPlaceIds);

  return {
    places: sorted,
    isPartial: hasQueryError,
  };
}

/**
 * Lấy toàn bộ Place riêng tư của chủ tài khoản.
 */
export async function fetchUserPrivatePlaces(uid: string): Promise<Place[]> {
  const snap = await getDocs(collection(db, `users/${uid}/privatePlaces`));
  const list: Place[] = [];
  snap.forEach((d) => {
    const data = d.data();
    list.push({
      id: d.id,
      name: data.name,
      nameNormalized: data.nameNormalized,
      category: data.category,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      geohash: data.geohash,
      createdBy: uid,
      createdAt: null,
      isPrivate: true,
    });
  });
  return list;
}

/**
 * Lấy thông tin một địa điểm theo ID.
 * Place riêng chỉ đọc được khi currentUid chính là chủ tài khoản.
 */
export async function getPlaceById(
  placeId: string,
  currentUid?: string
): Promise<Place | null> {
  // Thử tìm trong places dùng chung
  const sharedRef = doc(db, 'places', placeId);
  const sharedSnap = await getDoc(sharedRef);

  if (sharedSnap.exists()) {
    const data = sharedSnap.data();
    return {
      id: sharedSnap.id,
      name: data.name,
      nameNormalized: data.nameNormalized,
      category: data.category,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      geohash: data.geohash,
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      isPrivate: false,
    };
  }

  // Nếu không có, thử tìm trong privatePlaces của chính user
  if (currentUid) {
    const privRef = doc(db, `users/${currentUid}/privatePlaces`, placeId);
    const privSnap = await getDoc(privRef);
    if (privSnap.exists()) {
      const data = privSnap.data();
      return {
        id: privSnap.id,
        name: data.name,
        nameNormalized: data.nameNormalized,
        category: data.category,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        geohash: data.geohash,
        createdBy: currentUid,
        createdAt: null,
        isPrivate: true,
      };
    }
  }

  return null;
}

/**
 * Tải nhiều Place theo ID trong một lượt (Place dùng chung + privatePlaces của
 * chính người xem). Dùng cho bản đồ cá nhân và feed để tránh N+1.
 */
export async function fetchPlacesByIds(
  placeIds: string[],
  currentUid?: string
): Promise<Map<string, Place>> {
  const unique = Array.from(new Set(placeIds.filter(Boolean)));
  const result = new Map<string, Place>();

  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    if (chunk.length === 0) continue;

    const sharedSnap = await getDocs(
      query(collection(db, 'places'), where(documentId(), 'in', chunk))
    );
    sharedSnap.forEach((d) => {
      const data = d.data();
      result.set(d.id, {
        id: d.id,
        name: data.name,
        nameNormalized: data.nameNormalized,
        category: data.category,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        geohash: data.geohash,
        createdBy: data.createdBy,
        createdAt: data.createdAt,
        isPrivate: false,
      });
    });
  }

  if (currentUid) {
    const missing = unique.filter((id) => !result.has(id));
    for (let i = 0; i < missing.length; i += 10) {
      const chunk = missing.slice(i, i + 10);
      if (chunk.length === 0) continue;
      const privSnap = await getDocs(
        query(
          collection(db, `users/${currentUid}/privatePlaces`),
          where(documentId(), 'in', chunk)
        )
      );
      privSnap.forEach((d) => {
        const data = d.data();
        result.set(d.id, {
          id: d.id,
          name: data.name,
          nameNormalized: data.nameNormalized,
          category: data.category,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          geohash: data.geohash,
          createdBy: currentUid,
          createdAt: null,
          isPrivate: true,
        });
      });
    }
  }

  return result;
}

/**
 * Tìm Place dùng chung theo tiền tố tên đã chuẩn hóa (bỏ dấu, lowercase).
 * Dùng cho tìm kiếm cơ bản; không tải cả collection.
 */export async function searchSharedPlacesByPrefix(
  term: string,
  maxResults: number = 10
): Promise<Place[]> {
  const normalized = normalizeVietnamese(term);
  if (!normalized) return [];

  const q = query(
    collection(db, 'places'),
    where('nameNormalized', '>=', normalized),
    where('nameNormalized', '<=', normalized + '\uf8ff'),
    orderBy('nameNormalized'),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      nameNormalized: data.nameNormalized,
      category: data.category,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      geohash: data.geohash,
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      isPrivate: false,
    };
  });
}

/**
 * Tạo địa điểm mới (Shared hoặc Private).
 * Chỉ ghi đúng các field thuộc schema; id là khóa tài liệu nên không nằm trong dữ liệu.
 */
export async function createPlace(
  data: {
    name: string;
    category: string;
    address: string;
    latitude: number;
    longitude: number;
    isPrivate: boolean;
  },
  currentUid: string
): Promise<Place> {
  const geohash = getGeohash(data.latitude, data.longitude);
  const nameNormalized = normalizeVietnamese(data.name);
  const placeId = 'place_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

  if (data.isPrivate) {
    const privPlace: PrivatePlace = {
      id: placeId,
      name: data.name,
      nameNormalized,
      category: data.category,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      geohash,
    };
    await setDoc(doc(db, `users/${currentUid}/privatePlaces`, placeId), {
      name: privPlace.name,
      nameNormalized: privPlace.nameNormalized,
      category: privPlace.category,
      address: privPlace.address,
      latitude: privPlace.latitude,
      longitude: privPlace.longitude,
      geohash: privPlace.geohash,
    });
    return {
      ...privPlace,
      createdBy: currentUid,
      createdAt: null,
      isPrivate: true,
    };
  }

  await setDoc(doc(db, 'places', placeId), {
    name: data.name,
    nameNormalized,
    category: data.category,
    address: data.address,
    latitude: data.latitude,
    longitude: data.longitude,
    geohash,
    createdBy: currentUid,
    createdAt: serverTimestamp(),
  });

  return {
    id: placeId,
    name: data.name,
    nameNormalized,
    category: data.category,
    address: data.address,
    latitude: data.latitude,
    longitude: data.longitude,
    geohash,
    createdBy: currentUid,
    createdAt: new Date(),
    isPrivate: false,
  };
}
