import { describe, it, expect } from 'vitest';
import { normalizeVietnamese, getFriendshipPairId } from '../../src/lib/domain/schemas';

describe('Normalize and PairId Utils', () => {
  describe('normalizeVietnamese', () => {
    it('chuyển đúng chữ có dấu sang không dấu và viết thường', () => {
      expect(normalizeVietnamese('Cà phê Giảng')).toBe('ca phe giang');
      expect(normalizeVietnamese('BÚN CHẢ HƯƠNG LIÊN')).toBe('bun cha huong lien');
      expect(normalizeVietnamese('Đà Lạt & Đắk Lắk')).toBe('da lat & dak lak');
    });

    it('loại bỏ khoảng trắng thừa', () => {
      expect(normalizeVietnamese('   Phở   Bò   Hà   Nội   ')).toBe('pho bo ha noi');
    });

    it('xử lý chuỗi rỗng an toàn', () => {
      expect(normalizeVietnamese('')).toBe('');
    });
  });

  describe('getFriendshipPairId', () => {
    it('luôn trả về cùng một pairId bất kể thứ tự đối số truyền vào', () => {
      const pair1 = getFriendshipPairId('uid_alice_001', 'uid_bob_002');
      const pair2 = getFriendshipPairId('uid_bob_002', 'uid_alice_001');

      expect(pair1).toBe('uid_alice_001_uid_bob_002');
      expect(pair2).toBe('uid_alice_001_uid_bob_002');
      expect(pair1).toBe(pair2);
    });

    it('ngăn chặn người dùng tự kết bạn với chính mình', () => {
      expect(() => getFriendshipPairId('uid_alice_001', 'uid_alice_001')).toThrow(
        'Cannot pair user with themselves'
      );
    });

    it('báo lỗi nếu thiếu một trong hai UID', () => {
      expect(() => getFriendshipPairId('', 'uid_bob_002')).toThrow();
      expect(() => getFriendshipPairId('uid_alice_001', '')).toThrow();
    });
  });
});
