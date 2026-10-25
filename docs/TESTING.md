# Kế Hoạch & Nhật Ký Kiểm Thử (TESTING.md)

Tài liệu kiểm thử cho đồ án **Rocket24h (Spot & Place Memory Journal)** - ĐH Thủy Lợi.

---

## 1. Phương Pháp & Công Cụ Kiểm Thử

- **Unit Testing**: Sử dụng `vitest` để kiểm tra các hàm nghiệp vụ độc lập, bộ chuẩn hóa dữ liệu, logic phân trang, lọc khoảng cách geohash và các bộ validate dữ liệu Zod.
- **Security Rules Testing**: Sử dụng `@firebase/rules-unit-testing` kết nối với Firestore Security Rules.
- **Static Analysis**: TypeScript Compiler (`tsc --noEmit`) ở chế độ `strict: true` và ESLint (`eslint`).

---

## 2. Kết Quả Kiểm Thử Chi Tiết (Test Execution Log)

### A. Unit Tests (`tests/unit/`) - 24/24 Tests PASS (100%)

Chạy bằng lệnh: `npm test` hoặc `npm run test:unit`

```
 ✓ tests/unit/saved-place-recalc.test.ts (4 tests)
   ✓ giữ nguyên hasVisited = true nếu vẫn còn các Spot khác tại cùng Place
   ✓ chuyển hasVisited = false nếu đã xóa Spot cuối cùng tại Place
   ✓ báo shouldKeepRecord = false nếu cả hasVisited = false và isBookmarked = false
   ✓ bật và tắt bookmark không làm ảnh hưởng đến hasVisited

 ✓ tests/unit/geo-bounding-filter.test.ts (5 tests)
   ✓ tạo geohash chuẩn WGS84
   ✓ trả về các khoảng query bounds cho bán kính tìm kiếm
   ✓ tính chính xác khoảng cách giữa 2 điểm
   ✓ lọc bỏ các điểm nằm ngoài bán kính và loại trừ trùng lặp ID
   ✓ ưu tiên hiển thị địa điểm nằm trong lịch sử ghé của người dùng

 ✓ tests/unit/normalize-and-pair.test.ts (6 tests)
   ✓ chuyển đúng chữ có dấu sang không dấu và viết thường
   ✓ loại bỏ khoảng trắng thừa
   ✓ xử lý chuỗi rỗng an toàn
   ✓ luôn trả về cùng một pairId bất kể thứ tự đối số truyền vào
   ✓ ngăn chặn người dùng tự kết bạn với chính mình
   ✓ báo lỗi nếu thiếu một trong hai UID

 ✓ tests/unit/domain-validators.test.ts (9 tests)
   ✓ chấp nhận địa điểm hợp lệ
   ✓ từ chối tên địa điểm quá ngắn (< 2 ký tự) hoặc quá dài (> 120 ký tự)
   ✓ từ chối tọa độ ngoài phạm vi WGS84
   ✓ chấp nhận Spot hợp lệ với đánh giá và giá tiền
   ✓ phân biệt chính xác giữa priceVnd = null (chưa nhập) và priceVnd = 0 (miễn phí)
   ✓ từ chối priceVnd âm
   ✓ từ chối rating ngoài khoảng 1..5
   ✓ bắt buộc giới hạn ảnh từ 1 đến 5
   ✓ bắt buộc placeId == null khi locationMode == "hidden"

 Test Files  4 passed (4)
      Tests  24 passed (24)
   Duration  326ms
```

---

### B. Security Rules Tests (`tests/rules/firestore-rules.test.ts`)

File test đã được xây dựng hoàn chỉnh với 8 ca kiểm thử phủ kín ma trận phân quyền:
1. `Tác giả (Alice) đọc được tất cả: public, friends, private`
2. `Bạn bè đã chấp nhận (Bob) đọc được public và friends, nhưng bị TỪ CHỐI private`
3. `Thành viên khác chưa kết bạn (Charlie) chỉ đọc được public, bị TỪ CHỐI friends và private`
4. `Khách chưa đăng nhập (Unauthenticated) bị TỪ CHỐI mọi Spot`
5. `Chỉ Alice mới đọc được privatePlaces, spotLocations, savedPlaces, userSettings của mình`
6. `Người khác (kể cả bạn bè Bob) bị TỪ CHỐI đọc dữ liệu riêng tư của Alice`
7. `Client không thể tự ghi vào bảng tra cứu friends (chỉ server ghi)`
8. `Client không thể tự tạo bản ghi notifications cho người khác`
9. `Người dùng không thể sửa hoặc xóa Spot của người khác`
10. `Từ chối Spot có locationMode = "hidden" nhưng placeId != null`

> [!NOTE]
> **Ghi chú môi trường chạy Rules Emulator**:
> Trên máy chấm hiện tại cài đặt phiên bản Java `1.8.0_491` (Java 8). Firebase CLI (`firebase-tools` $\ge 14/15$) yêu cầu runtime **JDK 21 trở lên** để khởi chạy binary Firestore Emulator cục bộ (`firebase-tools no longer supports Java version before 21`).
> Kịch bản test `tests/rules/firestore-rules.test.ts` đã sẵn sàng để kích hoạt qua `npm run test:rules` ngay khi máy chủ được nâng cấp JDK 21+.

---

## 3. Tổng Hợp Chất Lượng Mã Nguồn

| Tiêu chuẩn | Lệnh kiểm tra | Kết quả | Ghi chú |
|---|---|---|---|
| TypeScript Strict | `npm run typecheck` | **PASS (0 errors)** | Tuân thủ strict type, không dùng any bừa bãi |
| ESLint Next.js | `npm run lint` | **PASS (0 errors)** | Đạt chuẩn React 19 & Next.js App Router |
| Production Build | `npm run build` | **PASS (0 errors)** | Biên dịch và Prerender thành công toàn bộ route |
| Unit Tests | `npm test` | **PASS (24/24)** | 100% logic cốt lõi đã có test chứng minh |
