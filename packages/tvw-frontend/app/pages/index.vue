<script setup lang="ts">
const $trpc = useTrpc()
const { isConnected } = useWebSocketConnection()

const message = ref('')
const busy = ref(false)
const err = ref('')
const feed = ref<{
  messageCount: number
  lastMessage: string | null
  lastRecordedAt: string | null
} | null>(null)

async function refreshFeed() {
  err.value = ''
  if (!isConnected.value) return
  try {
    const result = await $trpc.query.query({
      query: 'DemoFeed.get',
      input: { demo: 'global' },
    })
    if (
      result.success &&
      'data' in result &&
      result.data != null &&
      typeof result.data === 'object'
    ) {
      const row = result.data as Record<string, unknown>
      if (typeof row.messageCount === 'number') {
        feed.value = {
          messageCount: row.messageCount,
          lastMessage:
            typeof row.lastMessage === 'string' ? row.lastMessage : null,
          lastRecordedAt:
            typeof row.lastRecordedAt === 'string'
              ? row.lastRecordedAt
              : null,
        }
        return
      }
    }
    const msg =
      'error' in result && typeof result.error === 'string' ? result.error : ''
    if (msg.includes('No DemoFeed found') || msg.includes('not found')) {
      feed.value = {
        messageCount: 0,
        lastMessage: null,
        lastRecordedAt: null,
      }
      return
    }
    if (msg) err.value = msg
    else err.value = 'Could not read demo projection (unexpected shape).'
  } catch (e) {
    err.value = e instanceof Error ? e.message : 'Query failed'
  }
}

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
    await refreshFeed()
  } catch (e) {
    err.value = e instanceof Error ? e.message : 'Mutation failed'
  } finally {
    busy.value = false
  }
}

watch(isConnected, (c) => {
  if (c) void refreshFeed()
})

onMounted(() => {
  if (isConnected.value) void refreshFeed()
})
</script>

<template>
  <div class="home">
    <div class="inner">
      <h1 class="title">Home</h1>
      <p class="lead">Signed in. Use the nav for streams and projections.</p>

      <section class="demo card">
        <h2 class="demo-title">Demo projection</h2>
        <p class="demo-desc">
          <code>command RecordDemoMessage</code> → <code>DemoMessageRecorded</code> → persistent
          <code>DemoFeed</code> (partition <code>demo:global</code>). Read via <code>query DemoFeed.get</code>.
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
            <button type="button" class="btn-demo secondary" :disabled="busy" @click="refreshFeed">
              Refresh read model
            </button>
          </div>
          <div v-if="err" class="demo-err">{{ err }}</div>
          <div v-else-if="feed" class="demo-feed">
            <div><span class="k">Count:</span> {{ feed.messageCount }}</div>
            <div><span class="k">Last:</span> {{ feed.lastMessage ?? '—' }}</div>
            <div><span class="k">At:</span> {{ feed.lastRecordedAt ?? '—' }}</div>
          </div>
          <div v-else class="demo-muted">No feed loaded yet — record a message or refresh.</div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home {
  color: #fafafa;
}
.inner {
  max-width: 42rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.title {
  font-size: var(--text-page-title);
  font-weight: 700;
  letter-spacing: var(--tracking-tight);
  line-height: 1.25;
  margin: 0;
}
.lead {
  font-size: var(--text-body);
  font-weight: 500;
  color: #b4b4bd;
  margin: 0;
}
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
.btn-demo.secondary {
  background: #3f3f46;
}
.btn-demo.secondary:hover:not(:disabled) {
  background: #52525b;
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
