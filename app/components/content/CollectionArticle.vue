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
const categoryLabel = computed(() => {
  const category = data.value.categories[data.value.row.category];
  return category?.[lang.value]?.label || category?.en?.label || data.value.row.category;
});
const labels = computed(() => lang.value === 'vi' ? {
  back: 'Tất cả bài viết', contents: 'Trong bài này', guide: 'Hướng dẫn đọc', problem: 'Vấn đề',
  idea: 'Ý tưởng cốt lõi', outcome: 'Kết quả', takeaways: 'Điểm chính', review: 'Góc nhìn đánh giá',
  source: 'Nguồn', original: 'Bài viết gốc', close: 'Đóng ảnh'
} : {
  back: 'All articles', contents: 'On this page', guide: 'Reading guide', problem: 'Problem',
  idea: 'Core idea', outcome: 'Outcome', takeaways: 'Takeaways', review: 'Review lenses',
  source: 'Source', original: 'Original article', close: 'Close image'
});

const decodeHeading = (value: string) => value
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'");
const headings = computed(() => [...body.value.matchAll(/<h([23])\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/h\1>/gi)]
  .map(match => ({ level: Number(match[1]), id: match[2], text: decodeHeading(match[3]).trim() })));

const lightbox = useTemplateRef<HTMLDialogElement>('lightbox');
const lightboxImage = ref({ src: '', alt: '', caption: '' });
function onArticleClick(event: MouseEvent) {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-zoom-image]');
  const image = button?.querySelector<HTMLImageElement>('img');
  if (!button || !image) return;
  const caption = button.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '';
  lightboxImage.value = { src: image.currentSrc || image.src, alt: image.alt, caption };
  lightbox.value?.showModal();
}

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
      <div class="cs-article">
        <div class="cs-backbar">
          <NuxtLink class="cs-back" :to="{ path: `/${collection}`, query: lang === 'vi' ? { lang } : {} }">← {{ labels.back }}</NuxtLink>
        </div>

        <header class="cs-article-head">
          <p class="cs-eyebrow">{{ data.row.company || categoryLabel }} · {{ categoryLabel }}</p>
          <h1>{{ copy.title }}</h1>
          <p class="cs-deck">{{ copy.excerpt }}</p>
          <div class="cs-byline content-dates">
            <span v-for="fact in dates" :key="fact.kind"><b>{{ fact.label }}</b><time :datetime="fact.value">{{ fact.formatted }}</time></span>
            <span v-if="data.row.original_language" class="cs-language">{{ data.row.original_language.toUpperCase() }}</span>
          </div>
          <div class="cs-tags"><span v-for="tag in copy.tags || []" :key="tag">{{ tag }}</span></div>
        </header>

        <section v-if="guide.title" class="cs-guide" aria-labelledby="cs-guide-title">
          <header><p>{{ labels.guide }}</p><h2 id="cs-guide-title">{{ guide.title }}</h2></header>
          <template v-if="guide.problem || guide.core_idea || guide.outcome">
            <div class="cs-guide-brief">
              <article v-if="guide.problem"><b>{{ labels.problem }}</b><p>{{ guide.problem }}</p></article>
              <article v-if="guide.core_idea"><b>{{ labels.idea }}</b><p>{{ guide.core_idea }}</p></article>
              <article v-if="guide.outcome"><b>{{ labels.outcome }}</b><p>{{ guide.outcome }}</p></article>
            </div>
            <div class="cs-guide-depth">
              <article v-if="guide.takeaways?.length"><h3>{{ labels.takeaways }}</h3><ul><li v-for="point in guide.takeaways" :key="point">{{ point }}</li></ul></article>
              <article v-if="guide.review_lenses?.length"><h3>{{ labels.review }}</h3><ul><li v-for="point in guide.review_lenses" :key="point">{{ point }}</li></ul></article>
            </div>
          </template>
          <template v-else>
            <div class="cs-guide-brief"><article><b>{{ labels.guide }}</b><p>{{ guide.summary }}</p></article></div>
            <div v-if="guide.points?.length" class="cs-guide-depth"><article><h3>{{ labels.takeaways }}</h3><ul><li v-for="point in guide.points" :key="point">{{ point }}</li></ul></article></div>
          </template>
        </section>

        <details v-if="headings.length" class="cs-toc-mobile">
          <summary>{{ labels.contents }}</summary>
          <nav><a v-for="heading in headings" :key="heading.id" :href="`#${heading.id}`" :class="{ sub: heading.level === 3 }">{{ heading.text }}</a></nav>
        </details>
        <div class="cs-article-grid">
          <aside class="cs-toc" :aria-label="labels.contents">
            <div class="cs-toc-head"><p>{{ labels.contents }}</p></div>
            <div class="cs-toc-content"><nav><a v-for="heading in headings" :key="heading.id" :href="`#${heading.id}`" :class="{ sub: heading.level === 3 }">{{ heading.text }}</a></nav></div>
          </aside>
          <article class="cs-article-body" @click="onArticleClick" v-html="body" />
        </div>

        <footer v-if="data.row.source_url" class="cs-source">
          <span>{{ labels.source }}</span><a :href="data.row.source_url" target="_blank" rel="noopener noreferrer">{{ data.row.company }} — {{ labels.original }} ↗</a>
        </footer>
        <dialog ref="lightbox" class="cs-lightbox" @click.self="lightbox?.close()">
          <button type="button" :aria-label="labels.close" @click="lightbox?.close()">×</button>
          <figure v-if="lightboxImage.src"><img :src="lightboxImage.src" :alt="lightboxImage.alt"><figcaption>{{ lightboxImage.caption }}</figcaption></figure>
        </dialog>
      </div>
    </main>
  </div>
</template>
