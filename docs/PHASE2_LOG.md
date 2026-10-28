# Nhật Ký Giai Đoạn 2 — Tính Năng Xã Hội & Bản Đồ Cá Nhân

Tài liệu ghi lại phạm vi, quyết định kỹ thuật và kết quả kiểm chứng của Giai đoạn 2
(Bảng tin, Bạn bè, Lưu địa điểm, Thông báo, Tìm kiếm/Lọc, Bản đồ cá nhân, Chi tiết địa điểm).

---

## 1. Phạm Vi Đã Hoàn Thành

| Hạng mục | Kết quả |
|---|---|
| Bảng tin phân trang | 20 Spot/trang, con trỏ riêng cho mỗi nguồn (bản thân + từng bạn), gộp – loại trùng – sắp xếp mới nhất trước |
| Like | `spots/{spotId}/likes/{uid}`; đếm bằng aggregation, không lưu bộ đếm trên Spot |
| Lưu địa điểm | `users/{uid}/savedPlaces/{key}` với `hasVisited` và `isBookmarked` độc lập |
| Bạn bè | `friendships/{pairId}` + bảng tra cứu server-only `users/{uid}/friends/{friendUid}` |
| Thông báo | Server tạo; người nhận chỉ đổi `isRead`; mới nhất trước, phân trang |
| Tìm kiếm/Lọc | Trên tập Spot đã tải và đã được phép xem: tên Place không dấu, từ khóa chú thích, danh mục, giá, đánh giá |
| Bản đồ cá nhân | Một marker/Place từ `savedPlaces` của chính mình; lọc Tất cả/Đã ghé/Đã lưu/Danh mục |
| Chi tiết địa điểm | Tab lịch sử của tôi + trải nghiệm của bạn bè được phép xem; Place riêng của người khác bị từ chối |

---

## 2. Bất Biến Dữ Liệu Được Giữ

- **UID là khóa liên kết duy nhất.** `users/{uid}` chỉ có `displayName`, `avatarPath`, `createdAt`;
  không có `email`, không có trường `uid` bên trong tài liệu.
- **Timestamp của Firestore** cho `createdAt/updatedAt/visitedAt`, hiển thị theo múi giờ thiết bị.
- **`spots/{spotId}`** dùng đúng schema; Spot ẩn vị trí có `placeId = null` và không chứa
  tên/địa chỉ/geohash; tham chiếu thật nằm ở `users/{uid}/spotLocations/{spotId}`.
- **Ảnh** lưu object path (`spots/{uid}/{spotId}/photo_n.jpg`), URL tải được resolve tại thời điểm
  hiển thị sau khi Storage Rules cho phép; không lưu URL token dài hạn trong tài liệu chia sẻ.
- **Like** dùng `docId = uid` nên bấm lặp không tạo bản ghi trùng; không thông báo khi tự like.
- **Saved Place**: đăng Spot đặt `hasVisited = true`; bookmark chỉ đổi `isBookmarked`;
  xóa Spot cuối cùng tại Place mới tính lại `hasVisited` (server, idempotent).
- **Bạn bè**: lời mời ngược chiều không tạo bản ghi đối xứng; mọi thay đổi quan hệ chạy trong
  một transaction gồm `friendships/{pairId}` và hai bảng tra cứu.
- **Thông báo**: chỉ server tạo/xóa; mở thông báo kiểm tra lại quyền đọc hiện tại và báo
  "không còn khả dụng" mà không lộ nội dung cũ.

---

## 3. Thay Đổi Kỹ Thuật Chính

### Tầng dữ liệu (`src/lib/data/`)
- `feed-loader.ts` (trong `src/features/feed/`): trạng thái phân trang giữ `DocumentSnapshot`
  làm con trỏ cho từng nguồn, buffer phần dư, gộp bằng `mergeUniqueSorted`, cắt trang bằng
  `takePage`; nguồn lỗi được báo riêng và không xóa dữ liệu đã tải.
- `likes.ts`, `saved-places.ts`, `friends.ts`, `notifications.ts`, `users.ts`, `media.ts`, `api.ts`.
- `spots.ts`: tạo Spot trong transaction (Spot + `spotLocations` + `savedPlaces` + `media`),
  dọn ảnh đã tải nếu transaction thất bại; xóa Spot qua Route Handler.
- `places.ts`: đọc Place theo lô `documentId in` (tối đa 10/lần) và Place riêng của chính mình.

### Tầng server (`src/server/` + Route Handlers)
- `POST /api/friends`: vòng đời `request/accept/reject/cancel/remove` trong một transaction,
  đồng bộ bảng tra cứu, tạo thông báo lời mời một lần.
- `POST|DELETE /api/spots/[spotId]/like`: kiểm tra quyền đọc Spot, ghi/xóa like, tạo thông báo
  một lần cho mỗi cặp (Spot, người like), không thông báo khi tự like.
- `DELETE /api/spots/[spotId]`: đánh dấu `status: 'deleting'` trước, dọn like/media/ảnh/`spotLocations`,
  tính lại `hasVisited`, chạy lại được nhiều lần.

### Domain dùng chung (`src/lib/domain/`)
- `feed-merge.ts`, `spot-filters.ts`, `spot-access.ts`: logic thuần, có unit test.

### Bảo mật
- `firestore.rules`: kiểm tra schema chính xác theo từng collection, cấm trường ngoài schema,
  bất biến `uid`/`authorId`/`createdAt`/`placeId`, cấm client ghi `friendships`, `friends`,
  `notifications` (trừ `isRead`), `likes`, và cấm client xóa `spotLocations`/`privatePlaces`.
  Tác giả chỉ được đổi `visibility` (và `updatedAt`) của Spot.
- `storage.rules`: quyền đọc ảnh bám theo `visibility` hiện tại của Spot và tư cách bạn bè,
  nên đổi phạm vi bài viết có hiệu lực ngay với ảnh đã tải trước đó; client không xóa ảnh trực tiếp.
- `firestore.indexes.json`: 4 composite index cho các truy vấn Spot thực tế.

---

## 4. Kết Quả Kiểm Chứng

| Lệnh | Kết quả |
|---|---|
| `npm run lint` | PASS — 0 error, 12 warning (`<img>` và `exhaustive-deps` không chặn build) |
| `npm run typecheck` | PASS — 0 error |
| `npm test` | PASS — 5 file / 38 test |
| `npm run build` | PASS — 16 route, `/places/[id]`, `/spots/[id]`, `/users/[uid]` ở chế độ Partial Prerender |
| `npm run test:rules` | Chưa chạy được trên máy hiện tại (Java 8); xem `docs/TESTING.md` |

---

## 5. Ghi Chú Vận Hành

- Chạy `npm run emulators` (cần JDK 21+) rồi `npm run seed` để có dữ liệu demo:
  3 người dùng, 10 Place, 10 Spot (gồm 1 Spot ẩn vị trí), 1 quan hệ bạn bè đã chấp nhận và 1 like mẫu.
- Seed dùng URL Unsplash cho `imagePaths` để demo không cần upload Storage.
- `imagePaths` trong dữ liệu thật luôn là object path; `useMediaUrl` tự phân biệt URL ngoài và
  object path.
