import { describe, it, expect } from 'vitest';
import { PlaceInputSchema, SpotInputSchema } from '../../src/lib/domain/schemas';

describe('Domain Validators (Zod Schemas)', () => {
  describe('PlaceInputSchema', () => {
    it('chấp nhận địa điểm hợp lệ', () => {
      const validPlace = {
        name: 'Cà phê Giảng',
        category: 'cafe',
        address: '39 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội',
        latitude: 21.034182,
        longitude: 105.853284,
        isPrivate: false,
      };
      const result = PlaceInputSchema.safeParse(validPlace);
      expect(result.success).toBe(true);
    });

    it('từ chối tên địa điểm quá ngắn (< 2 ký tự) hoặc quá dài (> 120 ký tự)', () => {
      const tooShort = {
        name: 'A',
        category: 'cafe',
        address: 'Hà Nội',
        latitude: 21.0,
        longitude: 105.8,
      };
      expect(PlaceInputSchema.safeParse(tooShort).success).toBe(false);

      const tooLong = {
        name: 'A'.repeat(121),
        category: 'cafe',
        address: 'Hà Nội',
        latitude: 21.0,
        longitude: 105.8,
      };
      expect(PlaceInputSchema.safeParse(tooLong).success).toBe(false);
    });

    it('từ chối tọa độ ngoài phạm vi WGS84', () => {
      const invalidLat = {
        name: 'Quán Phở',
        category: 'restaurant',
        address: 'Hà Nội',
        latitude: 95.0, // > 90
        longitude: 105.8,
      };
      expect(PlaceInputSchema.safeParse(invalidLat).success).toBe(false);

      const invalidLng = {
        name: 'Quán Phở',
        category: 'restaurant',
        address: 'Hà Nội',
        latitude: 21.0,
        longitude: 195.0, // > 180
      };
      expect(PlaceInputSchema.safeParse(invalidLng).success).toBe(false);
    });
  });

  describe('SpotInputSchema', () => {
    it('chấp nhận Spot hợp lệ với đánh giá và giá tiền', () => {
      const validSpot = {
        placeId: 'place_123',
        locationMode: 'exact' as const,
        imagePaths: ['spots/user1/spot1/img1.jpg'],
        category: 'cafe',
        priceVnd: 45000,
        rating: 5,
        caption: 'Cà phê rất ngon!',
        visibility: 'public' as const,
      };
      const result = SpotInputSchema.safeParse(validSpot);
      expect(result.success).toBe(true);
    });

    it('phân biệt chính xác giữa priceVnd = null (chưa nhập) và priceVnd = 0 (miễn phí)', () => {
      const nullPriceSpot = {
        placeId: 'place_123',
        locationMode: 'exact' as const,
        imagePaths: ['spots/user1/spot1/img1.jpg'],
        category: 'cafe',
        priceVnd: null,
        rating: null,
        caption: '',
        visibility: 'public' as const,
      };
      const nullParsed = SpotInputSchema.safeParse(nullPriceSpot);
      expect(nullParsed.success).toBe(true);
      if (nullParsed.success) {
        expect(nullParsed.data.priceVnd).toBeNull();
      }

      const zeroPriceSpot = {
        ...nullPriceSpot,
        priceVnd: 0,
      };
      const zeroParsed = SpotInputSchema.safeParse(zeroPriceSpot);
      expect(zeroParsed.success).toBe(true);
      if (zeroParsed.success) {
        expect(zeroParsed.data.priceVnd).toBe(0);
      }
    });

    it('từ chối priceVnd âm', () => {
      const negativePrice = {
        placeId: 'place_123',
        locationMode: 'exact' as const,
        imagePaths: ['spots/user1/spot1/img1.jpg'],
        category: 'cafe',
        priceVnd: -5000,
        rating: 4,
        caption: '',
        visibility: 'public' as const,
      };
      expect(SpotInputSchema.safeParse(negativePrice).success).toBe(false);
    });

    it('từ chối rating ngoài khoảng 1..5', () => {
      const ratingZero = {
        placeId: 'place_123',
        locationMode: 'exact' as const,
        imagePaths: ['spots/user1/spot1/img1.jpg'],
        category: 'cafe',
        priceVnd: 20000,
        rating: 0, // < 1
        caption: '',
        visibility: 'public' as const,
      };
      expect(SpotInputSchema.safeParse(ratingZero).success).toBe(false);

      const ratingSix = {
        ...ratingZero,
        rating: 6, // > 5
      };
      expect(SpotInputSchema.safeParse(ratingSix).success).toBe(false);
    });

    it('bắt buộc giới hạn ảnh từ 1 đến 5', () => {
      const zeroImages = {
        placeId: 'place_123',
        locationMode: 'exact' as const,
        imagePaths: [],
        category: 'cafe',
        priceVnd: 20000,
        rating: 4,
        caption: '',
        visibility: 'public' as const,
      };
      expect(SpotInputSchema.safeParse(zeroImages).success).toBe(false);

      const sixImages = {
        ...zeroImages,
        imagePaths: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg'],
      };
      expect(SpotInputSchema.safeParse(sixImages).success).toBe(false);
    });

    it('bắt buộc placeId == null khi locationMode == "hidden"', () => {
      const hiddenWithPlaceId = {
        placeId: 'place_123', // Sai: phải là null
        locationMode: 'hidden' as const,
        imagePaths: ['1.jpg'],
        category: 'cafe',
        priceVnd: 20000,
        rating: 4,
        caption: 'Quán bí mật',
        visibility: 'public' as const,
      };
      expect(SpotInputSchema.safeParse(hiddenWithPlaceId).success).toBe(false);

      const validHidden = {
        ...hiddenWithPlaceId,
        placeId: null,
      };
      expect(SpotInputSchema.safeParse(validHidden).success).toBe(true);
    });
  });
});
