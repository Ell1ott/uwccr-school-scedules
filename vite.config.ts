import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

function stripProxyPrefix(path: string): string {
  return path.replace(/^\/wvq/, '')
}

const posthogProxy: Record<string, string | ProxyOptions> = {
  '/wvq/static': {
    target: 'https://us-assets.i.posthog.com',
    changeOrigin: true,
    rewrite: stripProxyPrefix,
  },
  '/wvq/array': {
    target: 'https://us-assets.i.posthog.com',
    changeOrigin: true,
    rewrite: stripProxyPrefix,
  },
  '/wvq': {
    target: 'https://us.i.posthog.com',
    changeOrigin: true,
    rewrite: stripProxyPrefix,
  },
}

export default defineConfig({
  server: { proxy: posthogProxy },
  preview: { proxy: posthogProxy },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
        includeAssets: [
          'favicon.svg',
          'favicon.ico',
          'apple-touch-icon-180x180.png',
          'push-sw.js',
        ],
      manifest: {
        id: '/',
        name: 'IB Week View',
        short_name: 'Week View',
        description: 'IB class schedules',
        theme_color: '#fbf9fa',
        background_color: '#fbf9fa',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        categories: ['education', 'productivity'],
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}'],
        importScripts: ['push-sw.js'],
        clientsClaim: true,
        skipWaiting: true,
        navigateFallbackDenylist: [/^\/wvq(?:\/|$)/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/wvq'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
