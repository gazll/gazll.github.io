<script setup lang="ts">
import { contentDateFacts } from '~/utils/content-dates.js';
import { safeJsonLd } from '~/utils/safe-jsonld.js';
import { PUBLISHER_ORIGINS, originGuard } from '../../../public/lib/constants.js';
import { manualReviewMarkup, syncManualReviewControls } from '../../../public/lib/manual-review.js';

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
const decoratedBody = computed(() => body.value.replace(/<h([23])\b([^>]*\bid=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/h\1>/gi,
  (_match: string, level: string, attrs: string, id: string, label: string) => `<h${level}${attrs}><a class="md-heading-anchor" href="#${encodeURIComponent(id)}" aria-label="${lang.value === 'vi' ? 'Liên kết đến mục này' : 'Link to this section'}">${label}</a></h${level}>`));
const decoratedBodyWithReviews = computed(() => decorateReviewQuestions(decoratedBody.value));
const dates = computed(() => contentDateFacts(data.value.row, lang.value, { includePublished: true }));
const categoryLabel = computed(() => {
  const category = data.value.categories[data.value.row.category];
  return category?.[lang.value]?.label || category?.en?.label || data.value.row.category;
});
const labels = computed(() => lang.value === 'vi' ? {
  back: 'Tất cả bài viết', contents: 'Trong bài này', guide: 'Hướng dẫn đọc', problem: 'Vấn đề',
  idea: 'Ý tưởng cốt lõi', outcome: 'Kết quả', takeaways: 'Điểm chính', review: 'Góc nhìn đánh giá',
  source: 'Nguồn', original: 'Bài viết gốc', close: 'Đóng ảnh',
  historical: 'Historical case study', synthesis: 'Editorial synthesis',
  architecture: 'Góc nhìn kiến trúc',
  historicalNote: 'Architecture, technology choices và benchmark figures phản ánh system cùng workload tại thời điểm bài được publish.',
  synthesisNote: 'Bài này được biên soạn lại từ nguồn đã ghi công, không phải bản sao được lưu nguyên văn từ bài gốc.'
} : {
  back: 'All articles', contents: 'On this page', guide: 'Reading guide', problem: 'Problem',
  idea: 'Core idea', outcome: 'Outcome', takeaways: 'Takeaways', review: 'Review lenses',
  source: 'Source', original: 'Original article', close: 'Close image',
  historical: 'Historical case study', synthesis: 'Editorial synthesis',
  architecture: 'Architecture lens',
  historicalNote: 'Architecture, technology choices and benchmark figures reflect the system and workload described at publication time.',
  synthesisNote: 'This article is a rewritten case study based on the credited source, not a preserved copy of the original.'
});

const progress = import.meta.client && props.collection === 'case-studies' ? useStudyProgress() : null;
const reviewLabels = computed(() => lang.value === 'vi'
  ? { pending: 'Đánh dấu đã ôn', done: 'Bỏ đánh dấu đã ôn' }
  : { pending: 'Mark reviewed', done: 'Unmark reviewed' });

function decorateReviewQuestions(html: string) {
  if (props.collection !== 'case-studies') return html;
  let sectionNumber = 0;
  return html.replace(
    /(<h[23]\b[^>]*\bid=["'][^"']*(?:question|review)[^"']*["'][^>]*>[\s\S]*?<\/h[23]>)(\s*<ol\b[^>]*>)([\s\S]*?)(<\/ol>)/gi,
    (match: string, heading: string, listStart: string, listBody: string, listEnd: string) => {
      const headingId = /\bid=["']([^"']+)["']/i.exec(heading)?.[1] || `review-${++sectionNumber}`;
      let questionNumber = 0;
      const markedList = listBody.replace(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi,
        (_item: string, attrs: string, question: string) => {
          questionNumber += 1;
          const reviewId = `case-studies.${props.slug}.${headingId}.q${questionNumber}`;
          return `<li${attrs} class="cs-review-question"><span class="cs-review-question-body">${question}</span>${manualReviewMarkup(reviewId, reviewLabels.value)}</li>`;
        });
      return questionNumber ? heading + listStart + markedList + listEnd : match;
    });
}

/* Outbound credit links are pinned to the approved publisher origins by
   lib/constants.js — the one allowlist owner. A first-party row carries no
   source_url at all, so it gets neither the link nor the archive note. */
const sourceHref = originGuard(PUBLISHER_ORIGINS);
const creditHref = computed(() => data.value.row.source_url ? sourceHref(data.value.row.source_url) : '');
/* An external body that was rewritten rather than preserved must be labelled
   as editorial synthesis, never as the original article. */
const archive = computed(() => {
  if (props.collection !== 'case-studies' || data.value.row.first_party || !data.value.row.source_url) return null;
  const synthesis = data.value.row.content_kind === 'synthesis';
  return {
    label: synthesis ? labels.value.synthesis : labels.value.historical,
    note: synthesis ? labels.value.synthesisNote : labels.value.historicalNote
  };
});

/* Present only on the cases handed over to System Design; the lens and its
   diagram are authored in the blueprint catalog. */
const overview = computed(() => {
  const row = data.value.overview;
  if (!row) return null;
  const copyRow = row[lang.value] || row.en;
  return copyRow?.lens ? { title: copyRow.title || '', lens: copyRow.lens, diagram: row.diagram || '' } : null;
});

const decodeHeading = (value: string) => value
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'");
const headings = computed(() => [...decoratedBodyWithReviews.value.matchAll(/<h([23])\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/h\1>/gi)]
  .map(match => ({ level: Number(match[1]), id: match[2], text: decodeHeading(match[3]).trim() })));

const lightbox = useTemplateRef<HTMLDialogElement>('lightbox');
const lightboxImage = ref({ src: '', alt: '', caption: '' });
const lightboxReturnFocus = ref<HTMLElement | null>(null);
const tocCollapsed = ref(false);
const articleBody = ref<HTMLElement | null>(null);
const mobileToc = ref<HTMLDetailsElement | null>(null);
const activeHeadingId = ref(headings.value[0]?.id || '');
const activeHeadingLabel = computed(() => headings.value.find(heading => heading.id === activeHeadingId.value)?.text || labels.value.contents);
let tocObserver: IntersectionObserver | null = null;
function syncActiveHeading() {
  tocObserver?.disconnect();
  tocObserver = null;
  const ids = headings.value.map(heading => heading.id);
  activeHeadingId.value = ids[0] || '';
  if (!import.meta.client || !articleBody.value || typeof IntersectionObserver === 'undefined') return;
  const targets = ids
    .map(id => document.getElementById(id))
    .filter((node): node is HTMLElement => Boolean(node));
  if (!targets.length) return;
  tocObserver = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible[0]) {
      activeHeadingId.value = visible[0].target.id;
      return;
    }
    const passed = targets.filter(target => target.getBoundingClientRect().top <= window.innerHeight * 0.32);
    if (passed.length) activeHeadingId.value = passed[passed.length - 1].id;
  }, { rootMargin: '-16% 0px -68% 0px', threshold: [0, 0.1, 0.5] });
  targets.forEach(target => tocObserver?.observe(target));
}
function syncReviews() {
  syncManualReviewControls(articleBody.value, progress?.reviewed.value, reviewLabels.value);
}
function closeMobileToc() {
  if (mobileToc.value) mobileToc.value.open = false;
}
onMounted(() => {
  tocCollapsed.value = localStorage.getItem('gazll:article-toc') === 'collapsed';
  void nextTick(() => {
    syncActiveHeading();
    syncReviews();
  });
});
onBeforeUnmount(() => tocObserver?.disconnect());
watch(tocCollapsed, value => { if (import.meta.client) localStorage.setItem('gazll:article-toc', value ? 'collapsed' : 'open'); });
watch(() => headings.value.map(heading => heading.id).join('|'), () => nextTick(syncActiveHeading));
watch(() => lang.value, () => nextTick(syncReviews));
watch(() => progress?.reviewed.value, () => nextTick(syncReviews));
function onArticleClick(event: MouseEvent) {
  const reviewControl = (event.target as HTMLElement).closest<HTMLElement>('[data-manual-review-id]');
  if (reviewControl && articleBody.value?.contains(reviewControl)) {
    event.preventDefault();
    const id = reviewControl.dataset.manualReviewId;
    if (id) progress?.toggleReviewed(id);
    syncReviews();
    return;
  }
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-zoom-image]');
  const image = button?.querySelector<HTMLImageElement>('img');
  if (!button || !image) return;
  const caption = button.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '';
  lightboxImage.value = { src: image.currentSrc || image.src, alt: image.alt, caption };
  lightboxReturnFocus.value = button;
  lightbox.value?.showModal();
  void nextTick(() => lightbox.value?.querySelector<HTMLButtonElement>('button')?.focus());
}
function closeLightbox() {
  if (lightbox.value?.open) lightbox.value.close();
  void nextTick(() => {
    if (lightboxReturnFocus.value?.isConnected) lightboxReturnFocus.value.focus({ preventScroll: true });
    lightboxReturnFocus.value = null;
  });
}

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: `${copy.value.title} — GAZLL`,
  meta: [{ name: 'description', content: copy.value.excerpt }],
  link: [
    { rel: 'canonical', href: `https://gazll.github.io/${props.collection}/${props.slug}` }
  ],
  script: [{
    type: 'application/ld+json',
    innerHTML: safeJsonLd({
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
    <main id="view-host" tabindex="-1" class="view">
      <div :id="`${collection}-article`" :data-ui="`${collection}-article`" class="cs-article">
        <div :id="`${collection}-article-backbar`" data-ui="article-backbar" class="cs-backbar">
          <NuxtLink class="cs-back" :to="{ path: `/${collection}`, query: lang === 'vi' ? { lang } : {} }">← {{ labels.back }}</NuxtLink>
        </div>

        <header :id="`${collection}-article-header`" data-ui="article-header" class="cs-article-head">
          <p class="cs-eyebrow">{{ data.row.company || categoryLabel }} · {{ categoryLabel }}</p>
          <h1>{{ copy.title }}</h1>
          <p class="cs-deck">{{ copy.excerpt }}</p>
          <div class="cs-byline content-dates">
            <ContentDateStamp v-for="fact in dates" :key="fact.kind" :fact="fact" :lang="lang" />
            <span v-if="data.row.original_language" class="cs-language">{{ data.row.original_language.toUpperCase() }}</span>
          </div>
          <div class="cs-tags"><span v-for="tag in copy.tags || []" :key="tag">{{ tag }}</span></div>
          <div v-if="archive" class="cs-archive-note"><b>{{ archive.label }}</b><span>{{ archive.note }}</span></div>
        </header>

        <section v-if="overview" id="architecture-lens" class="cs-guide cs-architecture" aria-labelledby="cs-architecture-title">
          <header><p>{{ labels.architecture }}</p><h2 id="cs-architecture-title">{{ overview.title || labels.architecture }}</h2></header>
          <div class="cs-guide-brief"><article><p>{{ overview.lens }}</p></article></div>
          <ContentMermaidDiagram v-if="overview.diagram" :source="overview.diagram" :title="overview.title || labels.architecture" :lang="lang" />
        </section>

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

        <details v-if="headings.length" ref="mobileToc" :id="`${collection}-article-toc-mobile`" data-ui="article-toc-mobile" class="cs-toc-mobile">
          <summary><span>{{ labels.contents }}</span><span class="toc-current" aria-live="polite">{{ activeHeadingLabel }}</span></summary>
          <nav><a v-for="heading in headings" :key="heading.id" :href="`#${heading.id}`" :class="{ sub: heading.level === 3 }" :aria-current="activeHeadingId === heading.id ? 'location' : undefined" @click="closeMobileToc">{{ heading.text }}</a></nav>
        </details>
        <div :id="`${collection}-article-grid`" data-ui="article-grid" class="cs-article-grid" :class="{ 'is-toc-collapsed': tocCollapsed }">
          <aside :id="`${collection}-article-toc`" data-ui="article-toc" class="cs-toc" :class="{ 'is-collapsed': tocCollapsed }" :aria-label="labels.contents">
            <div class="cs-toc-head"><p>{{ labels.contents }}</p><button type="button" class="cs-toc-toggle" :aria-expanded="!tocCollapsed" @click="tocCollapsed = !tocCollapsed"><span aria-hidden="true">{{ tocCollapsed ? '›' : '‹' }}</span><span class="sr-only">Toggle contents</span></button></div>
            <div class="cs-toc-content" :hidden="tocCollapsed"><nav><a v-for="heading in headings" :key="heading.id" :href="`#${heading.id}`" :class="{ sub: heading.level === 3 }" :aria-current="activeHeadingId === heading.id ? 'location' : undefined">{{ heading.text }}</a></nav></div>
          </aside>
          <article :id="`${collection}-article-body`" data-ui="article-body" ref="articleBody" class="cs-article-body" @click="onArticleClick" v-html="decoratedBodyWithReviews" />
        </div>

        <footer v-if="creditHref" :id="`${collection}-article-source`" data-ui="article-source" class="cs-source">
          <span>{{ labels.source }}</span><a :href="creditHref" target="_blank" rel="noopener noreferrer">{{ data.row.company }} — {{ labels.original }} ↗</a>
        </footer>
        <dialog :id="`${collection}-lightbox`" data-ui="article-lightbox" ref="lightbox" class="cs-lightbox" :aria-label="lang === 'vi' ? 'Xem ảnh' : 'Image preview'" @click.self="closeLightbox" @cancel.prevent="closeLightbox">
          <button type="button" :aria-label="labels.close" @click="closeLightbox">×</button>
          <figure v-if="lightboxImage.src"><img :src="lightboxImage.src" :alt="lightboxImage.alt"><figcaption>{{ lightboxImage.caption }}</figcaption></figure>
        </dialog>
      </div>
    </main>
  </div>
</template>
