import { defineTkDcbTrpcWsPlugin } from '@tk-dcb/nuxt/runtime/trpc-ws-plugin'
import type { TvwDomainRouter } from 'tvw-domain'

/** Nuxt plugin transform only sees `defineNuxtPlugin` in this file (not inside tk-dcb). */
export default defineNuxtPlugin({
  name: 'trpc-client',
  setup: defineTkDcbTrpcWsPlugin<TvwDomainRouter>({
    authStateKey: 'tvw-auth-token',
    authStorageKey: 'tvw_auth_token',
    debugLogTag: 'tvw trpc ws',
  }),
})
