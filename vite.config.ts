import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Build id: short commit on GitHub Actions, timestamp locally. Shipped in the bundle and in version.json,
// so the app can tell whether a newer version is online.
const VERSION = `${new Date().toISOString().slice(0, 16).replace('T', ' ')}${process.env.GITHUB_SHA ? ` · ${process.env.GITHUB_SHA.slice(0, 7)}` : ''}`

// BASE_PATH lets the GitHub Pages build live under /confra2026/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  plugins: [
    react(),
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
