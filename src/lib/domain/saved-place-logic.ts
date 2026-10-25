import { SavedPlace } from './types';

/**
 * Tính toán trạng thái hasVisited của SavedPlace khi có sự kiện thay đổi Spot:
 * - Khi tạo Spot mới: hasVisited luôn chuyển thành true
 * - Khi xóa Spot: kiểm tra remainingSpotsCount. Nếu > 0 thì hasVisited giữ nguyên true; nếu == 0 thì chuyển false.
 * - Cờ isBookmarked không bao giờ bị ảnh hưởng bởi việc xóa Spot.
 * - Nếu cả hasVisited == false và isBookmarked == false, bản ghi có thể được dọn dẹp hoặc đánh dấu không còn quan tâm.
 */
export function recalculateHasVisitedOnSpotDelete(
  currentRecord: SavedPlace,
  remainingSpotsCountForThisPlace: number
): {
  updatedRecord: SavedPlace;
  shouldKeepRecord: boolean;
} {
  const newHasVisited = remainingSpotsCountForThisPlace > 0;
  const updatedRecord: SavedPlace = {
    ...currentRecord,
    hasVisited: newHasVisited,
  };

  // Nếu người dùng không còn ghé (hasVisited = false) và cũng chưa từng bấm lưu/bookmark (isBookmarked = false)
  const shouldKeepRecord = updatedRecord.hasVisited || updatedRecord.isBookmarked;

  return {
    updatedRecord,
    shouldKeepRecord,
  };
}

/**
 * Cập nhật trạng thái khi người dùng nhấn Bookmark (Lưu địa điểm)
 */
export function toggleBookmarkStatus(
  currentRecord: SavedPlace | null,
  placeScope: 'shared' | 'private',
  placeId: string,
  newBookmarkState: boolean
): SavedPlace {
  if (!currentRecord) {
    return {
      placeScope,
      placeId,
      hasVisited: false,
      isBookmarked: newBookmarkState,
      lastVisitedAt: null,
    };
  }

  return {
    ...currentRecord,
    isBookmarked: newBookmarkState,
  };
}
