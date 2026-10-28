'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { getPlaceById } from '@/lib/data/places';
import { fetchPlaceSpots } from '@/lib/data/spots';
import { fetchFriendUids } from '@/lib/data/friends';
import { fetchLikeSummaries, LikeSummary } from '@/lib/data/likes';
import { getSavedPlace, togglePlaceBookmark } from '@/lib/data/saved-places';
import { Place, SavedPlace, Spot } from '@/lib/domain/types';
import InteractiveMap from '@/components/map/InteractiveMap';
import SpotCard from '@/components/SpotCard';
import {
  MapPin,
  Navigation,
  Bookmark,
  Lock,
  ArrowLeft,
  Calendar,
  AlertCircle,
  PlusCircle,
  CheckCircle2,
  EyeOff,
} from 'lucide-react';

function PlaceDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const placeId = params?.id as string;

  const [place, setPlace] = useState<Place | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [likes, setLikes] = useState<Map<string, LikeSummary>>(new Map());
  const [saved, setSaved] = useState<SavedPlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPartial, setIsPartial] = useState(false);
  const [activeTab, setActiveTab] = useState<'my_spots' | 'all_spots'>('my_spots');
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  const loadData = useCallback(async () => {
    if (!placeId) return;
    setLoading(true);
    setError(null);
    setIsPartial(false);

    try {
      const placeData = await getPlaceById(placeId, user?.uid);
      if (!placeData) {
        // Place riêng của người khác và Place không tồn tại trả về cùng một thông báo,
        // không lộ tên/tọa độ.
        setError('Địa điểm không tồn tại hoặc bạn không có quyền xem.');
        setLoading(false);
        return;
      }
      setPlace(placeData);

      const placeScope = placeData.isPrivate ? 'private' : 'shared';
      if (user) {
        try {
          setSaved(await getSavedPlace(user.uid, placeScope, placeData.id));
        } catch (savedError) {
          console.warn('Không đọc được trạng thái lưu địa điểm:', savedError);
          setSaved(null);
        }
      } else {
        setSaved(null);
      }

      let friendUids: string[] = [];
      if (user) {
        try {
          friendUids = await fetchFriendUids(user.uid);
        } catch (friendError) {
          console.warn('Không tải được danh sách bạn bè:', friendError);
          setIsPartial(true);
        }
      }

      const result = await fetchPlaceSpots(
        placeData.id,
        user?.uid,
        friendUids,
        placeScope
      );
      setSpots(result.spots);
      if (result.isPartial) setIsPartial(true);

      if (user && result.spots.length > 0) {
        try {
          setLikes(await fetchLikeSummaries(result.spots.map((s) => s.id), user.uid));
        } catch (likeError) {
          console.warn('Không tải được lượt thích:', likeError);
        }
      }
    } catch (err: unknown) {
      console.error('Lỗi khi tải chi tiết địa điểm:', err);
      setError('Không thể tải thông tin địa điểm. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [placeId, user]);

  useEffect(() => {
    // loadData đặt loading ngay; chạy ở microtask để không setState đồng bộ trong effect.
    queueMicrotask(loadData);
  }, [loadData]);

  const mySpots = useMemo(
    () => spots.filter((s) => s.authorId === user?.uid),
    [spots, user?.uid]
  );
  const otherSpots = useMemo(
    () => spots.filter((s) => s.authorId !== user?.uid),
    [spots, user?.uid]
  );

  const openExternalDirections = () => {
    if (!place) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleBookmarkToggle = async () => {
    if (!user || !place || bookmarkBusy) return;
    const nextState = !saved?.isBookmarked;
    const previous = saved;
    setSaved((current) => ({
      placeScope: place.isPrivate ? 'private' : 'shared',
      placeId: place.id,
      hasVisited: current?.hasVisited ?? false,
      isBookmarked: nextState,
      lastVisitedAt: current?.lastVisitedAt ?? null,
    }));
    setBookmarkBusy(true);
    try {
      await togglePlaceBookmark(
        user.uid,
        place.isPrivate ? 'private' : 'shared',
        place.id,
        nextState
      );
      setSaved(await getSavedPlace(user.uid, place.isPrivate ? 'private' : 'shared', place.id));
    } catch (err) {
      console.error('Lỗi khi lưu địa điểm:', err);
      setSaved(previous);
      alert('Không thể cập nhật trạng thái lưu. Vui lòng thử lại.');
    } finally {
      setBookmarkBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-medium text-stone-600">Đang tải thông tin địa điểm...</p>
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-stone-900">Không tìm thấy địa điểm</h2>
        <p className="text-sm text-stone-600">{error || 'Nội dung không còn khả dụng.'}</p>
        <div className="flex justify-center gap-2">
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-sm transition-colors"
          >
            Quay lại Bảng tin
          </button>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay lại</span>
      </button>

      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-orange-100 text-orange-700 font-semibold text-xs rounded-full">
                {place.category}
              </span>
              {place.isPrivate && (
                <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 font-semibold text-xs rounded-full">
                  <Lock className="w-3 h-3" />
                  Địa điểm riêng tư
                </span>
              )}
              {saved?.hasVisited && (
                <span className="flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  Đã ghé
                </span>
              )}
              {saved?.isBookmarked && (
                <span className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 font-semibold text-xs rounded-full">
                  <Bookmark className="w-3 h-3 fill-amber-700" />
                  Đã lưu
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
              {place.name}
            </h1>

            <p className="text-sm text-stone-600 flex items-start gap-1.5 pt-1">
              <MapPin className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <span>{place.address}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={openExternalDirections}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-orange-500/20 transition-all"
            >
              <Navigation className="w-4 h-4" />
              <span>Chỉ đường</span>
            </button>

            {user && (
              <button
                onClick={handleBookmarkToggle}
                disabled={bookmarkBusy}
                aria-pressed={Boolean(saved?.isBookmarked)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold rounded-xl border transition-colors disabled:opacity-60 ${
                  saved?.isBookmarked
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 ${saved?.isBookmarked ? 'fill-orange-600 text-orange-600' : ''}`}
                />
                <span>{saved?.isBookmarked ? 'Bỏ lưu địa điểm' : 'Lưu địa điểm'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl overflow-hidden border border-stone-200">
          <InteractiveMap
            center={[place.latitude, place.longitude]}
            zoom={16}
            places={[place]}
            height="260px"
          />
        </div>
      </div>

      {isPartial && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between gap-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
            <p>Một phần trải nghiệm chưa tải được. Danh sách bên dưới có thể chưa đầy đủ.</p>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold hover:bg-amber-100"
          >
            Thử lại
          </button>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('my_spots')}
              className={`text-sm font-bold pb-2 relative transition-colors ${
                activeTab === 'my_spots' ? 'text-orange-600' : 'text-stone-600 hover:text-stone-700'
              }`}
            >
              Lịch sử của tôi ({mySpots.length})
              {activeTab === 'my_spots' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-full" />
              )}
            </button>
            {!place.isPrivate && (
              <button
                onClick={() => setActiveTab('all_spots')}
                className={`text-sm font-bold pb-2 relative transition-colors ${
                  activeTab === 'all_spots' ? 'text-orange-600' : 'text-stone-600 hover:text-stone-700'
                }`}
              >
                Trải nghiệm bạn bè ({otherSpots.length})
                {activeTab === 'all_spots' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-full" />
                )}
              </button>
            )}
          </div>

          <Link
            href="/spots/new"
            className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Thêm lần ghé mới</span>
          </Link>
        </div>

        <div className="space-y-4">
          {activeTab === 'my_spots' && (
            <>
              {mySpots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mySpots.map((spot) => (
                    <SpotCard
                      key={spot.id}
                      spot={spot}
                      place={place}
                      authorProfile={{ displayName: 'Bạn', avatarPath: null }}
                      isLiked={likes.get(spot.id)?.likedByViewer}
                      likeCount={likes.get(spot.id)?.count}
                      isBookmarked={Boolean(saved?.isBookmarked) && spot.locationMode !== 'hidden'}
                      onBookmarkChange={(bookmarked) =>
                        setSaved((current) =>
                          current
                            ? { ...current, isBookmarked: bookmarked }
                            : {
                                placeScope: place.isPrivate ? 'private' : 'shared',
                                placeId: place.id,
                                hasVisited: true,
                                isBookmarked: bookmarked,
                                lastVisitedAt: null,
                              }
                        )
                      }
                      onDeleted={(id) => {
                        setSpots((previous) => previous.filter((s) => s.id !== id));
                        loadData();
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-3">
                  <Calendar className="w-10 h-10 text-stone-300 mx-auto" />
                  <h3 className="font-bold text-stone-800 text-sm">
                    Bạn chưa ghi lại lần ghé nào tại đây
                  </h3>
                  <p className="text-xs text-stone-600 max-w-sm mx-auto">
                    Hãy chia sẻ khoảnh khắc, món ăn hoặc cảm nhận đầu tiên của bạn tại địa điểm này!
                  </p>
                  <Link
                    href="/spots/new"
                    className="inline-block mt-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    Tạo Spot ngay
                  </Link>
                </div>
              )}
            </>
          )}

          {activeTab === 'all_spots' && !place.isPrivate && (
            <>
              {otherSpots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {otherSpots.map((spot) => (
                    <SpotCard
                      key={spot.id}
                      spot={spot}
                      place={place}
                      isLiked={likes.get(spot.id)?.likedByViewer}
                      likeCount={likes.get(spot.id)?.count}
                      isBookmarked={Boolean(saved?.isBookmarked) && spot.locationMode !== 'hidden'}
                      onBookmarkChange={(bookmarked) =>
                        setSaved((current) =>
                          current
                            ? { ...current, isBookmarked: bookmarked }
                            : {
                                placeScope: 'shared',
                                placeId: place.id,
                                hasVisited: false,
                                isBookmarked: bookmarked,
                                lastVisitedAt: null,
                              }
                        )
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-2">
                  <EyeOff className="w-8 h-8 text-stone-300 mx-auto" />
                  <p className="text-sm font-semibold text-stone-700">
                    Chưa có trải nghiệm nào bạn được xem
                  </p>
                  <p className="text-xs text-stone-600">
                    Bạn bè của bạn chưa đăng bài viết nào tại đây hoặc các bài viết được đặt ở chế
                    độ riêng tư.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlaceDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-5xl mx-auto px-4 py-12 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm text-stone-600">Đang tải...</p>
        </div>
      }
    >
      <PlaceDetailContent />
    </React.Suspense>
  );
}
