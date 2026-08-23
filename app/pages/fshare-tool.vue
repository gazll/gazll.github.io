<script setup lang="ts">
/* This page needs its own CSP. The site-wide policy in `nuxt.config.ts` allows
   Google Identity and Apps Script and nothing else, so the tool's folder proxy
   was blocked before a request left the browser — every listing failed with a
   bare "Failed to fetch" that reads as the proxy being down. Unhead replaces
   the inherited meta by `http-equiv`, so this is the whole policy, not an
   addition to it: keep GSI and Apps Script here or the tool's sync signs out. */
const FSHARE_API_ORIGIN = 'https://fshare.annnekkk.com';

useHead({
  htmlAttrs: { lang: 'en' },
  title: 'Fshare Bulk Copy',
  meta: [
    { 'http-equiv': 'Content-Security-Policy', content: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://*.googleusercontent.com",
      `connect-src 'self' ${FSHARE_API_ORIGIN} https://accounts.google.com/gsi/ https://script.google.com https://script.googleusercontent.com`,
      "frame-src https://accounts.google.com/gsi/",
      "form-action 'none'",
      "worker-src 'none'",
      'upgrade-insecure-requests'
    ].join('; ') }
  ],
  link: [{ rel: 'stylesheet', href: '/fshare-tool/style.css' }]
});
</script>

<template>
  <StaticToolSurface shell="/shells/fshare-tool.html" controller="/fshare-tool/app.js" />
</template>
