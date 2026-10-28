'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import {
  fetchFriends,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  searchNewFriends,
  submitFriendAction,
  FriendEntry,
  FriendRequestEntry,
} from '@/lib/data/friends';
import { ProfileSearchResult } from '@/lib/data/users';
import { FriendshipAction } from '@/lib/domain/types';
import Avatar from '@/components/Avatar';
import {
  AlertCircle,
  Check,
  Clock,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

function PersonRow({
  uid,
  displayName,
  avatarPath,
  children,
}: {
  uid: string;
  displayName: string;
  avatarPath: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-stone-50">
      <Link href={`/users/${uid}`} className="flex items-center gap-3 min-w-0">
        <Avatar path={avatarPath} name={displayName} />
        <span className="font-semibold text-sm text-stone-800 truncate">{displayName}</span>
      </Link>
      <div className="flex items-center gap-1.5 flex-shrink-0">{children}</div>
    </div>
  );
}

export default function FriendsPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestEntry[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestEntry[]>([]);
  const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [friendList, incomingList, outgoingList] = await Promise.all([
        fetchFriends(user.uid),
        fetchIncomingRequests(user.uid),
        fetchOutgoingRequests(user.uid),
      ]);
      setFriends(friendList);
      setIncoming(incomingList);
      setOutgoing(outgoingList);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu bạn bè:', err);
      setError('Không tải được dữ liệu bạn bè. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // loadAll đặt loading ngay; chạy ở microtask để không setState đồng bộ trong effect.
    queueMicrotask(loadAll);
  }, [loadAll]);

  const knownUids = useMemo(
    () =>
      new Set([
        ...friends.map((f) => f.uid),
        ...incoming.map((r) => r.senderId),
        ...outgoing.map((r) => r.receiverId),
      ]),
    [friends, incoming, outgoing]
  );

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      setSearchResults(await searchNewFriends(searchTerm, user.uid, knownUids));
    } catch (err) {
      console.error('Lỗi tìm người dùng:', err);
      setError('Không tìm được người dùng. Vui lòng thử lại.');
    } finally {
      setSearching(false);
    }
  };

  const runAction = async (uid: string, action: FriendshipAction) => {
    const key = `${uid}:${action}`;
    setBusyKey(key);
    setError(null);
    try {
      await submitFriendAction(uid, action);
      setSearchResults((previous) => previous.filter((p) => p.uid !== uid));
      await loadAll();
    } catch (err) {
      console.error('Lỗi cập nhật quan hệ bạn bè:', err);
      setError(err instanceof Error ? err.message : 'Không thể cập nhật quan hệ bạn bè.');
    } finally {
      setBusyKey(null);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-4">
        <h2 className="text-xl font-bold text-stone-900">Yêu cầu đăng nhập</h2>
        <p className="text-sm text-stone-600">Vui lòng đăng nhập để kết nối với bạn bè.</p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-stone-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-orange-600" />
          Bạn bè
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Kết bạn để xem trải nghiệm được chia sẻ ở chế độ “Bạn bè”.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start justify-between gap-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
            <p>{error}</p>
          </div>
          <button
            onClick={loadAll}
            className="px-3 py-1.5 bg-white border border-red-300 rounded-lg text-xs font-semibold hover:bg-red-100"
          >
            Thử lại
          </button>
        </div>
      )}

      <form onSubmit={handleSearch} className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <label htmlFor="friend-search" className="text-sm font-semibold text-stone-800">
          Tìm thành viên theo tên hiển thị
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="friend-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nhập tên hiển thị..."
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !searchTerm.trim()}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {searching ? 'Đang tìm...' : 'Tìm'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <ul className="divide-y divide-stone-100 border border-stone-100 rounded-xl">
            {searchResults.map((person) => (
              <li key={person.uid}>
                <PersonRow
                  uid={person.uid}
                  displayName={person.displayName}
                  avatarPath={person.avatarPath}
                >
                  <button
                    onClick={() => runAction(person.uid, 'request')}
                    disabled={busyKey === `${person.uid}:request`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold disabled:opacity-60"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Kết bạn
                  </button>
                </PersonRow>
              </li>
            ))}
          </ul>
        )}

        {!searching && searchTerm.trim() && searchResults.length === 0 && (
          <p className="text-xs text-stone-600">
            Không tìm thấy thành viên mới phù hợp với “{searchTerm.trim()}”.
          </p>
        )}
      </form>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white border border-stone-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <h2 className="px-4 pt-4 pb-2 text-sm font-bold text-stone-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-orange-600" />
              Lời mời đang chờ ({incoming.length})
            </h2>
            {incoming.length === 0 ? (
              <p className="px-4 pb-4 text-xs text-stone-600">Không có lời mời nào.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {incoming.map((request) => (
                  <li key={request.pairId}>
                    <PersonRow
                      uid={request.senderId}
                      displayName={request.profile?.displayName || 'Thành viên'}
                      avatarPath={request.profile?.avatarPath || null}
                    >
                      <button
                        onClick={() => runAction(request.senderId, 'accept')}
                        disabled={busyKey === `${request.senderId}:accept`}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-60"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Chấp nhận
                      </button>
                      <button
                        onClick={() => runAction(request.senderId, 'reject')}
                        disabled={busyKey === `${request.senderId}:reject`}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold disabled:opacity-60"
                      >
                        <X className="w-3.5 h-3.5" />
                        Từ chối
                      </button>
                    </PersonRow>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {outgoing.length > 0 && (
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <h2 className="px-4 pt-4 pb-2 text-sm font-bold text-stone-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Lời mời đã gửi ({outgoing.length})
              </h2>
              <ul className="divide-y divide-stone-100">
                {outgoing.map((request) => (
                  <li key={request.pairId}>
                    <PersonRow
                      uid={request.receiverId}
                      displayName={request.profile?.displayName || 'Thành viên'}
                      avatarPath={request.profile?.avatarPath || null}
                    >
                      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg font-semibold">
                        Đang chờ
                      </span>
                      <button
                        onClick={() => runAction(request.receiverId, 'cancel')}
                        disabled={busyKey === `${request.receiverId}:cancel`}
                        className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold disabled:opacity-60"
                      >
                        Hủy
                      </button>
                    </PersonRow>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <h2 className="px-4 pt-4 pb-2 text-sm font-bold text-stone-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Bạn bè ({friends.length})
            </h2>
            {friends.length === 0 ? (
              <div className="px-4 pb-5 text-xs text-stone-600 space-y-1">
                <p>Bạn chưa có người bạn nào trong Rocket24h.</p>
                <p>Dùng ô tìm kiếm ở trên để gửi lời mời kết bạn đầu tiên.</p>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {friends.map((friend) => (
                  <li key={friend.uid}>
                    <PersonRow
                      uid={friend.uid}
                      displayName={friend.displayName}
                      avatarPath={friend.avatarPath}
                    >
                      <Link
                        href={`/users/${friend.uid}`}
                        className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold"
                      >
                        Trang cá nhân
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm(`Hủy kết bạn với ${friend.displayName}?`)) {
                            runAction(friend.uid, 'remove');
                          }
                        }}
                        disabled={busyKey === `${friend.uid}:remove`}
                        className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold disabled:opacity-60"
                      >
                        Hủy kết bạn
                      </button>
                    </PersonRow>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
