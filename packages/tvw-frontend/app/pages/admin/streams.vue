<script setup lang="ts">
interface HaltedStream {
  processorName: string
  streamKey: string
  lastSequence: number
  isHalted: boolean
  haltReason: string | null
  haltStackTrace: string | null
  consecutiveFailures: number
  haltedAt: string | null
  resumedAt: string | null
  updatedAt: string
  haltEventSequence: number | null
}

const haltedStreams = ref<HaltedStream[]>([])
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const selectedStream = ref<HaltedStream | null>(null)
const resumingStreams = ref(new Set<string>())

const uniqueProcessors = computed(() => {
  const processors = new Set(haltedStreams.value.map((s) => s.processorName))
  return Array.from(processors)
})

const criticalFailures = computed(() =>
  haltedStreams.value.filter((s) => s.consecutiveFailures >= 10).length
)

const $trpc = useTrpc()
const { isConnected } = useWebSocketConnection()

const refreshStreams = async () => {
  if (!isConnected.value) return
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await $trpc.admin_getHaltedStreams.query({})
    if (result.success && 'data' in result && result.data) {
      haltedStreams.value = result.data.map((stream) => ({
        processorName: stream.processorName,
        streamKey: stream.streamKey,
        lastSequence: stream.lastSequence,
        isHalted: stream.isHalted,
        haltReason: stream.haltReason,
        haltStackTrace: stream.haltStackTrace,
        consecutiveFailures: stream.consecutiveFailures,
        haltedAt: stream.haltedAt,
        resumedAt: stream.resumedAt,
        updatedAt: stream.updatedAt,
        haltEventSequence: stream.haltEventSequence ?? null,
      }))
      successMessage.value = `Loaded ${result.data.length} halted stream(s)`
      setTimeout(() => {
        successMessage.value = ''
      }, 3000)
    } else if ('error' in result && result.error) {
      errorMessage.value = result.error
    }
  } catch (error) {
    console.error('Error fetching halted streams:', error)
    errorMessage.value =
      error instanceof Error ? error.message : 'Unknown error occurred'
  } finally {
    loading.value = false
  }
}

const resumeStream = async (
  streamKey: string,
  processorName: string,
  fastForward: boolean
) => {
  resumingStreams.value.add(streamKey)
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await $trpc.admin_resumeStream.mutate({
      streamKey,
      processorName,
      fastForward,
    })

    if (result.success) {
      successMessage.value =
        'message' in result && result.message
          ? result.message
          : `Stream "${streamKey}" resumed successfully`
      setTimeout(() => {
        successMessage.value = ''
      }, 3000)
      setTimeout(() => refreshStreams(), 1000)
    } else if ('error' in result && result.error) {
      errorMessage.value = result.error
    }
  } catch (error) {
    console.error('Error resuming stream:', error)
    errorMessage.value =
      error instanceof Error ? error.message : 'Unknown error occurred'
  } finally {
    resumingStreams.value.delete(streamKey)
  }
}

const resumeAll = async () => {
  if (
    !confirm(
      `Resume all ${haltedStreams.value.length} halted streams?`
    )
  ) {
    return
  }

  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await $trpc.admin_resumeAllStreams.mutate({})
    if (result.success) {
      successMessage.value =
        'message' in result && result.message
          ? result.message
          : 'All streams resumed successfully'
      setTimeout(() => {
        successMessage.value = ''
      }, 3000)
      setTimeout(() => refreshStreams(), 1000)
    } else if ('error' in result && result.error) {
      errorMessage.value = result.error
    }
  } catch (error) {
    console.error('Error resuming all streams:', error)
    errorMessage.value =
      error instanceof Error ? error.message : 'Unknown error occurred'
  } finally {
    loading.value = false
  }
}

const showStackTrace = (stream: HaltedStream) => {
  selectedStream.value = stream
}

const formatDate = (date: string | null) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

watch(isConnected, (c) => {
  if (c) void refreshStreams()
})

onMounted(() => {
  if (isConnected.value) void refreshStreams()
  const intervalId = setInterval(() => {
    if (!loading.value && isConnected.value) void refreshStreams()
  }, 30000)
  onUnmounted(() => clearInterval(intervalId))
})
</script>

<template>
  <div class="adm">
    <header class="adm-head card">
      <div class="adm-head-text">
        <h1>Halted streams</h1>
        <p>Monitor and resume halted stream processors</p>
      </div>
      <div class="adm-actions">
        <button type="button" class="btn btn-blue" :disabled="loading" @click="refreshStreams">
          {{ loading ? 'Refreshing…' : 'Refresh' }}
        </button>
        <button
          type="button"
          class="btn btn-green"
          :disabled="loading || haltedStreams.length === 0"
          @click="resumeAll"
        >
          Resume all
        </button>
      </div>
    </header>

    <div class="adm-stats">
      <div class="card stat">
        <span class="stat-label">Total halted</span>
        <span class="stat-value">{{ haltedStreams.length }}</span>
      </div>
      <div class="card stat">
        <span class="stat-label">Processors</span>
        <span class="stat-value">{{ uniqueProcessors.length }}</span>
      </div>
      <div class="card stat">
        <span class="stat-label">Critical (≥10 failures)</span>
        <span class="stat-value">{{ criticalFailures }}</span>
      </div>
    </div>

    <div v-if="successMessage" class="banner banner-ok">{{ successMessage }}</div>
    <div v-if="errorMessage" class="banner banner-err">{{ errorMessage }}</div>

    <section class="card adm-table-wrap">
      <h2 class="adm-table-title">Halted streams</h2>

      <div v-if="!isConnected" class="adm-empty">
        <p>Connect to WebSocket to load streams…</p>
      </div>
      <div v-else-if="loading" class="adm-empty">
        <p>Loading…</p>
      </div>
      <div v-else-if="haltedStreams.length === 0" class="adm-empty">
        <p>No halted streams. All operational.</p>
      </div>
      <div v-else class="table-scroll">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Stream key</th>
              <th>Processor</th>
              <th>Failures</th>
              <th>Halted at</th>
              <th>Reason</th>
              <th>Event</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stream in haltedStreams" :key="`${stream.processorName}-${stream.streamKey}`">
              <td>
                <code class="code">{{ stream.streamKey }}</code>
              </td>
              <td>{{ stream.processorName }}</td>
              <td>
                <span
                  class="badge"
                  :class="stream.consecutiveFailures >= 10 ? 'badge-red' : 'badge-amber'"
                >
                  {{ stream.consecutiveFailures }}
                </span>
              </td>
              <td class="muted">{{ formatDate(stream.haltedAt) }}</td>
              <td class="reason">
                <span class="truncate">{{ stream.haltReason || 'Unknown' }}</span>
                <button
                  v-if="stream.haltStackTrace"
                  type="button"
                  class="linkish"
                  @click="showStackTrace(stream)"
                >
                  Stack trace
                </button>
              </td>
              <td>
                <code v-if="stream.haltEventSequence != null" class="code">{{
                  stream.haltEventSequence
                }}</code>
                <span v-else class="muted">—</span>
              </td>
              <td class="actions">
                <button
                  type="button"
                  class="btn btn-green btn-sm"
                  :disabled="resumingStreams.has(stream.streamKey)"
                  @click="resumeStream(stream.streamKey, stream.processorName, false)"
                >
                  Resume
                </button>
                <button
                  type="button"
                  class="btn btn-blue btn-sm"
                  :disabled="resumingStreams.has(stream.streamKey)"
                  title="Fast-forward to current sequence"
                  @click="resumeStream(stream.streamKey, stream.processorName, true)"
                >
                  Fast-forward
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div
      v-if="selectedStream"
      class="modal-backdrop"
      @click.self="selectedStream = null"
    >
      <div class="modal card">
        <div class="modal-head">
          <h3>Stack trace</h3>
          <button type="button" class="modal-close" aria-label="Close" @click="selectedStream = null">
            ×
          </button>
        </div>
        <div class="modal-body">
          <p class="muted">Stream</p>
          <code class="code block">{{ selectedStream.streamKey }}</code>
          <p class="muted">Processor</p>
          <p>{{ selectedStream.processorName }}</p>
          <p class="muted">Error</p>
          <p class="err-text">{{ selectedStream.haltReason }}</p>
          <p class="muted">Stack</p>
          <pre class="stack">{{ selectedStream.haltStackTrace }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.adm {
  max-width: 72rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.card {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 0.5rem;
}
.adm-head {
  padding: 1rem 1.25rem;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.adm-head h1 {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  font-weight: 600;
}
.adm-head p {
  margin: 0;
  font-size: 0.875rem;
  color: #a1a1aa;
}
.adm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.btn {
  border: none;
  border-radius: 0.375rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  color: #fff;
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn-sm {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
}
.btn-blue {
  background: #2563eb;
}
.btn-blue:not(:disabled):hover {
  background: #1d4ed8;
}
.btn-green {
  background: #059669;
}
.btn-green:not(:disabled):hover {
  background: #047857;
}
.adm-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.75rem;
}
.stat {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.stat-label {
  font-size: 0.75rem;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}
.banner {
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}
.banner-ok {
  background: rgba(6, 78, 59, 0.35);
  border: 1px solid #059669;
  color: #d1fae5;
}
.banner-err {
  background: rgba(127, 29, 29, 0.35);
  border: 1px solid #dc2626;
  color: #fecaca;
}
.adm-table-wrap {
  overflow: hidden;
}
.adm-table-title {
  margin: 0;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  font-weight: 600;
  border-bottom: 1px solid #27272a;
}
.adm-empty {
  padding: 2rem;
  text-align: center;
  color: #a1a1aa;
  font-size: 0.875rem;
}
.table-scroll {
  overflow-x: auto;
}
.adm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}
.adm-table th {
  text-align: left;
  padding: 0.65rem 0.75rem;
  background: #0c0c0e;
  color: #a1a1aa;
  font-weight: 500;
  text-transform: uppercase;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  border-bottom: 1px solid #27272a;
  white-space: nowrap;
}
.adm-table td {
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid #27272a;
  vertical-align: top;
}
.adm-table tbody tr:hover {
  background: rgba(39, 39, 42, 0.4);
}
.code {
  background: #09090b;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  word-break: break-all;
}
.code.block {
  display: block;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
}
.muted {
  color: #a1a1aa;
}
.badge {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: 600;
}
.badge-amber {
  background: rgba(113, 63, 18, 0.5);
  color: #fcd34d;
}
.badge-red {
  background: rgba(127, 29, 29, 0.5);
  color: #fca5a5;
}
.reason {
  max-width: 12rem;
}
.truncate {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.linkish {
  display: block;
  margin-top: 0.25rem;
  background: none;
  border: none;
  padding: 0;
  color: #60a5fa;
  font-size: 0.7rem;
  cursor: pointer;
}
.linkish:hover {
  text-decoration: underline;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}
.modal {
  width: 100%;
  max-width: 48rem;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #27272a;
}
.modal-head h3 {
  margin: 0;
  font-size: 1rem;
}
.modal-close {
  background: none;
  border: none;
  color: #a1a1aa;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}
.modal-body {
  padding: 1rem;
  overflow: auto;
}
.stack {
  margin: 0;
  padding: 0.75rem;
  background: #09090b;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  white-space: pre-wrap;
  word-break: break-word;
  color: #d4d4d8;
}
.err-text {
  color: #f87171;
  margin: 0 0 0.5rem;
}
</style>
