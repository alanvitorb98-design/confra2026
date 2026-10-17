import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Build id: short commit on GitHub Actions, timestamp locally. Shipped in the bundle and in version.json,
// so the app can tell whether a newer version is online.
const VERSION = `${new Date().toISOString().slice(0, 16).replace('T', ' ')}${process.env.GITHUB_SHA ? ` · ${process.env.GITHUB_SHA.slice(0, 7)}` : ''}`

// Content-Security-Policy for the built site. GitHub Pages can't send headers, so it goes in a meta tag.
// Only the hosts the app talks to: Supabase (data, photos, live updates), Cloudflare R2 (photos),
// Google Fonts and the OpenStreetMap address search in the organizer panel. Left out of `npm run dev`,
// where Vite's live reload needs its own connections.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' blob: data: https://*.supabase.co wss://*.supabase.co https://*.r2.cloudflarestorage.com https://nominatim.openstreetmap.org",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

// BASE_PATH lets the GitHub Pages build live under /confra2026/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  plugins: [
    react(),
    {
      name: 'csp',
      apply: 'build',
      transformIndexHtml: (html: string) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
    },
    {
      name: 'version-file',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION }) })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      workbox: {
        // version.json must always come from the network
        globIgnores: ['**/version.json'],
        // shows the countdown reminders sent by the server
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            // feed previews never change once posted: keep them on the phone so each one downloads once
            urlPattern: /^https:\/\/optapzbhyhklcirdoyid\.supabase\.co\/storage\/v1\/object\/sign\/fotos\/.*-p\.jpg\?/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'previews',
              expiration: { maxEntries: 600 },
              cacheableResponse: { statuses: [200] },
              // signed links change on every refresh: cache by the file path, not the expiring token
              plugins: [{ cacheKeyWillBeUsed: async ({ request }) => request.url.split('?')[0] }],
            },
          },
        ],
      },
      manifest: {
        name: 'Confra da Firma',
        short_name: 'Confra',
        description: 'As fotos da confraternização de fim de ano 2026',
        lang: 'pt-BR',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fbf3d9',
        theme_color: '#fbf3d9',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
