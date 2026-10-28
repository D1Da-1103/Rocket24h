# PROMPT GIAO VIỆC CHO AGENT: XÂY DỰNG WEBSITE "LƯU GIỮ & CHIA SẺ TRẢI NGHIỆM ĐỊA ĐIỂM" (PLACE / SPOT)

> Dán toàn bộ nội dung bên dưới (từ "VAI TRÒ") vào agent. Nếu agent có giới hạn độ dài, dán từng GIAI ĐOẠN một, nhưng luôn dán kèm phần 0–5 làm ngữ cảnh nền.

---

## 0. VAI TRÒ VÀ CÁCH LÀM VIỆC

Bạn là một kỹ sư full-stack senior (Next.js, TypeScript, Firebase, bản đồ/định vị). Hãy xây dựng cho tôi một **website hoàn chỉnh, chạy được** theo đặc tả dưới đây. Đây là đồ án môn "Chuyên đề Công nghệ thông tin" (Đại học Thủy Lợi), nên sản phẩm cần **đúng nghiệp vụ, đúng phân quyền, có thể demo được và có test chứng minh**.

Quy tắc làm việc:

1. **Đọc hết đặc tả trước khi viết code.** Sau đó đưa ra kế hoạch ngắn (cấu trúc thư mục, thứ tự làm việc) rồi bắt tay làm luôn, không cần chờ tôi duyệt, trừ khi gặp mục "Câu hỏi cần xác nhận" ở phần 14.
2. **Làm theo từng giai đoạn (phần 12).** Hết mỗi giai đoạn phải chạy được (`npm run dev`, `npm run build`, `npm run lint`, `tsc --noEmit` đều pass) và tóm tắt ngắn: đã làm gì, chạy thế nào, còn thiếu gì.
3. **Không bịa dữ liệu hay báo thành công giả.** Mọi thao tác ghi dữ liệu chỉ báo thành công sau khi server xác nhận. Khi chưa xong hoặc chưa kiểm chứng được, hãy nói rõ.
4. **Bảo mật đặt ở tầng dữ liệu** (Security Rules + server), không chỉ ẩn trên giao diện.
5. Gặp điểm đặc tả chưa rõ: chọn phương án mặc định hợp lý, ghi vào `docs/DECISIONS.md` (lý do + phương án thay thế), không dừng lại hỏi trừ các câu ở phần 14.
6. Code sạch, tách lớp (UI / nghiệp vụ / truy cập dữ liệu / tích hợp vị trí), có chú thích ở những chỗ khó (geohash, quyền riêng tư, giao dịch).
7. Giao diện và thông báo cho người dùng cuối bằng **tiếng Việt**. Tên biến/hàm/commit bằng tiếng Anh.

---

## 1. BÀI TOÁN VÀ Ý TƯỞNG CỐT LÕI

Người dùng ghi lại những nơi đã ghé (quán ăn, cà phê, điểm du lịch) kèm ảnh, giá, đánh giá, cảm nhận; chia sẻ có chọn lọc với bạn bè; xem lại trên bản đồ cá nhân.

Hai thực thể trung tâm:

- **Place** = danh tính ổn định của một địa điểm: tên, địa chỉ, tọa độ, geohash, danh mục. Có thể là *dùng chung* (shared) hoặc *riêng tư* (private, chỉ chủ tài khoản thấy).
- **Spot** = một lần trải nghiệm tại một Place: người đăng, ảnh, giá tham khảo, đánh giá, chú thích, thời điểm ghé, phạm vi hiển thị. Một Place có nhiều Spot; sửa Spot của mình không ảnh hưởng Spot người khác.

Bốn vấn đề phải giải quyết (đây là điểm ăn tiền của đề tài):

1. Thông tin trải nghiệm có cấu trúc (ảnh + nội dung + địa điểm trong một bản ghi).
2. Tránh nhập trùng địa điểm: **gợi ý** Place ở gần để người dùng chọn, **không tự hợp nhất** chỉ dựa vào khoảng cách.
3. Định vị có thể thất bại (từ chối quyền, sai số lớn, không HTTPS): luôn có nhánh **ghim điểm thủ công**; quyền vị trí không bao giờ là điều kiện bắt buộc.
4. Kiểm soát truy cập xuyên suốt: Spot private thì ảnh và tọa độ liên quan cũng không đọc được kể cả khi biết đường dẫn trực tiếp.

**Ngoài phạm vi (KHÔNG làm):** chat, bình luận, đặt chỗ, thanh toán, thuật toán gợi ý cá nhân hóa, theo dõi hành trình liên tục, tự tính tuyến đường (chỉ mở app bản đồ ngoài), giao diện quản trị nội dung.

---

## 2. TECH STACK (BẮT BUỘC)

| Thành phần | Lựa chọn |
|---|---|
| Ngôn ngữ | TypeScript (strict) |
| Giao diện | React + Next.js (App Router). Phần dùng `window`/`navigator`/Leaflet phải ở Client Component (`"use client"`, bản đồ nạp bằng `dynamic(..., { ssr:false })`) |
| Xác thực | Firebase Authentication (email + mật khẩu) |
| CSDL | Cloud Firestore |
| Lưu ảnh | Firebase Storage |
| Truy vấn vị trí | `geofire-common` (`geohashForLocation`, `geohashQueryBounds`, `distanceBetween`) |
| Bản đồ | Leaflet (+ react-leaflet), bọc sau lớp **MapProvider** để đổi nhà cung cấp tile được |
| Reverse geocoding | Nominatim (qua lớp tích hợp riêng, có timeout, rate-limit ≤ 1 req/s toàn app, header nhận diện app, ghi nguồn OSM) |
| Xử lý tin cậy phía server | Next.js Route Handlers + `firebase-admin` (mặc định). Cloud Functions chỉ dùng nếu tôi xác nhận có gói Blaze (xem phần 14) |
| Test | Vitest/Jest (unit), Firebase Local Emulator Suite + `@firebase/rules-unit-testing` (rules), Playwright (E2E luồng chính) |
| UI | Tailwind CSS (hoặc CSS Modules), responsive mobile-first |
| Triển khai | Vercel hoặc Firebase Hosting; bí mật ở biến môi trường, không commit |

Phải chạy được **hoàn toàn trên Firebase Emulator** (Auth, Firestore, Storage) để tôi demo không cần tài khoản Firebase thật; có file `.env.example` và script `npm run emulators`, `npm run seed`.

---

## 3. NGƯỜI DÙNG VÀ PHÂN QUYỀN

| Đối tượng | Quyền |
|---|---|
| Khách (chưa đăng nhập) | Chỉ xem trang giới thiệu, đăng ký, đăng nhập |
| Thành viên | Tạo/sửa/xóa Spot của mình; quản lý hồ sơ, Place riêng, địa điểm đã lưu |
| Bạn bè (đã chấp nhận) | Xem Spot `friends`; thích Spot; lưu Place dùng chung được chia sẻ |
| Chủ dữ liệu | Đổi phạm vi hiển thị; xem Place riêng và lịch sử cá nhân |

"Bạn bè" là **trạng thái quan hệ** giữa 2 thành viên, không phải loại tài khoản.

**Ma trận đọc Spot:**

| Phạm vi Spot | Tác giả | Bạn bè đã chấp nhận | Thành viên khác |
|---|---|---|---|
| `public` | ✔ | ✔ | ✔ (mọi thành viên đã đăng nhập) |
| `friends` | ✔ | ✔ | ✘ |
| `private` | ✔ | ✘ | ✘ |

Sửa/xóa Spot chỉ thuộc tác giả ở cả 3 phạm vi. Quyền được đánh giá theo **trạng thái hiện tại** (đổi phạm vi hoặc hủy kết bạn thì mất quyền đọc ngay).

---

## 4. YÊU CẦU CHỨC NĂNG (FR01–FR14)

| Mã | Yêu cầu | Điều kiện đáp ứng |
|---|---|---|
| FR01 | Đăng ký, đăng nhập, đăng xuất | Nhận đúng UID; trạng thái phiên cập nhật trên UI |
| FR02 | Quản lý hồ sơ | Chỉ chủ tài khoản sửa tên, ảnh đại diện, thiết lập |
| FR03 | Tạo/sửa/xóa Spot | Có ảnh, nội dung, vị trí hợp lệ; người khác không sửa được |
| FR04 | Xác định vị trí | Lấy vị trí thiết bị khi được cấp quyền; luôn có chọn điểm thủ công |
| FR05 | Gợi ý & tái sử dụng Place | Hiển thị danh sách gần điểm đã chọn; người dùng tự xác nhận |
| FR06 | Xem Feed | Phân trang; chỉ hiện bài của mình và bạn bè có quyền xem |
| FR07 | Thích Spot | Mỗi UID tối đa 1 like/Spot; bỏ thích được |
| FR08 | Lưu địa điểm | Không tạo bản ghi trùng; lưu Place không mở rộng quyền xem Spot |
| FR09 | Quản lý bạn bè | Gửi, nhận, chấp nhận, từ chối, hủy lời mời, hủy kết bạn |
| FR10 | Chi tiết Place | Thông tin địa điểm + lịch sử trải nghiệm được phép đọc |
| FR11 | Bản đồ cá nhân | Hiện địa điểm đã ghé/đã lưu; mở chi tiết từ dấu bản đồ |
| FR12 | Tìm kiếm & lọc | Theo tên, từ khóa cơ bản, danh mục, mức giá, đánh giá |
| FR13 | Thông báo | Thông báo trong website (lời mời kết bạn, lượt thích); push là phần mở rộng |
| FR14 | Quyền riêng tư | Phân biệt public/friends/private và lựa chọn chia sẻ vị trí |

**Yêu cầu phi chức năng (NFR):**

- NFR01 Hiệu năng: Feed phân trang **20 Spot/trang**; mục tiêu nội dung đầu < 3 giây (điều kiện thử nghiệm xác định).
- NFR02 Bảo mật: kiểm tra UID + quyền sở hữu ở dịch vụ; chặn đọc Spot/ảnh/Place riêng trái phép.
- NFR03 Khả dụng: định vị lỗi thì vẫn tạo Spot bằng điểm thủ công; thông báo lỗi rõ, cho thử lại.
- NFR04 Dễ dùng/tiếp cận: responsive, nhãn trường rõ, dùng được bàn phím, ảnh có `alt`, nút có tên, không chỉ dùng màu để truyền đạt.
- NFR05 Nhất quán: không trùng Like/Saved Place; trạng thái kết bạn cập nhật nguyên tử.
- NFR06 Bảo trì: tách UI / nghiệp vụ / truy cập dữ liệu / tích hợp vị trí.
- NFR07 Kiểm soát tài nguyên: giới hạn ảnh, phân trang, `limit()` mọi truy vấn.

---

## 5. QUY TẮC NGHIỆP VỤ & VALIDATION (kiểm tra ở CẢ client LẪN server/rules)

- Mỗi Spot thuộc đúng 1 tác giả. **1–5 ảnh**, mỗi ảnh **≤ 5 MB**, chỉ `image/jpeg`, `image/png`, `image/webp`.
- Chú thích ≤ **1.000** ký tự. Tên Place **2–120** ký tự.
- Đánh giá: số nguyên 1–5, **có thể để trống (`null`)**.
- Giá (`priceVnd`): số nguyên ≥ 0 (VND). **`null` = chưa nhập, `0` = không phát sinh chi phí** (phải phân biệt). Giá là giá tham khảo của một lần ghé, không phải giá niêm yết của Place.
- Vĩ độ ∈ [−90, 90], kinh độ ∈ [−180, 180]; `geohash` phải khớp tọa độ.
- Bạn bè: không tự gửi lời mời cho mình; lời mời trùng không tạo quan hệ mới; chỉ **người nhận** được chấp nhận/từ chối; chỉ **người gửi** được hủy lời mời pending; hủy kết bạn **không xóa Spot** của hai bên; có lời mời ngược chiều thì hiển thị chấp nhận/từ chối, không tạo lời mời đối ứng.
- Like và Saved Place dùng **khóa xác định** (docId = UID / key) để thao tác lặp không tăng số bản ghi.
- Không gửi thông báo khi tự like bài mình; cùng một sự kiện xử lý lại **không** tạo thông báo trùng.
- Xóa Spot **không** xóa Place dùng chung đang được người khác dùng.
- Nút "Đăng" phải chặn bấm lặp (disable + khóa yêu cầu idempotent).
- Tạo Place **dùng chung** cần xác nhận riêng (checkbox/bước xác nhận), kể cả khi Spot là `private`.
- Người đăng **không được sửa tùy ý** tọa độ/tên của Place dùng chung đang được người khác dùng. Tọa độ thiết bị chỉ để gợi ý, **không ghi đè** tọa độ Place đã có.

---

## 6. MÔ HÌNH DỮ LIỆU FIRESTORE / STORAGE

Dùng WGS84. Mọi `createdAt/updatedAt/visitedAt` là Firestore `Timestamp` (hiển thị theo múi giờ thiết bị). **Dùng UID làm khóa liên kết, không dùng email.**

```
users/{uid}                      { displayName, avatarPath, createdAt }              // hồ sơ hiển thị, KHÔNG có email
userSettings/{uid}               { defaultVisibility, notificationEnabled }          // chỉ chủ đọc/sửa

places/{placeId}                 { name, nameNormalized, category, address,
                                   latitude, longitude, geohash, createdBy, createdAt }  // Place dùng chung
users/{uid}/privatePlaces/{id}   { name, nameNormalized, category, address, latitude, longitude, geohash }
users/{uid}/spotLocations/{spotId} { placeScope: 'shared'|'private', placeKey }       // tham chiếu thật khi Spot ẩn vị trí; chỉ chủ đọc

spots/{spotId}                   { authorId, placeId|null, locationMode:'exact'|'hidden',
                                   imagePaths[], category, priceVnd|null, rating|null,
                                   caption, visibility:'public'|'friends'|'private',
                                   visitedAt, createdAt, updatedAt, status?('active'|'deleting') }
spots/{spotId}/likes/{uid}       { userId, createdAt }

friendships/{pairId}             { senderId, receiverId, status:'pending'|'accepted', createdAt, updatedAt }
                                 // pairId = ghép 2 UID đã sắp xếp; hủy/từ chối thì xóa bản ghi
users/{uid}/friends/{friendUid}  { friendUid, acceptedAt }                           // bản tra cứu quyền; CHỈ server ghi

users/{uid}/savedPlaces/{key}    { placeScope, placeId, hasVisited, isBookmarked, lastVisitedAt }  // key xác định, 1 bản ghi/địa điểm
users/{uid}/notifications/{id}   { type:'friend_request'|'like', actorId, targetId, isRead, createdAt } // server tạo; người nhận chỉ đổi isRead
users/{uid}/pushDevices/{id}     { installationId, updatedAt }                       // phần mở rộng
media/{mediaId}                  { ownerId, spotId, objectPath, status:'temp'|'attached'|'orphan' }

Storage: spots/{authorUid}/{spotId}/{filename}   avatars/{uid}/{filename}
```

**Quyền riêng tư vị trí (điểm khó nhất, làm đúng):**

- Spot có `locationMode = 'hidden'` ⇒ trong `spots/{id}` **`placeId = null`** và **không** chứa tên riêng, địa chỉ, geohash, hay ID suy ra được vị trí. Tham chiếu thật nằm ở `users/{uid}/spotLocations/{spotId}`. Đây là **tách ở cấp tài liệu**, không phải ẩn field trên UI.
- Với Spot hidden: giao diện **không hiện nút "Lưu địa điểm"** cho người xem.
- Geohash của Place riêng được bảo vệ như tọa độ.
- Ảnh: **bỏ EXIF vị trí** trước khi upload (xử lý ở client bằng canvas/thư viện, và/hoặc ở server); nén/resize hợp lý; nhắc người dùng kiểm tra chú thích không lộ địa chỉ nhà ở bước xác nhận.
- **Không** lưu URL có token tải dài hạn vào tài liệu chia sẻ cho ảnh private. Tải ảnh qua cơ chế có kiểm quyền (Storage Rules theo UID/spotId đối chiếu bài viết, hoặc Route Handler trả ảnh/URL ngắn hạn sau khi kiểm quyền). Đổi phạm vi bài ⇒ cập nhật quyền ảnh tương ứng.

**Saved Place:** `hasVisited` (đã ghé) và `isBookmarked` (lưu tham khảo) là hai cờ **độc lập**. Đăng Spot ⇒ `hasVisited=true`. Lưu địa điểm bạn giới thiệu ⇒ `isBookmarked=true`. Bỏ lưu chỉ đổi `isBookmarked`. Xóa Spot cuối tại Place ⇒ **tính lại** `hasVisited` từ các Spot còn tồn tại. Số like/số lần ghé là dữ liệu dẫn xuất, tái tính được; cập nhật nền không được đếm hai lần.

**Toàn vẹn:** không cho sửa `uid`, `authorId`, `createdAt` sau khi tạo; từ chối field ngoài schema; phân biệt `null` / `0` / chuỗi rỗng.

---

## 7. THUẬT TOÁN VỊ TRÍ VÀ GỢI Ý PLACE

Luồng tạo Spot (UC03 → include UC04):

1. Người dùng chọn ảnh (1–5), xem trước, xóa được.
2. Chọn vị trí: **"Dùng vị trí hiện tại"** *hoặc* **"Chọn trên bản đồ"** (ghim thủ công, kéo được).
   - Gọi `navigator.geolocation.getCurrentPosition` **một lần** (có timeout), kèm `accuracy`. Không `watchPosition`. Cần HTTPS/localhost.
   - Từ chối quyền / không có vị trí / quá thời gian ⇒ tự chuyển sang ghim thủ công, **giữ nguyên dữ liệu đã nhập**.
   - Sai số (`accuracy`) lớn ⇒ cảnh báo, yêu cầu kiểm tra điểm ghim trước khi mở rộng vùng tìm.
3. Truy vấn Place lân cận (cả Place dùng chung **và** Place riêng của chính user):
   - Bán kính mặc định **150 m**, nút "Mở rộng" lên **300 m** khi không có kết quả (cấu hình được, đặt trong `config`).
   - `geohashQueryBounds(center, radius)` ⇒ chạy nhiều truy vấn khoảng `orderBy('geohash').startAt().endAt()` (mỗi cái có `limit`), **gộp theo ID**, rồi **lọc lại bằng `distanceBetween`** (vì geohash có thể bỏ sót điểm sát ranh giới ô hoặc chứa điểm ngoài vùng).
   - Sắp xếp theo khoảng cách tăng dần; **ưu tiên** Place trong lịch sử của chính user; hiển thị tên, địa chỉ, khoảng cách.
   - Place riêng của người khác **không bao giờ** xuất hiện.
   - Một khoảng truy vấn lỗi ⇒ báo "danh sách chưa đầy đủ" + nút thử lại (không kết luận "không có địa điểm").
4. Người dùng **chọn Place có sẵn** hoặc **tạo mới** (nhập tên, kiểm tra địa chỉ/danh mục, chọn *dùng chung* hoặc *riêng tư*, xác nhận).
   - Reverse geocoding chỉ là **gợi ý địa chỉ, sửa được**; lỗi geocoding không chặn lưu nếu đã ghim điểm và nhập địa chỉ tay.
   - **Không tự hợp nhất** theo khoảng cách (hai cửa hàng cùng tòa nhà có thể trùng tọa độ). Chấp nhận khả năng trùng Place khi 2 người tạo đồng thời.
5. Nhập giá, đánh giá, danh mục, chú thích, thời điểm ghé (`visitedAt`).
6. Chọn **phạm vi bài viết** (public/friends/private) **và** **chia sẻ vị trí** (chính xác / ẩn) — hai lựa chọn tách biệt rõ trên UI.
7. Xem lại ⇒ Đăng.

Lưu Spot: cấp `spotId` trước → upload ảnh (trạng thái `temp`) → validate → ghi Spot + cập nhật Saved Place trong **batch/transaction**. Lưu lỗi sau khi upload ảnh ⇒ ảnh `temp` được dọn bởi tác vụ nền; **không** báo thành công. Hủy tạo ⇒ ảnh tạm vào hàng dọn dẹp. Xóa Spot ⇒ **xóa logic trước** (chặn truy cập) rồi dọn ảnh, likes, liên kết riêng theo quy trình **chạy lại được (idempotent)**, tính lại `hasVisited`.

---

## 8. FEED, TÌM KIẾM, BẢN ĐỒ

**Feed (20/trang, "Tải thêm"):** KHÔNG tải cả collection rồi lọc ở trình duyệt. Dùng:
- Spot của tôi: `authorId == me` + `orderBy(createdAt desc)`.
- Spot của từng bạn: `authorId == friend` + `visibility in ['public','friends']` + `orderBy(createdAt desc)`.
- Giữ **con trỏ riêng cho từng nguồn**; trang kế bổ sung từ các nguồn còn dữ liệu, gộp theo `createdAt` + `id`, loại trùng theo `spotId`. Truy vấn phải ràng buộc theo quyền (Firestore Rules không tự lọc kết quả — truy vấn có thể trả dữ liệu trái phép sẽ bị từ chối toàn bộ).
- Lỗi tải ⇒ giữ phần đã tải hợp lệ + nút thử lại. Spot bị xóa/đổi phạm vi/hủy kết bạn ⇒ biến mất khỏi Feed người mất quyền. Feed rỗng ⇒ trạng thái trống gợi ý tạo Spot / kết bạn. Like thất bại ⇒ khôi phục trạng thái (optimistic UI có rollback).
- Mỗi card: avatar, tên người đăng, thời gian, ảnh, tên Place · danh mục (nếu được phép hiện), giá tham khảo, đánh giá 1–5, chú thích, nút **Thích / Lưu địa điểm / Chi tiết**.

**Chỉ mục ghép dự kiến** (tạo `firestore.indexes.json`): `spots(authorId, createdAt desc)`, `spots(authorId, visibility, createdAt desc)`, `spots(placeId, authorId, createdAt desc)` (+ visibility cho bài bạn bè), `places(geohash)` (+ category nếu kết hợp), `places(nameNormalized)` cho tìm theo tiền tố, notifications theo `createdAt desc`.

**Tìm kiếm cơ bản:** theo tên Place đã chuẩn hóa (bỏ dấu, lowercase, tiền tố) và từ khóa trong chú thích **chỉ trong tập Spot người dùng được phép đọc**. Lọc: danh mục, mức giá, đánh giá. **Giá/đánh giá thuộc Spot**: khi lọc Place theo các tiêu chí này, UI phải nói rõ "dựa trên trải nghiệm nào"; nếu lọc cả giá và đánh giá thì **cùng một Spot** phải thỏa cả hai; Place chưa có Spot phù hợp không được tự gán giá/đánh giá. Không gộp thành "điểm đánh giá trung bình của Place".

**Bản đồ cá nhân (Leaflet):** mỗi Place **một** dấu dù có nhiều Spot; bộ lọc *Tất cả / Đã ghé / Đã lưu / Danh mục*; click dấu ⇒ thẻ tóm tắt ⇒ "Xem chi tiết" / "Mở chỉ đường" (mở app bản đồ ngoài bằng URL, chỉ với tọa độ được phép chia sẻ). Gom cụm dấu (marker cluster) nếu làm được, không thì cho zoom. Bản đồ không tải được ⇒ vẫn có **danh sách chữ** các địa điểm. Tile: ghi attribution OSM; dùng nhà cung cấp tile qua `MapProvider` + biến môi trường, không hard-code, và tuân thủ chính sách tile OSM.

**Chi tiết Place:** tên, địa chỉ, tọa độ/mini-map (hoặc trạng thái "ẩn vị trí"), tab/section **Lịch sử của tôi** (ảnh, ngày, giá, đánh giá) và **Trải nghiệm của bạn bè được phép xem**. Place riêng của người khác ⇒ từ chối, không lộ tên/tọa độ. Place dùng chung chưa có Spot được phép xem ⇒ vẫn hiện thông tin Place + "chưa có trải nghiệm nào bạn được xem".

---

## 9. BẠN BÈ VÀ THÔNG BÁO

- **Bạn bè (UC07):** từ hồ sơ người khác ⇒ trạng thái quan hệ (Kết bạn / Đã gửi lời mời — Hủy / Chấp nhận–Từ chối / Bạn bè — Hủy kết bạn). Thao tác ghi cả `friendships/{pairId}` **và** `users/{uid}/friends/{friendUid}` của hai bên phải **nguyên tử** (transaction/server), client **không** được tự tạo bản ghi `friends`. Lời mời đã xử lý ở phiên khác ⇒ trả trạng thái hiện tại, không xử lý lại. Tài khoản đích không tồn tại ⇒ từ chối. Hủy kết bạn ⇒ thu hồi quyền đọc Spot `friends`.
- **Thông báo (UC09):** danh sách mới nhất trước, phân trang; hiện loại sự kiện, người thực hiện, thời gian, đã đọc/chưa; đánh dấu 1 hoặc tất cả đã đọc. Mở thông báo ⇒ kiểm tra quyền hiện tại; Spot đã xóa/mất quyền ⇒ báo "nội dung không còn khả dụng", không lộ nội dung cũ. Thông báo **không** chứa tọa độ riêng tư hay toàn bộ nội dung Spot nhạy cảm. Do **server tạo**, người nhận chỉ cập nhật `isRead`. Push FCM (service worker) là **mở rộng giai đoạn 3**, không được làm hỏng luồng khi người dùng từ chối quyền thông báo.

---

## 10. GIAO DIỆN

Điều hướng: **Trang chủ (Feed) · Bản đồ · Bạn bè · Hồ sơ** + nút **Tạo Spot** nổi bật ở Feed và Bản đồ. Mobile-first, dùng tốt trên điện thoại.

- **Feed bạn bè:** ô tìm tên địa điểm/từ khóa; card như mục 8.
- **Tạo Spot** chia nhóm: (1) Ảnh — thêm, xem trước, xóa; (2) Vị trí — *Dùng vị trí hiện tại | Chọn trên bản đồ*; (3) Gợi ý Place gần đây (tên · địa chỉ · khoảng cách · chọn hoặc tạo mới); (4) Giá · Đánh giá · Danh mục · Chú thích; (5) Phạm vi bài viết + chia sẻ vị trí; (6) "Xem lại và đăng Spot".
- **Bản đồ & chi tiết Place:** thanh lọc (Bản đồ cá nhân | Danh mục | Đã ghé | Đã lưu), bản đồ bên trái, panel phải: chi tiết Place · thông tin/mini-map hoặc "ẩn vị trí" · lịch sử của tôi · trải nghiệm bạn bè được xem (lọc cá nhân/bạn bè).
- **Trạng thái bắt buộc có cho mọi màn hình dữ liệu:** đang tải (skeleton, chặn gửi lặp), chưa có dữ liệu (giải thích + gợi ý hành động), từ chối định vị (chuyển ghim thủ công, giữ dữ liệu), lỗi mạng/dịch vụ (thông báo ngắn + thử lại, **không báo thành công giả**), không có quyền (nói nội dung không còn khả dụng, **không lộ tên/tọa độ**).
- **Tiếp cận:** nhãn trường rõ, focus order hợp lý, thao tác bàn phím, `alt` cho ảnh, nút có tên, không chỉ dùng màu.
- Hướng thiết kế: hiện đại, sạch, ưu tiên ảnh trải nghiệm; tông màu ấm, thân thiện kiểu "nhật ký ẩm thực & du lịch"; tránh giao diện template mặc định. Có dark mode là điểm cộng, không bắt buộc.

---

## 11. BẢO MẬT, RULES, KIẾN TRÚC

**Kiến trúc:** Trình duyệt dùng Firebase SDK cho thao tác Rules cho phép; tác vụ cần bí mật máy chủ / cập nhật nhiều quan hệ / tạo thông báo / dọn dẹp chạy ở **Route Handler (firebase-admin)**. Phía server **tự xác thực ID token** và kiểm quyền từng thao tác — **không tin UID do client gửi** (Admin SDK bỏ qua Rules). UI không tự ghép đường dẫn dữ liệu riêng tư hay tự tạo quyền theo trạng thái hiển thị.

Cấu trúc thư mục gợi ý:
```
src/
  app/                 # routes (App Router)
  components/          # SpotCard, PlacePicker, ImageUploader, PrivacySelector, MapView, ...
  features/            # auth, spots, places, friends, likes, saved, notifications, search
  lib/
    firebase/          # client + admin init
    domain/            # types, zod schemas, validators, config (bán kính, giới hạn ảnh...)
    data/              # lớp truy cập Firestore/Storage
    geo/               # geolocation, geohash, nearby query, reverse geocoding
    map/               # MapProvider (Leaflet)
  server/              # logic tin cậy dùng ở route handlers
firestore.rules  storage.rules  firestore.indexes.json  firebase.json
docs/ (DECISIONS.md, ARCHITECTURE.md, TESTING.md)
tests/ (unit, rules, e2e)
```

**Viết đầy đủ `firestore.rules` và `storage.rules`** theo ma trận ở mục 3 và mô hình ở mục 6:
- Đọc Spot: tác giả; hoặc `public` với user đã đăng nhập; hoặc `friends` nếu tồn tại `users/{uid}/friends/{author}`.
- `userSettings`, `privatePlaces`, `spotLocations`, `savedPlaces`: chỉ chủ.
- `notifications`: chỉ người nhận đọc; chỉ đổi `isRead`; client không tạo.
- `friends` (bản tra cứu): client **không** ghi.
- Validate schema/kiểu/giới hạn (độ dài, rating 1–5, price ≥ 0 hoặc null, field lạ bị từ chối); bất biến `authorId/createdAt`.
- Storage: đúng đường dẫn UID/spotId, MIME, dung lượng ≤ 5 MB, quyền đọc đối chiếu bài viết.
- Truy vấn phía client phải **ràng buộc theo điều kiện quyền** để Rules chấp nhận.

Zod (hoặc tương đương) cho validate dùng chung client/server. Biến bí mật chỉ ở `.env.local`; có `.env.example`.

---

## 12. KẾ HOẠCH THEO GIAI ĐOẠN (làm tuần tự, mỗi giai đoạn phải chạy được)

**Giai đoạn 0 — Khởi tạo:** Next.js + TS strict + Tailwind + ESLint/Prettier; cấu hình Firebase Emulator (Auth/Firestore/Storage); cấu trúc thư mục; types + zod schemas + config; `npm run emulators/seed/test`; README chạy dự án.

**Giai đoạn 1 — Lõi (Tài khoản, Place, Spot, định vị):** FR01, FR02, FR03, FR04, FR05, FR14 (một phần). Đăng ký/đăng nhập/đăng xuất + tạo hồ sơ (hoàn thiện lại được nếu auth tạo xong mà hồ sơ lỗi); tạo/sửa/xóa Spot với upload ảnh + bỏ EXIF; Place chung/riêng; định vị + ghim thủ công; gợi ý Place bằng geohash + lọc `distanceBetween`; Spot hidden-location (tách `spotLocations`); rules + test rules cho phần này. Xem lại Spot của chính mình và trang chi tiết Place (lịch sử cá nhân).
*Hoàn thành khi:* tạo Spot được bằng **cả hai cách** định vị; tái sử dụng Place; xem lại lịch sử theo địa điểm; dữ liệu private bị rules từ chối.

**Giai đoạn 2 — Xã hội & bản đồ:** FR06–FR11, FR13 (trong website). Bạn bè (transaction/server), Feed phân trang đa nguồn, Like (docId = UID), Saved Place (hasVisited/isBookmarked), chi tiết Place gồm cả Spot bạn bè, bản đồ cá nhân Leaflet, thông báo trong web (lời mời, like), tìm kiếm/lọc cơ bản (FR12).
*Hoàn thành khi:* tương tác và kết bạn không tạo bản ghi trùng; quyền đọc đổi đúng khi đổi phạm vi/hủy kết bạn; phân trang và xử lý lỗi đạt.

**Giai đoạn 3 — Hoàn thiện:** nén/resize ảnh + bản xem trước, tìm kiếm tốt hơn, FCM push (tùy chọn, không bắt buộc), marker cluster, dọn dẹp ảnh tạm (job idempotent), tối ưu hiệu năng/đo đạc, rà soát accessibility, dark mode (tùy chọn), tài liệu.

---

## 13. KIỂM THỬ VÀ TIÊU CHÍ NGHIỆM THU

Phải có test chạy được bằng `npm test`:

1. **Unit:** validators (ảnh, caption, tên Place, rating, price null vs 0), `pairId`, chuẩn hóa tên (bỏ dấu), hàm gộp/loại trùng kết quả geohash + lọc khoảng cách (kể cả điểm sát ranh giới ô), tính lại `hasVisited`.
2. **Rules (Emulator):** ma trận đọc Spot (author/friend/other × public/friends/private); khách bị từ chối; không sửa/xóa Spot người khác; không đọc `privatePlaces/spotLocations/savedPlaces/userSettings/notifications` của người khác; client không ghi được `friends`/tạo `notifications`; field lạ bị từ chối; rating/price/độ dài sai bị từ chối; Storage: sai MIME/quá 5 MB/sai UID bị từ chối; **truy cập trực tiếp đường dẫn ảnh của Spot private bị từ chối**.
3. **E2E (Playwright):** đăng ký → tạo Spot (ghim thủ công) → tạo Place mới → tạo Spot thứ hai **tái sử dụng Place** → xem lịch sử tại Place; từ chối quyền định vị vẫn tạo được Spot; kết bạn 2 tài khoản → Feed hiện bài friends → đổi bài sang private → bạn không còn thấy → hủy kết bạn → mất quyền; like 2 lần/bấm lặp không tạo trùng; lưu Place 2 lần không tạo trùng.

**Tiêu chí nghiệm thu (từ báo cáo):** (a) tạo Spot bằng cả hai cách định vị; (b) tái sử dụng Place; (c) xem lại lịch sử theo địa điểm; (d) tương tác và kết bạn không tạo bản ghi trùng; (e) dữ liệu riêng tư bị **từ chối ở phía dịch vụ** khi người không có quyền truy cập. Cuối cùng viết `docs/TESTING.md` ghi rõ test nào pass, test nào chưa làm; **không khẳng định đã đạt chỉ tiêu hiệu năng nếu chưa đo**.

---

## 14. CÂU HỎI CẦN XÁC NHẬN VỚI TÔI (hỏi MỘT LẦN ở đầu, kèm mặc định để tôi chỉ cần "ok")

1. **Firebase:** dùng Emulator hoàn toàn để demo (mặc định), hay đã có project Firebase thật? Có gói **Blaze** không (nếu có mới dùng Cloud Functions; mặc định dùng Route Handlers + firebase-admin)?
2. **Tile bản đồ:** mặc định dùng OSM tile cho dev/demo nhỏ (có attribution), cấu hình đổi được; hay bạn muốn dùng Google Maps / MapTiler?
3. **Reverse geocoding:** mặc định Nominatim công cộng (≤ 1 req/s) qua Route Handler có cache; ok không?
4. **Triển khai:** Vercel (mặc định) hay Firebase Hosting?
5. **Dữ liệu mẫu:** có muốn seed sẵn vài user/Place/Spot khu vực Hà Nội để demo không (mặc định: có, ~3 user, ~10 Place, ~15 Spot)?

Nếu tôi không trả lời: dùng toàn bộ mặc định trên và ghi vào `docs/DECISIONS.md`.

---

## 15. SẢN PHẨM BÀN GIAO

- Mã nguồn đầy đủ chạy được; `README.md` (cài đặt, biến môi trường, chạy emulator, seed, test, build, deploy).
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`.
- `docs/ARCHITECTURE.md` (sơ đồ thành phần, luồng tạo Spot, mô hình dữ liệu), `docs/DECISIONS.md`, `docs/TESTING.md`.
- Tài khoản demo trong seed (ghi trong README).
- Báo cáo cuối: tính năng đã xong / chưa xong / hạn chế đã biết (gợi ý: Place trùng khi tạo đồng thời, tìm kiếm tiền tố chỉ cơ bản, Feed nhiều bạn thì nhiều truy vấn, phụ thuộc điều kiện dùng tile/geocoding).

**BẮT ĐẦU:** xác nhận 5 câu hỏi ở mục 14 (kèm mặc định), sau đó thực hiện Giai đoạn 0 và Giai đoạn 1.
