<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'vi' },
  title: 'Tra cứu đăng ký học phần NTT',
  meta: [
    { name: 'referrer', content: 'no-referrer' },
    { 'http-equiv': 'Content-Security-Policy', content: "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; form-action 'none'; worker-src 'none'; upgrade-insecure-requests" }
  ],
  link: [{ rel: 'stylesheet', href: '/course-registration/style.css' }]
});
</script>

<template>
  <StaticToolSurface shell="/shells/course-registration.html" controller="/course-registration/app.js" />
</template>
