'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import {
  createFeedPagerState,
  FeedItem,
  FeedPagerState,
  loadFeedPage,
} from '@/features/feed/feed-loader';
import SpotCard from '@/components/SpotCard';
import {
  Compass,
  PlusCircle,
  Search,
  Filter,
  MapPin,
  Shield,
  Camera,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Star,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { APP_CONFIG, PLACE_CATEGORIES } from '@/lib/domain/config';
import { DEFAULT_SPOT_FILTERS, matchesSpotFilters, PriceFilter } from '@/lib/domain/spot-filters';
import { fetchFriendUids } from '@/lib/data/friends';
import { fetchUserSavedPlaces } from '@/lib/data/saved-places';
import { getSavedPlaceKey } from '@/lib/domain/schemas';

const PRICE_OPTIONS: { id: PriceFilter; label: string }[] = [
  { id: 'any', label: 'Mọi mức giá' },
  { id: 'free', label: 'Miễn phí (0 đ)' },
  { id: 'under50', label: 'Dưới 50k' },
  { id: '50to150', label: '50k – 150k' },
  { id: 'over150', label: 'Trên 150k' },
];

export default function HomePage() {
  const { user, profile } = useAuth();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const pagerRef = useRef<FeedPagerState | null>(null);

  // Tìm kiếm & Lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('any');
  const [minRating, setMinRating] = useState<number | null>(null);

  const loadFeed = useCallback(
    async (reset: boolean) => {
      if (!user) return;

      if (reset) {
        setLoading(true);
        setFeedError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        let friendUids: string[] = [];
        if (reset) {
          try {
            friendUids = await fetchFriendUids(user.uid);
          } catch (error) {
            console.warn('Không tải được danh sách bạn bè:', error);
            setFeedError('Không tải được danh sách bạn bè. Bảng tin của bạn vẫn được hiển thị.');
          }

          pagerRef.current = createFeedPagerState(
            user.uid,
            friendUids,
            APP_CONFIG.pagination.feedPageSize
          );

          try {
            const saved = await fetchUserSavedPlaces(user.uid);
            setSavedKeys(
              new Set(saved.filter((s) => s.isBookmarked).map((s) => getSavedPlaceKey(s.placeScope, s.placeId)))
            );
          } catch (error) {
            console.warn('Không tải được trạng thái lưu địa điểm:', error);
          }
        }

        if (!pagerRef.current) {
          pagerRef.current = createFeedPagerState(
            user.uid,
            friendUids,
            APP_CONFIG.pagination.feedPageSize
          );
        }

        const page = await loadFeedPage(pagerRef.current);

        setFeedItems((previous) => {
          const base = reset ? [] : previous;
          const seen = new Set(base.map((item) => item.spot.id));
          return [...base, ...page.items.filter((item) => !seen.has(item.spot.id))];
        });
        setHasMore(page.hasMore);
        if (page.isPartial) {
          setFeedError('Một phần bảng tin chưa tải được. Dữ liệu đã tải vẫn được giữ lại.');
        }
      } catch (error) {
        console.error('Lỗi khi tải bảng tin:', error);
        setFeedError('Không thể tải bảng tin. Vui lòng thử lại.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      if (user) {
        loadFeed(true);
      } else {
        setFeedItems([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user, loadFeed]);

  const filters = {
    ...DEFAULT_SPOT_FILTERS,
    searchTerm,
    category: selectedCategory === 'all' ? null : selectedCategory,
    price: priceFilter,
    minRating,
  };

  const filteredItems = feedItems.filter((item) =>
    matchesSpotFilters(item.spot, item.place?.nameNormalized || null, filters)
  );

  const hasFilter = Boolean(
    searchTerm.trim() || selectedCategory !== 'all' || priceFilter !== 'any' || minRating !== null
  );

  // GIAO DIỆN KHÁCH (CHƯA ĐĂNG NHẬP)
  if (!user) {
    return (
      <div className="space-y-16 py-8 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100 border border-orange-200 text-orange-700 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-orange-600" />
            <span>Đồ án Chuyên đề Công nghệ thông tin - Đại học Thủy Lợi</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-stone-900 tracking-tight leading-tight">
            Lưu giữ & Chia sẻ{' '}
            <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-rose-600 bg-clip-text text-transparent">
              Mọi Khoảnh Khắc
            </span>{' '}
            Ẩm Thực & Du Lịch
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-stone-600 leading-relaxed">
            Ghi lại những quán ăn ngon, quán cà phê đẹp kèm ảnh thực tế, giá cả và đánh giá chân thực.
            Chia sẻ có chọn lọc với bạn bè và tra cứu lại trên bản đồ cá nhân.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link
              href="/register"
              className="px-6 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all flex items-center gap-2"
            >
              <span>Bắt đầu trải nghiệm ngay</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="px-6 py-3.5 bg-white hover:bg-stone-50 text-stone-800 font-bold rounded-2xl border border-stone-200 shadow-sm transition-all"
            >
              Đăng nhập tài khoản demo
            </Link>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-stone-900">Trải nghiệm có cấu trúc</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Ảnh thực tế (1–5 ảnh đã xóa sạch EXIF), giá tham khảo, đánh giá 1–5 sao và chú thích chi tiết.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-stone-900">Tránh trùng địa điểm</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Gợi ý Place gần nhất bằng Geohash trong bán kính 150m/300m để người dùng tự xác nhận và tái sử dụng.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-stone-900">Định vị linh hoạt</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Tự động chuyển sang ghim kéo thả thủ công khi không có GPS hoặc người dùng từ chối quyền.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-stone-900">Bảo mật cấp tài liệu</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Kiểm soát phân quyền ở Security Rules. Chế độ ẩn vị trí tách biệt hoàn toàn tọa độ khỏi tài liệu chia sẻ.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-orange-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">Xin chào, {profile?.displayName || 'bạn'}! 👋</h1>
          <p className="text-sm text-orange-100 mt-1">Hôm nay bạn đã khám phá quán ăn hay địa điểm thú vị nào chưa?</p>
        </div>
        <Link
          href="/spots/new"
          id="home-create-spot-cta"
          className="px-5 py-3 bg-white text-orange-600 font-bold rounded-2xl shadow-md hover:bg-orange-50 transition-colors flex items-center gap-2 flex-shrink-0"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Tạo Spot Mới</span>
        </Link>
      </div>

      {/* Tìm kiếm & Lọc */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="feed-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên địa điểm hoặc từ khóa trong chú thích..."
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <button
            onClick={() => loadFeed(true)}
            disabled={loading}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
            title="Làm mới bảng tin"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-stone-600 font-semibold flex items-center gap-1 pl-1 pr-2 flex-shrink-0">
            <Filter className="w-3.5 h-3.5" />
            Lọc:
          </span>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex-shrink-0 transition-colors ${
              selectedCategory === 'all' ? 'bg-orange-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Tất cả
          </button>
          {PLACE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold flex-shrink-0 transition-colors ${
                selectedCategory === cat.id ? 'bg-orange-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 font-semibold text-stone-700">
            <Wallet className="w-3.5 h-3.5" />
            <span className="sr-only">Mức giá</span>
            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value as PriceFilter)}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg font-normal"
            >
              {PRICE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 font-semibold text-stone-700">
            <Star className="w-3.5 h-3.5" />
            <span className="sr-only">Đánh giá tối thiểu</span>
            <select
              value={minRating === null ? 'any' : String(minRating)}
              onChange={(e) => setMinRating(e.target.value === 'any' ? null : Number(e.target.value))}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg font-normal"
            >
              <option value="any">Mọi đánh giá</option>
              <option value="3">Từ 3 sao</option>
              <option value="4">Từ 4 sao</option>
              <option value="5">5 sao</option>
            </select>
          </label>

          {hasFilter && (
            <span className="text-stone-600">
              {filteredItems.length}/{feedItems.length} bài đã tải khớp bộ lọc
            </span>
          )}
        </div>

        <p className="text-[11px] text-stone-600">
          Giá và đánh giá là của từng Spot. Khi lọc cả hai, cùng một Spot phải thỏa cả hai điều kiện.
        </p>
      </div>

      {feedError && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between gap-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
            <p>{feedError}</p>
          </div>
          <button
            onClick={() => loadFeed(false)}
            disabled={loadingMore}
            className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold hover:bg-amber-100"
          >
            Thử lại
          </button>
        </div>
      )}

      <div className="space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-200 p-6 animate-pulse space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-stone-200" />
                  <div className="space-y-2">
                    <div className="w-32 h-4 bg-stone-200 rounded" />
                    <div className="w-20 h-3 bg-stone-200 rounded" />
                  </div>
                </div>
                <div className="w-full aspect-[16/9] bg-stone-200 rounded-xl" />
                <div className="w-3/4 h-4 bg-stone-200 rounded" />
              </div>
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="space-y-6">
            {filteredItems.map((item) => (
              <SpotCard
                key={item.spot.id}
                spot={item.spot}
                place={item.place}
                authorProfile={item.authorProfile}
                isLiked={item.likedByViewer}
                likeCount={item.likeCount}
                isBookmarked={
                  item.place
                    ? savedKeys.has(
                        getSavedPlaceKey(item.place.isPrivate ? 'private' : 'shared', item.place.id)
                      )
                    : false
                }
                onBookmarkChange={(bookmarked) => {
                  if (!item.place) return;
                  const key = getSavedPlaceKey(item.place.isPrivate ? 'private' : 'shared', item.place.id);
                  setSavedKeys((previous) => {
                    const next = new Set(previous);
                    if (bookmarked) next.add(key);
                    else next.delete(key);
                    return next;
                  });
                }}
                onDeleted={(id) => setFeedItems((previous) => previous.filter((f) => f.spot.id !== id))}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white p-12 rounded-3xl border border-stone-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-stone-900">
              {hasFilter ? 'Không tìm thấy bài viết phù hợp trong các bài đã tải' : 'Bảng tin chưa có bài viết nào'}
            </h3>
            <p className="text-xs text-stone-600 max-w-sm mx-auto">
              {hasFilter
                ? 'Thử đổi bộ lọc hoặc bấm "Tải thêm" để tìm trong các bài cũ hơn.'
                : 'Hãy đăng bài viết đầu tiên hoặc kết bạn với các thành viên khác để xem trải nghiệm của họ!'}
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <Link
                href="/spots/new"
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                Tạo Spot đầu tiên
              </Link>
              <Link
                href="/friends"
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Khám phá bạn bè
              </Link>
            </div>
          </div>
        )}

        {hasMore && !loading && (
          <div className="text-center">
            <button
              onClick={() => loadFeed(false)}
              disabled={loadingMore}
              className="px-6 py-3 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-sm font-semibold rounded-2xl shadow-sm disabled:opacity-60"
            >
              {loadingMore ? 'Đang tải thêm...' : 'Tải thêm bài viết'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
