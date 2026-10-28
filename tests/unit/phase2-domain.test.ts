import { describe, it, expect } from 'vitest';
import { mergeUniqueSorted, takePage, timestampToMillis } from '../../src/lib/domain/feed-merge';
import {
  DEFAULT_SPOT_FILTERS,
  hasActiveFilters,
  matchesSpotFilters,
} from '../../src/lib/domain/spot-filters';
import { canViewSpot } from '../../src/lib/domain/spot-access';
import { Spot } from '../../src/lib/domain/types';

function makeSpot(overrides: Partial<Spot> & Pick<Spot, 'id'>): Spot {
  return {
    authorId: 'uid_alice',
    placeId: 'place_1',
    locationMode: 'exact',
    imagePaths: ['spots/uid_alice/spot/photo_1.jpg'],
    category: 'cafe',
    priceVnd: null,
    rating: null,
    caption: '',
    visibility: 'public',
    visitedAt: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('Feed merge & pagination', () => {
  it('loại trùng theo spotId khi nhiều nguồn trả cùng một bài', () => {
    const merged = mergeUniqueSorted([
      [makeSpot({ id: 'spot_a', createdAt: 100 }), makeSpot({ id: 'spot_b', createdAt: 200 })],
      [makeSpot({ id: 'spot_b', createdAt: 200 })],
    ]);

    expect(merged.map((s) => s.id)).toEqual(['spot_b', 'spot_a']);
  });

  it('sắp xếp mới nhất trước và ổn định khi trùng thời điểm', () => {
    const merged = mergeUniqueSorted([
      [
        makeSpot({ id: 'spot_a', createdAt: 100 }),
        makeSpot({ id: 'spot_c', createdAt: 300 }),
        makeSpot({ id: 'spot_b', createdAt: 300 }),
      ],
    ]);

    expect(merged.map((s) => s.id)).toEqual(['spot_c', 'spot_b', 'spot_a']);
  });

  it('cắt đúng trang và giữ phần dư cho lần tải sau', () => {
    const sorted = [1, 2, 3, 4, 5];
    const { page, rest } = takePage(sorted, 2);

    expect(page).toEqual([1, 2]);
    expect(rest).toEqual([3, 4, 5]);
  });

  it('quy đổi được Timestamp, Date, số, chuỗi và giá trị rỗng', () => {
    expect(timestampToMillis(new Date(1000))).toBe(1000);
    expect(timestampToMillis(2000)).toBe(2000);
    expect(timestampToMillis({ seconds: 3 })).toBe(3000);
    expect(timestampToMillis('1970-01-01T00:00:04.000Z')).toBe(4000);
    expect(timestampToMillis(null)).toBe(0);
  });
});

describe('Spot filters', () => {
  const filters = (overrides: Partial<typeof DEFAULT_SPOT_FILTERS> = {}) => ({
    ...DEFAULT_SPOT_FILTERS,
    ...overrides,
  });

  it('tìm theo tiền tố tên Place không phân biệt dấu', () => {
    const spot = makeSpot({ id: 's1', caption: '' });
    expect(matchesSpotFilters(spot, 'cà phê giảng', filters({ searchTerm: 'CA PHE' }))).toBe(
      true
    );
    expect(matchesSpotFilters(spot, 'cà phê giảng', filters({ searchTerm: 'giang' }))).toBe(
      false
    );
  });

  it('tìm từ khóa trong chú thích', () => {
    const spot = makeSpot({ id: 's1', caption: 'Cà phê trứng béo ngậy' });
    expect(matchesSpotFilters(spot, 'quán khác', filters({ searchTerm: 'trung beo' }))).toBe(
      true
    );
  });

  it('giá và đánh giá phải cùng thỏa trên một Spot', () => {
    const cheapLowRating = makeSpot({ id: 's1', priceVnd: 30000, rating: 2 });
    const priceyHighRating = makeSpot({ id: 's2', priceVnd: 200000, rating: 5 });

    const combined = filters({ price: 'under50', minRating: 4 });
    expect(matchesSpotFilters(cheapLowRating, null, combined)).toBe(false);
    expect(matchesSpotFilters(priceyHighRating, null, combined)).toBe(false);

    const matching = makeSpot({ id: 's3', priceVnd: 30000, rating: 5 });
    expect(matchesSpotFilters(matching, null, combined)).toBe(true);
  });

  it('phân biệt giá null (chưa nhập) với 0 (miễn phí)', () => {
    const unknownPrice = makeSpot({ id: 's1', priceVnd: null });
    const free = makeSpot({ id: 's2', priceVnd: 0 });

    expect(matchesSpotFilters(unknownPrice, null, filters({ price: 'free' }))).toBe(false);
    expect(matchesSpotFilters(free, null, filters({ price: 'free' }))).toBe(true);
    expect(matchesSpotFilters(unknownPrice, null, filters({ price: 'any' }))).toBe(true);
  });

  it('lọc theo danh mục và nhận biết bộ lọc đang bật', () => {
    const spot = makeSpot({ id: 's1', category: 'restaurant' });
    expect(matchesSpotFilters(spot, null, filters({ category: 'cafe' }))).toBe(false);
    expect(hasActiveFilters(filters())).toBe(false);
    expect(hasActiveFilters(filters({ searchTerm: '  ' }))).toBe(false);
    expect(hasActiveFilters(filters({ minRating: 4 }))).toBe(true);
  });
});

describe('Spot access matrix', () => {
  const base = {
    authorId: 'uid_alice',
    visibility: 'public' as const,
  };

  it('tác giả luôn đọc được bài của mình', () => {
    expect(canViewSpot(base, 'uid_alice', false)).toBe(true);
    expect(canViewSpot({ ...base, visibility: 'private' }, 'uid_alice', false)).toBe(true);
  });

  it('bài public cho mọi người dùng đã đăng nhập', () => {
    expect(canViewSpot(base, 'uid_charlie', false)).toBe(true);
  });

  it('bài friends chỉ cho bạn bè đã chấp nhận', () => {
    const spot = { ...base, visibility: 'friends' as const };
    expect(canViewSpot(spot, 'uid_bob', true)).toBe(true);
    expect(canViewSpot(spot, 'uid_charlie', false)).toBe(false);
  });

  it('bài private và bài đang xóa thì không ai ngoài tác giả đọc được', () => {
    expect(canViewSpot({ ...base, visibility: 'private' }, 'uid_bob', true)).toBe(false);
    expect(canViewSpot({ ...base, status: 'deleting' }, 'uid_alice', true)).toBe(false);
  });

  it('khách chưa đăng nhập không đọc được bài nào', () => {
    expect(canViewSpot(base, null, true)).toBe(false);
    expect(canViewSpot(base, undefined, true)).toBe(false);
  });
});
