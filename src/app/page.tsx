'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import { loadFeedPage, FeedItem } from '@/features/feed/feed-loader';
import SpotCard from '@/components/SpotCard';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
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
} from 'lucide-react';
import { PLACE_CATEGORIES } from '@/lib/domain/config';

export default function HomePage() {
  const { user, profile } = useAuth();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likedSpotIds, setLikedSpotIds] = useState<Set<string>>(new Set());

  // Tìm kiếm & Lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadFeed = async () => {
    if (!user) return;
    try {
      // 1. Lấy danh sách bạn bè đã chấp nhận
      const friendsSnap = await getDocs(collection(db, `users/${user.uid}/friends`));
      const friendUids: string[] = [];
      friendsSnap.forEach((d) => friendUids.push(d.id));

      // 2. Tải feed đa nguồn có kiểm soát quyền
      const items = await loadFeedPage(user.uid, friendUids, 20);
      setFeedItems(items);

      // 3. Tải danh sách like của user cho các bài này
      const userLikes = new Set<string>();
      await Promise.all(
        items.map(async (item) => {
          try {
            const likeSnap = await getDoc(doc(db, `spots/${item.spot.id}/likes`, user.uid));
            if (likeSnap.exists()) {
              userLikes.add(item.spot.id);
            }
          } catch {
            // bỏ qua
          }
        })
      );
      setLikedSpotIds(userLikes);
    } catch (err) {
      console.error('Lỗi khi tải bảng tin:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      if (user) {
        loadFeed();
      } else {
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Xử lý Thích / Bỏ thích (Optimistic UI kèm rollback)
  const handleLikeToggle = async (spotId: string) => {
    if (!user) return;

    const isCurrentlyLiked = likedSpotIds.has(spotId);
    const nextSet = new Set(likedSpotIds);
    if (isCurrentlyLiked) {
      nextSet.delete(spotId);
    } else {
      nextSet.add(spotId);
    }
    setLikedSpotIds(nextSet);

    try {
      const likeRef = doc(db, `spots/${spotId}/likes`, user.uid);
      if (isCurrentlyLiked) {
        await deleteDoc(likeRef);
      } else {
        await setDoc(likeRef, {
          userId: user.uid,
          createdAt: new Date(),
        });
      }
    } catch (err) {
      console.error('Lỗi like:', err);
      // Rollback
      setLikedSpotIds(likedSpotIds);
    }
  };

  // Lọc bài viết theo ô tìm kiếm và danh mục
  const filteredItems = feedItems.filter((item) => {
    const s = item.spot;
    const p = item.place;

    // Lọc theo danh mục
    if (selectedCategory !== 'all' && s.category !== selectedCategory) {
      return false;
    }

    // Lọc theo từ khóa tìm kiếm
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchCaption = s.caption?.toLowerCase().includes(term);
      const matchPlace = p?.name?.toLowerCase().includes(term) || p?.address?.toLowerCase().includes(term);
      if (!matchCaption && !matchPlace) return false;
    }

    return true;
  });

  // GIAO DIỆN KHÁCH (CHƯA ĐĂNG NHẬP)
  if (!user) {
    return (
      <div className="space-y-16 py-8 sm:py-16">
        {/* Hero Section */}
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

        {/* 4 Trụ Cột Đề Tài */}
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

  // GIAO DIỆN BẢNG TIN CHO THÀNH VIÊN ĐÃ ĐĂNG NHẬP
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner / Chào mừng */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-orange-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Xin chào, {profile?.displayName || 'bạn'}! 👋
          </h1>
          <p className="text-sm text-orange-100 mt-1">
            Hôm nay bạn đã khám phá quán ăn hay địa điểm thú vị nào chưa?
          </p>
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

      {/* Bộ lọc và Tìm kiếm */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Ô tìm kiếm */}
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
            onClick={() => {
              setRefreshing(true);
              loadFeed();
            }}
            disabled={refreshing}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
            title="Làm mới bảng tin"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* Danh mục lọc ngang */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-stone-600 font-semibold flex items-center gap-1 pl-1 pr-2 flex-shrink-0">
            <Filter className="w-3.5 h-3.5" />
            Lọc:
          </span>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex-shrink-0 transition-colors ${
              selectedCategory === 'all'
                ? 'bg-orange-600 text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Tất cả
          </button>
          {PLACE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold flex-shrink-0 transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-orange-600 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Danh sách bài viết (Feed List) */}
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-stone-200 p-6 animate-pulse space-y-4"
              >
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
                isLiked={likedSpotIds.has(item.spot.id)}
                onLikeToggle={() => handleLikeToggle(item.spot.id)}
                onDeleted={(id) => setFeedItems(feedItems.filter((f) => f.spot.id !== id))}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white p-12 rounded-3xl border border-stone-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-stone-900">
              {searchTerm || selectedCategory !== 'all'
                ? 'Không tìm thấy bài viết phù hợp với bộ lọc'
                : 'Bảng tin chưa có bài viết nào'}
            </h3>
            <p className="text-xs text-stone-600 max-w-sm mx-auto">
              {searchTerm || selectedCategory !== 'all'
                ? 'Hãy thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục khác.'
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
      </div>
    </div>
  );
}
