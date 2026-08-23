<script setup lang="ts">
/* Let Nuxt/Vite own the global stylesheet so production emits one hashed,
   minified CSS asset instead of shipping the raw public file as a
   render-blocking request. The source stays in public/ because the design
   and contrast checks read that canonical file directly. */
import '../public/styles.css';
</script>

<template>
  <NuxtPage />
</template>
