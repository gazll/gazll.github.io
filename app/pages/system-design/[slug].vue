<script setup lang="ts">
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const slug = String(route.params.slug);
const { data, error } = await useAsyncData(`system-design:${slug}`, () => $fetch<any>(`/api/content/system-design/${slug}`));
if (error.value) throw error.value;
const design = computed(() => data.value.design);
const copy = computed(() => design.value[lang.value] || design.value.en || design.value.vi);
const sections = computed(() => [
  { id: 'functional-requirements', title: 'Functional requirements', rows: copy.value.functional },
  { id: 'quality-attributes', title: 'Quality attributes', rows: copy.value.quality },
  { id: 'capacity-model', title: 'Capacity model', rows: copy.value.capacity },
  { id: 'data-model', title: 'Data model', rows: copy.value.data_model },
  { id: 'technology-choices', title: 'Technology choices', rows: copy.value.stack },
  { id: 'trade-offs-and-evolution', title: 'Trade-offs and evolution', rows: copy.value.tradeoffs }
].filter(section => Array.isArray(section.rows) && section.rows.length));

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: `${copy.value.title} — GAZLL`,
  meta: [{ name: 'description', content: copy.value.excerpt || copy.value.scope }],
  link: [
    { rel: 'stylesheet', href: '/styles.css' },
    { rel: 'canonical', href: `https://gazll.github.io/system-design/${slug}` }
  ]
}));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" class="view">
      <article class="sd-article">
        <div class="sd-backbar"><NuxtLink class="cs-back" :to="{ path: '/system-design', query: lang === 'vi' ? { lang: 'vi' } : {} }">← System Design Library</NuxtLink></div>
        <header class="sd-article-head">
          <p class="cs-eyebrow">Blueprint · {{ design.level }} · {{ design.effort }}</p>
          <h1>{{ copy.title }}</h1>
          <p class="intro">{{ copy.scope || copy.excerpt }}</p>
          <div class="cs-tags"><span v-for="tag in copy.tags || []" :key="tag">{{ tag }}</span></div>
        </header>
        <details class="sd-toc-mobile"><summary>On this page</summary><nav><a v-if="design.diagram" href="#architecture">{{ copy.diagram_title || 'Architecture' }}</a><a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ section.title }}</a></nav></details>
        <div class="sd-article-grid">
          <aside class="sd-toc" aria-label="Article contents">
            <div class="sd-toc-head"><p>On this page</p></div>
            <nav><a v-if="design.diagram" href="#architecture">{{ copy.diagram_title || 'Architecture' }}</a><a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ section.title }}</a></nav>
          </aside>
          <div class="sd-article-body">
            <figure v-if="design.reference_image" class="sd-reference-figure">
              <a :href="`/${design.reference_image.src}`" target="_blank" rel="noopener noreferrer"><img :src="`/${design.reference_image.src}`" :alt="(design.reference_image[lang] || design.reference_image.en).alt"></a>
            </figure>
            <section v-if="design.diagram" id="architecture" class="sd-section">
              <h2>{{ copy.diagram_title || 'Architecture' }}</h2>
              <ContentMermaidDiagram :source="design.diagram" />
              <details class="sd-mermaid-source"><summary>Editable Mermaid source</summary><pre><code>{{ design.diagram }}</code></pre></details>
            </section>
            <section v-for="section in sections" :id="section.id" :key="section.id" class="sd-section">
              <h2>{{ section.title }}</h2>
              <ul><li v-for="row in section.rows" :key="row">{{ row }}</li></ul>
            </section>
          </div>
        </div>
      </article>
    </main>
  </div>
</template>
