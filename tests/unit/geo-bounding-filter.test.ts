import { describe, it, expect } from 'vitest';
import {
  calculateDistanceMeters,
  filterAndSortPlacesByDistance,
  getGeohash,
  getQueryBounds,
} from '../../src/lib/geo';
import { Place } from '../../src/lib/domain/types';

describe('Geo Bounding and Distance Calculation', () => {
  const centerHanoi = { latitude: 21.028511, longitude: 105.854444 }; // Hồ Hoàn Kiếm

  it('tạo geohash chuẩn WGS84', () => {
    const hash = getGeohash(centerHanoi.latitude, centerHanoi.longitude, 9);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(9);
    expect(hash.startsWith('w7e')).toBe(true);
  });

  it('trả về các khoảng query bounds cho bán kính tìm kiếm', () => {
    const bounds = getQueryBounds(centerHanoi, 150);
    expect(bounds.length).toBeGreaterThan(0);
    for (const b of bounds) {
      expect(b.length).toBe(2);
      expect(b[0] <= b[1]).toBe(true);
    }
  });

  it('tính chính xác khoảng cách giữa 2 điểm', () => {
    // Điểm cách Hồ Gươm khoảng 350m
    const kemTrangTien = { latitude: 21.025345, longitude: 105.854812 };
    const dist = calculateDistanceMeters(centerHanoi, kemTrangTien);
    expect(dist).toBeGreaterThan(300);
    expect(dist).toBeLessThan(400);
  });

  it('lọc bỏ các điểm nằm ngoài bán kính và loại trừ trùng lặp ID', () => {
    const mockPlaces: Place[] = [
      {
        id: 'place_near_100m',
        name: 'Quán Gần 100m',
        nameNormalized: 'quan gan 100m',
        category: 'cafe',
        address: 'Hà Nội',
        latitude: 21.029,
        longitude: 105.854,
        geohash: getGeohash(21.029, 105.854),
        createdBy: 'user1',
        createdAt: null,
      },
      {
        id: 'place_far_1000m',
        name: 'Quán Xa 1000m',
        nameNormalized: 'quan xa 1000m',
        category: 'cafe',
        address: 'Hà Nội',
        latitude: 21.0375,
        longitude: 105.854,
        geohash: getGeohash(21.0375, 105.854),
        createdBy: 'user1',
        createdAt: null,
      },
      // Bản ghi trùng ID (giả lập trường hợp multi-query bounds trả về cùng 1 document)
      {
        id: 'place_near_100m',
        name: 'Quán Gần 100m (Trùng)',
        nameNormalized: 'quan gan 100m',
        category: 'cafe',
        address: 'Hà Nội',
        latitude: 21.029,
        longitude: 105.854,
        geohash: getGeohash(21.029, 105.854),
        createdBy: 'user1',
        createdAt: null,
      },
    ];

    const filtered = filterAndSortPlacesByDistance(mockPlaces, centerHanoi, 200);

    // Chỉ còn 1 phần tử (vì quán 1000m bị loại do > 200m, bản ghi trùng ID bị loại)
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('place_near_100m');
    expect(filtered[0].distanceMeters).toBeLessThanOrEqual(200);
  });

  it('ưu tiên hiển thị địa điểm nằm trong lịch sử ghé của người dùng', () => {
    const mockPlaces: Place[] = [
      {
        id: 'place_closer_no_visit',
        name: 'Quán Gần 50m (Chưa ghé)',
        nameNormalized: 'quan gan',
        category: 'cafe',
        address: 'Hà Nội',
        latitude: 21.0286,
        longitude: 105.8545,
        geohash: 'abc',
        createdBy: 'user1',
        createdAt: null,
      },
      {
        id: 'place_visited',
        name: 'Quán Thân Quen 120m (Đã từng ghé)',
        nameNormalized: 'quan than quen',
        category: 'cafe',
        address: 'Hà Nội',
        latitude: 21.0295,
        longitude: 105.8545,
        geohash: 'xyz',
        createdBy: 'user1',
        createdAt: null,
      },
    ];

    const visitedSet = new Set(['place_visited']);
    const sorted = filterAndSortPlacesByDistance(mockPlaces, centerHanoi, 200, visitedSet);

    // place_visited được ưu tiên lên đầu dù khoảng cách 120m > 50m
    expect(sorted[0].id).toBe('place_visited');
    expect(sorted[1].id).toBe('place_closer_no_visit');
  });
});
