<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { createLiveQueryHelpers, type QuerySubscriptionClient } from '@tk-dcb/framework/live-query'
import type { TvwQueryCatalog } from 'tvw-domain'

const $trpc = useTrpc()
const { isConnected } = useWebSocketConnection()

const { useLiveQuery } = createLiveQueryHelpers<TvwQueryCatalog>(() => ({
  querySubscription: {
    subscribe(input, handlers) {
      return $trpc.querySubscription.subscribe(input, handlers)
    },
  },
}) satisfies QuerySubscriptionClient)

/** Avoid subscribing before client mount + tRPC WS plugin finished wiring (fixes stuck "Waiting…"). */
const clientMounted = ref(false)
onMounted(() => {
  void nextTick(() => {
    clientMounted.value = true
  })
})
const subscriptionEnabled = computed(() => isConnected.value && clientMounted.value)

const message = ref('')
const busy = ref(false)
const err = ref('')
const demoFeed = useLiveQuery('GetDemoFeed', { demo: 'global' }, { enabled: subscriptionEnabled })
const feed = demoFeed.data
const subscriptionActive = computed(() => demoFeed.status.value === 'ready')
const errorMessage = computed(() => err.value || demoFeed.error.value?.message || '')

async function record() {
  err.value = ''
  const text = message.value.trim()
  if (!text || !isConnected.value) return
  busy.value = true
  try {
    const result = await $trpc.command.mutate({
      command: 'RecordDemoMessage',
      input: { message: text },
    })
    if (!result.success) {
      err.value =
        'error' in result && typeof result.error === 'string'
          ? result.error
          : 'Command failed'
      return
    }
    message.value = ''
  } catch (e) {
    err.value = e instanceof Error ? e.message : 'Mutation failed'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="demo card">
    <h2 class="demo-title">Demo projection</h2>
    <p class="demo-desc">
      <code>command RecordDemoMessage</code> → <code>DemoMessageRecorded</code> → persistent
      <code>DemoFeed</code> (partition <code>demo:global</code>). Read via live
      <code>querySubscription</code>.
    </p>
    <div v-if="!isConnected" class="demo-muted">WebSocket disconnected — connect to try demo.</div>
    <template v-else>
      <div class="demo-row">
        <input
          v-model="message"
          class="demo-input"
          type="text"
          maxlength="500"
          placeholder="Message"
          :disabled="busy"
          @keyup.enter="record"
        >
        <button type="button" class="btn-demo" :disabled="busy || !message.trim()" @click="record">
          {{ busy ? 'Recording…' : 'Record' }}
        </button>
      </div>
      <div class="demo-muted">
        {{ subscriptionActive ? 'Live subscription active.' : 'Starting live subscription…' }}
      </div>
      <div v-if="errorMessage" class="demo-err">{{ errorMessage }}</div>
      <div v-else-if="feed" class="demo-feed">
        <div><span class="k">Count:</span> {{ feed.messageCount }}</div>
        <div><span class="k">Last:</span> {{ feed.lastMessage ?? '—' }}</div>
        <div><span class="k">At:</span> {{ feed.lastRecordedAt ?? '—' }}</div>
      </div>
      <div v-else class="demo-muted">Waiting for initial projection state…</div>
    </template>
  </section>
</template>

<style scoped>
.card {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 0.5rem;
}
.demo {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.demo-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}
.demo-desc {
  margin: 0;
  font-size: 0.875rem;
  color: #a8a8b3;
  line-height: 1.45;
}
.demo-desc code {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.8em;
  background: #09090b;
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
}
.demo-muted {
  font-size: 0.875rem;
  color: #71717a;
}
.demo-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.demo-input {
  flex: 1 1 12rem;
  min-width: 0;
  padding: 0.5rem 0.65rem;
  border-radius: 0.375rem;
  border: 1px solid #3f3f46;
  background: #09090b;
  color: #fafafa;
  font-size: 0.875rem;
}
.demo-input:focus {
  outline: none;
  border-color: #52525b;
}
.btn-demo {
  border: none;
  border-radius: 0.375rem;
  padding: 0.5rem 0.85rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  background: #2563eb;
  color: #fff;
}
.btn-demo:hover:not(:disabled) {
  background: #1d4ed8;
}
.btn-demo:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.demo-err {
  font-size: 0.875rem;
  color: #f87171;
}
.demo-feed {
  font-size: 0.875rem;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.demo-feed .k {
  color: #a1a1aa;
  margin-right: 0.35rem;
}
</style>
