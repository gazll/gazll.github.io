<script setup lang="ts">
const route = useRoute(); const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData('stats:admin', () => $fetch<any>('/api/content/stats'));
useHead({ title: 'Admin — GAZLL', meta: [{ name: 'robots', content: 'noindex,nofollow' }] });
</script>
<template><div><ContentHeader :lang="lang" /><main id="view-host" class="view"><div class="page admin-page"><section class="hero"><h1>Admin — all-user overview</h1><p class="intro">Read straight from the Google Sheet; the backend enforces the admin role.</p></section><ClientOnly><AdminAdminOverview :total="data.total" /></ClientOnly></div></main></div></template>
