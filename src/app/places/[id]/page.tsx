'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { getPlaceById } from '@/lib/data/places';
import { fetchPlaceSpots } from '@/lib/data/spots';
import { Place, Spot } from '@/lib/domain/types';
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
} from 'lucide-react';
import { togglePlaceBookmark } from '@/lib/data/saved-places';

function PlaceDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const placeId = params?.id as string;

  const [place, setPlace] = useState<Place | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my_spots' | 'all_spots'>('my_spots');
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (!placeId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const placeData = await getPlaceById(placeId, user?.uid);
        if (!placeData) {
          setError('Không tìm thấy địa điểm hoặc nội dung không còn khả dụng.');
          setLoading(false);
          return;
        }
        setPlace(placeData);

        // Tải các Spot tại Place này
        const spotList = await fetchPlaceSpots(placeId);
        setSpots(spotList);
      } catch (err: unknown) {
        console.error('Lỗi khi tải chi tiết địa điểm:', err);
        setError('Không thể tải thông tin địa điểm');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [placeId, user?.uid]);

  const mySpots = spots.filter((s) => s.authorId === user?.uid);
  const otherSpots = spots.filter((s) => s.authorId !== user?.uid);

  // Mở ứng dụng bản đồ bên ngoài (Google Maps / Apple Maps)
  const openExternalDirections = () => {
    if (!place) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleBookmarkToggle = async () => {
    if (!user || !place) return;
    const nextState = !bookmarked;
    setBookmarked(nextState);
    try {
      await togglePlaceBookmark(
        user.uid,
        place.isPrivate ? 'private' : 'shared',
        place.id,
        nextState
      );
    } catch {
      setBookmarked(!nextState);
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
        <p className="text-sm text-stone-600">{error || 'Địa điểm không tồn tại hoặc bạn không có quyền xem.'}</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-sm transition-colors"
        >
          Quay lại Bảng tin
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Nút quay lại */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay lại</span>
      </button>

      {/* Header Địa điểm */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-orange-100 text-orange-700 font-semibold text-xs rounded-full">
                {place.category}
              </span>
              {place.isPrivate && (
                <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 font-semibold text-xs rounded-full">
                  <Lock className="w-3 h-3" />
                  Địa điểm riêng tư
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

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={openExternalDirections}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-orange-500/20 transition-all"
            >
              <Navigation className="w-4 h-4" />
              <span>Chỉ đường</span>
            </button>

            <button
              onClick={handleBookmarkToggle}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
                bookmarked
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-orange-600 text-orange-600' : ''}`} />
              <span>{bookmarked ? 'Đã lưu' : 'Lưu địa điểm'}</span>
            </button>
          </div>
        </div>

        {/* Mini Map */}
        <div className="mt-6 rounded-2xl overflow-hidden border border-stone-200">
          <InteractiveMap
            center={[place.latitude, place.longitude]}
            zoom={16}
            places={[place]}
            height="260px"
          />
        </div>
      </div>

      {/* Tabs Lịch sử trải nghiệm */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
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
          </div>

          <button
            onClick={() => router.push('/spots/new')}
            className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Thêm lần ghé mới</span>
          </button>
        </div>

        {/* Danh sách Spot theo Tab */}
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
                      onDeleted={(id) => setSpots(spots.filter((s) => s.id !== id))}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-3">
                  <Calendar className="w-10 h-10 text-stone-300 mx-auto" />
                  <h3 className="font-bold text-stone-800 text-sm">Bạn chưa ghi lại lần ghé nào tại đây</h3>
                  <p className="text-xs text-stone-600 max-w-sm mx-auto">
                    Hãy chia sẻ khoảnh khắc, món ăn hoặc cảm nhận đầu tiên của bạn tại địa điểm này!
                  </p>
                  <button
                    onClick={() => router.push('/spots/new')}
                    className="mt-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    Tạo Spot ngay
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'all_spots' && (
            <>
              {otherSpots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {otherSpots.map((spot) => (
                    <SpotCard key={spot.id} spot={spot} place={place} />
                  ))}
                </div>
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-2">
                  <p className="text-sm font-semibold text-stone-700">Chưa có trải nghiệm nào bạn được xem</p>
                  <p className="text-xs text-stone-600">
                    Bạn bè của bạn chưa đăng bài viết nào tại đây hoặc các bài viết được đặt ở chế độ riêng tư.
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
