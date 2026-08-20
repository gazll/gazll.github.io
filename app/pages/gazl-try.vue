<script setup lang="ts">
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData('interviews', () => $fetch<any>('/api/content/interviews'));
useHead(() => ({ htmlAttrs: { lang: lang.value }, title: 'Gazl Try — GAZLL', meta: [{ name: 'description', content: 'Interview journal, preparation playbooks and technically reviewed answers.' }], link: [{ rel: 'canonical', href: 'https://gazll.github.io/gazl-try' }] }));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" class="view"><ClientOnly><GazlJournal :seed="data.companies" :lang="lang" /><template #fallback><p class="loading-block">Loading the interview journal…</p></template></ClientOnly></main>
  </div>
</template>
