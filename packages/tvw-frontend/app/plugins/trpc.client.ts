import { createTRPCClient, createWSClient, wsLink } from '@trpc/client'
import type { TvwDomainRouter } from 'tvw-domain'

let wsClient: ReturnType<typeof createWSClient> | null = null
let client: ReturnType<typeof createTRPCClient<TvwDomainRouter>> | null = null
let connectionReady = false

export type WsConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected'

export default defineNuxtPlugin({
  name: 'trpc-client',
  setup() {
    const wsConnectionState = useState<WsConnectionState>(
      'trpc-ws-connection',
      () => 'idle'
    )
    const authToken = useState<string | null>('tvw-auth-token', () => null)
    const config = useRuntimeConfig()

    const wsUrl = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return (
        config.public.trpcWsUrl ||
        `${protocol}//${window.location.host}/ws`
      )
    }

    const disconnect = () => {
      if (wsClient) {
        const inner = (wsClient as { ws?: WebSocket }).ws
        if (inner && inner.readyState === WebSocket.OPEN) {
          inner.close()
        }
        wsClient = null
        client = null
        connectionReady = false
      }
      wsConnectionState.value = 'idle'
    }

    const connect = () => {
      const tok = authToken.value
      if (!tok) {
        disconnect()
        return null
      }

      disconnect()
      wsConnectionState.value = 'connecting'

      wsClient = createWSClient({
        url: wsUrl(),
        connectionParams: async () => ({ token: tok }),
        onOpen: () => {
          connectionReady = true
          wsConnectionState.value = 'connected'
        },
        onClose: (event) => {
          connectionReady = false
          wsConnectionState.value = 'disconnected'
          const code = event?.code
          const reason = String(event?.reason ?? '')
          const authFail =
            code === 4401 ||
            code === 4001 ||
            reason.includes('UNAUTHORIZED') ||
            reason.includes('401')
          if (authFail) {
            wsClient = null
            client = null
          }
        },
        onError: () => {
          connectionReady = false
          wsConnectionState.value = 'disconnected'
        },
        retryDelayMs: (attemptIndex) => {
          if (!authToken.value || !wsClient) return Infinity
          if (attemptIndex === 0) return 0
          return Math.min(1000 * 2 ** attemptIndex, 30000)
        },
        keepAlive: {
          enabled: true,
          intervalMs: 10_000,
          pongTimeoutMs: 5_000,
        },
      })

      client = createTRPCClient<TvwDomainRouter>({
        links: [wsLink({ client: wsClient })],
      })

      return client
    }

    watch(
      authToken,
      (t) => {
        if (t) connect()
        else disconnect()
      },
      { immediate: true }
    )

    const ensureClient = () => {
      if (!authToken.value) return null
      if (client && wsClient) return client
      return connect()
    }

    type ClientType = ReturnType<typeof createTRPCClient<TvwDomainRouter>>

    return {
      provide: {
        trpc: new Proxy({} as ClientType, {
          get(_target, prop) {
            if (prop === 'then' || prop === 'catch' || prop === 'finally') {
              return undefined
            }
            const c = ensureClient()
            if (!c) {
              throw new Error('Not logged in — open tRPC after login')
            }
            return (c as Record<string | unknown>)[prop as string]
          },
        }) as ClientType,
        __trpcConnect: connect,
        __trpcDisconnect: disconnect,
        __trpcReady: () => connectionReady,
        __trpcWsConnectionState: wsConnectionState,
      },
    }
  },
})
