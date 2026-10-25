# 🚀 Rocket24h - Spot & Place Memory Journal

> **Đồ án môn học**: Chuyên đề Công nghệ thông tin  
> **Đơn vị**: Đại học Thủy Lợi  
> **Công nghệ**: Next.js (App Router, TypeScript strict), Firebase (Auth, Firestore, Storage, Emulators), Leaflet, Geofire-common, Tailwind CSS.

---

## 📌 1. Giới thiệu Đề tài

Rocket24h là ứng dụng web cho phép người dùng ghi lại nhật ký trải nghiệm thực tế tại các địa điểm (quán ăn, cà phê, du lịch...) kèm hình ảnh, mức giá tham khảo, đánh giá và cảm nhận. Người dùng có thể chia sẻ có chọn lọc với bạn bè và tra cứu lại trên bản đồ cá nhân.

### Hai thực thể cốt lõi:
- **Place**: Danh tính ổn định của địa điểm (Tên, địa chỉ, tọa độ WGS84, Geohash, danh mục). Có thể là **Dùng chung (Shared)** hoặc **Riêng tư (Private)**.
- **Spot**: Một lần ghé trải nghiệm tại một Place (ảnh, giá, đánh giá, chú thích, thời điểm ghé, phạm vi hiển thị `public` / `friends` / `private` và chế độ chia sẻ vị trí `exact` / `hidden`).

---

## 🛠️ 2. Yêu cầu Môi trường

- **Node.js**: $\ge 20$ (khuyến nghị v22.x)
- **Java Runtime Environment (JRE)**: $\ge 11$ (để chạy Firebase Local Emulator Suite)
- **Firebase CLI**: `npm install -g firebase-tools` (hoặc chạy qua `npx firebase`)

---

## 🚀 3. Hướng dẫn Khởi chạy Nhanh

### Bước 1: Cài đặt thư viện phụ thuộc
```bash
npm install
```

### Bước 2: Thiết lập biến môi trường
File `.env.local` đã được cấu hình sẵn cho Firebase Local Emulator:
```bash
cp .env.example .env.local
```

### Bước 3: Khởi động Firebase Local Emulators (Auth, Firestore, Storage)
Mở một cửa sổ dòng lệnh riêng:
```bash
npm run emulators
```
*Giao diện Emulator UI sẽ mở tại*: [http://localhost:4000](http://localhost:4000)

### Bước 4: Nạp dữ liệu mẫu (Seed Data)
Tại một cửa sổ dòng lệnh khác, chạy:
```bash
npm run seed
```
Lệnh này sẽ tự động tạo:
- **3 người dùng mẫu** có hồ sơ và cài đặt đầy đủ.
- **Quan hệ bạn bè mẫu** giữa Alice và Bob.
- **10 địa điểm nổi tiếng** tại khu vực trung tâm Hà Nội kèm Geohash chuẩn WGS84.
- **15 bài viết Spot mẫu** trải đều các phạm vi `public`, `friends`, `private` và chế độ ẩn vị trí.

### Bước 5: Chạy ứng dụng giao diện Next.js
```bash
npm run dev
```
Truy cập ứng dụng tại: [http://localhost:3000](http://localhost:3000)

---

## 🔑 4. Danh sách Tài khoản Demo (Seed Accounts)

| Tên hiển thị | Email | Mật khẩu | Vai trò / Quan hệ |
|---|---|---|---|
| **Alice Hoàng** | `demo_user1@rocket24h.vn` | `Password123!` | Bạn của Bob, có các bài viết đủ 3 phạm vi & bài ẩn vị trí |
| **Bob Nguyễn** | `demo_user2@rocket24h.vn` | `Password123!` | Bạn của Alice, xem được Spot `friends` của Alice |
| **Charlie Đặng** | `demo_user3@rocket24h.vn` | `Password123!` | Thành viên mới (chưa kết bạn với Alice & Bob) |

---

## 🧪 5. Kiểm thử & Kiểm tra Chất lượng Mã Nguồn

```bash
# 1. Chạy toàn bộ Unit Tests (Vitest)
npm test

# 2. Kiểm tra kiểu dữ liệu TypeScript (Strict mode)
npm run typecheck

# 3. Kiểm tra chuẩn mã nguồn ESLint
npm run lint

# 4. Build đóng gói ứng dụng sản phẩm
npm run build
```

---

## 📂 6. Cấu trúc Dự án

```
├── docs/                     # Tài liệu kiến trúc, quyết định kỹ thuật, kiểm thử
│   ├── ARCHITECTURE.md       # Sơ đồ luồng, phân tách lớp, mô hình dữ liệu
│   ├── DECISIONS.md          # Ghi nhận các quyết định thiết kế cốt lõi
│   └── TESTING.md            # Bảng nhật ký kiểm thử và kết quả
├── firestore.rules           # Security Rules bảo mật Firestore ở tầng dữ liệu
├── storage.rules             # Security Rules bảo mật Storage (ảnh Spot & Avatar)
├── firestore.indexes.json    # Composite Indexes tối ưu truy vấn Firestore
├── firebase.json             # Cấu hình Firebase Local Emulator Suite
├── scripts/                  # Kịch bản nạp dữ liệu mẫu (seed.ts)
├── src/
│   ├── app/                  # Next.js App Router (Giao diện & Route Handlers)
│   ├── components/           # UI components tái sử dụng (Map, Spot, Place...)
│   ├── lib/
│   │   ├── domain/           # Types, Zod Schemas, cấu hình nghiệp vụ
│   │   ├── firebase/         # Client SDK & Admin SDK khởi tạo
│   │   ├── geo/              # Thuật toán Geohash, Query Bounds, Distance
│   │   └── image/            # Client EXIF Stripper & Canvas Compressor
│   └── server/               # Logic bảo mật & xác thực Bearer Token phía server
└── tests/                    # Thư mục kiểm thử (Unit tests, Rules tests, E2E)
```
