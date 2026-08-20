<script setup lang="ts">
import { renderMarkdown } from '~/utils/markdown.js';
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData('release-notes', () => $fetch<any>('/api/content/releases'));
useHead({ title: 'Release Notes — GAZLL', link: [{ rel: 'stylesheet', href: '/styles.css' }] });
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" class="view"><div class="page release-page">
      <header><p class="eyebrow">What changed</p><h1>Release Notes</h1></header>
      <section v-for="release in data.releases" :key="`${release.date}-${release.en.title}`" class="release-day">
        <time :datetime="release.date">{{ release.date }}</time>
        <h2>{{ release[lang].title }}</h2>
        <article v-for="change in release.changes" :key="change[lang].text" class="release-change">
          <span class="tag">{{ change.kind }}</span><div v-html="renderMarkdown(change[lang].text)" />
        </article>
      </section>
    </div></main>
  </div>
</template>
