import { adminAuth, adminDb, FieldValue } from '@/lib/firebase/admin';
import { getFriendshipPairId } from '@/lib/domain/schemas';
import { FriendshipAction, FriendshipState } from '@/lib/domain/types';
import { HttpError } from './errors';

const FRIEND_ACTIONS: FriendshipAction[] = ['request', 'accept', 'reject', 'cancel', 'remove'];

export function friendRequestNotificationId(pairId: string): string {
  return `friend_request_${pairId}`;
}

async function assertTargetExists(targetUid: string): Promise<void> {
  const profile = await adminDb.doc(`users/${targetUid}`).get();
  if (profile.exists) return;

  try {
    await adminAuth.getUser(targetUid);
  } catch {
    throw new HttpError('Tài khoản người dùng không tồn tại', 404);
  }
}

/**
 * Xử lý toàn bộ vòng đời quan hệ bạn bè trên server:
 * - friendships/{pairId} và hai bảng tra cứu users/{uid}/friends luôn đổi trong cùng transaction
 * - pairId xác định nên không thể tạo bản ghi trùng
 * - client không bao giờ ghi trực tiếp các tài liệu này
 */
export async function applyFriendAction(
  actorUid: string,
  targetUid: string,
  action: FriendshipAction
): Promise<FriendshipState> {
  if (!FRIEND_ACTIONS.includes(action)) {
    throw new HttpError('Hành động kết bạn không hợp lệ', 400);
  }
  if (!targetUid || actorUid === targetUid) {
    throw new HttpError('Không thể kết bạn với chính mình', 400);
  }
  if (action === 'request') {
    await assertTargetExists(targetUid);
  }

  const pairId = getFriendshipPairId(actorUid, targetUid);
  const pairRef = adminDb.doc(`friendships/${pairId}`);
  const actorLookupRef = adminDb.doc(`users/${actorUid}/friends/${targetUid}`);
  const targetLookupRef = adminDb.doc(`users/${targetUid}/friends/${actorUid}`);

  return adminDb.runTransaction(async (tx) => {
    // Mọi lượt đọc phải hoàn tất trước khi ghi trong transaction.
    const pairSnap = await tx.get(pairRef);
    const pair = pairSnap.exists ? pairSnap.data() : null;

    const receiverUid = pair ? (pair.receiverId as string) : targetUid;
    const notificationRef = adminDb.doc(
      `users/${receiverUid}/notifications/${friendRequestNotificationId(pairId)}`
    );
    const notificationSnap = await tx.get(notificationRef);

    const currentState = (): FriendshipState => {
      if (!pair) return 'none';
      if (pair.status === 'accepted') return 'accepted';
      return pair.senderId === actorUid ? 'pending_sent' : 'pending_received';
    };

    if (action === 'request') {
      if (pair) {
        if (pair.status === 'pending' && pair.receiverId === actorUid) {
          // Đã có lời mời của đối phương: trả trạng thái hiện tại, không tạo trùng.
          return 'pending_received';
        }
        return currentState();
      }

      tx.set(pairRef, {
        senderId: actorUid,
        receiverId: targetUid,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (!notificationSnap.exists) {
        tx.set(notificationRef, {
          type: 'friend_request',
          actorId: actorUid,
          targetId: pairId,
          isRead: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      return 'pending_sent';
    }

    if (!pair) {
      throw new HttpError('Lời mời kết bạn không còn tồn tại', 404);
    }

    if (action === 'accept') {
      if (pair.status === 'accepted') return 'accepted';
      if (pair.receiverId !== actorUid) {
        throw new HttpError('Chỉ người nhận mới có thể chấp nhận lời mời', 403);
      }

      tx.update(pairRef, {
        status: 'accepted',
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(actorLookupRef, {
        friendUid: targetUid,
        acceptedAt: FieldValue.serverTimestamp(),
      });
      tx.set(targetLookupRef, {
        friendUid: actorUid,
        acceptedAt: FieldValue.serverTimestamp(),
      });
      if (notificationSnap.exists) {
        tx.update(notificationRef, { isRead: true });
      }
      return 'accepted';
    }

    if (action === 'reject') {
      if (pair.receiverId !== actorUid) {
        throw new HttpError('Chỉ người nhận mới có thể từ chối lời mời', 403);
      }
      if (pair.status === 'accepted') {
        throw new HttpError('Hai bạn đã là bạn bè, hãy dùng thao tác hủy kết bạn', 409);
      }
      tx.delete(pairRef);
      if (notificationSnap.exists) tx.delete(notificationRef);
      return 'none';
    }

    if (action === 'cancel') {
      if (pair.senderId !== actorUid) {
        throw new HttpError('Chỉ người gửi mới có thể hủy lời mời', 403);
      }
      if (pair.status === 'accepted') {
        throw new HttpError('Hai bạn đã là bạn bè, hãy dùng thao tác hủy kết bạn', 409);
      }
      tx.delete(pairRef);
      if (notificationSnap.exists) tx.delete(notificationRef);
      return 'none';
    }

    // remove
    if (pair.status !== 'accepted') {
      throw new HttpError('Hai bạn chưa phải bạn bè', 409);
    }
    if (pair.senderId !== actorUid && pair.receiverId !== actorUid) {
      throw new HttpError('Bạn không thuộc quan hệ này', 403);
    }
    tx.delete(pairRef);
    tx.delete(actorLookupRef);
    tx.delete(targetLookupRef);
    return 'none';
  });
}
