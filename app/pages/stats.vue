<script setup lang="ts">
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData('stats:data', () => $fetch<any>('/api/content/stats'));
useHead({ title: 'Study statistics — GAZLL', link: [{ rel: 'stylesheet', href: '/styles.css' }] });
</script>
<template><div><ContentHeader :lang="lang" /><main id="view-host" class="view"><div class="page stats-page"><section class="hero"><h1>Study statistics</h1><p class="intro">Progress, notes and daily study activity.</p></section><ClientOnly><StatsStatsDashboard :data="data" :lang="lang" /></ClientOnly></div></main></div></template>
