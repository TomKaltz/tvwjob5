<script setup lang="ts">
const { token, clearToken } = useAuthToken()
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

async function logout() {
  clearToken()
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login')
}

onMounted(() => {
  if (!token.value) {
    navigateTo('/login')
  }
})
</script>

<template>
  <div class="home">
    <div class="inner">
      <header>
        <h1>tvw</h1>
        <button type="button" class="link" @click="logout">Sign out</button>
      </header>

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
  min-height: 100dvh;
  background: #09090b;
  color: #fafafa;
  padding: 1.5rem;
}
.inner {
  max-width: 36rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
h1 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}
.link {
  background: none;
  border: none;
  color: #a1a1aa;
  font-size: 0.875rem;
  cursor: pointer;
}
.link:hover {
  color: #e4e4e7;
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
