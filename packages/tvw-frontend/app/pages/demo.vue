<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  partitionKeyFromFeedItem,
  useAddDemoEntity,
  useTvwDemoFeedList,
} from '~/composables/useTvwDemoFeed'

/** Matches `AddDemoEntity.demo` in tvw-domain. */
const MAX_KEY_LEN = 64

const { items, feedByPartition, error, subscriptionActive, isConnected } = useTvwDemoFeedList()
const {
  busy: addBusy,
  error: addCommandError,
  addDemoEntity,
} = useAddDemoEntity()

const newKey = ref('')
const addError = ref('')

const channelKeys = computed(() => {
  const keys = new Set<string>()
  for (const it of items.value) {
    const k = partitionKeyFromFeedItem(it)
    if (k) keys.add(k)
  }
  return [...keys].sort((a, b) => a.localeCompare(b))
})

function feedFor(demo: string) {
  return feedByPartition.value[demo] ?? null
}

async function addChannel(): Promise<void> {
  addError.value = ''
  const k = newKey.value.trim()
  if (!k) {
    addError.value = 'Enter a non-empty key.'
    return
  }
  if (k.length > MAX_KEY_LEN) {
    addError.value = `Key at most ${MAX_KEY_LEN} characters.`
    return
  }
  if (channelKeys.value.includes(k)) {
    addError.value = 'That key is already in the list.'
    return
  }
  const { ok } = await addDemoEntity(k)
  if (ok) newKey.value = ''
}
</script>

<template>
  <div class="page">
    <div class="inner">
      <h1 class="title">Demo feed</h1>
      <p class="lead">
        <code>AddDemoEntity</code> creates a partition row; <code>RecordDemoMessage</code> appends messages.
        UI from auto-generated <code>DemoFeed.list</code> via <code>querySubscription</code>.
      </p>
      <ClientOnly>
        <p v-if="error" class="err">{{ error }}</p>
        <p v-else-if="isConnected && !subscriptionActive" class="muted">Loading list subscription…</p>
        <div class="toolbar card">
          <label class="add-label" for="demo-new-key">Add demo entity</label>
          <div class="add-row">
            <input
              id="demo-new-key"
              v-model="newKey"
              class="add-input"
              type="text"
              :maxlength="MAX_KEY_LEN"
              placeholder="e.g. staging"
              autocomplete="off"
              :disabled="addBusy || !isConnected"
              @keyup.enter="addChannel"
            >
            <button type="button" class="add-btn" :disabled="addBusy || !isConnected" @click="addChannel">
              {{ addBusy ? 'Adding…' : 'Add' }}
            </button>
          </div>
          <p v-if="addError || addCommandError" class="err">{{ addError || addCommandError }}</p>
          <p class="add-hint">Creates a server-side demo entity with zero messages; list updates live.</p>
        </div>
        <p v-if="isConnected && subscriptionActive && !channelKeys.length" class="muted empty">
          No projection rows yet — add a demo entity above.
        </p>
        <ul v-if="channelKeys.length" class="grid" role="list">
          <li v-for="c in channelKeys" :key="c" role="listitem" class="grid-item">
            <DemoFeedChannelCard :demo="c" :feed="feedFor(c)" />
          </li>
        </ul>
        <template #fallback>
          <p class="fallback">Loading demo…</p>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped>
.page {
  color: #fafafa;
}
.inner {
  max-width: 56rem;
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
  line-height: 1.5;
}
.lead code,
.empty code {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.88em;
  background: #18181b;
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
  border: 1px solid #27272a;
}
.card {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 0.5rem;
}
.toolbar {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.add-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #a1a1aa;
}
.add-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.add-input {
  flex: 1 1 12rem;
  min-width: 0;
  padding: 0.5rem 0.65rem;
  border-radius: 0.375rem;
  border: 1px solid #3f3f46;
  background: #09090b;
  color: #fafafa;
  font-size: 0.875rem;
}
.add-input:focus {
  outline: none;
  border-color: #52525b;
}
.add-btn {
  border: none;
  border-radius: 0.375rem;
  padding: 0.5rem 0.85rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  background: #3f3f46;
  color: #fafafa;
}
.add-btn:hover:not(:disabled) {
  background: #52525b;
}
.add-btn:disabled,
.add-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.add-hint {
  margin: 0;
  font-size: 0.75rem;
  color: #71717a;
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
}
.grid-item {
  margin: 0;
  min-width: 0;
}
.err {
  margin: 0;
  font-size: 0.8125rem;
  color: #f87171;
}
.empty,
.fallback,
.muted {
  font-size: 0.875rem;
  color: #71717a;
  margin: 0;
  line-height: 1.5;
}
</style>
