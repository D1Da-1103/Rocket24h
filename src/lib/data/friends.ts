import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAt,
  endAt,
  where,
  Unsubscribe,
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
 * Danh sách bạn bè từ các quan hệ mà người dùng tham gia.
 */
export async function fetchFriends(uid: string): Promise<FriendEntry[]> {
  const [sentSnap, receivedSnap] = await Promise.all([
    getDocs(query(collection(db, 'friendships'), where('senderId', '==', uid))),
    getDocs(query(collection(db, 'friendships'), where('receiverId', '==', uid))),
  ]);
  const accepted = [...sentSnap.docs, ...receivedSnap.docs]
    .map((d) => mapFriendship(d.id, d.data()))
    .filter((friendship) => friendship.status === 'accepted');
  const friendUids = accepted.map((friendship) =>
    friendship.senderId === uid ? friendship.receiverId : friendship.senderId
  );
  const profiles = await fetchProfilesByUids(friendUids);

  return accepted.map((friendship) => {
    const friendUid =
      friendship.senderId === uid ? friendship.receiverId : friendship.senderId;
    const profile = profiles.get(friendUid);
    return {
      uid: friendUid,
      displayName: profile?.displayName || 'Thành viên',
      avatarPath: profile?.avatarPath || null,
      acceptedAt: friendship.updatedAt,
    };
  });
}

export async function fetchFriendUids(uid: string): Promise<string[]> {
  const [sentSnap, receivedSnap] = await Promise.all([
    getDocs(query(collection(db, 'friendships'), where('senderId', '==', uid))),
    getDocs(query(collection(db, 'friendships'), where('receiverId', '==', uid))),
  ]);
  return [...sentSnap.docs, ...receivedSnap.docs]
    .map((d) => mapFriendship(d.id, d.data()))
    .filter((friendship) => friendship.status === 'accepted')
    .map((friendship) =>
      friendship.senderId === uid ? friendship.receiverId : friendship.senderId
    );
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

export function subscribeFriendLists(
  uid: string,
  onData: (data: {
    friends: FriendEntry[];
    incoming: FriendRequestEntry[];
    outgoing: FriendRequestEntry[];
  }) => void,
  onError: (error: Error) => void
): Unsubscribe {
  let incoming: Friendship[] = [];
  let outgoing: Friendship[] = [];
  let pendingProfiles = 0;

  const publish = async () => {
    pendingProfiles += 1;
    const version = pendingProfiles;
    try {
      const profileUids = [
        ...incoming.map((friendship) => friendship.senderId),
        ...outgoing.map((friendship) => friendship.receiverId),
      ];
      const profiles = await fetchProfilesByUids(profileUids);
      if (version !== pendingProfiles) return;

      onData({
        friends: [...incoming, ...outgoing]
          .filter((friendship) => friendship.status === 'accepted')
          .map((friendship) => {
            const friendUid =
              friendship.senderId === uid
                ? friendship.receiverId
                : friendship.senderId;
            const profile = profiles.get(friendUid);
            return {
              uid: friendUid,
              displayName: profile?.displayName || 'Thành viên',
              avatarPath: profile?.avatarPath || null,
              acceptedAt: friendship.updatedAt,
            };
          }),
        incoming: incoming
          .filter((friendship) => friendship.status === 'pending')
          .map((friendship) => ({
          pairId: friendship.pairId,
          senderId: friendship.senderId,
          receiverId: friendship.receiverId,
          createdAt: friendship.createdAt,
          profile: profiles.get(friendship.senderId)
            ? {
                uid: friendship.senderId,
                displayName: profiles.get(friendship.senderId)!.displayName,
                avatarPath: profiles.get(friendship.senderId)!.avatarPath,
              }
            : null,
          })),
        outgoing: outgoing
          .filter((friendship) => friendship.status === 'pending')
          .map((friendship) => ({
          pairId: friendship.pairId,
          senderId: friendship.senderId,
          receiverId: friendship.receiverId,
          createdAt: friendship.createdAt,
          profile: profiles.get(friendship.receiverId)
            ? {
                uid: friendship.receiverId,
                displayName: profiles.get(friendship.receiverId)!.displayName,
                avatarPath: profiles.get(friendship.receiverId)!.avatarPath,
              }
            : null,
          })),
      });
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Không tải được hồ sơ bạn bè'));
    }
  };

  const unsubscribers = [
    onSnapshot(
      query(collection(db, 'friendships'), where('receiverId', '==', uid)),
      (snap) => {
        incoming = snap.docs.map((d) => mapFriendship(d.id, d.data()));
        void publish();
      },
      onError
    ),
    onSnapshot(
      query(collection(db, 'friendships'), where('senderId', '==', uid)),
      (snap) => {
        outgoing = snap.docs.map((d) => mapFriendship(d.id, d.data()));
        void publish();
      },
      onError
    ),
  ];

  return () => {
    pendingProfiles += 1;
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
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
