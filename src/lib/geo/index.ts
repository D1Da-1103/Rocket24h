import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';
import { Place } from '../domain/types';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface PlaceWithDistance extends Place {
  distanceMeters: number;
}

/**
 * Sinh chuỗi geohash từ tọa độ vĩ độ và kinh độ
 */
export function getGeohash(latitude: number, longitude: number, precision: number = 9): string {
  const hash = geofireForLocationWrapper(latitude, longitude);
  return hash.slice(0, precision);
}

function geofireForLocationWrapper(latitude: number, longitude: number): string {
  return geohashForLocation([latitude, longitude]);
}

/**
 * Lấy các khoảng geohash (bounds) để truy vấn Firestore
 * @param center Tọa độ trung tâm
 * @param radiusInMeters Bán kính tìm kiếm (mét)
 */
export function getQueryBounds(center: GeoPoint, radiusInMeters: number): string[][] {
  const centerLocation: [number, number] = [center.latitude, center.longitude];
  return geohashQueryBounds(centerLocation, radiusInMeters);
}

/**
 * Tính khoảng cách đường chim bay giữa 2 tọa độ WGS84 (đơn vị: mét)
 */
export function calculateDistanceMeters(p1: GeoPoint, p2: GeoPoint): number {
  const loc1: [number, number] = [p1.latitude, p1.longitude];
  const loc2: [number, number] = [p2.latitude, p2.longitude];
  // distanceBetween trả về km -> nhân 1000 ra mét
  const distanceKm = distanceBetween(loc1, loc2);
  return Math.round(distanceKm * 1000);
}

/**
 * Lọc và sắp xếp các Place theo khoảng cách thực tế (loại bỏ điểm ngoài bán kính và trùng lặp)
 */
export function filterAndSortPlacesByDistance(
  places: Place[],
  center: GeoPoint,
  radiusInMeters: number,
  userVisitedPlaceIds?: Set<string>
): PlaceWithDistance[] {
  const placeMap = new Map<string, PlaceWithDistance>();

  for (const place of places) {
    if (!placeMap.has(place.id)) {
      const dist = calculateDistanceMeters(center, {
        latitude: place.latitude,
        longitude: place.longitude,
      });

      // Lọc chính xác khoảng cách
      if (dist <= radiusInMeters) {
        placeMap.set(place.id, {
          ...place,
          distanceMeters: dist,
        });
      }
    }
  }

  const results = Array.from(placeMap.values());

  // Sắp xếp: Ưu tiên địa điểm từng ghé của user, sau đó theo khoảng cách tăng dần
  results.sort((a, b) => {
    const aVisited = userVisitedPlaceIds?.has(a.id) ? 1 : 0;
    const bVisited = userVisitedPlaceIds?.has(b.id) ? 1 : 0;
    if (aVisited !== bVisited) {
      return bVisited - aVisited;
    }
    return a.distanceMeters - b.distanceMeters;
  });

  return results;
}
