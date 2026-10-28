import type { Spot } from './types';

export type SpotAccessFields = Pick<Spot, 'authorId' | 'visibility'> & {
  status?: 'active' | 'deleting';
};

/**
 * Quy tắc đọc Spot dùng chung cho client/server:
 * - tác giả luôn đọc được
 * - public: mọi người dùng đã đăng nhập
 * - friends: chỉ khi có quan hệ bạn bè đã chấp nhận
 * - Spot đang ở trạng thái deleting thì không ai đọc được
 */
export function canViewSpot(
  spot: SpotAccessFields,
  viewerUid: string | null | undefined,
  areFriends: boolean
): boolean {
  if (!viewerUid) return false;
  if (spot.status === 'deleting') return false;
  if (spot.authorId === viewerUid) return true;
  if (spot.visibility === 'public') return true;
  if (spot.visibility === 'friends') return areFriends;
  return false;
}
