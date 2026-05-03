import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import tkDcb from '@tk-dcb/nuxt'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: [tkDcb],
  /** Set `NUXT_PUBLIC_TK_DCB_DEBUG=1` for WS / tk-dcb console.debug noise. */
  tkDcb: {
    debug: process.env.NUXT_PUBLIC_TK_DCB_DEBUG === '1',
  },
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  nitro: {
    preset: 'node-server',
    experimental: { wasm: true },
  },
  build: {
    transpile: ['@tk-dcb/framework', '@tk-dcb/nuxt', 'tvw-domain'],
  },
  watch: [resolve(__dirname, '../tvw-domain/dist')],
  vite: {
    server: {
      watch: {
        ignored: ['!**/node_modules/@tk-dcb/**', '!**/node_modules/tvw-domain/**'],
      },
    },
    optimizeDeps: {
      exclude: ['@tk-dcb/framework', 'tvw-domain'],
    },
    ssr: {
      external: ['@tk-dcb/framework', 'tvw-domain'],
    },
  },
  runtimeConfig: {
    public: {
      trpcWsUrl: process.env.NUXT_PUBLIC_TRPC_WS_URL || '',
    },
  },
})
