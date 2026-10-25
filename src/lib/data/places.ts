import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  startAt,
  endAt,
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
      const privateSnap = await getDocs(collection(db, `users/${currentUid}/privatePlaces`));
      privateSnap.forEach((d) => {
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
          createdBy: currentUid,
          createdAt: null,
          isPrivate: true,
        });
      });
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
 * Lấy thông tin một địa điểm theo ID (kiểm tra cả shared và private)
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
 * Tạo địa điểm mới (Shared hoặc Private)
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
    await setDoc(doc(db, `users/${currentUid}/privatePlaces`, placeId), privPlace);
    return {
      ...privPlace,
      createdBy: currentUid,
      createdAt: null,
      isPrivate: true,
    };
  } else {
    const sharedPlace: Place = {
      id: placeId,
      name: data.name,
      nameNormalized,
      category: data.category,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      geohash,
      createdBy: currentUid,
      createdAt: serverTimestamp(),
      isPrivate: false,
    };
    await setDoc(doc(db, 'places', placeId), sharedPlace);
    return sharedPlace;
  }
}
