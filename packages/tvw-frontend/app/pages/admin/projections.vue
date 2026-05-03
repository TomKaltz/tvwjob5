<script setup lang="ts">
interface ProjectionStatus {
  name: string
  cacheStrategy: 'persistent' | 'memory' | 'none'
  tableName?: string
  eventTypes: string[]
  tags?: string[]
  entryCount?: number
  lastSequence?: number
  version?: string
  staleEntryCount?: number
  isStale?: boolean
  rebuildStatus?: 'idle' | 'rebuilding' | 'completed' | 'failed'
  rebuildMessage?: string
}

const projections = ref<ProjectionStatus[]>([])
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const rebuildingProjections = ref(new Set<string>())
const rebuildStatuses = ref(
  new Map<
    string,
    { status: 'rebuilding' | 'completed' | 'failed'; message: string; timestamp: Date }
  >()
)

const persistentCount = computed(
  () => projections.value.filter((p) => p.cacheStrategy === 'persistent').length
)
const memoryCount = computed(
  () => projections.value.filter((p) => p.cacheStrategy === 'memory').length
)
const totalEntries = computed(() =>
  projections.value.reduce((sum, p) => sum + (p.entryCount || 0), 0)
)

const $trpc = useTrpc()
const { isConnected } = useWebSocketConnection()

function formatRebuildTime(projectionName: string): string {
  const d = rebuildStatuses.value.get(projectionName)?.timestamp
  return d ? d.toLocaleString() : ''
}

const refreshProjections = async () => {
  if (!isConnected.value) return
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await $trpc.admin_getProjections.query({})
    if (result.success && 'data' in result && result.data) {
      projections.value = result.data
      successMessage.value = `Loaded ${result.data.length} projection(s)`
      setTimeout(() => {
        successMessage.value = ''
      }, 3000)
    } else if ('error' in result && result.error) {
      errorMessage.value = result.error
    }
  } catch (error) {
    console.error('Error fetching projections:', error)
    errorMessage.value =
      error instanceof Error ? error.message : 'Unknown error occurred'
  } finally {
    loading.value = false
  }
}

const rebuildProjection = async (projectionName: string) => {
  rebuildingProjections.value.add(projectionName)
  errorMessage.value = ''
  successMessage.value = ''

  rebuildStatuses.value.set(projectionName, {
    status: 'rebuilding',
    message: 'Rebuild initiated…',
    timestamp: new Date(),
  })

  try {
    const result = await $trpc.admin_rebuildProjection.mutate({ projectionName })

    if (result.success) {
      rebuildStatuses.value.set(projectionName, {
        status: 'completed',
        message: result.message || 'Rebuild completed',
        timestamp: new Date(),
      })
      successMessage.value =
        'message' in result && result.message
          ? result.message
          : `Projection "${projectionName}" rebuild completed`
      setTimeout(() => {
        successMessage.value = ''
      }, 5000)
      setTimeout(() => refreshProjections(), 2000)
      setTimeout(() => rebuildStatuses.value.delete(projectionName), 10000)
    } else {
      const errorMsg =
        'error' in result && result.error ? result.error : 'Failed to rebuild'
      const friendlyMsg =
        typeof errorMsg === 'string' && errorMsg.includes('worker')
          ? errorMsg.includes('already in progress')
            ? 'Rebuild already in progress.'
            : 'Rebuild may require a running processor worker.'
          : errorMsg
      rebuildStatuses.value.set(projectionName, {
        status: 'failed',
        message: friendlyMsg,
        timestamp: new Date(),
      })
      errorMessage.value = friendlyMsg
      setTimeout(() => rebuildStatuses.value.delete(projectionName), 15000)
    }
  } catch (error) {
    console.error('Error rebuilding projection:', error)
    const errorMsg =
      error instanceof Error ? error.message : 'Unknown error occurred'
    const friendlyMsg =
      typeof errorMsg === 'string' && errorMsg.includes('worker')
        ? errorMsg.includes('already in progress')
          ? 'Rebuild already in progress.'
          : 'Rebuild may require a running processor worker.'
        : errorMsg
    rebuildStatuses.value.set(projectionName, {
      status: 'failed',
      message: friendlyMsg,
      timestamp: new Date(),
    })
    errorMessage.value = friendlyMsg
    setTimeout(() => rebuildStatuses.value.delete(projectionName), 15000)
  } finally {
    rebuildingProjections.value.delete(projectionName)
  }
}

const rebuildAll = async () => {
  if (
    !confirm(
      `Rebuild all ${projections.value.length} projections? This invalidates cached projection state.`
    )
  ) {
    return
  }

  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  projections.value.forEach((projection) => {
    if (projection.cacheStrategy === 'persistent') {
      rebuildStatuses.value.set(projection.name, {
        status: 'rebuilding',
        message: 'Rebuild initiated…',
        timestamp: new Date(),
      })
    }
  })

  try {
    const result = await $trpc.admin_rebuildAllProjections.mutate({})

    if (result.success) {
      projections.value.forEach((projection) => {
        if (projection.cacheStrategy === 'persistent') {
          rebuildStatuses.value.set(projection.name, {
            status: 'completed',
            message: 'Rebuild completed',
            timestamp: new Date(),
          })
        }
      })
      successMessage.value =
        'message' in result && result.message
          ? result.message
          : 'All projections rebuild completed'
      setTimeout(() => {
        successMessage.value = ''
      }, 5000)
      setTimeout(() => refreshProjections(), 2000)
      setTimeout(() => {
        projections.value.forEach((p) => {
          if (p.cacheStrategy === 'persistent') {
            rebuildStatuses.value.delete(p.name)
          }
        })
      }, 10000)
    } else {
      const errorMsg =
        'error' in result && result.error
          ? result.error
          : 'Failed to rebuild all projections'
      projections.value.forEach((projection) => {
        if (projection.cacheStrategy === 'persistent') {
          rebuildStatuses.value.set(projection.name, {
            status: 'failed',
            message: errorMsg,
            timestamp: new Date(),
          })
        }
      })
      errorMessage.value = errorMsg
      setTimeout(() => {
        projections.value.forEach((p) => {
          if (p.cacheStrategy === 'persistent') {
            rebuildStatuses.value.delete(p.name)
          }
        })
      }, 15000)
    }
  } catch (error) {
    console.error('Error rebuilding all projections:', error)
    const errorMsg =
      error instanceof Error ? error.message : 'Unknown error occurred'
    projections.value.forEach((projection) => {
      if (projection.cacheStrategy === 'persistent') {
        rebuildStatuses.value.set(projection.name, {
          status: 'failed',
          message: errorMsg,
          timestamp: new Date(),
        })
      }
    })
    errorMessage.value = errorMsg
    setTimeout(() => {
      projections.value.forEach((p) => {
        if (p.cacheStrategy === 'persistent') {
          rebuildStatuses.value.delete(p.name)
        }
      })
    }, 15000)
  } finally {
    loading.value = false
  }
}

watch(isConnected, (c) => {
  if (c) void refreshProjections()
})

onMounted(() => {
  if (isConnected.value) void refreshProjections()
  const intervalId = setInterval(() => {
    if (!loading.value && isConnected.value) void refreshProjections()
  }, 30000)
  onUnmounted(() => clearInterval(intervalId))
})
</script>

<template>
  <div class="adm">
    <header class="adm-head card">
      <div class="adm-head-text">
        <h1>Projections</h1>
        <p>Read models — status and rebuilds</p>
      </div>
      <div class="adm-actions">
        <button type="button" class="btn btn-blue" :disabled="loading" @click="refreshProjections">
          {{ loading ? 'Refreshing…' : 'Refresh' }}
        </button>
        <button
          type="button"
          class="btn btn-orange"
          :disabled="loading || projections.length === 0"
          @click="rebuildAll"
        >
          Rebuild all
        </button>
      </div>
    </header>

    <div class="adm-stats">
      <div class="card stat">
        <span class="stat-label">Total</span>
        <span class="stat-value">{{ projections.length }}</span>
      </div>
      <div class="card stat">
        <span class="stat-label">Persistent</span>
        <span class="stat-value">{{ persistentCount }}</span>
      </div>
      <div class="card stat">
        <span class="stat-label">Memory</span>
        <span class="stat-value">{{ memoryCount }}</span>
      </div>
      <div class="card stat">
        <span class="stat-label">Entries</span>
        <span class="stat-value">{{ totalEntries.toLocaleString() }}</span>
      </div>
    </div>

    <div v-if="successMessage" class="banner banner-ok">{{ successMessage }}</div>
    <div v-if="errorMessage" class="banner banner-err">{{ errorMessage }}</div>

    <section class="card adm-table-wrap">
      <h2 class="adm-table-title">Projections</h2>

      <div v-if="!isConnected" class="adm-empty">
        <p>Connect to WebSocket to load projections…</p>
      </div>
      <div v-else-if="loading" class="adm-empty">
        <p>Loading…</p>
      </div>
      <div v-else-if="projections.length === 0" class="adm-empty">
        <p>No projections registered.</p>
      </div>
      <div v-else class="table-scroll">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Cache</th>
              <th>Table</th>
              <th>Event types</th>
              <th>Entries</th>
              <th>Last seq</th>
              <th>Rebuild</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="projection in projections" :key="projection.name">
              <td>
                <code class="code">{{ projection.name }}</code>
              </td>
              <td>
                <span
                  class="badge"
                  :class="{
                    'badge-green': projection.cacheStrategy === 'persistent',
                    'badge-amber': projection.cacheStrategy === 'memory',
                    'badge-gray': projection.cacheStrategy === 'none',
                  }"
                >
                  {{ projection.cacheStrategy }}
                </span>
              </td>
              <td>
                <code v-if="projection.tableName" class="code">{{ projection.tableName }}</code>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <span
                  v-for="et in projection.eventTypes"
                  :key="et"
                  class="tag"
                >{{ et }}</span>
                <span v-if="projection.eventTypes.length === 0" class="muted">None</span>
              </td>
              <td>
                <template v-if="projection.entryCount !== undefined">
                  {{ projection.entryCount.toLocaleString() }}
                </template>
                <span v-else class="muted">—</span>
                <div
                  v-if="projection.isStale && (projection.staleEntryCount ?? 0) > 0"
                  class="stale"
                >
                  {{ projection.staleEntryCount }} stale
                </div>
              </td>
              <td>
                <template v-if="projection.lastSequence !== undefined">
                  {{ projection.lastSequence.toLocaleString() }}
                </template>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <template v-if="rebuildStatuses.has(projection.name)">
                  <span
                    class="badge"
                    :class="{
                      'badge-amber': rebuildStatuses.get(projection.name)?.status === 'rebuilding',
                      'badge-green': rebuildStatuses.get(projection.name)?.status === 'completed',
                      'badge-red': rebuildStatuses.get(projection.name)?.status === 'failed',
                    }"
                  >
                    {{
                      rebuildStatuses.get(projection.name)?.status === 'rebuilding'
                        ? 'Rebuilding'
                        : rebuildStatuses.get(projection.name)?.status === 'completed'
                          ? 'Done'
                          : 'Failed'
                    }}
                  </span>
                  <div v-if="rebuildStatuses.get(projection.name)?.message" class="rebuild-msg">
                    {{ rebuildStatuses.get(projection.name)?.message }}
                  </div>
                  <div v-if="formatRebuildTime(projection.name)" class="rebuild-time muted">
                    {{ formatRebuildTime(projection.name) }}
                  </div>
                </template>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <button
                  v-if="projection.cacheStrategy === 'persistent'"
                  type="button"
                  class="btn btn-orange btn-sm"
                  :disabled="rebuildingProjections.has(projection.name)"
                  @click="rebuildProjection(projection.name)"
                >
                  {{
                    rebuildingProjections.has(projection.name) ? 'Rebuilding…' : 'Rebuild'
                  }}
                </button>
                <span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.adm {
  max-width: 80rem;
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
  font-size: var(--text-page-title);
  font-weight: 700;
  letter-spacing: var(--tracking-tight);
  line-height: 1.25;
}
.adm-head p {
  margin: 0;
  font-size: var(--text-body);
  font-weight: 500;
  color: #b4b4bd;
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
  font-size: var(--text-body);
  font-weight: 600;
  letter-spacing: var(--tracking-ui);
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
.btn-orange {
  background: #ea580c;
}
.btn-orange:not(:disabled):hover {
  background: #c2410c;
}
.adm-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.75rem;
}
.stat {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.stat-label {
  font-size: var(--text-label);
  font-weight: 600;
  color: #b4b4bd;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.stat-value {
  font-size: 1.625rem;
  font-weight: 750;
  letter-spacing: var(--tracking-tight);
  font-variant-numeric: tabular-nums;
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
  color: #b4b4bd;
  font-size: var(--text-body);
  font-weight: 500;
}
.table-scroll {
  overflow-x: auto;
}
.adm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-table);
  font-variant-numeric: tabular-nums;
}
.adm-table th {
  text-align: left;
  padding: 0.65rem 0.75rem;
  background: #0c0c0e;
  color: #a8a8b3;
  font-weight: 600;
  text-transform: uppercase;
  font-size: var(--text-label);
  line-height: 1.4;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #27272a;
  white-space: nowrap;
}
.adm-table td {
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid #27272a;
  vertical-align: top;
  line-height: 1.4;
}
.adm-table tbody tr:hover {
  background: rgba(39, 39, 42, 0.4);
}
.code {
  font-family: var(--font-mono);
  font-weight: 500;
  background: #09090b;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  font-size: var(--text-label);
  word-break: break-all;
}
.muted {
  color: #b4b4bd;
}
.badge {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: 600;
}
.badge-green {
  background: rgba(6, 78, 59, 0.45);
  color: #86efac;
}
.badge-amber {
  background: rgba(113, 63, 18, 0.45);
  color: #fcd34d;
}
.badge-gray {
  background: rgba(63, 63, 70, 0.6);
  color: #d4d4d8;
}
.badge-red {
  background: rgba(127, 29, 29, 0.45);
  color: #fca5a5;
}
.tag {
  display: inline-block;
  margin: 0.1rem 0.25rem 0.1rem 0;
  padding: 0.1rem 0.35rem;
  background: #09090b;
  border-radius: 0.2rem;
  font-size: 0.65rem;
  color: #d4d4d8;
}
.stale {
  font-size: 0.65rem;
  color: #fbbf24;
  margin-top: 0.2rem;
}
.rebuild-msg {
  font-size: 0.65rem;
  color: #b4b4bd;
  margin-top: 0.25rem;
  max-width: 10rem;
}
.rebuild-time {
  font-size: 0.65rem;
  margin-top: 0.15rem;
}
</style>
