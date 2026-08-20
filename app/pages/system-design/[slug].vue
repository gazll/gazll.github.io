<script setup lang="ts">
import { renderMarkdown } from '~/utils/markdown.js';
import { contentDateFacts } from '~/utils/content-dates.js';
import { safeDecodeURIComponent } from '~/utils/uri.js';

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
  data: 'Data model', stack: 'Lựa chọn công nghệ', tradeoffs: 'Trade-off và failure review', code: 'Code samples',
  research: 'Engineering deep dives', migrated: 'Ghi chú đã chuyển', copy: 'Copy link', copied: 'Đã copy', source: 'Nguồn',
  diagramSource: 'Mermaid source có thể chỉnh sửa', failure: 'Failure review', further: 'Đọc thêm', architecture: 'Kiến trúc', blueprint: 'Blueprint', copyCode: 'Copy code', run: 'Chạy',
  plainText: 'text', articleContents: 'Nội dung bài viết', toggleContents: 'Bật/tắt mục lục', copyLinkPrompt: 'Copy link này', copyCodePrompt: 'Copy đoạn code này'
} : {
  back: 'System Design Library', toc: 'On this page', scope: 'Scope and problem framing', requirements: 'Requirements',
  functional: 'Functional requirements', quality: 'Quality attributes', capacity: 'Capacity and constraints',
  data: 'Data model', stack: 'Technology choices', tradeoffs: 'Trade-offs and failure review', code: 'Code samples',
  research: 'Engineering deep dives', migrated: 'Migrated deep-dive notes', copy: 'Copy link', copied: 'Copied', source: 'Source',
  diagramSource: 'Editable Mermaid source', failure: 'Failure review', further: 'Further reading', architecture: 'Architecture', blueprint: 'Blueprint', copyCode: 'Copy code', run: 'Run',
  plainText: 'text', articleContents: 'Article contents', toggleContents: 'Toggle contents', copyLinkPrompt: 'Copy this link', copyCodePrompt: 'Copy this code'
});
const sections = computed(() => [
  { id: 'problem-framing', title: labels.value.scope, show: copy.value.scope },
  { id: 'requirements', title: labels.value.requirements, show: copy.value.functional?.length || copy.value.quality?.length },
  { id: 'capacity-constraints', title: labels.value.capacity, show: copy.value.capacity?.length },
  { id: 'architecture', title: copy.value.diagram_title || labels.value.architecture, show: design.value.diagram },
  { id: 'data-model', title: labels.value.data, show: copy.value.data_model?.length },
  { id: 'technology-choices', title: labels.value.stack, show: copy.value.stack?.length },
  { id: 'code-samples', title: labels.value.code, show: copy.value.code_samples?.length },
  { id: 'tradeoffs-failure-review', title: labels.value.tradeoffs, show: copy.value.tradeoffs?.length },
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
const failureReview = computed(() => {
  if (copy.value.failure_review?.length) return copy.value.failure_review;
  const pools = [copy.value.quality, copy.value.capacity, copy.value.stack, copy.value.data_model, copy.value.tradeoffs];
  const questions = lang.value === 'vi'
    ? ['Invariant nào phải luôn đúng?', 'Đo saturation bằng gì?', 'Failure domain được cô lập thế nào?', 'Retry/dedup giữ correctness ra sao?', 'Recovery và reconciliation hoạt động thế nào?']
    : ['Which invariant must always hold?', 'How is saturation measured?', 'How are failure domains isolated?', 'How do retry and dedup preserve correctness?', 'How do recovery and reconciliation work?'];
  return questions.map((question, index) => ({ question, answer: pools[index]?.[0] || copy.value.tradeoffs?.[index] || copy.value.scope }));
});
const refRoute = (id: string) => {
  const owner = data.value.sourceOwners?.[id];
  return owner ? `/system-design/${owner}#question-${encodeURIComponent(id)}` : `/topics/${id.split('.')[0]}#question-${encodeURIComponent(id)}`;
};
const noteHtml = (markdown: string) => renderMarkdown(markdown, {
  resolveRef: (id: string) => ({ href: refRoute(id), label: `Q${/\.q(\d+)$/.exec(id)?.[1] || ''}` }),
  headingPrefix: `design-${slug}`
});
const copiedNote = ref('');
const copiedCode = ref('');
const tocCollapsed = ref(false);
async function copyNoteLink(id: string) {
  const url = new URL(route.fullPath, window.location.origin);
  url.hash = `question-${id}`;
  try { await navigator.clipboard.writeText(url.href); }
  catch { window.prompt(labels.value.copyLinkPrompt, url.href); }
  copiedNote.value = id;
  window.setTimeout(() => { if (copiedNote.value === id) copiedNote.value = ''; }, 1600);
}
async function copyCodeSample(sample: any) {
  try { await navigator.clipboard.writeText(sample.code || ''); }
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
    { rel: 'stylesheet', href: '/styles.css' },
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
    <main id="view-host" class="view">
      <article class="sd-article" :class="{ 'toc-collapsed': tocCollapsed }">
        <div class="sd-backbar"><NuxtLink class="cs-back" :to="{ path: '/system-design', query: lang === 'vi' ? { lang: 'vi' } : {} }">← {{ labels.back }}</NuxtLink></div>
        <header class="sd-article-head">
          <p class="cs-eyebrow">{{ labels.blueprint }} · {{ design.level }} · {{ design.effort }}</p>
          <h1>{{ copy.title }}</h1>
          <p class="intro">{{ copy.scope || copy.excerpt }}</p>
          <div class="content-dates"><time v-for="fact in dates" :key="fact.kind" :datetime="fact.value">{{ fact.label }} {{ fact.formatted }}</time></div>
          <div class="cs-tags"><span v-for="tag in copy.tags || []" :key="tag">{{ tag }}</span></div>
          <p v-if="design.source_url" class="sd-blueprint-source"><span>{{ labels.source }}</span><a :href="design.source_url" target="_blank" rel="noopener noreferrer">{{ copy.source_label || design.source_label || labels.source }} ↗</a></p>
        </header>
        <details class="sd-toc-mobile"><summary>{{ labels.toc }}</summary><nav><a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ section.title }}</a></nav></details>
        <div class="sd-article-grid">
          <aside class="sd-toc" :aria-label="labels.articleContents">
            <div class="sd-toc-head"><p>{{ labels.toc }}</p><button type="button" class="sd-toc-toggle" :aria-expanded="!tocCollapsed" @click="tocCollapsed = !tocCollapsed"><span aria-hidden="true" /><span class="sr-only">{{ labels.toggleContents }}</span></button></div>
            <nav><a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ section.title }}</a></nav>
          </aside>
          <div class="sd-article-body">
            <section id="problem-framing" class="sd-section sd-scope"><h2>{{ labels.scope }}</h2><p>{{ copy.scope }}</p></section>
            <section id="requirements" class="sd-section sd-requirements"><h2>{{ labels.requirements }}</h2><div>
              <article><h3>{{ labels.functional }}</h3><ul><li v-for="row in copy.functional" :key="row">{{ row }}</li></ul></article>
              <article><h3>{{ labels.quality }}</h3><ul><li v-for="row in copy.quality" :key="row">{{ row }}</li></ul></article>
            </div></section>
            <section id="capacity-constraints" class="sd-section"><h2>{{ labels.capacity }}</h2><ul><li v-for="row in copy.capacity" :key="row">{{ row }}</li></ul></section>
            <figure v-if="design.reference_image" class="sd-reference-figure">
              <a :href="`/${design.reference_image.src}`" target="_blank" rel="noopener noreferrer"><img :src="`/${design.reference_image.src}`" :alt="(design.reference_image[lang] || design.reference_image.en).alt"></a>
              <figcaption>{{ (design.reference_image[lang] || design.reference_image.en).caption }}</figcaption>
            </figure>
            <section v-if="design.diagram" id="architecture" class="sd-section">
              <h2>{{ copy.diagram_title || labels.architecture }}</h2>
              <ContentMermaidDiagram :source="design.diagram" :title="copy.diagram_title" :lang="lang" />
              <details class="sd-mermaid-source"><summary>{{ labels.diagramSource }}</summary><pre><code>{{ design.diagram }}</code></pre></details>
            </section>
            <section id="data-model" class="sd-section sd-decision-section"><h2>{{ labels.data }}</h2><div class="sd-decision-rows"><div v-for="(row, index) in copy.data_model" :key="row" class="sd-decision-row"><p class="sd-decision-name"><span>{{ index + 1 }}</span>{{ row }}</p></div></div></section>
            <section id="technology-choices" class="sd-section sd-decision-section"><h2>{{ labels.stack }}</h2><div class="sd-decision-rows"><div v-for="(row, index) in copy.stack" :key="row" class="sd-decision-row"><p class="sd-decision-name"><span>{{ index + 1 }}</span>{{ row }}</p></div></div></section>
            <section v-if="copy.code_samples?.length" id="code-samples" class="sd-section sd-code-samples"><h2>{{ labels.code }}</h2><div class="sd-code-grid">
              <article v-for="sample in copy.code_samples" :key="sample.title" class="sd-code-sample"><header><div><h3>{{ sample.title }}</h3><p v-if="sample.note">{{ sample.note }}</p></div><span>{{ sample.language || labels.plainText }}</span></header><div class="sd-code-frame"><button type="button" @click="copyCodeSample(sample)">{{ copiedCode === sample.title ? labels.copied : labels.copyCode }}</button><pre><code>{{ sample.code }}</code></pre></div><p v-if="sample.run" class="sd-code-run"><b>{{ labels.run }}</b><code>{{ sample.run }}</code></p></article>
            </div></section>
            <section id="tradeoffs-failure-review" class="sd-section sd-tradeoff-review"><h2>{{ labels.tradeoffs }}</h2><div class="sd-tradeoff-list"><article v-for="(row, index) in copy.tradeoffs" :key="row"><span>{{ index + 1 }}</span><div><strong>{{ row }}</strong></div></article></div>
              <aside class="sd-failure-review"><strong>{{ labels.failure }}</strong><div><article v-for="(entry, index) in failureReview" :key="entry.question"><span>{{ index + 1 }}</span><div><h3>{{ entry.question }}</h3><p>{{ entry.answer }}</p></div></article></div></aside>
            </section>
            <section v-if="research.length" id="engineering-deep-dives" class="sd-section sd-research"><h2>{{ labels.research }}</h2><section v-for="pack in research" :key="pack.id" class="sd-research-pack"><header><h3>{{ pack.copy.title }}</h3><p>{{ pack.copy.intro }}</p></header><div class="sd-research-grid"><article v-for="part in pack.copy.sections" :key="part.title"><h3>{{ part.title }}</h3><ul><li v-for="item in part.items" :key="item">{{ item }}</li></ul></article></div><footer><strong>{{ labels.further }}</strong><a v-for="source in pack.sources" :key="source[1]" :href="source[1]" target="_blank" rel="noopener noreferrer">{{ source[0] }} ↗</a></footer></section></section>
            <section v-if="sourceNotes.length" id="migrated-notes" class="sd-section sd-notes"><h2>{{ labels.migrated }}</h2><p>{{ copy.migrated_note || (lang === 'vi' ? 'Các deep dive này được chuyển từ Study Track và giữ nguyên ID để bookmark, progress và cross-reference tiếp tục hoạt động.' : 'These deep dives moved from Study Track and retain their IDs so bookmarks, progress and cross-references keep working.') }}</p><details v-for="note in sourceNotes" :id="`question-${note.id}`" :key="note.id"><summary><span>{{ note.item.q }}</span><code>{{ note.id }}</code></summary><div><div class="sd-note-actions"><button type="button" @click="copyNoteLink(note.id)">{{ copiedNote === note.id ? labels.copied : labels.copy }}</button></div><div v-html="noteHtml(note.item.a)" /></div></details></section>
          </div>
        </div>
      </article>
    </main>
  </div>
</template>
