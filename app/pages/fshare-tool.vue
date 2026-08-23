<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'en' },
  title: 'Fshare Bulk Copy',
  link: [{ rel: 'stylesheet', href: '/fshare-tool/style.css' }]
});
</script>

<template>
  <ClientOnly>
    <StaticToolSurface shell="/shells/fshare-tool.html" controller="/fshare-tool/app.js" lang="en" />
    <template #fallback>
      <div class="static-tool-surface">
        <p class="static-tool-status" role="status">Loading Fshare tool…</p>
      </div>
    </template>
  </ClientOnly>
</template>
