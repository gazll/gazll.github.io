<script setup lang="ts">
import { contentDateFacts } from '~/utils/content-dates.js';

const props = defineProps<{
  collection: 'case-studies' | 'photography' | 'homelab'
  slug: string
}>();
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data, error } = await useAsyncData(`collection:${props.collection}:${props.slug}`, () =>
  $fetch<any>(`/api/content/collection/${props.collection}/${props.slug}`));
if (error.value) throw error.value;
const copy = computed(() => data.value.row.metadata[lang.value] || data.value.row.metadata.en);
const guide = computed(() => (lang.value === 'vi' && data.value.vi ? data.value.vi : data.value.en).guide || {});
const body = computed(() => lang.value === 'vi' ? data.value.viBody : data.value.enBody);
const dates = computed(() => contentDateFacts(data.value.row, lang.value, { includePublished: true }));

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: `${copy.value.title} — GAZLL`,
  meta: [{ name: 'description', content: copy.value.excerpt }],
  link: [
    { rel: 'stylesheet', href: '/styles.css' },
    { rel: 'canonical', href: `https://gazll.github.io/${props.collection}/${props.slug}` }
  ],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: copy.value.title,
      description: copy.value.excerpt,
      datePublished: data.value.row.published_at || data.value.row.created_at,
      dateModified: data.value.row.updated_at || data.value.row.created_at,
      inLanguage: lang.value
    })
  }]
}));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" class="view">
      <article class="page cs-article">
        <NuxtLink class="backlink" :to="`/${collection}?lang=${lang}`">← {{ data.library[lang].title }}</NuxtLink>
        <header class="cs-article-head">
          <p class="eyebrow">{{ data.row.company || data.row.level }}</p>
          <h1>{{ copy.title }}</h1>
          <p class="intro">{{ copy.excerpt }}</p>
          <div class="content-dates">
            <time v-for="fact in dates" :key="fact.kind" :datetime="fact.value">{{ fact.label }} {{ fact.formatted }}</time>
          </div>
          <div class="tags"><span v-for="tag in copy.tags || []" :key="tag" class="tag">{{ tag }}</span></div>
        </header>
        <img v-if="data.row.cover_image" class="cs-cover" :src="`/${data.row.cover_image}`" :alt="copy.title">
        <aside v-if="guide.title" class="cs-guide">
          <h2>{{ guide.title }}</h2>
          <p v-if="guide.summary || guide.problem">{{ guide.summary || guide.problem }}</p>
          <p v-if="guide.core_idea"><strong>Core idea:</strong> {{ guide.core_idea }}</p>
          <ul v-if="guide.points || guide.takeaways">
            <li v-for="point in guide.points || guide.takeaways" :key="point">{{ point }}</li>
          </ul>
        </aside>
        <div class="cs-article-body" v-html="body" />
        <p v-if="data.row.source_url" class="cs-source"><a :href="data.row.source_url" rel="noopener noreferrer">Original source</a></p>
      </article>
    </main>
  </div>
</template>
