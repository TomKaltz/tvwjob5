import { createTRPCClient, createWSClient, wsLink } from '@trpc/client'
import type { TvwDomainRouter } from 'tvw-domain'
import { watch } from 'vue'

const AUTH_STORAGE_KEY = 'tvw_auth_token'

let wsClient: ReturnType<typeof createWSClient> | null = null
let client: ReturnType<typeof createTRPCClient<TvwDomainRouter>> | null = null
let connectionReady = false

export type WsConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected'

function trpcClientPlugin() {
  const wsConnectionState = useState<WsConnectionState>(
    'trpc-ws-connection',
    () => 'idle'
  )
  const authToken = useState<string | null>('tvw-auth-token', () => null)

  if (!authToken.value) {
    try {
      const stored = sessionStorage.getItem(AUTH_STORAGE_KEY)
      if (stored) authToken.value = stored
    } catch {
      /* sessionStorage unavailable */
    }
  }

  const config = useRuntimeConfig()
  const tkDcbDebug = () =>
    Boolean((config.public as { tkDcbDebug?: boolean }).tkDcbDebug)

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
    disconnect()
    wsConnectionState.value = 'connecting'

    wsClient = createWSClient({
      url: wsUrl(),
      connectionParams: async () => {
        const tok = authToken.value
        return tok ? { token: tok } : {}
      },
      onOpen: () => {
        if (tkDcbDebug()) console.debug('[tvw trpc ws] open', wsUrl())
        connectionReady = true
        wsConnectionState.value = 'connected'
      },
      onClose: (event) => {
        if (tkDcbDebug()) console.debug('[tvw trpc ws] close', event?.code, event)
        connectionReady = false
        wsConnectionState.value = 'disconnected'
        const code = event?.code
        const reason = String(
          (event as { reason?: string } | undefined)?.reason ?? ''
        )
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
      onError: (err) => {
        if (tkDcbDebug()) console.debug('[tvw trpc ws] error', err)
        connectionReady = false
        wsConnectionState.value = 'disconnected'
      },
      retryDelayMs: (attemptIndex) => {
        if (!wsClient) return Infinity
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

  watch(authToken, () => connect(), { immediate: true })

  const ensureClient = () => {
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
            throw new Error('tRPC WebSocket client unavailable')
          }
          return Reflect.get(c as object, prop)
        },
      }) as ClientType,
      __trpcConnect: connect,
      __trpcDisconnect: disconnect,
      __trpcReady: () => connectionReady,
      __trpcWsConnectionState: wsConnectionState,
    },
  }
}

export default defineNuxtPlugin(
  Object.assign(trpcClientPlugin, {
    _name: 'trpc-client',
    dependsOn: ['tvw-auth-token'],
  })
)
