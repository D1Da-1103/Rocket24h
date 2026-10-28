import { TimestampLike } from './types';

export interface FeedSortable {
  id: string;
  createdAt: TimestampLike;
}

/**
 * Quy đổi TimestampLike (Firestore Timestamp, Date, số, chuỗi) sang mili-giây.
 * Trả về 0 cho giá trị chưa xác định để thứ tự vẫn ổn định.
 */
export function timestampToMillis(value: TimestampLike): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === 'function') {
      return toDate.call(value).getTime();
    }
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = (value as { seconds?: number }).seconds;
    return typeof seconds === 'number' ? seconds * 1000 : 0;
  }
  return 0;
}

/**
 * Gộp nhiều nguồn Spot thành một danh sách duy nhất:
 * - loại trùng theo spotId
 * - sắp xếp createdAt giảm dần, cùng thời điểm thì id giảm dần (ổn định)
 */
export function mergeUniqueSorted<T extends FeedSortable>(batches: T[][]): T[] {
  const byId = new Map<string, T>();
  for (const batch of batches) {
    for (const item of batch) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const byTime = timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt);
    if (byTime !== 0) return byTime;
    return b.id.localeCompare(a.id);
  });
}

/**
 * Lấy tối đa pageSize phần tử đầu tiên và phần còn lại.
 */
export function takePage<T>(sorted: T[], pageSize: number): { page: T[]; rest: T[] } {
  const size = Math.max(0, Math.floor(pageSize));
  return {
    page: sorted.slice(0, size),
    rest: sorted.slice(size),
  };
}
