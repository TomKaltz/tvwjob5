<script setup lang="ts">
definePageMeta({ layout: false })

const username = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)

const { setToken } = useAuthToken()

async function onSubmit() {
  error.value = ''
  pending.value = true
  try {
    const res = await $fetch<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: {
        username: username.value,
        password: password.value,
      },
    })
    setToken(res.token)
    await navigateTo('/')
  } catch (e: unknown) {
    error.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message)
        : 'Login failed'
    if (!error.value || error.value === 'undefined') {
      error.value = 'Login failed'
    }
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <form class="card" @submit.prevent="onSubmit">
      <h1>tvw — Sign in</h1>
      <label>
        <span>Username</span>
        <input
          v-model="username"
          type="text"
          autocomplete="username"
          required
        />
      </label>
      <label>
        <span>Password</span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </label>
      <p v-if="error" class="err">{{ error }}</p>
      <button type="submit" :disabled="pending">
        {{ pending ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #09090b;
  color: #fafafa;
  padding: 1rem;
}
.card {
  width: 100%;
  max-width: 22rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: 1px solid #27272a;
  border-radius: 0.5rem;
  padding: 1.5rem;
  background: rgba(24, 24, 27, 0.6);
}
h1 {
  font-size: var(--text-page-title);
  font-weight: 700;
  letter-spacing: var(--tracking-tight);
  line-height: 1.25;
  margin: 0;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
label span {
  font-size: var(--text-body);
  font-weight: 600;
  color: #b4b4bd;
}
input {
  border: 1px solid #3f3f46;
  border-radius: 0.25rem;
  background: #09090b;
  color: inherit;
  padding: 0.5rem 0.75rem;
  font-size: var(--text-body);
  font-weight: 500;
  letter-spacing: var(--tracking-ui);
}
.err {
  font-size: var(--text-body);
  color: #f87171;
  margin: 0;
}
button {
  width: 100%;
  border: none;
  border-radius: 0.25rem;
  padding: 0.5rem;
  font-size: var(--text-body);
  font-weight: 600;
  letter-spacing: var(--tracking-ui);
  background: #059669;
  color: #fff;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
button:not(:disabled):hover {
  background: #10b981;
}
</style>
