import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Proxy API requests to backend server
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/v1'),
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req) => {
            // Log proxied requests for debugging
            console.log('Proxying request:', req.method, req.url);
            // Ensure Authorization header is forwarded (Vite proxy does this by default, but explicit is better)
            if (req.headers.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization);
            }
          });
        },
      },
      // Alternative: Direct proxy for /v1 endpoints
      '/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('proxy error', err);
          });
        },
      },
      // WebSocket proxy for /ws endpoints
      '/ws': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('WebSocket proxy error', err);
          });
          proxy.on('proxyReqWs', (proxyReq, req) => {
            // Log WebSocket upgrade requests
            console.log('Proxying WebSocket upgrade:', req.url);
            // Forward Authorization header if present
            if (req.headers.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization);
            }
          });
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'offline.html'],
      injectRegister: 'auto',
      manifest: {
        name: 'Nearby Community Chat',
        short_name: 'Nearby Chat',
        description: 'Offline-first community chat for disaster scenarios',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'vite.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Don't use custom sw.js from public/ - let VitePWA generate it
        // Precaching: Cache app shell and static assets
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}',
          'index.html'
        ],
        // Precache strategy: CacheFirst for static assets
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/_/, /^\/v1/],
        // Clean up old caches on activation
        cleanupOutdatedCaches: true,
        // Skip waiting: true = auto update (updates activate immediately)
        // With skipWaiting: true, updates happen automatically
        // PWAUpdateNotification only informs user, no action needed
        skipWaiting: true,
        clientsClaim: true,
        // Import custom service worker code if needed (for background sync)
        // Note: In dev mode, we can import custom sw.js for background sync features
        importScripts: process.env.NODE_ENV === 'development' ? ['/sw.js'] : [],
        // Runtime caching strategies
        runtimeCaching: [
          {
            // Local API requests (via proxy): NetworkFirst with fallback to cache
            urlPattern: ({ url }) => {
              return url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/');
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              },
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
              }
            }
          },
          {
            // External API requests: NetworkFirst with fallback to cache
            urlPattern: /^https:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'external-api-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              },
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60 // 5 minutes
              }
            }
          },
          {
            // Static assets: CacheFirst for better performance
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          },
          {
            // HTML pages: NetworkFirst with offline fallback
            urlPattern: /\.(?:html)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 3,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      // Enable in dev mode for testing
      devOptions: {
        enabled: true,
        type: 'module',
        // Use custom sw.js in dev mode for background sync features
        navigateFallback: '/index.html',
        // Suppress warnings about missing icons in dev mode
        suppressWarnings: true
      }
    })
  ]
})
