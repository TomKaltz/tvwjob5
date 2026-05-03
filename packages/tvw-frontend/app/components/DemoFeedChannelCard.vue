<script setup lang="ts">
import { ref, computed, toRef } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Partition id (`tags.demo`); one persistent feed per id. */
    demo: string
    /** Show remove control (parent drops key from list). */
    removable?: boolean
  }>(),
  { removable: false }
)

const emit = defineEmits<{ remove: [] }>()

const message = ref('')
const demoRef = toRef(props, 'demo')
const {
  feed,
  error,
  busy,
  subscriptionActive,
  isConnected,
  recordMessage,
} = useTvwDemoFeed(demoRef)

const errorMessage = computed(() => error.value ?? '')

async function record() {
  const text = message.value.trim()
  const { ok } = await recordMessage(text)
  if (ok) message.value = ''
}
</script>

<template>
  <article class="card channel">
    <header class="channel-head">
      <h3 class="channel-title">
        <code>{{ demo }}</code>
      </h3>
      <span v-if="isConnected && subscriptionActive" class="pill live">Live</span>
      <span v-else-if="!isConnected" class="pill off">WS off</span>
      <span v-else class="pill wait">Sub…</span>
      <button
        v-if="removable"
        type="button"
        class="btn-remove"
        title="Remove channel"
        aria-label="Remove channel"
        @click="emit('remove')"
      >
        ×
      </button>
    </header>
    <div v-if="isConnected" class="channel-body">
      <div class="row">
        <input
          v-model="message"
          class="inp"
          type="text"
          maxlength="500"
          placeholder="Message"
          :disabled="busy"
          @keyup.enter="record"
        >
        <button type="button" class="btn" :disabled="busy || !message.trim()" @click="record">
          {{ busy ? '…' : 'Record' }}
        </button>
      </div>
      <div v-if="errorMessage" class="err">{{ errorMessage }}</div>
      <dl v-else-if="feed" class="stats">
        <div><dt>Count</dt><dd>{{ feed.messageCount }}</dd></div>
        <div><dt>Last</dt><dd>{{ feed.lastMessage ?? '—' }}</dd></div>
        <div><dt>At</dt><dd>{{ feed.lastRecordedAt ?? '—' }}</dd></div>
      </dl>
      <p v-else class="muted">Waiting for projection…</p>
    </div>
    <p v-else class="muted">Connect WebSocket to use this channel.</p>
  </article>
</template>

<style scoped>
.card {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 0.5rem;
}
.channel {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
}
.channel-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.btn-remove {
  margin-left: auto;
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: #71717a;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}
.btn-remove:hover {
  color: #f87171;
  background: #27272a;
}
.channel-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
}
.channel-title code {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.85em;
  background: #09090b;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
}
.pill {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
}
.pill.live {
  background: #14532d;
  color: #86efac;
}
.pill.off {
  background: #3f3f46;
  color: #a1a1aa;
}
.pill.wait {
  background: #422006;
  color: #fdba74;
}
.channel-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.row {
  display: flex;
  gap: 0.45rem;
  align-items: center;
}
.inp {
  flex: 1;
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border-radius: 0.375rem;
  border: 1px solid #3f3f46;
  background: #09090b;
  color: #fafafa;
  font-size: 0.8125rem;
}
.inp:focus {
  outline: none;
  border-color: #52525b;
}
.btn {
  flex-shrink: 0;
  border: none;
  border-radius: 0.375rem;
  padding: 0.45rem 0.65rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  background: #2563eb;
  color: #fff;
}
.btn:hover:not(:disabled) {
  background: #1d4ed8;
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.muted {
  margin: 0;
  font-size: 0.8125rem;
  color: #71717a;
}
.err {
  font-size: 0.8125rem;
  color: #f87171;
  margin: 0;
}
.stats {
  margin: 0;
  display: grid;
  gap: 0.35rem 1rem;
  grid-template-columns: auto 1fr;
  font-size: 0.8125rem;
}
.stats > div {
  display: contents;
}
.stats dt {
  margin: 0;
  color: #a1a1aa;
  font-weight: 500;
}
.stats dd {
  margin: 0;
  color: #e4e4e7;
  word-break: break-word;
}
</style>
