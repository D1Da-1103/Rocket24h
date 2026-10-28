'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '@/features/auth/AuthContext';
import {
  fetchNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/data/notifications';
import { fetchProfilesByUids } from '@/lib/data/users';
import { fetchSpotById } from '@/lib/data/spots';
import { timestampToMillis } from '@/lib/domain/feed-merge';
import { AppNotification, TimestampLike } from '@/lib/domain/types';
import { APP_CONFIG } from '@/lib/domain/config';
import Avatar from '@/components/Avatar';
import {
  AlertCircle,
  Bell,
  CheckCheck,
  Heart,
  UserPlus,
} from 'lucide-react';

function formatTime(value: TimestampLike): string {
  const millis = timestampToMillis(value);
  if (!millis) return '';
  const diffMinutes = Math.floor((Date.now() - millis) / 60000);
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return new Date(millis).toLocaleDateString('vi-VN');
}

interface NotificationItem extends AppNotification {
  actorDisplayName: string;
  actorAvatarPath: string | null;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const cursorRef = useRef<DocumentSnapshot | null>(null);
  const pageSize = APP_CONFIG.pagination.notificationsPageSize;

  const enrich = useCallback(async (raw: AppNotification[]): Promise<NotificationItem[]> => {
    const profiles = await fetchProfilesByUids(raw.map((item) => item.actorId));
    return raw.map((item) => {
      const profile = profiles.get(item.actorId);
      return {
        ...item,
        actorDisplayName: profile?.displayName || 'Thành viên',
        actorAvatarPath: profile?.avatarPath || null,
      };
    });
  }, []);

  const loadPage = useCallback(
    async (reset: boolean) => {
      if (!user) return;
      if (reset) {
        setLoading(true);
        cursorRef.current = null;
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const page = await fetchNotificationsPage(
          user.uid,
          pageSize,
          reset ? null : cursorRef.current
        );
        const enriched = await enrich(page.items);
        setItems((previous) => {
          const base = reset ? [] : previous;
          const seen = new Set(base.map((item) => item.id));
          return [...base, ...enriched.filter((item) => !seen.has(item.id))];
        });
        cursorRef.current = page.lastCursor;
        setHasMore(page.hasMore);
      } catch (err) {
        console.error('Lỗi khi tải thông báo:', err);
        setError('Không tải được thông báo. Dữ liệu đã tải vẫn được giữ lại.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, pageSize, enrich]
  );

  useEffect(() => {
    // loadPage đặt loading ngay; chạy ở microtask để không setState đồng bộ trong effect.
    if (user) queueMicrotask(() => loadPage(true));
  }, [user, loadPage]);

  const markReadLocally = (id: string) => {
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
  };

  const handleOpen = async (item: NotificationItem) => {
    if (!user) return;
    setNotice(null);

    if (!item.isRead) {
      try {
        await markNotificationRead(user.uid, item.id, true);
        markReadLocally(item.id);
      } catch (err) {
        console.warn('Không đánh dấu đã đọc:', err);
      }
    }

    if (item.type === 'friend_request') {
      router.push(`/users/${item.actorId}`);
      return;
    }

    // Kiểm tra quyền đọc hiện tại trước khi mở nội dung Spot.
    try {
      const spot = await fetchSpotById(item.targetId);
      if (!spot || spot.status === 'deleting') {
        setNotice('Nội dung không còn khả dụng.');
        return;
      }
      router.push(`/spots/${item.targetId}`);
    } catch {
      setNotice('Nội dung không còn khả dụng hoặc bạn không còn quyền xem.');
    }
  };

  const handleMarkAll = async () => {
    if (!user || markingAll) return;
    setMarkingAll(true);
    setError(null);
    try {
      await markAllNotificationsRead(user.uid);
      setItems((previous) => previous.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      console.error('Lỗi đánh dấu tất cả đã đọc:', err);
      setError('Không đánh dấu được tất cả thông báo. Vui lòng thử lại.');
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = items.filter((item) => !item.isRead).length;

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-4">
        <h2 className="text-xl font-bold text-stone-900">Yêu cầu đăng nhập</h2>
        <p className="text-sm text-stone-600">Vui lòng đăng nhập để xem thông báo.</p>
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
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-orange-600" />
            Thông báo
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc trong trang này` : 'Bạn đã đọc hết thông báo đã tải'}
          </p>
        </div>
        <button
          onClick={handleMarkAll}
          disabled={markingAll}
          className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl disabled:opacity-60"
        >
          <CheckCheck className="w-4 h-4" />
          Đánh dấu tất cả
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start justify-between gap-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
            <p>{error}</p>
          </div>
          <button
            onClick={() => loadPage(true)}
            className="px-3 py-1.5 bg-white border border-red-300 rounded-lg text-xs font-semibold hover:bg-red-100"
          >
            Thử lại
          </button>
        </div>
      )}

      {notice && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start justify-between gap-2">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-semibold underline">
            Đóng
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-white border border-stone-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-stone-200 text-center space-y-3">
          <Bell className="w-10 h-10 text-stone-300 mx-auto" />
          <h2 className="font-bold text-stone-800">Chưa có thông báo nào</h2>
          <p className="text-xs text-stone-600 max-w-sm mx-auto">
            Khi có người gửi lời mời kết bạn hoặc thích bài viết của bạn, thông báo sẽ xuất hiện ở
            đây.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleOpen(item)}
                className={`w-full text-left bg-white rounded-2xl border p-4 flex items-start gap-3 transition-colors hover:border-orange-300 ${
                  item.isRead ? 'border-stone-200' : 'border-orange-200 bg-orange-50/40'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar path={item.actorAvatarPath} name={item.actorDisplayName} />
                  <span
                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white ${
                      item.type === 'like' ? 'bg-rose-500' : 'bg-sky-500'
                    }`}
                  >
                    {item.type === 'like' ? (
                      <Heart className="w-2.5 h-2.5 text-white fill-white" />
                    ) : (
                      <UserPlus className="w-2.5 h-2.5 text-white" />
                    )}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-800">
                    <span className="font-semibold">{item.actorDisplayName}</span>{' '}
                    {item.type === 'like'
                      ? 'đã thích bài viết của bạn'
                      : 'đã gửi lời mời kết bạn'}
                  </p>
                  <p className="text-[11px] text-stone-600 mt-1">{formatTime(item.createdAt)}</p>
                </div>

                {!item.isRead && (
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0 mt-1"
                    title="Chưa đọc"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasMore && !loading && (
        <div className="text-center">
          <button
            onClick={() => loadPage(false)}
            disabled={loadingMore}
            className="px-5 py-2.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-sm font-semibold rounded-2xl shadow-sm disabled:opacity-60"
          >
            {loadingMore ? 'Đang tải...' : 'Tải thêm thông báo'}
          </button>
        </div>
      )}
    </div>
  );
}
