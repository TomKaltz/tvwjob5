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
  font-weight: 600;
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
  color: #a1a1aa;
  text-decoration: none;
  font-size: 0.875rem;
}
.links a:hover,
.links a.router-link-active {
  color: #e4e4e7;
}
.logout {
  margin-left: auto;
  background: none;
  border: none;
  color: #a1a1aa;
  font-size: 0.875rem;
  cursor: pointer;
}
.logout:hover {
  color: #e4e4e7;
}
.main {
  flex: 1;
  padding: 1.25rem;
}
</style>
