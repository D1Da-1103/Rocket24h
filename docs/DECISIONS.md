# Architecture & Project Decisions (DECISIONS.md)

Tài liệu này ghi lại các quyết định thiết kế kiến trúc, lựa chọn công nghệ và các quy ước nghiệp vụ của đồ án **Rocket24h (Spot & Place Memory Journal)** - Đồ án Chuyên đề CNTT (Đại học Thủy Lợi).

---

## 1. Các quyết định kỹ thuật từ câu hỏi xác nhận (Mục 14)

### Q1: Firebase Execution & Backend
- **Quyết định**: Sử dụng **Firebase Local Emulator Suite** (Auth, Firestore, Storage) cho môi trường phát triển & demo tại chỗ.
- **Xử lý phía Server**: Sử dụng **Next.js Route Handlers (`app/api/...`)** kết hợp với `firebase-admin` để thực hiện các nghiệp vụ tin cậy (kết bạn 2 chiều nguyên tử, tạo thông báo hệ thống, reverse geocoding có rate-limit & cache, dọn dẹp quan hệ). Không bắt buộc gói Blaze / Cloud Functions.
- **Lý do**: Không phụ thuộc chi phí đám mây, dễ dàng khởi chạy và nghiệm thu trên bất kỳ máy chấm bài nào thông qua `npm run emulators`.
- **Phương án thay thế**: Triển khai Firebase Cloud Functions (yêu cầu dự án Firebase thật có gói trả phí Blaze).

### Q2: Tile bản đồ (Map Tiles)
- **Quyết định**: Sử dụng **OpenStreetMap (OSM) Standard Tile** làm mặc định, bọc qua lớp trừu tượng `MapProvider` (Leaflet). Cấu hình URL template qua biến môi trường `NEXT_PUBLIC_MAP_TILE_URL` và `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`.
- **Lý do**: Hoàn toàn miễn phí, chuẩn mã nguồn mở, đầy đủ ghi nhận nguồn (attribution) tuân thủ chính sách OSM Tile Usage Policy.
- **Phương án thay thế**: MapTiler hoặc Google Maps JS API (yêu cầu cấu hình API Key riêng).

### Q3: Dịch vụ Reverse Geocoding
- **Quyết định**: Sử dụng API **Nominatim của OpenStreetMap** thông qua Route Handler trung gian `/api/geo/reverse`.
- **Cơ chế**:
  - Tuân thủ rate limit nghiêm ngặt $\le 1$ request/giây toàn ứng dụng.
  - Tích hợp in-memory cache trên server (làm tròn tọa độ tới 4 chữ số thập phân ~11m) để tái sử dụng kết quả khi người dùng rê chuột/kéo ghim quanh vị trí cũ.
  - Đính kèm header `User-Agent: Rocket24h-App/1.0 (contact: admin@rocket24h.local)` nhận diện ứng dụng.
  - Không bao giờ chặn quy trình tạo Spot nếu Nominatim timeout hoặc trả về lỗi: người dùng luôn có thể tự nhập/chỉnh sửa tên và địa chỉ thủ công.
- **Phương án thay thế**: Mapbox Geocoding API hoặc Google Geocoding API.

### Q4: Nền tảng triển khai (Deployment)
- **Quyết định**: Tối ưu hóa trước hết cho **Vercel** (hỗ trợ tự nhiên Next.js App Router, Route Handlers, SSR/dynamic loading), đồng thời hỗ trợ đóng gói Node.js / Docker.
- **Phương án thay thế**: Firebase Hosting với Next.js Web Frameworks experimental.

### Q5: Dữ liệu mẫu (Seed Data)
- **Quyết định**: Cung cấp kịch bản `npm run seed` tự động nạp dữ liệu mẫu vào Firebase Emulators:
  - 3 người dùng thử nghiệm:
    - User A: `demo_user1@rocket24h.vn` (UID: `uid_alice_001`)
    - User B: `demo_user2@rocket24h.vn` (UID: `uid_bob_002`)
    - User C: `demo_user3@rocket24h.vn` (UID: `uid_charlie_003`)
  - Trạng thái kết bạn có sẵn (Alice & Bob là bạn bè; Charlie chưa kết bạn).
  - ~10 địa điểm (Places) tại khu vực trung tâm Hà Nội (Hồ Hoàn Kiếm, Hồ Tây, Phố Cổ, Đống Đa, Cầu Giấy) với tọa độ và geohash chuẩn WGS84.
  - ~15 bài trải nghiệm (Spots) trải dài các phạm vi `public`, `friends`, `private` và chế độ vị trí `exact` vs `hidden` để phục vụ demo phân quyền.

---

## 2. Các quyết định thiết kế nghiệp vụ & bảo mật dữ liệu

### D01: Tách biệt cấp tài liệu cho chế độ vị trí ẩn (`locationMode: 'hidden'`)
- **Vấn đề**: Người dùng muốn chia sẻ cảm nghĩ, ảnh món ăn nhưng muốn giấu vị trí chính xác (quán gần nhà, địa điểm bí mật).
- **Quyết định**: Không đơn thuần là ẩn tọa độ trên UI. Khi `locationMode === 'hidden'`:
  - Bản ghi công khai `spots/{spotId}`: trường `placeId` bị gán là `null`, không lưu địa chỉ, tọa độ hay geohash.
  - Bản ghi liên kết bí mật: được lưu độc quyền tại `users/{authorUid}/spotLocations/{spotId}` chỉ tác giả mới có quyền đọc (`request.auth.uid == authorUid`).
  - Phía người xem (bạn bè/cộng đồng): UI không hiển thị nút "Lưu địa điểm" và không thể truy vết ngược ra Place.

### D02: Quản lý quan hệ bạn bè nguyên tử & Bản tra cứu quyền (`users/{uid}/friends/{friendUid}`)
- **Vấn đề**: Firestore Security Rules không thể truy vấn chéo nhiều tài liệu mà không tốn chi phí đọc lớn hoặc vượt quá giới hạn rules.
- **Quyết định**:
  - Giao dịch kết bạn được thực thi độc quyền qua Server Route Handler (`/api/friends/...` dùng `firebase-admin`).
  - Tạo 1 bản ghi giao dịch `friendships/{pairId}` (với `pairId` là 2 UID sắp xếp theo thứ tự từ điển, ví dụ `uidA_uidB`).
  - Đồng thời cập nhật vào 2 sub-collection tra cứu nhanh: `users/{uidA}/friends/{uidB}` và `users/{uidB}/friends/{uidA}`.
  - Trong `firestore.rules`, quyền đọc Spot chế độ `friends` chỉ cần kiểm tra:
    `exists(/databases/$(database)/documents/users/$(spot.authorId)/friends/$(request.auth.uid))`
  - Client tuyệt đối không được phép ghi trực tiếp vào `users/{uid}/friends/...`.

### D03: Saved Places & Phân tách 2 cờ độc lập (`hasVisited` và `isBookmarked`)
- **Quyết định**: Mỗi địa điểm được lưu với docId xác định:
  - Place dùng chung: `key = "shared_" + placeId`
  - Place riêng: `key = "private_" + placeId`
  - Đăng Spot tại một Place: tự động kích hoạt `hasVisited = true`.
  - Nhấn nút "Lưu địa điểm" (Bookmark): kích hoạt `isBookmarked = true`.
  - Bỏ lưu: chỉ chuyển `isBookmarked = false`. Nếu người dùng đã từng ghé (`hasVisited = true`), địa điểm vẫn còn trong lịch sử cá nhân.
  - Khi xóa Spot: kích hoạt hàm tính lại `hasVisited` dựa trên số lượng Spot còn lại của người dùng tại Place đó.

### D04: Bỏ EXIF ảnh & Giới hạn MIME/Dung lượng
- **Quyết định**:
  - Client xử lý ảnh trước khi gửi: sử dụng HTML5 Canvas vẽ lại ảnh để loại bỏ hoàn toàn các metadata nhạy cảm (GPS coordinates, thiết bị chụp) và nén ảnh về kích thước tối đa 1920px.
  - Storage Rules kiểm soát chặt: MIME type chỉ chấp nhận `image/jpeg`, `image/png`, `image/webp`; dung lượng $\le 5\text{MB}$.
  - Cấu trúc đường dẫn: `spots/{authorUid}/{spotId}/{filename}` và `avatars/{uid}/{filename}`.

### D05: Xử lý Geohash & Tìm kiếm lân cận
- **Quyết định**:
  - Tọa độ WGS84 chuyển đổi thành Geohash độ dài 9 ký tự bằng `geofire-common`.
  - Khi tìm Place lân cận bán kính $R$ (mặc định 150m, mở rộng 300m):
    1. Lấy các khoảng geohash bao phủ qua `geohashQueryBounds(center, radiusInM)`.
    2. Truy vấn song song các khoảng trên Firestore với `orderBy('geohash').startAt(b[0]).endAt(b[1])`.
    3. Hợp nhất kết quả từ cả collection `places` (shared) và `users/{uid}/privatePlaces` (private của user).
    4. Lọc lại chính xác bằng hàm tính khoảng cách đại hình cầu `distanceBetween([lat1, lng1], [lat2, lng2]) * 1000 <= radiusInM`.
    5. Sắp xếp tăng dần theo khoảng cách.
