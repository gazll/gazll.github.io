<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'en' },
  title: 'Fshare Bulk Copy',
  link: [{ rel: 'stylesheet', href: '/fshare-tool/style.css' }]
});
</script>

<template>
  <LegacySurface shell="/shells/fshare-tool.html" controller="/fshare-tool/app.js" />
</template>
