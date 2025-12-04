# Multi-stage Dockerfile cho frontend Nearby Msg (Vite + React)

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Cài đặt dependencies
RUN npm install --legacy-peer-deps

# Build-time backend URL
# - Dùng cho Vite thông qua biến VITE_BACKEND_URL
# - Giá trị này sẽ được đọc trong code/frontend để gọi API
ARG BACKEND_URL=http://localhost:8080
ENV VITE_BACKEND_URL=${BACKEND_URL}

# Copy source code
COPY . .

# Build Vite app (ra thư mục dist)
RUN npm run build

# Stage 2: Runtime (serve static)
FROM nginx:alpine AS runner

# Thư mục làm việc mặc định của nginx
WORKDIR /usr/share/nginx/html

# Copy file build từ stage builder sang nginx
COPY --from=builder /app/dist .

# Copy nginx default config (nếu cần custom sau này có thể thêm nginx.conf riêng)
# Mặc định sẽ serve static từ /usr/share/nginx/html trên port 80

EXPOSE 80

# Start nginx ở foreground
CMD ["nginx", "-g", "daemon off;"]
