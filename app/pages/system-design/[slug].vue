<script setup lang="ts">
import { renderMarkdown } from '~/utils/markdown.js';
import { comparisonTable, emphasize, failureCards, list, proseParagraph, renderScope, tradeoffCards } from '~/utils/design-prose.js';
import { PROMPT_ORIGINS, REFERENCE_ORIGINS, originGuard } from '../../../public/lib/constants.js';
import { contentDateFacts } from '~/utils/content-dates.js';
import { safeDecodeURIComponent } from '~/utils/uri.js';
import { crossRefResolver, trackItemIds } from '../../../public/lib/cross-ref.js';
import { copyText } from '../../../public/lib/clipboard.js';

const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const slug = String(route.params.slug);
const { data, error } = await useAsyncData(`system-design:${slug}`, () => $fetch<any>(`/api/content/system-design/${slug}`));
if (error.value) throw error.value;
const design = computed(() => data.value.design);
const copy = computed(() => design.value[lang.value] || design.value.en || design.value.vi);
const labels = computed(() => lang.value === 'vi' ? {
  back: 'Thư viện System Design', toc: 'Trong bài này', scope: 'Phạm vi và bài toán', requirements: 'Yêu cầu',
  functional: 'Yêu cầu chức năng', quality: 'Thuộc tính chất lượng', capacity: 'Capacity và constraint',
  data: 'Data model', stack: 'Lựa chọn công nghệ', tradeoffs: 'Trade-off', code: 'Code samples',
  research: 'Engineering deep dives', migrated: 'Ghi chú đã chuyển', copy: 'Copy link', copied: 'Đã copy', source: 'Nguồn',
  diagramSource: 'Mermaid source có thể chỉnh sửa', failure: 'Failure review', further: 'Đọc thêm', architecture: 'Kiến trúc', blueprint: 'Blueprint', copyCode: 'Copy code', run: 'Chạy',
  plainText: 'text', articleContents: 'Nội dung bài viết', toggleContents: 'Bật/tắt mục lục', copyLinkPrompt: 'Copy link này', copyCodePrompt: 'Copy đoạn code này',
  dataIntro: 'So sánh record theo quyền sở hữu và trách nhiệm trước khi chọn storage. Mỗi record nên là authoritative, operational hoặc derived; trộn các vai trò này sẽ làm boundary consistency mơ hồ.',
  dataName: 'Record / model', dataRole: 'Fields, ownership và responsibility',
  dataChecksTitle: 'Compare models on',
  dataChecks: ['transaction boundary và invariant', 'read/write path và indexes', 'partition key và hot-key risk', 'retention, audit và privacy', 'rebuildability sau data loss'],
  stackIntro: 'Xem đây là bản đồ quyết định, không phải danh sách công nghệ. Mỗi component phải giải một constraint cụ thể và có operational cost rõ ràng.',
  stackLayer: 'Layer / option', stackReason: 'Choice, purpose và boundary',
  stackChecksTitle: 'Challenge mỗi choice bằng',
  stackChecks: ['simplest viable alternative', 'consistency và latency impact', 'failure/degraded mode', 'team/on-call capability', 'migration và exit trigger'],
  tradeoffIntro: 'Mỗi row là một tension mà design chấp nhận, không phải best practice đúng cho mọi hệ thống. Review cả hai phía và ghi điều kiện khiến decision phải đảo chiều.',
  failureReviewAnswered: 'Failure review — câu trả lời cho design này'
} : {
  back: 'System Design Library', toc: 'On this page', scope: 'Scope and problem framing', requirements: 'Requirements',
  functional: 'Functional requirements', quality: 'Quality attributes', capacity: 'Capacity and constraints',
  data: 'Data model', stack: 'Technology choices', tradeoffs: 'Trade-offs', code: 'Code samples',
  research: 'Engineering deep dives', migrated: 'Migrated deep-dive notes', copy: 'Copy link', copied: 'Copied', source: 'Source',
  diagramSource: 'Editable Mermaid source', failure: 'Failure review', further: 'Further reading', architecture: 'Architecture', blueprint: 'Blueprint', copyCode: 'Copy code', run: 'Run',
  plainText: 'text', articleContents: 'Article contents', toggleContents: 'Toggle contents', copyLinkPrompt: 'Copy this link', copyCodePrompt: 'Copy this code',
  dataIntro: 'Compare records by ownership and responsibility before choosing storage. A record is authoritative, operational or derived; mixing those roles creates unclear consistency boundaries.',
  dataName: 'Record / model', dataRole: 'Fields, ownership and responsibility',
  dataChecksTitle: 'Compare the models on',
  dataChecks: ['transaction boundary and invariant', 'read/write path and indexes', 'partition key and hot-key risk', 'retention, audit and privacy', 'whether it can be rebuilt after loss'],
  stackIntro: 'Treat this as a decision map, not a shopping list. Each component must solve a named constraint and carry an explicit operational cost.',
  stackLayer: 'Layer / option', stackReason: 'Choice, purpose and boundary',
  stackChecksTitle: 'Challenge every choice with',
  stackChecks: ['simplest viable alternative', 'consistency and latency impact', 'failure and degraded mode', 'team/on-call capability', 'migration and exit trigger'],
  tradeoffIntro: 'Each row is a tension the design accepts—not a universal best practice. Review both sides and record the condition that would reverse the decision.',
  failureReviewAnswered: 'Failure review — answers for this design'
});
/* Authored only. This used to fall back to synthesizing five questions and
   answering them with the first line of `quality` or `capacity` — text that
   read as a considered answer and was not one. `validate-content.mjs` now
   requires the field in both languages, so the fallback has no honest job. */
const failureReview = computed(() => copy.value.failure_review || []);
const sections = computed(() => [
  { id: 'problem-framing', title: labels.value.scope, show: copy.value.scope },
  { id: 'requirements', title: labels.value.requirements, show: copy.value.functional?.length || copy.value.quality?.length },
  { id: 'capacity-constraints', title: labels.value.capacity, show: copy.value.capacity?.length },
  { id: 'architecture', title: copy.value.diagram_title || labels.value.architecture, show: design.value.diagram },
  { id: 'data-model', title: labels.value.data, show: copy.value.data_model?.length },
  { id: 'technology-choices', title: labels.value.stack, show: copy.value.stack?.length },
  { id: 'code-samples', title: labels.value.code, show: copy.value.code_samples?.length },
  { id: 'tradeoffs-failure-review', title: labels.value.tradeoffs, show: copy.value.tradeoffs?.length },
  /* Its own anchor: every blueprint now ships an authored five-question review,
     and on a page this long it is what a reader jumps to, not scrolls to. */
  { id: 'failure-review', title: labels.value.failure, show: failureReview.value.length },
  { id: 'engineering-deep-dives', title: labels.value.research, show: data.value.research?.length },
  { id: 'migrated-notes', title: labels.value.migrated, show: data.value.sourceNotes?.length }
].filter(section => section.show));
const dates = computed(() => contentDateFacts(design.value, lang.value));
const sourceNotes = computed(() => (data.value.sourceNotes || []).map((row: any) => ({
  id: row.id, item: row[lang.value] || row.en || row.vi
})).filter((row: any) => row.item));
const research = computed(() => (data.value.research || []).map((pack: any) => ({
  ...pack, copy: pack[lang.value] || pack.en
})));
/* Decision rows stack name over structured detail and prose the author wrote
   as a list prints as one — see CLAUDE.md, the settled blueprint reading
   format. Rendering these strings raw is what reintroduces the wall of text. */
const scopeHtml = computed(() => renderScope(copy.value.scope));
const capacityHtml = computed(() => list(copy.value.capacity));
const functionalHtml = computed(() => list(copy.value.functional));
const qualityHtml = computed(() => list(copy.value.quality));
const dataModelHtml = computed(() => comparisonTable(
  copy.value.data_model, [labels.value.dataName, labels.value.dataRole], 'sd-data-decision-table'));
const stackHtml = computed(() => comparisonTable(
  copy.value.stack, [labels.value.stackLayer, labels.value.stackReason], 'sd-stack-decision-table'));
const tradeoffHtml = computed(() => tradeoffCards(copy.value.tradeoffs));
const failureHtml = computed(() => failureCards(failureReview.value));
const dataIntroHtml = computed(() => proseParagraph(labels.value.dataIntro, 'sd-section-intro'));
const stackIntroHtml = computed(() => proseParagraph(labels.value.stackIntro, 'sd-section-intro'));
const tradeoffIntroHtml = computed(() => proseParagraph(labels.value.tradeoffIntro, 'sd-section-intro'));

/* Outbound links have one allowlist owner (lib/constants.js). A blueprint's
   source_url is a discussion prompt, never an authority; research packs cite
   primary docs. Dropping the guard here would let a catalog edit link out to
   anywhere. */
const promptHref = originGuard(PROMPT_ORIGINS, '');
const researchHref = originGuard(REFERENCE_ORIGINS, '');
const blueprintSource = computed(() => promptHref(design.value.source_url || ''));

/* Blueprint figures are repository-owned assets only: a narrow allow-list stops
   a catalog edit turning the <img> or its full-size link into an external
   request or a path traversal. */
const DESIGN_IMAGE = /^assets\/system-design\/[a-z0-9][a-z0-9._/-]*\.(?:avif|jpe?g|png|webp)$/i;
const referenceImage = computed(() => {
  const image = design.value.reference_image;
  const src = String(image?.src || '');
  if (!DESIGN_IMAGE.test(src)) return null;
  const localized = image[lang.value] || image.en;
  if (!localized?.alt || !localized?.caption) return null;
  return {
    src, alt: localized.alt, captionHtml: emphasize(localized.caption),
    width: Number.isInteger(image.width) && image.width > 0 ? image.width : 1600,
    height: Number.isInteger(image.height) && image.height > 0 ? image.height : 900
  };
});

/* A migrated note cites the same written (item-id) references a topic answer
   does, so it resolves through the same owner — see lib/cross-ref.js. A bare
   "Q3" label names nothing; the target's own question does. */
const { data: index } = await useAsyncData('content-index', () => $fetch<any>('/api/content/item-index'));
const resolveRef = computed(() => crossRefResolver({
  questions: index.value?.items || {},
  onTrack: trackItemIds(index.value),
  owners: data.value?.sourceOwners || {},
  lang: lang.value
}));
const noteHtml = (markdown: string) => renderMarkdown(markdown, {
  resolveRef: resolveRef.value,
  headingPrefix: `design-${slug}`
});
const copiedNote = ref('');
const copiedCode = ref('');
const tocCollapsed = ref(false);
async function copyNoteLink(id: string) {
  const url = new URL(route.fullPath, window.location.origin);
  url.hash = `question-${id}`;
  try { await copyText(url.href); }
  catch { window.prompt(labels.value.copyLinkPrompt, url.href); }
  copiedNote.value = id;
  window.setTimeout(() => { if (copiedNote.value === id) copiedNote.value = ''; }, 1600);
}
async function copyCodeSample(sample: any) {
  try { await copyText(sample.code || ''); }
  catch { window.prompt(labels.value.copyCodePrompt, sample.code || ''); }
  copiedCode.value = sample.title;
  window.setTimeout(() => { if (copiedCode.value === sample.title) copiedCode.value = ''; }, 1600);
}
function revealHash() {
  const id = safeDecodeURIComponent(String(route.hash || '').replace(/^#/, ''));
  if (!id) return;
  nextTick(() => {
    const target = document.getElementById(id);
    const details = target?.closest('details');
    if (details) details.open = true;
    target?.scrollIntoView({ block: 'start' });
  });
}
onMounted(() => {
  tocCollapsed.value = localStorage.getItem('gazll:system-design-toc') === 'collapsed';
  revealHash();
});
watch(tocCollapsed, value => { if (import.meta.client) localStorage.setItem('gazll:system-design-toc', value ? 'collapsed' : 'open'); });
watch(() => route.hash, revealHash);
useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: `${copy.value.title} — GAZLL`,
  meta: [{ name: 'description', content: copy.value.excerpt || copy.value.scope }],
  link: [
    { rel: 'canonical', href: `https://gazll.github.io/system-design/${slug}` }
  ],
  script: [{ type: 'application/ld+json', innerHTML: JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article', headline: copy.value.title,
    description: copy.value.excerpt || copy.value.scope, datePublished: design.value.created_at,
    dateModified: design.value.updated_at || design.value.created_at, inLanguage: lang.value
  }) }]
}));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" tabindex="-1" class="view">
      <article class="sd-article" :class="{ 'toc-collapsed': tocCollapsed }">
        <div class="sd-backbar"><NuxtLink class="cs-back" :to="{ path: '/system-design', query: lang === 'vi' ? { lang: 'vi' } : {} }">← {{ labels.back }}</NuxtLink></div>
        <header class="sd-article-head">
          <p class="cs-eyebrow">{{ labels.blueprint }} · {{ design.level }} · {{ design.effort }}</p>
          <h1>{{ copy.title }}</h1>
          <p class="intro">{{ copy.scope || copy.excerpt }}</p>
          <div class="content-dates"><ContentDateStamp v-for="fact in dates" :key="fact.kind" :fact="fact" :lang="lang" /></div>
          <div class="cs-tags"><span v-for="tag in copy.tags || []" :key="tag">{{ tag }}</span></div>
          <p v-if="blueprintSource" class="sd-blueprint-source"><span>{{ labels.source }}</span><a :href="blueprintSource" target="_blank" rel="noopener noreferrer">{{ copy.source_label || design.source_label || labels.source }} ↗</a></p>
        </header>
        <details class="sd-toc-mobile"><summary>{{ labels.toc }}</summary><nav><a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ section.title }}</a></nav></details>
        <div class="sd-article-grid">
          <aside class="sd-toc" :aria-label="labels.articleContents">
            <div class="sd-toc-head"><p>{{ labels.toc }}</p><button type="button" class="sd-toc-toggle" :aria-expanded="!tocCollapsed" @click="tocCollapsed = !tocCollapsed"><span aria-hidden="true" /><span class="sr-only">{{ labels.toggleContents }}</span></button></div>
            <nav><a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ section.title }}</a></nav>
          </aside>
          <div class="sd-article-body">
            <section id="problem-framing" class="sd-section sd-scope"><h2>{{ labels.scope }}</h2><div v-html="scopeHtml" /></section>
            <section id="requirements" class="sd-section sd-requirements"><h2>{{ labels.requirements }}</h2><div>
              <article><h3>{{ labels.functional }}</h3><div v-html="functionalHtml" /></article>
              <article><h3>{{ labels.quality }}</h3><div v-html="qualityHtml" /></article>
            </div></section>
            <section id="capacity-constraints" class="sd-section capacity-constraints"><h2>{{ labels.capacity }}</h2><div v-html="capacityHtml" /></section>
            <figure v-if="referenceImage" class="sd-reference-figure">
              <a :href="`/${referenceImage.src}`" target="_blank" rel="noopener noreferrer"><img :src="`/${referenceImage.src}`" :alt="referenceImage.alt" :width="referenceImage.width" :height="referenceImage.height" loading="lazy" decoding="async"></a>
              <figcaption v-html="referenceImage.captionHtml" />
            </figure>
            <section v-if="design.diagram" id="architecture" class="sd-section">
              <h2>{{ copy.diagram_title || labels.architecture }}</h2>
              <ContentMermaidDiagram :source="design.diagram" :title="copy.diagram_title" :lang="lang" />
              <details class="sd-mermaid-source"><summary>{{ labels.diagramSource }}</summary><pre><code>{{ design.diagram }}</code></pre></details>
            </section>
            <section id="data-model" class="sd-section sd-decision-section sd-data-decision"><h2>{{ labels.data }}</h2><div v-html="dataIntroHtml" /><div v-html="dataModelHtml" /><aside class="sd-decision-checks"><strong>{{ labels.dataChecksTitle }}</strong><ul><li v-for="check in labels.dataChecks" :key="check">{{ check }}</li></ul></aside></section>
            <section id="technology-choices" class="sd-section sd-decision-section sd-stack-decision"><h2>{{ labels.stack }}</h2><div v-html="stackIntroHtml" /><div v-html="stackHtml" /><aside class="sd-decision-checks"><strong>{{ labels.stackChecksTitle }}</strong><ul><li v-for="check in labels.stackChecks" :key="check">{{ check }}</li></ul></aside></section>
            <section v-if="copy.code_samples?.length" id="code-samples" class="sd-section sd-code-samples"><h2>{{ labels.code }}</h2><div class="sd-code-grid">
              <article v-for="sample in copy.code_samples" :key="sample.title" class="sd-code-sample"><header><div><h3>{{ sample.title }}</h3><p v-if="sample.note">{{ sample.note }}</p></div><span>{{ sample.language || labels.plainText }}</span></header><div class="sd-code-frame"><button type="button" @click="copyCodeSample(sample)">{{ copiedCode === sample.title ? labels.copied : labels.copyCode }}</button><pre><code>{{ sample.code }}</code></pre></div><p v-if="sample.run" class="sd-code-run"><b>{{ labels.run }}</b><code>{{ sample.run }}</code></p></article>
            </div></section>
            <section id="tradeoffs-failure-review" class="sd-section sd-tradeoff-review"><h2>{{ labels.tradeoffs }}</h2><div v-html="tradeoffIntroHtml" /><div class="sd-tradeoff-list" v-html="tradeoffHtml" />
              <aside id="failure-review" class="sd-failure-review"><strong>{{ labels.failureReviewAnswered }}</strong><div v-html="failureHtml" /></aside>
            </section>
            <section v-if="research.length" id="engineering-deep-dives" class="sd-section sd-research"><h2>{{ labels.research }}</h2><section v-for="pack in research" :key="pack.id" class="sd-research-pack"><header><h3>{{ pack.copy.title }}</h3><p>{{ pack.copy.intro }}</p></header><div class="sd-research-grid"><article v-for="part in pack.copy.sections" :key="part.title"><h3>{{ part.title }}</h3><ul><li v-for="item in part.items" :key="item">{{ item }}</li></ul></article></div><footer><strong>{{ labels.further }}</strong><template v-for="source in pack.sources" :key="source[1]"><a v-if="researchHref(source[1])" :href="researchHref(source[1])" target="_blank" rel="noopener noreferrer">{{ source[0] }} ↗</a></template></footer></section></section>
            <section v-if="sourceNotes.length" id="migrated-notes" class="sd-section sd-notes"><h2>{{ labels.migrated }}</h2><p>{{ copy.migrated_note || (lang === 'vi' ? 'Các deep dive này được chuyển từ Study Track và giữ nguyên ID để bookmark, progress và cross-reference tiếp tục hoạt động.' : 'These deep dives moved from Study Track and retain their IDs so bookmarks, progress and cross-references keep working.') }}</p><details v-for="note in sourceNotes" :id="`question-${note.id}`" :key="note.id"><summary><span>{{ note.item.q }}</span><code>{{ note.id }}</code></summary><div><div class="sd-note-actions"><button type="button" @click="copyNoteLink(note.id)">{{ copiedNote === note.id ? labels.copied : labels.copy }}</button></div><div v-html="noteHtml(note.item.a)" /></div></details></section>
          </div>
        </div>
      </article>
    </main>
  </div>
</template>
