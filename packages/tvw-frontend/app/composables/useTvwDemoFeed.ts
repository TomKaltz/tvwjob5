import { getUntypedClient } from '@trpc/client'
import type { TRPCUntypedClient } from '@trpc/client'
import type { DemoFeedStateType } from 'tvw-domain'
import {
  computed,
  onUnmounted,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'

type FeedStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Same shapes as framework `SubscriptionUpdate` (avoid importing server bundle on client). */
type SubscriptionUpdate =
  | { type: 'init'; data?: DemoFeedStateType }
  | {
      type: 'update'
      changes?: Array<{ type: string; key: string; data?: DemoFeedStateType }>
    }
  | { type: 'error'; message?: string }

function normalizeSubscriptionUpdate(raw: unknown): SubscriptionUpdate | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const t = r.type
  if (t === 'init' || t === 'update' || t === 'error') {
    return raw as SubscriptionUpdate
  }
  if (t === 'data' && r.data && typeof r.data === 'object') {
    const d = r.data as Record<string, unknown>
    if (d.type === 'init' || d.type === 'update' || d.type === 'error') {
      return r.data as SubscriptionUpdate
    }
  }
  return null
}

function applyUpdate(
  feed: Ref<DemoFeedStateType | null>,
  update: SubscriptionUpdate
): void {
  if (update.type === 'init') {
    if (update.data !== undefined) {
      feed.value = update.data
    }
    return
  }
  if (update.type === 'update') {
    let latest: DemoFeedStateType | undefined
    const changes = update.changes ?? []
    for (let i = changes.length - 1; i >= 0; i--) {
      const ch = changes[i]
      if (ch?.data !== undefined) {
        latest = ch.data
        break
      }
    }
    if (latest !== undefined) {
      feed.value = latest
    }
    return
  }
}

/**
 * Live `GetDemoFeed` over tRPC WebSocket for one partition (`input.demo`).
 * Uses `getUntypedClient` + procedure string for `querySubscription` so WS subscriptions
 * are not routed through the lazy Proxy getter chain (reliable delivery of `onData`).
 */
export function useTvwDemoFeed(demoId: MaybeRefOrGetter<string>) {
  const $trpc = useTrpc()
  const { isConnected } = useWebSocketConnection()

  const feed = ref<DemoFeedStateType | null>(null)
  const status = ref<FeedStatus>('idle')
  const error = ref<string | null>(null)

  let stopSub: (() => void) | null = null

  const subscriptionActive = computed(() => status.value === 'ready')

  function clearSub() {
    if (stopSub) {
      stopSub()
      stopSub = null
    }
  }

  function startSub() {
    clearSub()
    if (!isConnected.value) {
      status.value = 'idle'
      return
    }

    const partition = toValue(demoId).trim()
    if (!partition) {
      status.value = 'idle'
      return
    }

    status.value = 'loading'
    error.value = null

    const untyped = getUntypedClient($trpc as never) as TRPCUntypedClient<never>
    const sub = untyped.subscription(
      'querySubscription',
      {
        queryName: 'GetDemoFeed',
        input: { demo: partition },
        options: {},
      },
      {
        onStarted: () => {},
        onData: (raw: unknown) => {
          const update = normalizeSubscriptionUpdate(raw)
          if (!update) return
          if (update.type === 'error') {
            error.value = update.message ?? 'Subscription error'
            status.value = 'error'
            return
          }
          applyUpdate(feed, update)
          status.value = 'ready'
        },
        onError: (err: unknown) => {
          error.value = err instanceof Error ? err.message : String(err)
          status.value = 'error'
        },
        onStopped: () => {},
        onComplete: () => {},
        onConnectionStateChange: () => {},
      } as never
    )

    stopSub = () => {
      sub.unsubscribe()
      stopSub = null
    }
  }

  watch(
    [isConnected, () => toValue(demoId)],
    () => {
      if (isConnected.value) {
        startSub()
      } else {
        clearSub()
        status.value = 'idle'
        feed.value = null
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    clearSub()
  })

  const busy = ref(false)

  async function recordMessage(text: string) {
    const partition = toValue(demoId).trim()
    if (!text.trim() || !partition || !isConnected.value) return { ok: false as const }
    busy.value = true
    error.value = null
    try {
      const result = await $trpc.command.mutate({
        command: 'RecordDemoMessage',
        input: { demo: partition, message: text.trim() },
      })
      if (!result.success) {
        error.value =
          'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Command failed'
        return { ok: false as const }
      }
      return { ok: true as const }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Mutation failed'
      return { ok: false as const }
    } finally {
      busy.value = false
    }
  }

  return {
    feed,
    status,
    error,
    busy,
    subscriptionActive,
    isConnected,
    recordMessage,
  }
}
