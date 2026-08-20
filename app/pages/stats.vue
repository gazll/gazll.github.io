<script setup lang="ts">
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData('stats:data', () => $fetch<any>('/api/content/stats'));
useHead({ title: 'Study statistics — GAZLL', meta: [{ name: 'description', content: 'Personal study progress, notes and daily activity.' }], link: [{ rel: 'canonical', href: 'https://gazll.github.io/stats' }] });
</script>
<template><div><ContentHeader :lang="lang" /><main id="view-host" class="view"><div class="page stats-page"><section class="hero"><h1>Study statistics</h1><p class="intro">Progress, notes and daily study activity.</p></section><ClientOnly><StatsDashboard :data="data" :lang="lang" /></ClientOnly></div></main></div></template>
