import { PlaceCategory } from './types';

export const APP_CONFIG = {
  appName: 'Rocket24h',
  appDescription: 'Nhật ký trải nghiệm ẩm thực & du lịch',
  
  // Vị trí & Geohash
  geo: {
    defaultRadiusMeters: 150,
    expandedRadiusMeters: 300,
    geohashPrecision: 9,
    // Vị trí mặc định (Hà Nội: Hồ Hoàn Kiếm)
    defaultCenter: {
      latitude: 21.028511,
      longitude: 105.854444,
    },
  },

  // Ảnh & Media
  images: {
    minCount: 1,
    maxCount: 5,
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
    maxDimension: 1920, // nén kích thước tối đa 1920px
  },

  // Giới hạn chuỗi
  validation: {
    placeNameMin: 2,
    placeNameMax: 120,
    captionMax: 1000,
    displayNameMin: 2,
    displayNameMax: 60,
  },

  // Phân trang
  pagination: {
    feedPageSize: 20,
    notificationsPageSize: 20,
  },

  // Tile map
  map: {
    tileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },

  // Geocoding
  nominatim: {
    minIntervalMs: 1000, // <= 1 request / second
    userAgent: 'Rocket24h-App/1.0 (academic-project: chuyende-cntt-tlu)',
  },
};

export const PLACE_CATEGORIES: PlaceCategory[] = [
  { id: 'restaurant', label: 'Quán ăn / Nhà hàng', icon: 'Utensils' },
  { id: 'cafe', label: 'Cà phê & Trà sữa', icon: 'Coffee' },
  { id: 'street_food', label: 'Ăn vặt & Vỉa hè', icon: 'Store' },
  { id: 'tourism', label: 'Điểm du lịch & Check-in', icon: 'Camera' },
  { id: 'nightlife', label: 'Quán Bar & Pub', icon: 'Wine' },
  { id: 'entertainment', label: 'Vui chơi giải trí', icon: 'Compass' },
  { id: 'other', label: 'Khác', icon: 'MapPin' },
];
