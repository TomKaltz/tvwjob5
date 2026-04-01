import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  nitro: {
    preset: 'node-server',
    experimental: { wasm: true },
  },
  build: {
    transpile: ['@tk-dcb/framework', 'tvw-domain'],
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
