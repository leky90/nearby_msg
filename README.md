## Nearby Msg

Ứng dụng chat cộng đồng theo vị trí (PWA) gồm:

- **Backend** (`api/`): Go API (WebSocket + replication) lưu trữ trên PostgreSQL.
- **Frontend** (`web/`): Ứng dụng web (React/TypeScript) offline-first dùng RxDB, Redux-Saga.

### Tính năng chính

#### 💬 Chat theo vị trí
- **Tìm nhóm nearby**: Tự động tìm các nhóm chat trong bán kính xung quanh vị trí GPS của bạn
- **Lọc theo bán kính**: Điều chỉnh bán kính tìm kiếm (100m, 500m, 1km, 5km, 10km)
- **Tạo nhóm mới**: Tạo nhóm chat mới tại vị trí hiện tại
- **Favorite groups**: Đánh dấu nhóm yêu thích để truy cập nhanh
- **Real-time messaging**: Gửi/nhận tin nhắn real-time qua WebSocket
- **Offline-first**: Hoạt động offline, tự động đồng bộ khi có mạng

#### 📌 Ghim tin nhắn
- **Ghim tin nhắn quan trọng**: Đánh dấu tin nhắn quan trọng trong nhóm
- **Xem tin nhắn đã ghim**: Sheet hiển thị tất cả tin nhắn đã ghim trong nhóm
- **Quyền ghim**: Chỉ người ghim mới có thể bỏ ghim tin nhắn của mình
- **Đồng bộ real-time**: Tin nhắn ghim được đồng bộ real-time qua WebSocket

#### 🚨 SOS khẩn cấp
- **4 loại SOS**: 
  - 🏥 SOS cấp cứu (medical)
  - 🔥 SOS cháy nổ (fire)
  - 💧 SOS lũ lụt (flood)
  - 🚧 SOS mắc kẹt (missing_person)
- **Gửi tới tất cả nhóm**: Tự động gửi SOS tới tất cả nhóm bạn đang tham gia
- **Kèm vị trí GPS**: Tin nhắn SOS tự động kèm vị trí GPS hiện tại
- **Reverse geocoding**: Hiển thị địa chỉ đọc được từ tọa độ GPS
- **Mở Google Maps**: Click vào vị trí GPS để mở Google Maps
- **Cooldown**: Giới hạn 30 giây giữa các lần gửi SOS để tránh spam

#### 👤 Quản lý tài khoản
- **Nickname**: Đặt và cập nhật tên hiển thị
- **Vị trí**: Xem và cập nhật vị trí GPS hiện tại
- **Trạng thái người dùng**: Cập nhật trạng thái (available, busy, away, offline)
- **Xóa dữ liệu**: Xóa dữ liệu local và đăng xuất

#### 📱 Progressive Web App (PWA)
- **Offline support**: Hoạt động hoàn toàn offline với RxDB
- **Installable**: Cài đặt như ứng dụng native trên mobile/desktop
- **Service Worker**: Cache tài nguyên và hỗ trợ background sync
- **Auto-update**: Thông báo khi có phiên bản mới

#### 🔄 Đồng bộ dữ liệu
- **Replication push/pull**: Đồng bộ hai chiều giữa client và server
- **Mutation queue**: Hàng đợi các thay đổi khi offline, tự động gửi khi online
- **Pull replication định kỳ**: Tự động pull dữ liệu mới mỗi 30 giây
- **Sync status**: Hiển thị trạng thái đồng bộ trong giao diện

#### 🌐 WebSocket Real-time
- **Kết nối tự động**: Tự động kết nối và reconnect khi mất kết nối
- **Broadcast tin nhắn**: Server broadcast tin nhắn mới tới tất cả client trong nhóm
- **Sự kiện pin/unpin**: Đồng bộ real-time khi có tin nhắn được ghim/bỏ ghim
- **Status indicator**: Hiển thị trạng thái kết nối WebSocket

#### 🔒 Bảo mật & Rate Limiting
- **CORS**: Chỉ cho phép các origin đã được xác định
- **Rate limiting**: Giới hạn số lượng tin nhắn và SOS messages
- **Message validation**: Kiểm tra độ dài nội dung, tags, và các trường bắt buộc
- **WebSocket read limit**: Giới hạn kích thước payload WebSocket (16KB)

### Yêu cầu môi trường

- **Node.js**: >= 18
- **npm** hoặc **pnpm** (tùy bạn dùng trong `web/`)
- **Go**: >= 1.22
- **PostgreSQL**: 15/16 (hoặc dịch vụ tương thích, ví dụ Neon)
- **Git** và Docker (tùy chọn, nếu muốn build Docker image)

### Cài đặt nhanh

```bash
# Clone repo
git clone git@github.com:leky90/nearby_msg.git
cd nearby_msg
```

#### 1. Backend (`api/`)

Xem chi tiết trong `api/README.md`, tóm tắt như sau:

```bash
cd api

# Tạo file cấu hình
cp .env.example .env   # sau đó chỉnh DATABASE_URL, JWT_SECRET, PORT...

# Cài dependency
go mod download

# Chạy migration (ví dụ dùng golang-migrate)
migrate -path ./internal/infrastructure/database/migrations -database "$DATABASE_URL" up

# Chạy server dev (có auto reload nếu đã cài air)
make dev        # hoặc
air             # hoặc
go run cmd/server/main.go
```

Mặc định backend chạy tại `http://localhost:8080` (có thể thay bằng `PORT` trong `.env`).

#### 2. Frontend (`web/`)

```bash
cd web

# Cài dependency
npm install     # hoặc pnpm install / yarn

# Cấu hình env (nếu cần)
cp .env.example .env.local  # nếu file này tồn tại, chỉnh BACKEND_URL về API local, ví dụ:
# BACKEND_URL=http://localhost:8080

# Chạy dev server
npm run dev
```

Sau đó mở trình duyệt tại địa chỉ được in ra (thường là `http://localhost:5173` hoặc URL tương đương, tùy toolchain).

### Chạy bằng Docker (tùy chọn, tóm tắt)

Repo đã có workflow CI dùng Docker build hai image:

- `ghcr.io/<owner>/nearby-msg-api`
- `ghcr.io/<owner>/nearby-msg-web`

Bạn có thể tự build local:

```bash
# Backend
cd api
docker build -t nearby-msg-api .

# Frontend
cd ../web
docker build -t nearby-msg-web .
```

### Cấu trúc thư mục chính

- `api/`: mã nguồn backend Go, service WebSocket, replication, migration DB...
- `web/`: mã nguồn frontend React/TypeScript (PWA, RxDB, Redux-Saga, SOS features...).
- `.github/workflows/`: cấu hình CI/CD build & deploy Docker image cho frontend/backend.

### Gợi ý phát triển

- Luôn chạy backend và frontend song song để test real-time (WebSocket + replication).
- Kiểm tra lại quyền GPS trên thiết bị khi test tính năng SOS.
- Với thay đổi DB lớn, nên dùng môi trường PostgreSQL riêng (dev/staging) trước khi apply lên production.
