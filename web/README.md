# Nearby Community Chat - Web Frontend

React PWA frontend for the Nearby Community Chat application.

## Prerequisites

- Node.js 18.x or higher
- npm, pnpm, or bun

## Setup

1. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   # or
   bun install
   ```

2. Copy `.env.local.example` to `.env.local` and configure (optional):
   ```bash
   cp .env.local.example .env.local
   ```
   
   **Note:** In development, the API proxy is automatically configured. You only need to set `VITE_API_URL` if you want to use a different backend URL.

3. Start development server:
   ```bash
   npm run dev
   # or
   pnpm dev
   # or
   bun dev
   ```

The app will be available at `http://localhost:5173` (Vite default port).

### API Proxy (Development)

The Vite dev server is configured to proxy API requests to the backend:

- **Proxy path:** `/api` → `http://localhost:8080/v1`
- **Alternative:** `/v1` → `http://localhost:8080/v1`

This means:
- Frontend requests to `/api/device/register` are proxied to `http://localhost:8080/v1/device/register`
- No CORS issues in development
- No need to configure `VITE_API_URL` in development (unless using a different backend URL)

**To use a different backend URL**, set `VITE_API_URL` in `.env.local`:
```bash
VITE_API_URL=http://localhost:3000/v1
```

## Project Structure

```
web/
├── src/
│   ├── domain/          # Domain logic (no React imports)
│   ├── components/      # React UI components
│   │   ├── common/      # Reusable components
│   │   ├── home/        # Home page components
│   │   ├── groups/      # Group-related components
│   │   └── chat/        # Chat components
│   ├── hooks/           # Custom React hooks
│   ├── services/        # Data services (RxDB, API clients)
│   └── pages/           # Page components
├── public/              # Static assets
├── tests/               # Test files
└── vite.config.ts       # Vite configuration
```

## Development

- **Dev server**: `npm run dev`
- **Build**: `npm run build`
- **Preview**: `npm run preview` (preview production build)
- **Test**: `npm test` (unit tests with Vitest)
- **Type check**: `npm run type-check`

## Testing

- Unit tests: `npm test`
- Watch mode: `npm run test:watch`
- UI mode: `npm run test:ui`

## PWA Features

This app is a Progressive Web App (PWA) with:
- Offline support via Service Worker
- Installable on mobile devices
- Background sync for pending messages

See [quickstart.md](../specs/001-nearby-msg/quickstart.md) for more details.

## Deployment

### Environment Variables

Create `.env.production` or set environment variables:

```bash
# API base URL (required)
VITE_API_URL=https://api.nearby-msg.example.com

# Optional: Custom configuration
VITE_APP_NAME=Nearby Community Chat
```

### Production Build

1. **Build the application:**
   ```bash
   pnpm build
   # or
   npm run build
   ```

   This creates an optimized production build in the `dist/` directory.

2. **Preview the build locally:**
   ```bash
   pnpm preview
   ```

### Static Hosting

The built application is a static PWA that can be deployed to any static hosting service.

#### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel`
3. Set environment variables in Vercel dashboard

#### Netlify

1. Install Netlify CLI: `npm i -g netlify-cli`
2. Deploy: `netlify deploy --prod --dir=dist`
3. Set environment variables in Netlify dashboard

#### Cloudflare Pages

1. Connect your repository to Cloudflare Pages
2. Build command: `pnpm build`
3. Build output directory: `dist`
4. Set environment variables in Cloudflare dashboard

#### GitHub Pages

1. Install gh-pages: `pnpm add -D gh-pages`
2. Add to `package.json`:
   ```json
   {
     "scripts": {
       "deploy": "pnpm build && gh-pages -d dist"
     }
   }
   ```
3. Deploy: `pnpm deploy`

### PWA Configuration

The app is configured as a PWA with:
- **Service Worker:** Automatically registered for offline support
- **Manifest:** `public/manifest.json` (update with your app details)
- **Icons:** Place `pwa-192x192.png` and `pwa-512x512.png` in `public/`

### Environment-Specific Builds

For different environments, use different `.env` files:

- `.env.local` - Local development (gitignored)
- `.env.production` - Production build
- `.env.staging` - Staging environment

Vite automatically loads the appropriate file based on the mode.

### Build Optimization

The production build includes:
- Code minification
- Tree shaking
- Asset optimization
- Service Worker precaching
- Source maps (can be disabled for smaller builds)

### Performance

- **Code splitting:** Automatic via Vite
- **Lazy loading:** Routes and components are lazy-loaded
- **Caching:** Service Worker caches static assets
- **Compression:** Enable gzip/brotli compression on your hosting service

### Troubleshooting

**Build fails:**
- Check Node.js version (18.x or higher)
- Clear `node_modules` and reinstall: `rm -rf node_modules && pnpm install`
- Check for TypeScript errors: `pnpm type-check`

**PWA not working:**
- Ensure HTTPS (required for Service Workers)
- Check browser console for Service Worker errors
- Verify `manifest.json` is accessible

**API connection issues:**
- Verify `VITE_API_URL` is set correctly
- Check CORS settings on API server
- Verify API server is running and accessible
