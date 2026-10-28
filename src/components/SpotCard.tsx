'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Spot, Place, TimestampLike, VisibilityScope } from '@/lib/domain/types';
import { useAuth } from '@/features/auth/AuthContext';
import RatingStars from './RatingStars';
import { useMediaUrl, useMediaUrls } from '@/features/media/useMediaUrls';
import {
  MapPin,
  Calendar,
  Heart,
  Bookmark,
  Trash2,
  Lock,
  Users,
  Globe,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { deleteSpot, updateSpotVisibility } from '@/lib/data/spots';
import { togglePlaceBookmark } from '@/lib/data/saved-places';
import { setSpotLike } from '@/lib/data/likes';

interface SpotCardProps {
  spot: Spot;
  place?: Place | null;
  authorProfile?: {
    displayName: string;
    avatarPath: string | null;
  };
  isLiked?: boolean;
  likeCount?: number;
  isBookmarked?: boolean;
  onDeleted?: (spotId: string) => void;
  onBookmarkChange?: (bookmarked: boolean) => void;
}

export default function SpotCard({
  spot,
  place,
  authorProfile,
  isLiked = false,
  likeCount = 0,
  isBookmarked = false,
  onDeleted,
  onBookmarkChange,
}: SpotCardProps) {
  const { user } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [bookmarking, setBookmarking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [liked, setLiked] = useState(isLiked);
  const [likes, setLikes] = useState(likeCount);
  const [likeBusy, setLikeBusy] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityScope>(spot.visibility);
  const [savingVisibility, setSavingVisibility] = useState(false);

  const imageUrls = useMediaUrls(spot.imagePaths);
  const avatarUrl = useMediaUrl(authorProfile?.avatarPath);

  const isAuthor = user?.uid === spot.authorId;
  const isHiddenLocation = spot.locationMode === 'hidden';
  const placeScope = place?.isPrivate ? 'private' : 'shared';

  const formatDate = (val: TimestampLike) => {
    if (!val) return '';
    if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate().toLocaleDateString('vi-VN');
    }
    if (val instanceof Date) return val.toLocaleDateString('vi-VN');
    if (typeof val === 'string' || typeof val === 'number') return new Date(val).toLocaleDateString('vi-VN');
    return '';
  };

  const renderPrice = () => {
    if (spot.priceVnd === null || spot.priceVnd === undefined) return null;
    if (spot.priceVnd === 0) {
      return <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">0 đ (Miễn phí)</span>;
    }
    return (
      <span className="text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded">
        ~{spot.priceVnd.toLocaleString('vi-VN')} đ
      </span>
    );
  };

  const handleBookmarkToggle = async () => {
    if (!user || !place || isHiddenLocation || bookmarking) return;
    setBookmarking(true);
    const nextState = !bookmarked;
    setBookmarked(nextState);
    try {
      await togglePlaceBookmark(user.uid, placeScope, place.id, nextState);
      onBookmarkChange?.(nextState);
    } catch (err) {
      console.error('Lỗi khi lưu địa điểm:', err);
      setBookmarked(!nextState);
    } finally {
      setBookmarking(false);
    }
  };

  const handleLikeToggle = async () => {
    if (!user || likeBusy) return;
    const nextLiked = !liked;
    const previousCount = likes;
    setLiked(nextLiked);
    setLikes(Math.max(0, likes + (nextLiked ? 1 : -1)));
    setLikeBusy(true);
    try {
      const summary = await setSpotLike(spot.id, nextLiked);
      setLiked(summary.likedByViewer);
      setLikes(summary.count);
    } catch (err) {
      console.error('Lỗi like:', err);
      setLiked(!nextLiked);
      setLikes(previousCount);
    } finally {
      setLikeBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;
    setDeleting(true);
    try {
      await deleteSpot(spot.id);
      if (onDeleted) onDeleted(spot.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi khi xóa bài');
      setDeleting(false);
    }
  };

  const handleVisibilityChange = async (next: VisibilityScope) => {
    const previous = visibility;
    setVisibility(next);
    setSavingVisibility(true);
    try {
      await updateSpotVisibility(spot.id, next);
    } catch (err) {
      console.error('Lỗi đổi phạm vi bài viết:', err);
      setVisibility(previous);
      alert('Không thể đổi phạm vi bài viết. Vui lòng thử lại.');
    } finally {
      setSavingVisibility(false);
    }
  };

  const visibilityBadge = () => {
    if (isAuthor) {
      return (
        <select
          value={visibility}
          onChange={(e) => handleVisibilityChange(e.target.value as VisibilityScope)}
          disabled={savingVisibility}
          aria-label="Phạm vi bài viết"
          className="text-[11px] bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5 text-stone-700"
        >
          <option value="public">Công khai</option>
          <option value="friends">Bạn bè</option>
          <option value="private">Riêng tư</option>
        </select>
      );
    }
    if (visibility === 'public') {
      return (
        <span className="flex items-center gap-1 text-[11px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full" title="Công khai">
          <Globe className="w-3 h-3" />
          <span>Công khai</span>
        </span>
      );
    }
    if (visibility === 'friends') {
      return (
        <span className="flex items-center gap-1 text-[11px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full" title="Chỉ bạn bè">
          <Users className="w-3 h-3" />
          <span>Bạn bè</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full" title="Chỉ mình tôi">
        <Lock className="w-3 h-3" />
        <span>Riêng tư</span>
      </span>
    );
  };

  const safeImageIndex = imageUrls.length > 0 ? currentImageIndex % imageUrls.length : 0;

  return (
    <article className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 border border-orange-200 overflow-hidden flex items-center justify-center font-bold text-orange-600 text-sm">
            {avatarUrl ? (
              <img src={avatarUrl} alt={authorProfile?.displayName || 'Tác giả'} className="w-full h-full object-cover" />
            ) : (
              authorProfile?.displayName?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={`/users/${spot.authorId}`}
                className="font-bold text-sm text-stone-900 hover:text-orange-600"
              >
                {authorProfile?.displayName || (isAuthor ? 'Bạn' : 'Thành viên')}
              </Link>
              {visibilityBadge()}
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-600 mt-0.5">
              <Calendar className="w-3 h-3" />
              <span>Ghé ngày {formatDate(spot.visitedAt)}</span>
            </div>
          </div>
        </div>

        {isAuthor && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 text-stone-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Xóa bài viết"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {imageUrls.length > 0 && (
        <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-stone-100 overflow-hidden">
          <img
            src={imageUrls[safeImageIndex]}
            alt={spot.caption || 'Ảnh trải nghiệm'}
            className="w-full h-full object-cover"
          />

          {imageUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setCurrentImageIndex((prev) => (prev === 0 ? imageUrls.length - 1 : prev - 1))
                }
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                title="Ảnh trước"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentImageIndex((prev) => (prev === imageUrls.length - 1 ? 0 : prev + 1))
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                title="Ảnh tiếp"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute bottom-2 left-1/2 -translate-y-1/2 flex gap-1">
                {imageUrls.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i === safeImageIndex ? 'bg-white w-4' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {isHiddenLocation && (
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
              <span>Vị trí ẩn</span>
            </div>
          )}
        </div>
      )}

      <div className="p-4 space-y-3">
        <div>
          {isHiddenLocation ? (
            <div className="flex items-center gap-1.5 text-stone-600 text-sm">
              <EyeOff className="w-4 h-4 text-stone-600" />
              <span className="italic">Vị trí được ẩn bởi người đăng</span>
            </div>
          ) : place ? (
            <Link href={`/places/${place.id}`} className="group flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-base text-stone-900 group-hover:text-orange-600 transition-colors flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-orange-600 flex-shrink-0" />
                  <span>{place.name}</span>
                </h3>
                <p className="text-xs text-stone-600 line-clamp-1 mt-0.5 ml-5.5">{place.address}</p>
              </div>
              <span className="text-xs text-orange-600 font-semibold group-hover:underline flex-shrink-0">
                Chi tiết →
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-1.5 text-stone-600 text-sm">
              <MapPin className="w-4 h-4 text-stone-400" />
              <span className="italic">Địa điểm không còn khả dụng với bạn</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-100">
          <div className="flex items-center gap-1">
            {spot.rating ? (
              <RatingStars value={spot.rating} onChange={() => {}} readOnly size="sm" />
            ) : (
              <span className="text-stone-600 italic">Chưa đánh giá sao</span>
            )}
          </div>
          <div>{renderPrice()}</div>
        </div>

        {spot.caption && (
          <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{spot.caption}</p>
        )}

        <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLikeToggle}
              disabled={likeBusy}
              aria-pressed={liked}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                liked ? 'text-rose-600 bg-rose-50' : 'text-stone-600 hover:text-rose-600 hover:bg-stone-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${liked ? 'fill-rose-600' : ''}`} />
              <span>{likes > 0 ? likes : 'Thích'}</span>
            </button>

            {!isHiddenLocation && place && (
              <button
                type="button"
                onClick={handleBookmarkToggle}
                disabled={bookmarking}
                aria-pressed={bookmarked}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  bookmarked ? 'text-orange-600 bg-orange-50' : 'text-stone-600 hover:text-orange-600 hover:bg-stone-50'
                }`}
                title={bookmarked ? 'Bỏ lưu địa điểm' : 'Lưu địa điểm này'}
              >
                <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-orange-600' : ''}`} />
                <span>{bookmarked ? 'Đã lưu' : 'Lưu địa điểm'}</span>
              </button>
            )}
          </div>

          {!isHiddenLocation && place && (
            <Link
              href={`/places/${place.id}`}
              className="text-xs font-medium text-stone-600 hover:text-stone-800 underline"
            >
              Lịch sử quán
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
