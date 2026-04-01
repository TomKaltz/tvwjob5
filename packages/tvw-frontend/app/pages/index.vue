<script setup lang="ts">
const { token } = useAuthToken()
const { isConnected, showSpinner, state: wsState } = useWebSocketConnection()

const health = ref<unknown>(null)
const healthError = ref('')

watch(
  [token, isConnected],
  async () => {
    health.value = null
    healthError.value = ''
    if (!token.value || !isConnected.value) return
    try {
      const $trpc = useTrpc()
      health.value = await $trpc.health.query({})
    } catch (e) {
      healthError.value = e instanceof Error ? e.message : String(e)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="home">
    <div class="inner">
      <h1 class="title">Health</h1>

      <p class="meta">
        WebSocket: <strong>{{ wsState }}</strong>
        <span v-if="showSpinner"> (connecting…)</span>
      </p>

      <p v-if="healthError" class="err">{{ healthError }}</p>
      <pre v-else-if="health" class="json">{{ JSON.stringify(health, null, 2) }}</pre>
      <p v-else class="muted">Waiting for WebSocket…</p>
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
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}
.meta {
  font-size: 0.875rem;
  color: #a1a1aa;
  margin: 0;
}
.meta strong {
  color: #fafafa;
}
.err {
  font-size: 0.875rem;
  color: #f87171;
  margin: 0;
}
.json {
  font-size: 0.75rem;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 0.25rem;
  padding: 1rem;
  overflow: auto;
  margin: 0;
}
.muted {
  font-size: 0.875rem;
  color: #71717a;
  margin: 0;
}
</style>
