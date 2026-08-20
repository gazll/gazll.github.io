<script setup lang="ts">
import { renderMarkdown } from '~/utils/markdown.js';
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData('interviews', () => $fetch<any>('/api/content/interviews'));
useHead({ title: 'Gazl Try — GAZLL', link: [{ rel: 'stylesheet', href: '/styles.css' }] });
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" class="view"><div class="page interview-page">
      <header><p class="eyebrow">Interview journal</p><h1>Gazl Try</h1></header>
      <article v-for="company in data.companies" :key="company.slug" class="company-card">
        <header><h2>{{ company.name }}</h2><p>{{ company.role }}<template v-if="company.date"> · {{ company.date }}</template></p></header>
        <div class="tags"><span v-for="tag in company.stack || []" :key="tag" class="tag">{{ tag }}</span></div>
        <details v-for="(question, index) in company.questions" :key="`${company.slug}-${index}`" class="qcard">
          <summary class="qhead"><span class="qid">Q{{ index + 1 }}</span><span class="qtext">{{ question.q }}</span></summary>
          <div class="answer"><div v-html="renderMarkdown(question.a)" /><aside v-if="question.note" class="notebox"><strong>Reflection</strong><p>{{ question.note }}</p></aside></div>
        </details>
      </article>
    </div></main>
  </div>
</template>
