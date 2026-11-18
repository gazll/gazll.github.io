<script setup lang="ts">
import { renderMarkdown } from '~/utils/markdown.js';

const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const slug = String(route.params.slug);
const { data, error } = await useAsyncData(`presentation:${slug}`, () => $fetch<any>(`/api/content/presentations/${slug}`));
if (error.value) throw error.value;

const REPO = 'https://github.com/gazll/gazll.github.io';
const topic = computed(() => data.value!.topic);
const editLink = computed(() => data.value!.written
  ? `${REPO}/edit/main/public/data/presentations/talks/${slug}.md`
  : `${REPO}/new/main/public/data/presentations/talks?filename=${slug}.md`);
const labels = computed(() => lang.value === 'vi' ? {
  back: 'Tất cả bài thuyết trình', current: 'Công việc hiện tại', new: 'Công nghệ mới',
  open: 'Còn trống', preparing: 'Đang chuẩn bị', done: 'Đã trình bày',
  agenda: 'Bài này trả lời', contents: 'Mục lục', intro: 'Mở đầu',
  draft: 'Chưa có bài viết. Phần trên là những gì bài này cần trả lời.', write: 'Viết bài này', edit: 'Sửa bài này'
} : {
  back: 'All presentations', current: 'Current work', new: 'New tech',
  open: 'Open', preparing: 'Preparing', done: 'Presented',
  agenda: 'This talk answers', contents: 'Contents', intro: 'Introduction',
  draft: 'No talk written yet. The list above is what it needs to answer.', write: 'Write this talk', edit: 'Edit this talk'
});
const dateLabel = computed(() => topic.value.date
  ? new Intl.DateTimeFormat(lang.value === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'long' }).format(new Date(`${topic.value.date}T12:00:00`))
  : '');
const sections = computed(() => (data.value!.sections as any[]).map(section => ({
  ...section,
  label: section.title || labels.value.intro,
  blocks: section.blocks.map((block: any) => block.kind === 'md'
    ? { ...block, html: renderMarkdown(block.text, { headingPrefix: section.id }) }
    : block)
})));
const toc = computed(() => [['talk-agenda', labels.value.agenda], ...sections.value.map(section => [section.id, section.label])]);

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: `${topic.value.title} — GAZLL`,
  meta: [{ name: 'description', content: topic.value.outline.join(' · ') }],
  link: [{ rel: 'canonical', href: `https://gazll.github.io/presentations/${slug}` }]
}));
</script>

<template>
  <div><ContentHeader :lang="lang" /><main id="view-host" tabindex="-1" class="view"><div class="pj-shell pj-article pt-talk" :data-kind="topic.kind">
    <div class="sd-backbar"><NuxtLink class="pj-back" :to="{ path: '/presentations', query: lang === 'vi' ? { lang } : {} }">← {{ labels.back }}</NuxtLink></div>
    <header class="pj-head">
      <p class="pj-eyebrow"><span class="pt-kind">{{ labels[topic.kind as 'current'] }}</span> · {{ labels[topic.status as 'open'] }}</p>
      <h1>{{ topic.title }}</h1>
      <div class="pj-meta"><span v-if="topic.presenter"><b>{{ topic.presenter }}</b></span><span v-if="dateLabel"><time :datetime="topic.date">{{ dateLabel }}</time></span></div>
    </header>
    <details class="pj-toc-mobile"><summary><span>{{ labels.contents }}</span></summary><nav><a v-for="entry in toc" :key="entry[0]" :href="`#${entry[0]}`">{{ entry[1] }}</a></nav></details>
    <div class="pj-grid">
      <aside class="pj-toc"><p>{{ labels.contents }}</p><nav><a v-for="entry in toc" :key="entry[0]" :href="`#${entry[0]}`">{{ entry[1] }}</a></nav></aside>
      <article class="pj-body">
        <section id="talk-agenda" class="pj-section">
          <h2><a class="pj-heading-anchor" href="#talk-agenda">{{ labels.agenda }}</a></h2>
          <ol class="pt-agenda"><li v-for="line in topic.outline" :key="line">{{ line }}</li></ol>
          <p v-if="!data!.written" class="pt-empty">{{ labels.draft }}</p>
        </section>
        <section v-for="section in sections" :id="section.id" :key="section.id" class="pj-section">
          <h2 v-if="section.title"><a class="pj-heading-anchor" :href="`#${section.id}`">{{ section.title }}</a></h2>
          <template v-for="(block, index) in section.blocks" :key="index">
            <div v-if="block.kind === 'md'" class="pj-doc-body pt-md" v-html="block.html" />
            <ContentMermaidDiagram v-else :source="block.text" :title="section.label" :lang="lang" />
          </template>
        </section>
        <p class="pt-actions"><a class="pt-action" :href="editLink" target="_blank" rel="noopener noreferrer">{{ data!.written ? labels.edit : labels.write }} ↗</a></p>
      </article>
    </div>
  </div></main></div>
</template>
