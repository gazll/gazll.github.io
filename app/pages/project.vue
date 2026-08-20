<script setup lang="ts">
import { renderMarkdown } from '~/utils/markdown.js';
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData('project:calebzone', () => $fetch<any>('/api/content/project'));
const localized = computed(() => data.value.locales?.[lang.value] || {});
const project = computed(() => ({ ...data.value.project, ...(localized.value.project || {}) }));
const prose = computed(() => localized.value.prose || {});
useHead(() => ({ title: `${project.value.title} — GAZLL`, meta: [{ name: 'description', content: project.value.intro }], link: [{ rel: 'stylesheet', href: '/styles.css' }] }));
</script>

<template>
  <div><ContentHeader :lang="lang" /><main id="view-host" class="view"><article class="page project-page">
    <header class="project-head"><p class="eyebrow">{{ project.status }} · {{ data.snapshot }}</p><h1>{{ project.title }}</h1><p class="intro">{{ project.intro }}</p><p>{{ project.owner_note }}</p></header>
    <section><h2>{{ prose.technologyTitle || 'Technology baseline' }}</h2><div class="tags"><span v-for="item in data.stack" :key="item" class="tag">{{ item }}</span></div></section>
    <section><h2>{{ prose.modulesTitle || 'Module ownership' }}</h2><div class="project-modules"><article v-for="module in localized.modules || data.modules" :key="module.name" class="project-module"><h3>{{ module.name }}</h3><p>{{ module.role }}</p></article></div></section>
    <section><h2>Implementation requirements</h2><p>{{ prose.requirements }}</p><ol><li v-for="item in localized.requirements || data.requirements" :key="item">{{ item }}</li></ol></section>
    <section><h2>Architecture decisions</h2><p>{{ prose.architecture }}</p><ul><li v-for="item in localized.architecture?.decisions || data.architecture.decisions" :key="item">{{ item }}</li></ul></section>
    <section><h2>Implementation evidence</h2><p>{{ prose.evidence }}</p><details v-for="sample in data.samples" :key="sample.id" class="project-evidence"><summary><strong>{{ sample.title }}</strong> — {{ sample.focus }}</summary><pre><code>{{ sample.body }}</code></pre></details></section>
    <section><h2>Source documents</h2><p>{{ prose.documents }}</p><details v-for="document in data.documents" :key="document.id" class="project-document"><summary><strong>{{ document.title }}</strong> · {{ document.category }}</summary><div class="markdown-body" v-html="renderMarkdown(document.body)" /></details></section>
  </article></main></div>
</template>
