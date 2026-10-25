import { describe, it, expect } from 'vitest';
import {
  recalculateHasVisitedOnSpotDelete,
  toggleBookmarkStatus,
} from '../../src/lib/domain/saved-place-logic';
import { SavedPlace } from '../../src/lib/domain/types';

describe('Saved Place hasVisited & isBookmarked Recalculation', () => {
  it('giữ nguyên hasVisited = true nếu vẫn còn các Spot khác tại cùng Place', () => {
    const existing: SavedPlace = {
      placeScope: 'shared',
      placeId: 'place_pho_10',
      hasVisited: true,
      isBookmarked: false,
      lastVisitedAt: new Date(),
    };

    const { updatedRecord, shouldKeepRecord } = recalculateHasVisitedOnSpotDelete(existing, 2); // còn 2 spot
    expect(updatedRecord.hasVisited).toBe(true);
    expect(shouldKeepRecord).toBe(true);
  });

  it('chuyển hasVisited = false nếu đã xóa Spot cuối cùng tại Place', () => {
    const existing: SavedPlace = {
      placeScope: 'shared',
      placeId: 'place_pho_10',
      hasVisited: true,
      isBookmarked: true, // Vẫn đang bookmark
      lastVisitedAt: new Date(),
    };

    const { updatedRecord, shouldKeepRecord } = recalculateHasVisitedOnSpotDelete(existing, 0); // còn 0 spot
    expect(updatedRecord.hasVisited).toBe(false);
    expect(updatedRecord.isBookmarked).toBe(true); // Cờ bookmark không bị thay đổi
    expect(shouldKeepRecord).toBe(true); // Vẫn giữ bản ghi vì isBookmarked = true
  });

  it('báo shouldKeepRecord = false nếu cả hasVisited = false và isBookmarked = false', () => {
    const existing: SavedPlace = {
      placeScope: 'shared',
      placeId: 'place_pho_10',
      hasVisited: true,
      isBookmarked: false, // Không bookmark
      lastVisitedAt: new Date(),
    };

    const { updatedRecord, shouldKeepRecord } = recalculateHasVisitedOnSpotDelete(existing, 0);
    expect(updatedRecord.hasVisited).toBe(false);
    expect(shouldKeepRecord).toBe(false); // Không còn liên quan -> có thể xóa
  });

  it('bật và tắt bookmark không làm ảnh hưởng đến hasVisited', () => {
    // 1. Tạo mới bookmark khi chưa từng ghé
    const bookmarked = toggleBookmarkStatus(null, 'shared', 'place_pho_10', true);
    expect(bookmarked.isBookmarked).toBe(true);
    expect(bookmarked.hasVisited).toBe(false);

    // 2. Thêm cờ đã ghé (hasVisited = true)
    const visited = { ...bookmarked, hasVisited: true };

    // 3. Người dùng hủy bookmark (isBookmarked = false)
    const unbookmarked = toggleBookmarkStatus(visited, 'shared', 'place_pho_10', false);
    expect(unbookmarked.isBookmarked).toBe(false);
    expect(unbookmarked.hasVisited).toBe(true); // Vẫn giữ hasVisited = true!
  });
});
