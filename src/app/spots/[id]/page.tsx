'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { fetchOwnSpotLocation, fetchSpotById } from '@/lib/data/spots';
import { fetchPlacesByIds } from '@/lib/data/places';
import { fetchProfilesByUids } from '@/lib/data/users';
import { fetchLikeSummaries, LikeSummary } from '@/lib/data/likes';
import { getSavedPlace } from '@/lib/data/saved-places';
import { Place, Spot } from '@/lib/domain/types';
import SpotCard from '@/components/SpotCard';
import { AlertCircle, ArrowLeft, EyeOff } from 'lucide-react';

function SpotDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const spotId = params?.id as string;

  const [spot, setSpot] = useState<Spot | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [author, setAuthor] = useState<{ displayName: string; avatarPath: string | null } | null>(
    null
  );
  const [likes, setLikes] = useState<LikeSummary | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!spotId) return;
    setLoading(true);
    setError(null);
    setUnavailable(false);

    try {
      let spotData: Spot | null = null;
      try {
        spotData = await fetchSpotById(spotId);
      } catch (err) {
        // Rules từ chối đọc: không lộ nội dung cũ.
        console.warn('Không có quyền đọc Spot:', err);
      }

      if (!spotData || spotData.status === 'deleting') {
        setUnavailable(true);
        setSpot(null);
        return;
      }
      setSpot(spotData);

      const profiles = await fetchProfilesByUids([spotData.authorId]);
      const profile = profiles.get(spotData.authorId);
      setAuthor({
        displayName: profile?.displayName || 'Thành viên',
        avatarPath: profile?.avatarPath || null,
      });

      let resolvedPlace: Place | null = null;
      if (spotData.locationMode === 'hidden') {
        // Chỉ chủ bài viết được đọc tham chiếu vị trí thật.
        if (user && user.uid === spotData.authorId) {
          const location = await fetchOwnSpotLocation(user.uid, spotData.id);
          if (location) {
            const placeMap = await fetchPlacesByIds([location.placeKey], user.uid);
            resolvedPlace = placeMap.get(location.placeKey) ?? null;
          }
        }
      } else if (spotData.placeId) {
        const placeMap = await fetchPlacesByIds([spotData.placeId], user?.uid);
        resolvedPlace = placeMap.get(spotData.placeId) ?? null;
      }
      setPlace(resolvedPlace);

      if (user) {
        try {
          const summary = await fetchLikeSummaries([spotData.id], user.uid);
          setLikes(summary.get(spotData.id) ?? null);
        } catch (likeError) {
          console.warn('Không tải được lượt thích:', likeError);
        }

        if (resolvedPlace) {
          try {
            const saved = await getSavedPlace(
              user.uid,
              resolvedPlace.isPrivate ? 'private' : 'shared',
              resolvedPlace.id
            );
            setBookmarked(Boolean(saved?.isBookmarked));
          } catch (savedError) {
            console.warn('Không đọc được trạng thái lưu:', savedError);
          }
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải chi tiết bài viết:', err);
      setError('Không thể tải bài viết. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [spotId, user]);

  useEffect(() => {
    // loadData đặt loading ngay; chạy ở microtask để không setState đồng bộ trong effect.
    queueMicrotask(loadData);
  }, [loadData]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-medium text-stone-600">Đang tải bài viết...</p>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <EyeOff className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-stone-900">Nội dung không còn khả dụng</h1>
        <p className="text-sm text-stone-600">
          Bài viết đã bị xóa hoặc bạn không còn quyền xem nội dung này.
        </p>
        <div className="flex justify-center gap-2">
          <Link
            href="/"
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-sm"
          >
            Về bảng tin
          </Link>
          <Link
            href="/notifications"
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm"
          >
            Về thông báo
          </Link>
        </div>
      </div>
    );
  }

  if (error || !spot) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-stone-900">Không tải được bài viết</h1>
        <p className="text-sm text-stone-600">{error || 'Nội dung không còn khả dụng.'}</p>
        <div className="flex justify-center gap-2">
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-sm"
          >
            Về bảng tin
          </button>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay lại</span>
      </button>

      <SpotCard
        spot={spot}
        place={place}
        authorProfile={author ?? undefined}
        isLiked={likes?.likedByViewer}
        likeCount={likes?.count}
        isBookmarked={bookmarked}
        onBookmarkChange={setBookmarked}
        onDeleted={() => router.push('/')}
      />
    </div>
  );
}

export default function SpotDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm text-stone-600">Đang tải...</p>
        </div>
      }
    >
      <SpotDetailContent />
    </React.Suspense>
  );
}
