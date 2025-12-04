## Nearby Msg

Ứng dụng chat cộng đồng theo vị trí (PWA) gồm:

- **Backend** (`api/`): Go API (WebSocket + replication) lưu trữ trên PostgreSQL.
- **Frontend** (`web/`): Ứng dụng web (React/TypeScript) offline-first dùng RxDB, Redux-Saga.

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
