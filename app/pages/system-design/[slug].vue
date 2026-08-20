<script setup lang="ts">
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const slug = String(route.params.slug);
const { data, error } = await useAsyncData(`system-design:${slug}`, () => $fetch<any>(`/api/content/system-design/${slug}`));
if (error.value) throw error.value;
const design = computed(() => data.value.design);
const copy = computed(() => design.value[lang.value] || design.value.en || design.value.vi);
const sections = computed(() => [
  ['Functional requirements', copy.value.functional],
  ['Quality attributes', copy.value.quality],
  ['Capacity model', copy.value.capacity],
  ['Data model', copy.value.data_model],
  ['Technology choices', copy.value.stack],
  ['Trade-offs and evolution', copy.value.tradeoffs]
].filter(([, rows]) => Array.isArray(rows) && rows.length));

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
      <article class="page sd-article">
        <NuxtLink class="backlink" :to="`/system-design?lang=${lang}`">← System Design Library</NuxtLink>
        <header class="sd-article-head">
          <p class="eyebrow">{{ design.level }} · {{ design.effort }}</p>
          <h1>{{ copy.title }}</h1>
          <p class="intro">{{ copy.scope || copy.excerpt }}</p>
          <div class="tags"><span v-for="tag in copy.tags || []" :key="tag" class="tag">{{ tag }}</span></div>
        </header>
        <section v-if="design.reference_image" class="sd-reference-image">
          <img :src="`/${design.reference_image.src}`" :alt="(design.reference_image[lang] || design.reference_image.en).alt">
        </section>
        <section v-if="design.diagram" class="sd-section">
          <h2>{{ copy.diagram_title || 'Architecture' }}</h2>
          <ContentMermaidDiagram :source="design.diagram" />
          <details><summary>Editable Mermaid source</summary><pre><code>{{ design.diagram }}</code></pre></details>
        </section>
        <section v-for="([title, rows]) in sections" :key="String(title)" class="sd-section">
          <h2>{{ title }}</h2>
          <ul><li v-for="row in rows" :key="row">{{ row }}</li></ul>
        </section>
      </article>
    </main>
  </div>
</template>
