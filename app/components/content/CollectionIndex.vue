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
const labels = computed(() => lang.value === 'vi' ? {
  article: 'bài viết', articles: 'bài viết', collection: 'bộ sưu tập', collections: 'bộ sưu tập', languages: 'Tiếng Anh · Tiếng Việt',
  order: 'Thứ tự', curriculum: 'Giáo trình', recent: 'Mới cập nhật', collectionLabel: 'Bộ sưu tập', number: 'Số',
  featured: 'Nổi bật', minRead: 'phút đọc', level: { core: 'Cốt lõi', advanced: 'Nâng cao', extra: 'Mở rộng' }
} : {
  article: 'article', articles: 'articles', collection: 'collection', collections: 'collections', languages: 'English · Vietnamese',
  order: 'Order', curriculum: 'Curriculum', recent: 'Recently updated', collectionLabel: 'Collection', number: 'No.',
  featured: 'Featured', minRead: 'min read', level: { core: 'Core', advanced: 'Advanced', extra: 'Extra' }
});
const articleRows = computed(() => (data.value.articles || [])
  .filter((article: any) => props.collection !== 'case-studies' || article.category !== 'systems-architecture'));
const sortMode = ref<'curriculum' | 'recent'>('curriculum');
const activityDate = (article: any) => article.reviewed_at || article.updated_at || article.created_at || '';
const groups = computed(() => Object.entries(data.value.categories || {}).map(([id, category]) => ({
  id,
  copy: text(category),
  articles: articleRows.value.filter((article: any) => article.category === id).sort((left: any, right: any) => sortMode.value === 'recent'
    ? activityDate(right).localeCompare(activityDate(left)) || left.n - right.n
    : left.n - right.n)
})).filter(group => group.articles.length));
const articleRoute = (article: any) => ({
  path: `/${props.collection}/${article.slug}`,
  query: lang.value === 'vi' ? { lang: 'vi' } : {}
});
const lastDate = (article: any) => contentDateFacts(article, lang.value).at(-1);
const levelLabel = (level: string) => labels.value.level[level as 'core' | 'advanced' | 'extra'] || labels.value.level.core;
const byline = (article: any, category: any) => article.company || category.label || article.category;
/* Returning to the card the reader left from is app/router.options.ts's job
   now: it restores the real scroll offset once the grid has laid out, which is
   both more precise than centring a remembered slug and works on every surface
   rather than this one. */
onMounted(() => {
  const storedSort = localStorage.getItem(`gazll:sort:${props.collection}`);
  if (storedSort === 'recent') sortMode.value = 'recent';
});
watch(sortMode, value => { if (import.meta.client) localStorage.setItem(`gazll:sort:${props.collection}`, value); });

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: `${copy.value.title} — GAZLL`,
  meta: [{ name: 'description', content: copy.value.intro }],
  link: [
    { rel: 'canonical', href: `https://gazll.github.io/${props.collection}` }
  ]
}));

const libraryRoot = useTemplateRef<HTMLElement>('libraryRoot');
const sticky = useStickyGroupHeads(libraryRoot, '.cs-category-head');
// Re-sorting replaces the rows the observer was watching.
watch(sortMode, () => sticky.rebind());
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" tabindex="-1" ref="libraryRoot" class="view">
      <div :id="`${collection}-library`" :data-ui="`${collection}-library`" class="cs-library">
        <header :id="`${collection}-library-header`" data-ui="library-header" class="cs-library-hero">
          <p class="cs-eyebrow">{{ copy.eyebrow }}</p>
          <h1>{{ copy.title }}</h1>
          <p>{{ copy.intro }}</p>
          <div class="cs-library-stats">
            <span><b>{{ articleRows.length }}</b> {{ articleRows.length === 1 ? labels.article : labels.articles }}</span>
            <span><b>{{ groups.length }}</b> {{ groups.length === 1 ? labels.collection : labels.collections }}</span>
            <span>{{ labels.languages }}</span>
          </div>
        </header>

        <div v-if="collection === 'case-studies'" id="collection-sort" data-ui="collection-sort" class="content-sort" role="group" :aria-label="labels.order"><span>{{ labels.order }}</span><button type="button" :aria-pressed="sortMode === 'curriculum'" @click="sortMode = 'curriculum'">{{ labels.curriculum }}</button><button type="button" :aria-pressed="sortMode === 'recent'" @click="sortMode = 'recent'">{{ labels.recent }}</button></div>

        <section v-for="group in groups" :key="group.id" data-ui="collection-group" :data-category-id="group.id" class="cs-category" :aria-labelledby="`collection-${group.id}`">
          <header class="cs-category-head">
            <div>
              <p>{{ labels.collectionLabel }}</p>
              <h2 :id="`collection-${group.id}`">{{ group.copy.label }}</h2>
              <span>{{ group.copy.description }}</span>
            </div>
            <b>{{ group.articles.length }}</b>
          </header>
          <div class="cs-card-grid">
            <NuxtLink v-for="article in group.articles" :id="`article-${article.slug}`" :key="article.slug" class="cs-card" :to="articleRoute(article)">
              <span v-if="article.cover_image" class="cs-card-art" :class="{ contain: article.cover_fit === 'contain' }" aria-hidden="true">
                <img :src="`/${article.cover_thumb || article.cover_image}`" alt="" width="320" loading="lazy" decoding="async">
              </span>
              <span v-else class="cs-card-art" aria-hidden="true" />
              <span class="cs-card-content">
                <span class="cs-card-kicker">
                  {{ labels.number }} {{ String(article.n).padStart(2, '0') }} · {{ byline(article, group.copy) }}
                  <span class="content-level" :class="`level-${article.level || 'core'}`">{{ levelLabel(article.level) }}</span>
                  <span v-if="article.featured" class="featured-mark" role="img" :aria-label="labels.featured" :title="labels.featured">★</span>
                </span>
                <strong>{{ articleCopy(article).title }}</strong>
                <span class="cs-card-excerpt">{{ articleCopy(article).excerpt }}</span>
                <span class="cs-card-meta">
                  <span v-if="article.read_minutes">{{ article.read_minutes }} {{ labels.minRead }}</span>
                  <ContentDateStamp v-if="lastDate(article)" :fact="lastDate(article)" :lang="lang" inline />
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
