'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import { fetchUserSavedPlaces } from '@/lib/data/saved-places';
import { fetchPlacesByIds } from '@/lib/data/places';
import { fetchOwnSpotLocations, fetchUserSpots } from '@/lib/data/spots';
import { getSavedPlaceKey } from '@/lib/domain/schemas';
import { Place, SavedPlace } from '@/lib/domain/types';
import { APP_CONFIG, PLACE_CATEGORIES } from '@/lib/domain/config';
import InteractiveMap from '@/components/map/InteractiveMap';
import { MapMarkerItem } from '@/components/map/LeafletMapInner';
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Compass,
  List,
  MapPin,
  Navigation,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';

interface MapPlaceEntry {
  key: string;
  place: Place;
  hasVisited: boolean;
  isBookmarked: boolean;
  ownSpotCount: number;
  lastVisitedAt: SavedPlace['lastVisitedAt'];
}

type BaseFilter = 'all' | 'visited' | 'bookmarked';

export default function PersonalMapPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<MapPlaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseFilter, setBaseFilter] = useState<BaseFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const [savedPlaces, ownSpots, ownLocations] = await Promise.all([
        fetchUserSavedPlaces(user.uid),
        fetchUserSpots(user.uid),
        fetchOwnSpotLocations(user.uid),
      ]);

      const placeMap = await fetchPlacesByIds(
        savedPlaces.map((saved) => saved.placeId),
        user.uid
      );

      // Đếm số lần ghé của chính mình theo từng Place (gồm cả Spot ẩn vị trí).
      const ownSpotCounts = new Map<string, number>();
      const bump = (key: string) => {
        ownSpotCounts.set(key, (ownSpotCounts.get(key) ?? 0) + 1);
      };
      ownSpots.forEach((spot) => {
        if (spot.locationMode === 'hidden') {
          const location = ownLocations.get(spot.id);
          if (location) {
            bump(getSavedPlaceKey(location.placeScope, location.placeKey));
          }
          return;
        }
        if (!spot.placeId) return;
        const place = placeMap.get(spot.placeId);
        bump(getSavedPlaceKey(place?.isPrivate ? 'private' : 'shared', spot.placeId));
      });

      const nextEntries: MapPlaceEntry[] = [];
      savedPlaces.forEach((saved) => {
        const place = placeMap.get(saved.placeId);
        if (!place) return;
        const key = getSavedPlaceKey(saved.placeScope, saved.placeId);
        nextEntries.push({
          key,
          place,
          hasVisited: Boolean(saved.hasVisited),
          isBookmarked: Boolean(saved.isBookmarked),
          ownSpotCount: ownSpotCounts.get(key) ?? 0,
          lastVisitedAt: saved.lastVisitedAt,
        });
      });

      nextEntries.sort((a, b) => a.place.name.localeCompare(b.place.name, 'vi'));
      setEntries(nextEntries);
    } catch (err) {
      console.error('Lỗi khi tải bản đồ cá nhân:', err);
      setError('Không tải được bản đồ cá nhân. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // loadData đặt loading ngay; chạy ở microtask để không setState đồng bộ trong effect.
    if (user) queueMicrotask(loadData);
  }, [user, loadData]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (baseFilter === 'visited' && !entry.hasVisited) return false;
      if (baseFilter === 'bookmarked' && !entry.isBookmarked) return false;
      if (categoryFilter !== 'all' && entry.place.category !== categoryFilter) return false;
      return true;
    });
  }, [entries, baseFilter, categoryFilter]);

  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => entry.key === selectedKey) ?? null,
    [filteredEntries, selectedKey]
  );

  const markers = useMemo<MapMarkerItem[]>(
    () =>
      filteredEntries.map((entry) => ({
        id: entry.key,
        name: entry.place.name,
        category: entry.place.category,
        address: entry.place.address,
        latitude: entry.place.latitude,
        longitude: entry.place.longitude,
        isPrivate: entry.place.isPrivate,
        onClick: () => setSelectedKey(entry.key),
      })),
    [filteredEntries]
  );

  const center = useMemo<[number, number]>(() => {
    const anchor = selectedEntry ?? filteredEntries[0];
    if (anchor) return [anchor.place.latitude, anchor.place.longitude];
    return [
      APP_CONFIG.geo.defaultCenter.latitude,
      APP_CONFIG.geo.defaultCenter.longitude,
    ];
  }, [filteredEntries, selectedEntry]);

  const openDirections = (place: Place) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-4">
        <h2 className="text-xl font-bold text-stone-900">Yêu cầu đăng nhập</h2>
        <p className="text-sm text-stone-600">
          Vui lòng đăng nhập để xem bản đồ địa điểm đã ghé và đã lưu của bạn.
        </p>
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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 flex items-center gap-2">
            <Compass className="w-6 h-6 text-orange-600" />
            Bản đồ cá nhân
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Mỗi địa điểm chỉ có một dấu, dù bạn đã ghé nhiều lần. Dấu bản đồ chỉ dùng tọa độ bạn
            được phép xem.
          </p>
        </div>
        <Link
          href="/spots/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-orange-500/20"
        >
          <PlusCircle className="w-4 h-4" />
          Tạo Spot
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start justify-between gap-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
            <p>{error}</p>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1.5 bg-white border border-red-300 rounded-lg text-xs font-semibold hover:bg-red-100"
          >
            Thử lại
          </button>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(
            [
              { id: 'all', label: 'Tất cả', icon: List },
              { id: 'visited', label: 'Đã ghé', icon: CheckCircle2 },
              { id: 'bookmarked', label: 'Đã lưu', icon: Bookmark },
            ] as const
          ).map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => setBaseFilter(filter.id)}
                aria-pressed={baseFilter === filter.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  baseFilter === filter.id
                    ? 'bg-orange-600 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {filter.label}
              </button>
            );
          })}

          <label className="flex items-center gap-1.5 font-semibold text-stone-700 ml-auto">
            <span>Danh mục</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg font-normal"
            >
              <option value="all">Tất cả danh mục</option>
              {PLACE_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-semibold disabled:opacity-60"
            title="Tải lại bản đồ"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        <p className="text-[11px] text-stone-600">
          Đang hiển thị {filteredEntries.length}/{entries.length} địa điểm. Bộ lọc danh mục áp dụng
          trên danh mục của Place.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl overflow-hidden border border-stone-200 bg-white">
            <InteractiveMap center={center} zoom={14} markers={markers} height="440px" />
          </div>

          {selectedEntry && (
            <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-stone-900">{selectedEntry.place.name}</h3>
                  <p className="text-xs text-stone-600">{selectedEntry.place.address}</p>
                </div>
                <span className="text-[11px] px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-semibold flex-shrink-0">
                  {selectedEntry.place.category}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px]">
                {selectedEntry.hasVisited && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    Đã ghé
                  </span>
                )}
                {selectedEntry.isBookmarked && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full font-semibold">
                    <Bookmark className="w-3 h-3 fill-amber-700" />
                    Đã lưu
                  </span>
                )}
                {selectedEntry.ownSpotCount > 0 && (
                  <span className="px-2 py-0.5 bg-stone-100 text-stone-700 rounded-full">
                    {selectedEntry.ownSpotCount} lần ghé của bạn
                  </span>
                )}
                {selectedEntry.place.isPrivate && (
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                    Địa điểm riêng tư
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={`/places/${selectedEntry.place.id}`}
                  className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg"
                >
                  Xem chi tiết
                </Link>
                <button
                  onClick={() => openDirections(selectedEntry.place)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Mở chỉ đường
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <h2 className="px-4 pt-4 pb-2 text-sm font-bold text-stone-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-600" />
              Danh sách địa điểm
            </h2>

            {loading ? (
              <div className="px-4 pb-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="px-4 pb-5 text-xs text-stone-600 space-y-2">
                <p>
                  {entries.length === 0
                    ? 'Bạn chưa ghé hay lưu địa điểm nào. Hãy tạo Spot đầu tiên hoặc lưu địa điểm từ bảng tin.'
                    : 'Không có địa điểm nào khớp bộ lọc hiện tại.'}
                </p>
                <Link
                  href="/"
                  className="inline-block px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold"
                >
                  Về bảng tin
                </Link>
              </div>
            ) : (
              <ul className="max-h-[440px] overflow-y-auto divide-y divide-stone-100">
                {filteredEntries.map((entry) => (
                  <li key={entry.key}>
                    <button
                      onClick={() => setSelectedKey(entry.key)}
                      className={`w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors ${
                        selectedKey === entry.key ? 'bg-orange-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-900 truncate">
                            {entry.place.name}
                          </p>
                          <p className="text-[11px] text-stone-600 line-clamp-1">
                            {entry.place.address}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {entry.hasVisited && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold">
                              Đã ghé
                            </span>
                          )}
                          {entry.isBookmarked && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded font-semibold">
                              Đã lưu
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
