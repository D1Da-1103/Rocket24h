'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { fetchProfilesByUids } from '@/lib/data/users';
import {
  deriveFriendshipState,
  fetchFriendship,
  submitFriendAction,
} from '@/lib/data/friends';
import { fetchUserSpots, fetchUserSpotsForViewer } from '@/lib/data/spots';
import { fetchPlacesByIds } from '@/lib/data/places';
import { fetchLikeSummaries, LikeSummary } from '@/lib/data/likes';
import { FriendshipState, Place, Spot } from '@/lib/domain/types';
import Avatar from '@/components/Avatar';
import SpotCard from '@/components/SpotCard';
import {
  AlertCircle,
  Check,
  Clock,
  Lock,
  MapPin,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';

function UserProfileContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const targetUid = params?.uid as string;

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [friendshipState, setFriendshipState] = useState<FriendshipState>('none');
  const [spots, setSpots] = useState<Spot[]>([]);
  const [places, setPlaces] = useState<Map<string, Place>>(new Map());
  const [likes, setLikes] = useState<Map<string, LikeSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSelf = Boolean(user && user.uid === targetUid);

  const loadAll = useCallback(async () => {
    if (!targetUid) return;
    setLoading(true);
    setError(null);

    try {
      const profiles = await fetchProfilesByUids([targetUid]);
      const profile = profiles.get(targetUid);
      if (!profile) {
        setError('Tài khoản không tồn tại hoặc nội dung không còn khả dụng.');
        setLoading(false);
        return;
      }
      setDisplayName(profile.displayName);
      setAvatarPath(profile.avatarPath);

      let state: FriendshipState = 'none';
      if (user && user.uid !== targetUid) {
        try {
          const friendship = await fetchFriendship(user.uid, targetUid);
          state = deriveFriendshipState(friendship, user.uid);
        } catch (friendshipError) {
          console.warn('Không đọc được trạng thái bạn bè:', friendshipError);
        }
      }
      setFriendshipState(state);

      let visibleSpots: Spot[] = [];
      if (user) {
        visibleSpots =
          user.uid === targetUid
            ? await fetchUserSpots(targetUid)
            : await fetchUserSpotsForViewer(targetUid, user.uid, state === 'accepted');
      }
      setSpots(visibleSpots);

      const placeIds = visibleSpots
        .filter((s) => s.locationMode === 'exact' && s.placeId)
        .map((s) => s.placeId as string);
      if (placeIds.length > 0) {
        setPlaces(await fetchPlacesByIds(placeIds, user?.uid));
      } else {
        setPlaces(new Map());
      }

      if (user && visibleSpots.length > 0) {
        setLikes(await fetchLikeSummaries(visibleSpots.map((s) => s.id), user.uid));
      } else {
        setLikes(new Map());
      }
    } catch (err) {
      console.error('Lỗi khi tải trang cá nhân:', err);
      setError('Không tải được trang cá nhân. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [targetUid, user]);

  useEffect(() => {
    // loadAll đặt loading ngay; chạy ở microtask để không setState đồng bộ trong effect.
    queueMicrotask(loadAll);
  }, [loadAll]);

  const runAction = async (action: 'request' | 'accept' | 'reject' | 'cancel' | 'remove') => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitFriendAction(targetUid, action);
      setFriendshipState(result.state);
      await loadAll();
    } catch (err) {
      console.error('Lỗi cập nhật quan hệ bạn bè:', err);
      setError(err instanceof Error ? err.message : 'Không thể cập nhật quan hệ bạn bè.');
    } finally {
      setBusy(false);
    }
  };

  const relationshipActions = () => {
    if (!user || isSelf) return null;

    switch (friendshipState) {
      case 'none':
        return (
          <button
            onClick={() => runAction('request')}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl disabled:opacity-60"
          >
            <UserPlus className="w-4 h-4" />
            Kết bạn
          </button>
        );
      case 'pending_sent':
        return (
          <>
            <span className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-800 text-sm font-semibold rounded-xl">
              <Clock className="w-4 h-4" />
              Đã gửi lời mời
            </span>
            <button
              onClick={() => runAction('cancel')}
              disabled={busy}
              className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold rounded-xl disabled:opacity-60"
            >
              Hủy lời mời
            </button>
          </>
        );
      case 'pending_received':
        return (
          <>
            <button
              onClick={() => runAction('accept')}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60"
            >
              <Check className="w-4 h-4" />
              Chấp nhận
            </button>
            <button
              onClick={() => runAction('reject')}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold rounded-xl disabled:opacity-60"
            >
              <X className="w-4 h-4" />
              Từ chối
            </button>
          </>
        );
      case 'accepted':
        return (
          <>
            <span className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-xl">
              <UserCheck className="w-4 h-4" />
              Bạn bè
            </span>
            <button
              onClick={() => {
                if (confirm(`Hủy kết bạn với ${displayName || 'thành viên này'}?`)) {
                  runAction('remove');
                }
              }}
              disabled={busy}
              className="px-3 py-2 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl disabled:opacity-60"
            >
              Hủy kết bạn
            </button>
          </>
        );
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-4">
        <h2 className="text-xl font-bold text-stone-900">Yêu cầu đăng nhập</h2>
        <p className="text-sm text-stone-600">Vui lòng đăng nhập để xem hồ sơ thành viên.</p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="h-28 bg-white border border-stone-200 rounded-2xl animate-pulse" />
        <div className="h-40 bg-white border border-stone-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error && !displayName) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-stone-900">Không tìm thấy thành viên</h2>
        <p className="text-sm text-stone-600">{error}</p>
        <button
          onClick={() => router.push('/friends')}
          className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-sm"
        >
          Về trang Bạn bè
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
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

      <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <Avatar path={avatarPath} name={displayName} size="xl" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold text-stone-900 truncate">
              {displayName}
              {isSelf && <span className="ml-2 text-xs font-semibold text-orange-600">(Bạn)</span>}
            </h1>
            <p className="text-xs text-stone-600 mt-1">
              {spots.length} bài trải nghiệm bạn được xem
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isSelf ? (
              <Link
                href="/profile"
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold rounded-xl"
              >
                Quản lý hồ sơ
              </Link>
            ) : (
              relationshipActions()
            )}
          </div>
        </div>

        {!isSelf && friendshipState !== 'accepted' && (
          <p className="mt-4 text-xs text-stone-600 bg-stone-50 border border-stone-100 rounded-xl p-3">
            Chỉ bài viết ở chế độ Công khai được hiển thị. Kết bạn để xem thêm trải nghiệm ở chế độ
            Bạn bè.
          </p>
        )}
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-orange-600" />
          Trải nghiệm được phép xem
        </h2>

        {spots.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-2">
            <Lock className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="text-sm font-semibold text-stone-700">
              Chưa có trải nghiệm nào bạn được xem
            </p>
            <p className="text-xs text-stone-600">
              Thành viên này chưa đăng bài hoặc các bài viết đang ở chế độ riêng tư.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {spots.map((spot) => (
              <SpotCard
                key={spot.id}
                spot={spot}
                place={
                  spot.locationMode === 'hidden' || !spot.placeId
                    ? null
                    : places.get(spot.placeId) || null
                }
                authorProfile={{ displayName: displayName || 'Thành viên', avatarPath }}
                isLiked={likes.get(spot.id)?.likedByViewer}
                likeCount={likes.get(spot.id)?.count}
                onDeleted={(id) => setSpots((previous) => previous.filter((s) => s.id !== id))}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function UserProfilePage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          <div className="h-28 bg-white border border-stone-200 rounded-2xl animate-pulse" />
          <div className="h-40 bg-white border border-stone-200 rounded-2xl animate-pulse" />
        </div>
      }
    >
      <UserProfileContent />
    </React.Suspense>
  );
}
