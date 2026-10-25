'use client';

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Navigation,
  Plus,
  Check,
  AlertTriangle,
  ZoomIn,
  RefreshCw,
  Search,
} from 'lucide-react';
import InteractiveMap from './map/InteractiveMap';
import { fetchNearbyPlaces } from '@/lib/data/places';
import { Place } from '@/lib/domain/types';
import { PlaceWithDistance } from '@/lib/geo';
import { APP_CONFIG, PLACE_CATEGORIES } from '@/lib/domain/config';
import { useAuth } from '@/features/auth/AuthContext';

interface PlacePickerProps {
  selectedPlace: Place | null;
  onSelectPlace: (place: Place | null) => void;
  onCoordinatesChange: (coords: { lat: number; lng: number }) => void;
  // Metadata nếu tạo Place mới
  newPlaceForm: {
    name: string;
    category: string;
    address: string;
    isPrivate: boolean;
  } | null;
  onNewPlaceFormChange: (form: {
    name: string;
    category: string;
    address: string;
    isPrivate: boolean;
  } | null) => void;
}

export default function PlacePicker({
  selectedPlace,
  onSelectPlace,
  onCoordinatesChange,
  onNewPlaceFormChange,
}: PlacePickerProps) {
  const { user } = useAuth();
  // Vị trí mặc định (Hà Nội: Hồ Hoàn Kiếm)
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: APP_CONFIG.geo.defaultCenter.latitude,
    lng: APP_CONFIG.geo.defaultCenter.longitude,
  });

  const [radius, setRadius] = useState<number>(APP_CONFIG.geo.defaultRadiusMeters);
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceWithDistance[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [isPartialQuery, setIsPartialQuery] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [accuracyWarning, setAccuracyWarning] = useState<string | null>(null);

  // Chế độ tạo Place mới
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [newPlaceCategory, setNewPlaceCategory] = useState(PLACE_CATEGORIES[0].id);
  const [newPlaceAddress, setNewPlaceAddress] = useState('');
  const [newPlaceIsPrivate, setNewPlaceIsPrivate] = useState(false);
  const [geocodingLoading, setGeocodingLoading] = useState(false);

  // Tải danh sách Place lân cận khi coords hoặc radius thay đổi
  useEffect(() => {
    let cancelled = false;
    fetchNearbyPlaces(
      { latitude: coords.lat, longitude: coords.lng },
      radius,
      user?.uid
    ).then(({ places, isPartial }) => {
      if (!cancelled) {
        setNearbyPlaces(places);
        setIsPartialQuery(isPartial);
        setLoadingPlaces(false);
      }
    }).catch((err) => {
      if (!cancelled) {
        console.error('Lỗi khi tải địa điểm lân cận:', err);
        setLoadingPlaces(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [coords.lat, coords.lng, radius, user?.uid]);

  const loadNearby = (targetCoords: { lat: number; lng: number }, r: number) => {
    setLoadingPlaces(true);
    setIsPartialQuery(false);
    fetchNearbyPlaces(
      { latitude: targetCoords.lat, longitude: targetCoords.lng },
      r,
      user?.uid
    ).then(({ places, isPartial }) => {
      setNearbyPlaces(places);
      setIsPartialQuery(isPartial);
      setLoadingPlaces(false);
    }).catch((err) => {
      console.error('Lỗi khi tải địa điểm lân cận:', err);
      setLoadingPlaces(false);
    });
  };

  // Cập nhật tọa độ khi ghim được kéo thả
  const handlePinMoved = (lat: number, lng: number) => {
    const updated = { lat, lng };
    setCoords(updated);
    onCoordinatesChange(updated);
    // Nếu đang mở form tạo mới, tự động gợi ý lại địa chỉ
    if (isCreatingNew) {
      fetchReverseGeocode(lat, lng);
    }
  };

  // Lấy vị trí thiết bị qua Geolocation API (1 lần)
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoNotice('Trình duyệt của bạn không hỗ trợ định vị GPS. Đã chuyển sang ghim thủ công.');
      return;
    }

    setLocating(true);
    setGeoNotice(null);
    setAccuracyWarning(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newCoords = { lat: latitude, lng: longitude };
        setCoords(newCoords);
        onCoordinatesChange(newCoords);
        setLocating(false);

        // Kiểm tra sai số lớn (> 100m)
        if (accuracy > 100) {
          setAccuracyWarning(
            `Sai số định vị hiện tại khá lớn (~${Math.round(accuracy)}m). Hãy kéo ghim trên bản đồ để xác định đúng vị trí!`
          );
        } else {
          setGeoNotice(`Đã lấy vị trí thành công (độ chính xác ~${Math.round(accuracy)}m).`);
        }

        if (isCreatingNew) {
          fetchReverseGeocode(latitude, longitude);
        }
      },
      (error) => {
        setLocating(false);
        let errorMsg = 'Không thể lấy vị trí hiện tại. Đã chuyển sang chế độ ghim trên bản đồ.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Bạn đã từ chối quyền định vị. Vui lòng kéo ghim thủ công trên bản đồ bên dưới.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Yêu cầu định vị quá thời gian. Đã chuyển sang chọn điểm thủ công.';
        }
        setGeoNotice(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Reverse geocoding để gợi ý địa chỉ
  const fetchReverseGeocode = async (lat: number, lng: number) => {
    setGeocodingLoading(true);
    try {
      const res = await fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data.success && data.displayName) {
        setNewPlaceAddress(data.displayName);
      }
    } catch {
      // Lỗi reverse geocoding không chặn người dùng
    } finally {
      setGeocodingLoading(false);
    }
  };

  // Mở form tạo Place mới
  const handleStartCreateNew = () => {
    setIsCreatingNew(true);
    onSelectPlace(null);
    fetchReverseGeocode(coords.lat, coords.lng);
  };

  // Cập nhật newPlaceForm cha khi state thay đổi
  useEffect(() => {
    if (isCreatingNew) {
      onNewPlaceFormChange({
        name: newPlaceName,
        category: newPlaceCategory,
        address: newPlaceAddress,
        isPrivate: newPlaceIsPrivate,
      });
    } else {
      onNewPlaceFormChange(null);
    }
  }, [isCreatingNew, newPlaceName, newPlaceCategory, newPlaceAddress, newPlaceIsPrivate]);

  return (
    <div className="space-y-4">
      {/* Nút định vị & thông báo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            id="btn-get-current-location"
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={locating}
            className="flex items-center gap-2 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            <Navigation className={`w-4 h-4 text-orange-600 ${locating ? 'animate-spin' : ''}`} />
            {locating ? 'Đang định vị...' : 'Dùng vị trí hiện tại'}
          </button>
          <span className="text-xs text-stone-600">hoặc kéo ghim trên bản đồ</span>
        </div>

        {/* Nút mở rộng bán kính */}
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <span>Vùng tìm kiếm:</span>
          <button
            type="button"
            onClick={() => setRadius(radius === 150 ? 300 : 150)}
            className="px-2.5 py-1 bg-stone-100 hover:bg-orange-50 hover:text-orange-600 rounded-lg font-semibold transition-colors flex items-center gap-1"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            {radius} mét
          </button>
        </div>
      </div>

      {geoNotice && (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-800">
          {geoNotice}
        </div>
      )}

      {accuracyWarning && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-2 text-xs text-orange-800">
          <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <span>{accuracyWarning}</span>
        </div>
      )}

      {/* Bản đồ định vị và kéo ghim */}
      <div className="relative">
        <InteractiveMap
          center={[coords.lat, coords.lng]}
          zoom={16}
          draggablePin={{
            latitude: coords.lat,
            longitude: coords.lng,
            onDragEnd: handlePinMoved,
          }}
          places={nearbyPlaces}
          onPlaceSelect={(p) => {
            setIsCreatingNew(false);
            onSelectPlace(p);
          }}
          height="280px"
        />
        <div className="absolute top-2 right-2 z-10 bg-white/95 backdrop-blur px-2.5 py-1 rounded-md text-[11px] font-mono text-stone-600 shadow-sm border border-stone-200">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </div>
      </div>

      {/* Danh sách Gợi ý Place gần đây */}
      <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-orange-600" />
            <h4 className="text-sm font-bold text-stone-900">
              Địa điểm gần ghim ({nearbyPlaces.length})
            </h4>
          </div>
          <button
            type="button"
            onClick={() => loadNearby(coords, radius)}
            className="p-1 text-stone-600 hover:text-stone-800 rounded hover:bg-stone-200 transition-colors"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPlaces ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isPartialQuery && (
          <div className="mb-3 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 flex items-center justify-between">
            <span>Danh sách có thể chưa đầy đủ do một khoảng geohash bị lỗi.</span>
            <button
              type="button"
              onClick={() => loadNearby(coords, radius)}
              className="font-semibold underline ml-2"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Danh sách cuộn các Place */}
        <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
          {nearbyPlaces.map((place) => {
            const isSelected = selectedPlace?.id === place.id && !isCreatingNew;
            return (
              <div
                key={place.id}
                onClick={() => {
                  setIsCreatingNew(false);
                  onSelectPlace(place);
                }}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start justify-between ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50 shadow-sm ring-1 ring-orange-500'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <div className="flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-stone-900">{place.name}</span>
                    {place.isPrivate && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded">
                        Riêng tư
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 line-clamp-1 mt-0.5">{place.address}</p>
                  <span className="inline-block mt-1 text-[11px] font-medium text-orange-600">
                    Cách khoảng {place.distanceMeters}m
                  </span>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {nearbyPlaces.length === 0 && !loadingPlaces && (
            <div className="py-6 text-center text-xs text-stone-600">
              <Search className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              <p>Chưa có địa điểm nào trong bán kính {radius}m.</p>
              {radius < 300 && (
                <button
                  type="button"
                  onClick={() => setRadius(300)}
                  className="mt-2 text-orange-600 font-semibold underline hover:text-orange-700"
                >
                  Mở rộng tìm kiếm lên 300m
                </button>
              )}
            </div>
          )}
        </div>

        {/* Nút chọn tạo địa điểm mới */}
        <div className="mt-3 pt-3 border-t border-stone-200">
          {!isCreatingNew ? (
            <button
              id="btn-open-create-place"
              type="button"
              onClick={handleStartCreateNew}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-orange-300 hover:border-orange-500 bg-orange-50/40 hover:bg-orange-50 text-orange-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Không có trong danh sách? Tạo địa điểm mới tại ghim này
            </button>
          ) : (
            <div className="p-3.5 bg-white border-2 border-orange-500 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">
                  Tạo địa điểm mới tại tọa độ đã ghim
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="text-xs text-stone-600 hover:text-stone-800"
                >
                  Hủy tạo mới
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Tên địa điểm (2–120 ký tự) *
                </label>
                <input
                  id="new-place-name-input"
                  type="text"
                  value={newPlaceName}
                  onChange={(e) => setNewPlaceName(e.target.value)}
                  placeholder="Ví dụ: Quán Bún Bò Huế Cô Lan"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Danh mục *</label>
                  <select
                    id="new-place-category-select"
                    value={newPlaceCategory}
                    onChange={(e) => setNewPlaceCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    {PLACE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Địa chỉ (tự gợi ý hoặc sửa tay)
                  </label>
                  <input
                    id="new-place-address-input"
                    type="text"
                    value={newPlaceAddress}
                    onChange={(e) => setNewPlaceAddress(e.target.value)}
                    placeholder={geocodingLoading ? 'Đang tra cứu địa chỉ...' : 'Số nhà, tên phố, quận...'}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Checkbox tạo Dùng chung vs Riêng tư theo mục 5 */}
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700">
                  <input
                    type="checkbox"
                    checked={!newPlaceIsPrivate}
                    onChange={(e) => setNewPlaceIsPrivate(!e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded border-stone-300 focus:ring-orange-500"
                  />
                  <span>
                    Xác nhận cho phép chia sẻ địa điểm này để cộng đồng cùng sử dụng (Shared Place)
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
