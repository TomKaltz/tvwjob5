<script setup lang="ts">
import { ref } from 'vue'

/** Matches `RecordDemoMessage.demo` in tvw-domain. */
const MAX_KEY_LEN = 64
const DEFAULT_KEYS = ['alpha', 'beta', 'gamma'] as const

const channels = ref<string[]>([...DEFAULT_KEYS])
const newKey = ref('')
const addError = ref('')

function normalizeKey(raw: string): string {
  return raw.trim()
}

function addChannel(): void {
  addError.value = ''
  const k = normalizeKey(newKey.value)
  if (!k) {
    addError.value = 'Enter a non-empty key.'
    return
  }
  if (k.length > MAX_KEY_LEN) {
    addError.value = `Key at most ${MAX_KEY_LEN} characters.`
    return
  }
  if (channels.value.includes(k)) {
    addError.value = 'That key is already in the list.'
    return
  }
  channels.value = [...channels.value, k]
  newKey.value = ''
}

function removeChannel(demo: string): void {
  channels.value = channels.value.filter((c) => c !== demo)
}
</script>

<template>
  <div class="page">
    <div class="inner">
      <h1 class="title">Demo feed</h1>
      <p class="lead">
        <code>RecordDemoMessage</code> with <code>demo</code> tag → <code>DemoMessageRecorded</code> →
        <code>DemoFeed</code> partition per channel. One live <code>querySubscription</code> per key;
        recording on one card updates only that partition.
      </p>
      <ClientOnly>
        <div class="toolbar card">
          <label class="add-label" for="demo-new-key">Add partition key</label>
          <div class="add-row">
            <input
              id="demo-new-key"
              v-model="newKey"
              class="add-input"
              type="text"
              :maxlength="MAX_KEY_LEN"
              placeholder="e.g. staging"
              autocomplete="off"
              @keyup.enter="addChannel"
            >
            <button type="button" class="add-btn" @click="addChannel">Add</button>
          </div>
          <p v-if="addError" class="add-err">{{ addError }}</p>
          <p class="add-hint">Max {{ MAX_KEY_LEN }} chars per key. List in memory only — reload resets to defaults.</p>
        </div>
        <ul v-if="channels.length" class="grid" role="list">
          <li v-for="c in channels" :key="c" role="listitem" class="grid-item">
            <DemoFeedChannelCard removable :demo="c" @remove="removeChannel(c)" />
          </li>
        </ul>
        <p v-else class="empty">No keys — add one above.</p>
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
.lead code {
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
.add-btn:hover {
  background: #52525b;
}
.add-err {
  margin: 0;
  font-size: 0.8125rem;
  color: #f87171;
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
.empty,
.fallback {
  font-size: 0.875rem;
  color: #71717a;
  margin: 0;
}
</style>
