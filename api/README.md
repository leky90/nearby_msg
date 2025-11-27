# Nearby Community Chat API

Go backend API for the Nearby Community Chat PWA.

## Prerequisites

- Go 1.22 or higher
- PostgreSQL 15.x or 16.x (or use Neon serverless)

## Setup

1. Copy `.env.example` to `.env` and configure:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   go mod download
   ```

3. Set up your database (see [quickstart.md](../specs/001-nearby-msg/quickstart.md))

4. Run migrations:

   ```bash
   # Using golang-migrate
   migrate -path ./internal/infrastructure/database/migrations -database "$DATABASE_URL" up
   ```

5. Run the server:

   ```bash
   # Development mode with auto-reload (recommended)
   air

   # Or run directly
   go run cmd/server/main.go
   ```

The server will start on `http://localhost:8080` (or the port specified in `PORT` environment variable).

## Project Structure

```
api/
├── cmd/
│   └── server/          # Application entry point
├── internal/
│   ├── domain/          # Domain models and business logic
│   ├── service/         # Application/use-case services
│   ├── handler/         # HTTP handlers
│   └── infrastructure/  # Infrastructure adapters (DB, auth)
├── pkg/                 # Public packages (if any)
└── tests/               # Test files
```

## Development

### Watch Mode (Auto-reload)

For automatic rebuild and restart on file changes:

```bash
# Using Make (recommended)
make dev

# Or using air directly
air

# Or using the helper script
./scripts/dev.sh
```

### Other Commands

- Run tests: `go test ./...` or `make test`
- Format code: `go fmt ./...`
- Build: `go build -o bin/server cmd/server/main.go` or `make build`
- Run directly: `go run ./cmd/server` or `make run`
- Clean artifacts: `make clean`

See `make help` for all available commands.

## API Documentation

- **Interactive API Docs:** See [docs/API.md](./docs/API.md) for complete API documentation with examples
- **OpenAPI Spec:** See [contracts/openapi.yaml](../specs/001-nearby-msg/contracts/openapi.yaml) for OpenAPI 3.0 specification

## Deployment

### Environment Variables

Required environment variables:

```bash
# Database connection
DATABASE_URL=postgresql://user:password@host:port/dbname?sslmode=require

# JWT secret for token generation (use a strong random string)
JWT_SECRET=your-secret-key-here-minimum-32-characters

# Server port (optional, defaults to 8080)
PORT=8080

# Database connection pool settings (optional)
DB_MAX_CONNS=25
DB_MIN_CONNS=5
```

### Production Build

1. **Build the binary:**
   ```bash
   go build -o bin/server ./cmd/server
   ```

2. **Run migrations:**
   ```bash
   migrate -path ./internal/infrastructure/database/migrations -database "$DATABASE_URL" up
   ```

3. **Start the server:**
   ```bash
   ./bin/server
   ```

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o server ./cmd/server

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/server .
EXPOSE 8080
CMD ["./server"]
```

Build and run:
```bash
docker build -t nearby-msg-api .
docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  nearby-msg-api
```

### Platform-Specific Deployment

#### Railway

1. Connect your repository to Railway
2. Set environment variables in Railway dashboard
3. Railway will auto-detect Go and build/run the server

#### Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Create `fly.toml`:
   ```toml
   app = "nearby-msg-api"
   primary_region = "iad"
   
   [build]
     builder = "paketobuildpacks/builder:base"
   
   [[services]]
     internal_port = 8080
     protocol = "tcp"
   
     [[services.ports]]
       handlers = ["http"]
       port = 80
       force_https = true
   
     [[services.ports]]
       handlers = ["tls", "http"]
       port = 443
   ```
3. Deploy: `fly deploy`

#### Heroku

1. Create `Procfile`:
   ```
   web: ./bin/server
   ```
2. Deploy: `git push heroku main`

### Health Checks

The server exposes a health check endpoint:

```bash
curl http://localhost:8080/health
```

Returns `200 OK` if the server is running.

### Monitoring

- **Health endpoint:** `/health`
- **Logs:** Server logs to stdout/stderr
- **Metrics:** Consider adding Prometheus metrics for production

### Security Considerations

1. **JWT Secret:** Use a strong, random secret (minimum 32 characters)
2. **Database:** Use SSL/TLS connections in production (`sslmode=require`)
3. **HTTPS:** Always use HTTPS in production (use a reverse proxy like nginx or Caddy)
4. **Rate Limiting:** Already implemented (10 messages/minute per device)
5. **CORS:** Configure CORS headers appropriately for your frontend domain
