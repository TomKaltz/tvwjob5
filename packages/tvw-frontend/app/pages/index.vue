<script setup lang="ts"></script>

<template>
  <div class="home">
    <div class="inner">
      <h1 class="title">Home</h1>
      <p class="lead">Signed in. Use the nav for streams and projections.</p>

      <ClientOnly>
        <HomeDemoFeed />
        <template #fallback>
          <section class="card demo-fallback">
            <p class="demo-muted">Loading demo…</p>
          </section>
        </template>
      </ClientOnly>
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
}
.card {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 0.5rem;
}
.demo-fallback {
  padding: 1rem 1.25rem;
}
.demo-muted {
  font-size: 0.875rem;
  color: #71717a;
  margin: 0;
}
</style>
