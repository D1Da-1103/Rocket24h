import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAt,
  endAt,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { authedFetch, readApiError } from './api';
import { Friendship, FriendshipAction, FriendshipState } from '../domain/types';
import { getFriendshipPairId } from '../domain/schemas';
import { fetchProfilesByUids, ProfileSearchResult } from './users';

export interface FriendEntry extends ProfileSearchResult {
  acceptedAt: Friendship['createdAt'];
}

export interface FriendRequestEntry {
  pairId: string;
  senderId: string;
  receiverId: string;
  createdAt: Friendship['createdAt'];
  profile: ProfileSearchResult | null;
}

/**
 * Danh sách bạn bè từ bảng tra cứu server-only users/{uid}/friends.
 */
export async function fetchFriends(uid: string): Promise<FriendEntry[]> {
  const snap = await getDocs(collection(db, `users/${uid}/friends`));
  const friendUids = snap.docs.map((d) => d.id);
  const profiles = await fetchProfilesByUids(friendUids);

  return snap.docs.map((d) => {
    const data = d.data();
    const profile = profiles.get(d.id);
    return {
      uid: d.id,
      displayName: profile?.displayName || 'Thành viên',
      avatarPath: profile?.avatarPath || null,
      acceptedAt: data.acceptedAt as Friendship['createdAt'],
    };
  });
}

export async function fetchFriendUids(uid: string): Promise<string[]> {
  const snap = await getDocs(collection(db, `users/${uid}/friends`));
  return snap.docs.map((d) => d.id);
}

function mapFriendship(id: string, data: Record<string, unknown>): Friendship {
  return {
    pairId: id,
    senderId: data.senderId as string,
    receiverId: data.receiverId as string,
    status: data.status as Friendship['status'],
    createdAt: data.createdAt as Friendship['createdAt'],
    updatedAt: data.updatedAt as Friendship['updatedAt'],
  };
}

export async function fetchFriendship(
  myUid: string,
  otherUid: string
): Promise<Friendship | null> {
  if (myUid === otherUid) return null;
  const pairId = getFriendshipPairId(myUid, otherUid);
  const snap = await getDoc(doc(db, 'friendships', pairId));
  return snap.exists() ? mapFriendship(snap.id, snap.data()) : null;
}

export function deriveFriendshipState(
  friendship: Friendship | null,
  myUid: string
): FriendshipState {
  if (!friendship) return 'none';
  if (friendship.status === 'accepted') return 'accepted';
  return friendship.senderId === myUid ? 'pending_sent' : 'pending_received';
}

/**
 * Lời mời kết bạn đang chờ mà mình là người nhận.
 * Truy vấn theo receiverId (index đơn) rồi lọc status ở client trong tập nhỏ.
 */
export async function fetchIncomingRequests(
  uid: string
): Promise<FriendRequestEntry[]> {
  const snap = await getDocs(
    query(collection(db, 'friendships'), where('receiverId', '==', uid))
  );

  const pending: Friendship[] = [];
  snap.forEach((d) => {
    const friendship = mapFriendship(d.id, d.data());
    if (friendship.status === 'pending') pending.push(friendship);
  });

  const profiles = await fetchProfilesByUids(pending.map((f) => f.senderId));
  return pending.map((f) => {
    const profile = profiles.get(f.senderId);
    return {
      pairId: f.pairId,
      senderId: f.senderId,
      receiverId: f.receiverId,
      createdAt: f.createdAt,
      profile: profile
        ? { uid: profile.uid, displayName: profile.displayName, avatarPath: profile.avatarPath }
        : null,
    };
  });
}

export async function fetchOutgoingRequests(
  uid: string
): Promise<FriendRequestEntry[]> {
  const snap = await getDocs(
    query(collection(db, 'friendships'), where('senderId', '==', uid))
  );

  const pending: Friendship[] = [];
  snap.forEach((d) => {
    const friendship = mapFriendship(d.id, d.data());
    if (friendship.status === 'pending') pending.push(friendship);
  });

  const profiles = await fetchProfilesByUids(pending.map((f) => f.receiverId));
  return pending.map((f) => {
    const profile = profiles.get(f.receiverId);
    return {
      pairId: f.pairId,
      senderId: f.senderId,
      receiverId: f.receiverId,
      createdAt: f.createdAt,
      profile: profile
        ? { uid: profile.uid, displayName: profile.displayName, avatarPath: profile.avatarPath }
        : null,
    };
  });
}

export interface FriendActionResult {
  state: FriendshipState;
}

/**
 * Mọi thay đổi quan hệ đi qua Route Handler để ghi friendships + hai bảng tra cứu
 * trong cùng transaction. Client không tự ghi users/{uid}/friends.
 */
export async function submitFriendAction(
  targetUid: string,
  action: FriendshipAction
): Promise<FriendActionResult> {
  const res = await authedFetch('/api/friends', {
    method: 'POST',
    body: JSON.stringify({ targetUid, action }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return (await res.json()) as FriendActionResult;
}

/**
 * Tìm bạn bè mới theo tên, loại trừ chính mình và những người đã có quan hệ.
 */
export async function searchNewFriends(
  term: string,
  myUid: string,
  excludedUids: Set<string>
): Promise<ProfileSearchResult[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const snap = await getDocs(
    query(
      collection(db, 'users'),
      orderBy('displayName'),
      startAt(trimmed),
      endAt(trimmed + '\uf8ff'),
      limit(20)
    )
  );
  const results: ProfileSearchResult[] = [];
  snap.forEach((d) => {
    if (d.id === myUid || excludedUids.has(d.id)) return;
    results.push({
      uid: d.id,
      displayName: (d.data().displayName as string) || 'Thành viên',
      avatarPath: (d.data().avatarPath as string | null) ?? null,
    });
  });
  return results;
}
