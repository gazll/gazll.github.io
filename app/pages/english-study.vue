<script setup lang="ts">
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data, error } = await useAsyncData('english-study:plan', () => $fetch<any>('/api/content/english-study'));
if (error.value) throw error.value;

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: 'English Study — GAZLL',
  meta: [{ name: 'description', content: 'English Speaking OS 2026: a collapsible 26-week speaking system for a senior software developer.' }],
  link: [{ rel: 'canonical', href: 'https://gazll.github.io/english-study' }]
}));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" tabindex="-1" class="view">
      <div class="page english-study-page">
        <StudyEnglishStudyPlan :markdown="data?.markdown || ''" />
      </div>
    </main>
  </div>
</template>
