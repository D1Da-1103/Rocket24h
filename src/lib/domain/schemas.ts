import { z } from 'zod';
import { APP_CONFIG } from './config';

/**
 * Hàm chuẩn hóa tên tiếng Việt (bỏ dấu, chuyển chữ thường, loại bỏ ký tự đặc biệt thừa)
 */
export function normalizeVietnamese(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Hàm tạo pairId xác định từ 2 UID (sắp xếp theo thứ tự từ điển)
 */
export function getFriendshipPairId(uidA: string, uidB: string): string {
  if (!uidA || !uidB) throw new Error('Both UIDs are required to generate pairId');
  if (uidA === uidB) throw new Error('Cannot pair user with themselves');
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

/**
 * Hàm sinh docId xác định cho SavedPlace để tránh tạo trùng bản ghi
 */
export function getSavedPlaceKey(placeScope: 'shared' | 'private', placeId: string): string {
  return `${placeScope}_${placeId}`;
}

// Zod Schema cho Place
export const PlaceInputSchema = z.object({
  name: z
    .string()
    .min(APP_CONFIG.validation.placeNameMin, { message: 'Tên địa điểm phải từ 2 ký tự trở lên' })
    .max(APP_CONFIG.validation.placeNameMax, { message: 'Tên địa điểm không được quá 120 ký tự' })
    .trim(),
  category: z.string().min(1, { message: 'Vui lòng chọn danh mục' }),
  address: z.string().min(2, { message: 'Vui lòng nhập hoặc xác nhận địa chỉ' }).trim(),
  latitude: z.number().min(-90).max(90, { message: 'Vĩ độ không hợp lệ' }),
  longitude: z.number().min(-180).max(180, { message: 'Kinh độ không hợp lệ' }),
  isPrivate: z.boolean().default(false),
});

// Zod Schema cho Spot
export const SpotInputSchema = z
  .object({
    placeId: z.string().nullable(),
    locationMode: z.enum(['exact', 'hidden']),
    imagePaths: z
      .array(z.string())
      .min(APP_CONFIG.images.minCount, { message: 'Cần ít nhất 1 ảnh trải nghiệm' })
      .max(APP_CONFIG.images.maxCount, { message: 'Tối đa 5 ảnh' }),
    category: z.string().min(1, { message: 'Vui lòng chọn danh mục' }),
    priceVnd: z
      .number()
      .int({ message: 'Giá tiền phải là số nguyên' })
      .min(0, { message: 'Giá tiền không được âm' })
      .nullable(),
    rating: z
      .number()
      .int()
      .min(1, { message: 'Đánh giá từ 1 đến 5 sao' })
      .max(5, { message: 'Đánh giá tối đa 5 sao' })
      .nullable(),
    caption: z
      .string()
      .max(APP_CONFIG.validation.captionMax, { message: 'Chú thích không được quá 1000 ký tự' })
      .default(''),
    visibility: z.enum(['public', 'friends', 'private']),
    visitedAt: z.any().optional(),
    // Metadata tạm nếu là tạo place mới cùng lúc
    newPlace: PlaceInputSchema.optional(),
  })
  .refine(
    (data) => {
      // Khi ẩn vị trí, placeId trong Spot public phải là null
      if (data.locationMode === 'hidden') {
        return data.placeId === null;
      }
      return data.placeId !== null || data.newPlace !== undefined;
    },
    {
      message: 'Khi chọn vị trí chính xác phải có Place ID hoặc tạo Place mới; khi chọn ẩn vị trí thì placeId phải là null',
      path: ['placeId'],
    }
  );

// Zod Schema cho User Profile
export const UserProfileSchema = z.object({
  displayName: z
    .string()
    .min(APP_CONFIG.validation.displayNameMin, { message: 'Tên hiển thị từ 2 ký tự' })
    .max(APP_CONFIG.validation.displayNameMax, { message: 'Tên hiển thị tối đa 60 ký tự' })
    .trim(),
  avatarPath: z.string().nullable().optional(),
});
