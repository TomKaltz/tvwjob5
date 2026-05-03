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

export type DemoFeedListItem = DemoFeedStateType & { id?: string }

/** Same shapes as framework `SubscriptionUpdate` (avoid importing server bundle on client). */
type SubscriptionUpdate =
  | { type: 'init'; data?: unknown }
  | {
      type: 'update'
      changes?: Array<{ type: string; key: string; data?: unknown }>
    }
  | { type: 'error'; message?: string }

const DEMO_FEED_LIST_LIMIT = 500

export function partitionKeyFromFeedItem(item: DemoFeedListItem): string {
  const d = item.demo ?? item.id
  return d != null && String(d) !== '' ? String(d) : ''
}

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
  const result = r.result
  if (result && typeof result === 'object' && result !== raw) {
    return normalizeSubscriptionUpdate(result)
  }
  return null
}

function coerceTotal(raw: unknown, itemsLen: number): number {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10)
    if (!Number.isNaN(n)) return n
  }
  return itemsLen
}

/** Accept `{ items, total }` or common tRPC / transport wrappers. */
function unwrapListInitPayload(data: unknown): { items: DemoFeedListItem[]; total: number } | null {
  if (!data || typeof data !== 'object') return null
  const tryShape = (o: Record<string, unknown>): { items: DemoFeedListItem[]; total: number } | null => {
    if (!Array.isArray(o.items)) return null
    const items = o.items as DemoFeedListItem[]
    return { items, total: coerceTotal(o.total, items.length) }
  }

  const direct = tryShape(data as Record<string, unknown>)
  if (direct) return direct

  const top = data as Record<string, unknown>
  // tRPC client envelope: { result: { type: 'data', data: SubscriptionUpdate } }
  const result = top.result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (r.type === 'data' && r.data && typeof r.data === 'object') {
      const payload = r.data as Record<string, unknown>
      if (payload.type === 'init' && 'data' in payload) {
        const inner = unwrapListInitPayload(payload.data)
        if (inner) return inner
      }
      const inner = unwrapListInitPayload(r.data)
      if (inner) return inner
    }
  }
  // Single nested `data` object (not SubscriptionUpdate)
  if (top.data && typeof top.data === 'object') {
    const d = top.data as Record<string, unknown>
    if (!('type' in d) || typeof d.type !== 'string') {
      const nested = tryShape(d)
      if (nested) return nested
    }
  }
  return null
}

function applyListUpdate(items: Ref<DemoFeedListItem[]>, update: SubscriptionUpdate): void {
  if (update.type === 'init') {
    const payload = unwrapListInitPayload(update.data)
    if (payload) {
      items.value = payload.items
    }
    return
  }
  if (update.type === 'update') {
    const map = new Map<string, DemoFeedListItem>()
    for (const it of items.value) {
      const k = partitionKeyFromFeedItem(it)
      if (k) map.set(k, it)
    }
    for (const ch of update.changes ?? []) {
      if (ch.type === 'remove') {
        map.delete(ch.key)
        continue
      }
      if ((ch.type === 'add' || ch.type === 'update') && ch.data && typeof ch.data === 'object') {
        map.set(ch.key, ch.data as DemoFeedListItem)
      }
    }
    items.value = [...map.values()]
    return
  }
}

/**
 * Live `DemoFeed.list` over tRPC WebSocket (auto-generated query).
 * Uses `getUntypedClient` + procedure string for `querySubscription` so WS subscriptions
 * are not routed through the lazy Proxy getter chain (reliable delivery of `onData`).
 */
export function useTvwDemoFeedList() {
  const $trpc = useTrpc()
  const { isConnected } = useWebSocketConnection()

  const items = ref<DemoFeedListItem[]>([])
  const status = ref<FeedStatus>('idle')
  const error = ref<string | null>(null)

  let stopSub: (() => void) | null = null

  const subscriptionActive = computed(() => status.value === 'ready')

  const feedByPartition = computed(() => {
    const out: Record<string, DemoFeedListItem> = {}
    for (const it of items.value) {
      const k = partitionKeyFromFeedItem(it)
      if (k) out[k] = it
    }
    return out
  })

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

    status.value = 'loading'
    error.value = null

    const untyped = getUntypedClient($trpc as never) as TRPCUntypedClient<never>
    const sub = untyped.subscription(
      'querySubscription',
      {
        queryName: 'DemoFeed.list',
        input: { limit: DEMO_FEED_LIST_LIMIT, offset: 0 },
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
          applyListUpdate(items, update)
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
    isConnected,
    () => {
      if (isConnected.value) {
        startSub()
      } else {
        clearSub()
        status.value = 'idle'
        items.value = []
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    clearSub()
  })

  return {
    items,
    feedByPartition,
    status,
    error,
    subscriptionActive,
    isConnected,
  }
}

export function useRecordDemoMessage(demoId: MaybeRefOrGetter<string>) {
  const $trpc = useTrpc()
  const { isConnected } = useWebSocketConnection()
  const busy = ref(false)
  const error = ref<string | null>(null)

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
    busy,
    error,
    isConnected,
    recordMessage,
  }
}

export function useAddDemoEntity() {
  const $trpc = useTrpc()
  const { isConnected } = useWebSocketConnection()
  const busy = ref(false)
  const error = ref<string | null>(null)

  async function addDemoEntity(demo: string) {
    const partition = demo.trim()
    if (!partition || !isConnected.value) return { ok: false as const }
    busy.value = true
    error.value = null
    try {
      const result = await $trpc.command.mutate({
        command: 'AddDemoEntity',
        input: { demo: partition },
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
    busy,
    error,
    isConnected,
    addDemoEntity,
  }
}
