<script setup lang="ts"></script>

<template>
  <div class="home">
    <div class="inner">
      <h1 class="title">Home</h1>
      <p class="lead">Signed in. Use the nav for streams, projections, and the multi-channel demo.</p>
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
</style>
