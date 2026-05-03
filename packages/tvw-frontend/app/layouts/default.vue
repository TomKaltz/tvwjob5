<script setup lang="ts">
const { clearToken } = useAuthToken()

async function logout() {
  clearToken()
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login')
}
</script>

<template>
  <div class="shell">
    <nav class="nav">
      <NuxtLink to="/" class="brand">tvw</NuxtLink>
      <div class="links">
        <NuxtLink to="/">Home</NuxtLink>
        <NuxtLink to="/demo">Demo feed</NuxtLink>
        <NuxtLink to="/admin/streams">Halted streams</NuxtLink>
        <NuxtLink to="/admin/projections">Projections</NuxtLink>
      </div>
      <button type="button" class="logout" @click="logout">Sign out</button>
    </nav>
    <main class="main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
  background: #09090b;
  color: #fafafa;
  display: flex;
  flex-direction: column;
}
.nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid #27272a;
  background: #0c0c0e;
}
.brand {
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: var(--tracking-tight);
  color: #fafafa;
  text-decoration: none;
  margin-right: 0.5rem;
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  flex: 1;
}
.links a {
  color: #b4b4bd;
  text-decoration: none;
  font-size: var(--text-body);
  font-weight: 600;
  letter-spacing: var(--tracking-ui);
}
.links a:hover,
.links a.router-link-active {
  color: #f4f4f5;
}
.logout {
  margin-left: auto;
  background: none;
  border: none;
  color: #b4b4bd;
  font-size: var(--text-body);
  font-weight: 600;
  letter-spacing: var(--tracking-ui);
  cursor: pointer;
}
.logout:hover {
  color: #f4f4f5;
}
.main {
  flex: 1;
  padding: 1.25rem;
}
</style>
