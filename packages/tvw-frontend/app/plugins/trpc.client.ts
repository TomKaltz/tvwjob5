import { defineTkDcbTrpcWsPlugin } from '@tk-dcb/nuxt/runtime/trpc-ws-plugin'
import type { TvwDomainRouter } from 'tvw-domain'

const plugin = defineTkDcbTrpcWsPlugin<TvwDomainRouter>({
  authStateKey: 'tvw-auth-token',
  authStorageKey: 'tvw_auth_token',
  debugLogTag: 'tvw trpc ws',
})

export default Object.assign(plugin, { _name: 'trpc-client' })
