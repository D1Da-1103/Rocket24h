'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import ImageUploader from '@/components/ImageUploader';
import PlacePicker from '@/components/PlacePicker';
import RatingStars from '@/components/RatingStars';
import PrivacySelector from '@/components/PrivacySelector';
import { ProcessedImage } from '@/lib/image/exif';
import { Place, VisibilityScope, LocationMode } from '@/lib/domain/types';
import { createSpot } from '@/lib/data/spots';
import { createPlace } from '@/lib/data/places';
import { PLACE_CATEGORIES, APP_CONFIG } from '@/lib/domain/config';
import {
  Compass,
  DollarSign,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

function CreateSpotContent() {
  const router = useRouter();
  const { user } = useAuth();

  // (1) Ảnh
  const [images, setImages] = useState<ProcessedImage[]>([]);

  // (2) Địa điểm & Vị trí
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: APP_CONFIG.geo.defaultCenter.latitude,
    lng: APP_CONFIG.geo.defaultCenter.longitude,
  });
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [newPlaceForm, setNewPlaceForm] = useState<{
    name: string;
    category: string;
    address: string;
    isPrivate: boolean;
  } | null>(null);

  // (3) Trải nghiệm
  const [category, setCategory] = useState<string>(PLACE_CATEGORIES[0].id);
  const [priceType, setPriceType] = useState<'specified' | 'zero' | 'unspecified'>('unspecified');
  const [rawPrice, setRawPrice] = useState<string>('');
  const [rating, setRating] = useState<number | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [visitedDate, setVisitedDate] = useState<string>('');

  React.useEffect(() => {
    Promise.resolve().then(() => {
      setVisitedDate(new Date().toISOString().split('T')[0]);
    });
  }, []);

  // (4) Quyền riêng tư
  const [visibility, setVisibility] = useState<VisibilityScope>('friends');
  const [locationMode, setLocationMode] = useState<LocationMode>('exact');

  // Trạng thái gửi form & Chặn gửi lặp (Idempotent lock)
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successSpotId, setSuccessSpotId] = useState<string | null>(null);

  // Kiểm tra đăng nhập
  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-stone-800">Yêu cầu đăng nhập</h2>
        <p className="text-sm text-stone-600">
          Bạn cần đăng nhập để tạo bài viết ghi lại nhật ký trải nghiệm.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
        >
          Đến trang đăng nhập
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Validate ảnh
    if (images.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất 1 ảnh trải nghiệm (tối đa 5 ảnh)');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Validate Place
    if (!selectedPlace && !newPlaceForm) {
      setErrorMessage('Vui lòng chọn một địa điểm có sẵn hoặc tạo mới tại ghim');
      return;
    }

    if (newPlaceForm && newPlaceForm.name.trim().length < 2) {
      setErrorMessage('Tên địa điểm mới phải từ 2 ký tự trở lên');
      return;
    }

    // Validate caption
    if (caption.length > 1000) {
      setErrorMessage('Chú thích không được vượt quá 1000 ký tự');
      return;
    }

    // Tính toán priceVnd (null vs 0 vs số nguyên > 0)
    let finalPriceVnd: number | null = null;
    if (priceType === 'zero') {
      finalPriceVnd = 0;
    } else if (priceType === 'specified') {
      const parsed = parseInt(rawPrice.replace(/\D/g, ''), 10);
      if (isNaN(parsed) || parsed < 0) {
        setErrorMessage('Vui lòng nhập số tiền hợp lệ');
        return;
      }
      finalPriceVnd = parsed;
    }

    try {
      setErrorMessage(null);
      setSubmitting(true);

      let effectivePlace = selectedPlace;

      // 1. Nếu người dùng nhập địa điểm mới -> Tạo Place trước
      if (!effectivePlace && newPlaceForm) {
        effectivePlace = await createPlace(
          {
            name: newPlaceForm.name.trim(),
            category: newPlaceForm.category,
            address: newPlaceForm.address.trim() || 'Hà Nội, Việt Nam',
            latitude: coords.lat,
            longitude: coords.lng,
            isPrivate: newPlaceForm.isPrivate,
          },
          user.uid
        );
      }

      if (!effectivePlace) {
        throw new Error('Không thể xác định địa điểm trải nghiệm');
      }

      // 2. Tạo Spot với danh sách ảnh đã bỏ EXIF
      const imageFiles = images.map((img) => img.file);

      const spotId = await createSpot(
        {
          placeId: effectivePlace.id,
          realPlaceKey: effectivePlace.id,
          realPlaceScope: effectivePlace.isPrivate ? 'private' : 'shared',
          locationMode,
          category,
          priceVnd: finalPriceVnd,
          rating,
          caption: caption.trim(),
          visibility,
          visitedAt: new Date(visitedDate),
          imageFiles,
        },
        user.uid
      );

      setSuccessSpotId(spotId);
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: unknown) {
      console.error('Lỗi khi tạo Spot:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo Spot');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">
          <Compass className="w-4 h-4" />
          <span>Ghi lại trải nghiệm</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
          Tạo Spot Trải Nghiệm Mới
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Lưu giữ khoảnh khắc ẩm thực & du lịch cùng bạn bè
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-sm text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
          <div>
            <p className="font-semibold">Chưa thể lưu Spot:</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {successSpotId && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-sm text-emerald-800">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <div>
            <p className="font-bold">Đăng Spot thành công!</p>
            <p className="text-xs text-emerald-700">Đang chuyển bạn về Bảng tin...</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* NHÓM 1: ẢNH TRẢI NGHIỆM */}
        <section className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-900">1. Hình ảnh trải nghiệm (1–5 ảnh) *</h2>
            <span className="text-xs text-stone-600">Bắt buộc</span>
          </div>
          <ImageUploader images={images} onChange={setImages} />
        </section>

        {/* NHÓM 2: VỊ TRÍ & ĐỊA ĐIỂM */}
        <section className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-900">2. Xác định vị trí & Địa điểm (Place) *</h2>
            <span className="text-xs text-stone-600">Bắt buộc</span>
          </div>
          <PlacePicker
            selectedPlace={selectedPlace}
            onSelectPlace={(p) => {
              setSelectedPlace(p);
              if (p) setCategory(p.category);
            }}
            onCoordinatesChange={setCoords}
            newPlaceForm={newPlaceForm}
            onNewPlaceFormChange={setNewPlaceForm}
          />
        </section>

        {/* NHÓM 3: THÔNG TIN CHI TIẾT */}
        <section className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-stone-900">3. Chi tiết trải nghiệm của bạn</h2>

          {/* Danh mục */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Danh mục trải nghiệm
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PLACE_CATEGORIES.map((cat) => {
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      active
                        ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                        : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Đánh giá sao */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Đánh giá chất lượng (1–5 sao hoặc để trống)
            </label>
            <RatingStars value={rating} onChange={setRating} size="lg" />
          </div>

          {/* Giá tham khảo */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              <DollarSign className="w-4 h-4 text-stone-500" />
              <span>Giá tham khảo một lần ghé (VND)</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={() => setPriceType('unspecified')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium border ${
                  priceType === 'unspecified'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                Chưa nhập giá
              </button>
              <button
                type="button"
                onClick={() => setPriceType('zero')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium border ${
                  priceType === 'zero'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                0 đ (Miễn phí)
              </button>
              <button
                type="button"
                onClick={() => setPriceType('specified')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium border ${
                  priceType === 'specified'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                Nhập số tiền cụ thể
              </button>
            </div>

            {priceType === 'specified' && (
              <div className="relative max-w-xs mt-2">
                <input
                  id="spot-price-input"
                  type="number"
                  min="0"
                  step="1000"
                  value={rawPrice}
                  onChange={(e) => setRawPrice(e.target.value)}
                  placeholder="Ví dụ: 35000"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-600">
                  VND
                </span>
              </div>
            )}
          </div>

          {/* Thời điểm ghé */}
          <div className="max-w-xs">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              <Calendar className="w-4 h-4 text-stone-500" />
              <span>Thời điểm ghé</span>
            </label>
            <input
              id="spot-visited-date-input"
              type="date"
              value={visitedDate}
              onChange={(e) => setVisitedDate(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          {/* Chú thích / Cảm nhận */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 uppercase tracking-wider">
                <FileText className="w-4 h-4 text-stone-500" />
                <span>Chú thích & Cảm nhận</span>
              </label>
              <span className={`text-xs ${caption.length > 1000 ? 'text-red-600 font-bold' : 'text-stone-600'}`}>
                {caption.length}/1000
              </span>
            </div>
            <textarea
              id="spot-caption-input"
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Chia sẻ trải nghiệm của bạn (món ăn ngon, góc chụp đẹp, thời gian thích hợp ghé...)"
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none"
            />
          </div>
        </section>

        {/* NHÓM 4: QUYỀN RIÊNG TƯ & VỊ TRÍ */}
        <section className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <PrivacySelector
            visibility={visibility}
            onVisibilityChange={setVisibility}
            locationMode={locationMode}
            onLocationModeChange={setLocationMode}
          />
        </section>

        {/* NÚT ĐĂNG SPOT (CHẶN BẤM ĐÚP) */}
        <div className="pt-2">
          <button
            id="btn-submit-spot"
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-bold text-base shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/35 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Đang xử lý & tải dữ liệu lên...</span>
              </>
            ) : (
              <>
                <span>Xem lại và Đăng Spot ngay</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
          <p className="text-center text-xs text-stone-600 mt-2">
            Hệ thống chỉ thông báo thành công sau khi dữ liệu đã được xác nhận lưu trên máy chủ.
          </p>
        </div>
      </form>
    </div>
  );
}

export default function CreateSpotPage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm text-stone-600">Đang tải biểu mẫu tạo Spot...</p>
        </div>
      }
    >
      <CreateSpotContent />
    </React.Suspense>
  );
}
