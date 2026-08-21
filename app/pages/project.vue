<script setup lang="ts">
import { renderMarkdown } from '~/utils/markdown.js';

const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData('project:calebzone', () => $fetch<any>('/api/content/project'));
const localized = computed(() => data.value.locales?.[lang.value] || {});
const project = computed(() => ({ ...data.value.project, ...(localized.value.project || {}) }));
const prose = computed(() => localized.value.prose || {});
const modules = computed(() => localized.value.modules || data.value.modules);
const requirements = computed(() => localized.value.requirements || data.value.requirements);
const decisions = computed(() => localized.value.architecture?.decisions || data.value.architecture.decisions);
const documentGroups = computed(() => Object.entries(data.value.documents.reduce((groups: Record<string, any[]>, document: any) => {
  (groups[document.category] ||= []).push(document);
  return groups;
}, {})));
const labels = computed(() => lang.value === 'vi' ? {
  back: 'Tất cả dự án', contents: 'Trong bài này', scope: 'Phạm vi và mục tiêu', technology: 'Technology baseline',
  modules: 'Module ownership', requirements: 'Yêu cầu triển khai', architecture: 'Kiến trúc và boundary',
  evidence: 'Bằng chứng triển khai', documents: 'Tài liệu nguồn', source: 'Nguồn', editable: 'source có thể chỉnh sửa'
} : {
  back: 'All projects', contents: 'On this page', scope: 'Scope and intent', technology: 'Technology baseline',
  modules: 'Module ownership', requirements: 'Implementation requirements', architecture: 'Architecture and boundaries',
  evidence: 'Implementation evidence', documents: 'Source documents', source: 'Source', editable: 'editable source'
});
const toc = computed(() => [
  ['project-scope', labels.value.scope], ['project-technology', labels.value.technology], ['project-modules', labels.value.modules],
  ['project-requirements', labels.value.requirements], ['project-architecture', labels.value.architecture],
  ['project-evidence', labels.value.evidence], ['project-documents', labels.value.documents]
]);
const documentHtml = (document: any) => renderMarkdown(document.body, {
  headingPrefix: `doc-${document.id}`,
  headingLinkLabel: lang.value === 'vi' ? 'Liên kết đến mục này' : 'Link to this section'
});

useHead(() => ({
  htmlAttrs: { lang: lang.value }, title: `${project.value.title} — GAZLL`,
  meta: [{ name: 'description', content: project.value.intro }],
  link: [{ rel: 'canonical', href: 'https://gazll.github.io/project' }],
  script: [{ type: 'application/ld+json', innerHTML: JSON.stringify({
    '@context': 'https://schema.org', '@type': 'TechArticle', headline: project.value.title,
    description: project.value.intro, datePublished: data.value.created_at, dateModified: data.value.updated_at,
    inLanguage: lang.value
  }) }]
}));
</script>

<template>
  <div><ContentHeader :lang="lang" /><main id="view-host" tabindex="-1" class="view"><div class="pj-shell pj-article">
    <div class="sd-backbar"><NuxtLink class="pj-back" :to="{ path: '/', query: lang === 'vi' ? { lang } : {} }">← {{ labels.back }}</NuxtLink></div>
    <header class="pj-head"><p class="pj-eyebrow">Project · {{ project.status }} · {{ data.snapshot }}</p><h1>{{ project.title }}</h1><p class="pj-deck">{{ project.intro }}</p><p>{{ project.owner_note }}</p><div class="pj-meta"><span>{{ data.updated_at }}</span><code>{{ data.project.source_root }}</code></div></header>
    <details class="pj-toc-mobile"><summary>{{ labels.contents }}</summary><nav><a v-for="entry in toc" :key="entry[0]" :href="`#${entry[0]}`">{{ entry[1] }}</a></nav></details>
    <div class="pj-grid">
      <aside class="pj-toc"><p>{{ labels.contents }}</p><nav><a v-for="entry in toc" :key="entry[0]" :href="`#${entry[0]}`">{{ entry[1] }}</a></nav></aside>
      <article class="pj-body">
        <section id="project-scope" class="pj-section"><h2><a class="pj-heading-anchor" href="#project-scope">{{ labels.scope }}</a></h2><p>{{ prose.scope }}</p></section>
        <section id="project-technology" class="pj-section"><h2><a class="pj-heading-anchor" href="#project-technology">{{ prose.technologyTitle || labels.technology }}</a></h2><div class="tags"><span v-for="item in data.stack" :key="item" class="tag">{{ item }}</span></div></section>
        <section id="project-modules" class="pj-section"><h2><a class="pj-heading-anchor" href="#project-modules">{{ prose.modulesTitle || labels.modules }}</a></h2><div class="pj-module-grid"><article v-for="module in modules" :key="module.name" class="pj-module"><code>{{ module.name }}</code><p>{{ module.role }}</p></article></div></section>
        <section id="project-requirements" class="pj-section"><h2><a class="pj-heading-anchor" href="#project-requirements">{{ labels.requirements }}</a></h2><p>{{ prose.requirements }}</p><div class="pj-requirement-list"><article v-for="(item, index) in requirements" :key="item"><b>FR-{{ String(index + 1).padStart(2, '0') }}</b><p>{{ item }}</p></article></div></section>
        <section id="project-architecture" class="pj-section"><h2><a class="pj-heading-anchor" href="#project-architecture">{{ labels.architecture }}</a></h2><p>{{ prose.architecture }}</p><ContentMermaidDiagram :source="data.architecture.diagram" :title="prose.diagramTitle || labels.architecture" :lang="lang" /><details class="sd-mermaid-source"><summary>{{ prose.editableSource || labels.editable }}</summary><pre><code>{{ data.architecture.diagram }}</code></pre></details><div class="pj-decision-list"><article v-for="(item, index) in decisions" :key="item"><span>{{ index + 1 }}</span><p>{{ item }}</p></article></div></section>
        <section id="project-evidence" class="pj-section"><h2><a class="pj-heading-anchor" href="#project-evidence">{{ labels.evidence }}</a></h2><p>{{ prose.evidence }}</p><div class="pj-sample-list"><details v-for="sample in data.samples" :key="sample.id" class="pj-sample"><summary><span><strong>{{ sample.title }}</strong><small>{{ sample.language }} · {{ sample.focus }}</small></span><code>{{ sample.language }}</code></summary><div class="pj-sample-body"><div class="pj-source-line"><span>{{ labels.source }}</span><code>{{ sample.source }}</code></div><pre><code :class="`language-${sample.language}`">{{ sample.body }}</code></pre></div></details></div></section>
        <section id="project-documents" class="pj-section"><h2><a class="pj-heading-anchor" href="#project-documents">{{ labels.documents }}</a></h2><p>{{ prose.documents }}</p><section v-for="([category, documents]) in documentGroups" :key="category" class="pj-doc-group"><h3>{{ category }}</h3><details v-for="document in documents" :key="document.id" class="pj-doc"><summary><span><strong>{{ document.title }}</strong><small>{{ document.source }}</small></span><span class="pj-updated">{{ document.updated_at }}</span></summary><div class="pj-doc-body"><div class="pj-source-line"><span>{{ labels.source }}</span><code>{{ document.source }}</code></div><div class="markdown-body" v-html="documentHtml(document)" /></div></details></section></section>
      </article>
    </div>
  </div></main></div>
</template>
