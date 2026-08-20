<script setup lang="ts">
import { contentDateFacts } from '~/utils/content-dates.js';

const props = defineProps<{ collection: 'case-studies' | 'photography' | 'homelab' }>();
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData(`collection:${props.collection}`, () =>
  $fetch<any>(`/api/content/collection/${props.collection}/index`));
const copy = computed(() => data.value.library[lang.value] || data.value.library.en);
const text = (row: any) => row?.[lang.value] || row?.en || row?.vi || {};
const articleCopy = (article: any) => text(article.metadata);
const articleRows = computed(() => (data.value.articles || [])
  .filter((article: any) => props.collection !== 'case-studies' || article.category !== 'systems-architecture'));
const groups = computed(() => Object.entries(data.value.categories || {}).map(([id, category]) => ({
  id,
  copy: text(category),
  articles: articleRows.value.filter((article: any) => article.category === id)
})).filter(group => group.articles.length));
const articleRoute = (article: any) => ({
  path: `/${props.collection}/${article.slug}`,
  query: lang.value === 'vi' ? { lang: 'vi' } : {}
});
const lastDate = (article: any) => contentDateFacts(article, lang.value).at(-1);
const levelLabel = (level: string) => ({ core: 'Core', advanced: 'Advanced', extra: 'Extra' }[level] || 'Core');
const byline = (article: any, category: any) => article.company || category.label || article.category;

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: `${copy.value.title} — GAZLL`,
  meta: [{ name: 'description', content: copy.value.intro }],
  link: [
    { rel: 'stylesheet', href: '/styles.css' },
    { rel: 'canonical', href: `https://gazll.github.io/${props.collection}` }
  ]
}));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" class="view">
      <div class="cs-library">
        <header class="cs-library-hero">
          <p class="cs-eyebrow">{{ copy.eyebrow }}</p>
          <h1>{{ copy.title }}</h1>
          <p>{{ copy.intro }}</p>
          <div class="cs-library-stats">
            <span><b>{{ articleRows.length }}</b> {{ articleRows.length === 1 ? 'article' : 'articles' }}</span>
            <span><b>{{ groups.length }}</b> collections</span>
            <span>English · Vietnamese</span>
          </div>
        </header>

        <section v-for="group in groups" :key="group.id" class="cs-category" :aria-labelledby="`collection-${group.id}`">
          <header class="cs-category-head">
            <div>
              <p>Collection</p>
              <h2 :id="`collection-${group.id}`">{{ group.copy.label }}</h2>
              <span>{{ group.copy.description }}</span>
            </div>
            <b>{{ group.articles.length }}</b>
          </header>
          <div class="cs-card-grid">
            <NuxtLink v-for="article in group.articles" :key="article.slug" class="cs-card" :to="articleRoute(article)">
              <span v-if="article.cover_image" class="cs-card-art" :class="{ contain: article.cover_fit === 'contain' }" aria-hidden="true">
                <img :src="`/${article.cover_image}`" alt="" loading="lazy" decoding="async">
              </span>
              <span v-else class="cs-card-art" aria-hidden="true" />
              <span class="cs-card-content">
                <span class="cs-card-kicker">
                  No. {{ String(article.n).padStart(2, '0') }} · {{ byline(article, group.copy) }}
                  <span class="content-level" :class="`level-${article.level || 'core'}`">{{ levelLabel(article.level) }}</span>
                  <span v-if="article.featured" class="featured-mark" role="img" aria-label="Featured" title="Featured">★</span>
                </span>
                <strong>{{ articleCopy(article).title }}</strong>
                <span class="cs-card-excerpt">{{ articleCopy(article).excerpt }}</span>
                <span class="cs-card-meta">
                  <span v-if="article.read_minutes">{{ article.read_minutes }} min read</span>
                  <span v-if="lastDate(article)">{{ lastDate(article).label }} {{ lastDate(article).formatted }}</span>
                </span>
              </span>
              <span class="cs-card-arrow" aria-hidden="true">→</span>
            </NuxtLink>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
