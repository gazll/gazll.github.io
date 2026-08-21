<script setup lang="ts">
import { renderMarkdown } from '~/utils/markdown.js';
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData('release-notes', () => $fetch<any>('/api/content/releases'));
const days = computed(() => {
  const groups = new Map<string, any[]>();
  for (const release of data.value.releases || []) (groups.get(release.date) || (groups.set(release.date, []), groups.get(release.date)!)).push(release);
  return [...groups.entries()].map(([date, releases]) => ({
    date, releases, itemsAdded: releases.reduce((sum, release) => sum + (Number(release.items_added) || 0), 0),
    changeCount: releases.reduce((sum, release) => sum + (release.changes || []).length, 0)
  }));
});
const dateLabel = (value: string) => new Intl.DateTimeFormat(lang.value === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`));
const labels = computed(() => lang.value === 'vi' ? {
  eyebrow: 'Những gì đã thay đổi', title: 'Ghi chú phát hành', intro: 'Nội dung và tính năng mới nhất, theo thứ tự thời gian.',
  questions: 'câu hỏi mới', release: 'bản phát hành', releases: 'bản phát hành', change: 'thay đổi', changes: 'thay đổi',
  kinds: { topic: 'Chủ đề', content: 'Nội dung', feature: 'Tính năng', change: 'Thay đổi', fix: 'Sửa lỗi' }
} : {
  eyebrow: 'What changed', title: 'Release Notes', intro: 'The latest content and product changes, newest first.',
  questions: 'new questions', release: 'release', releases: 'releases', change: 'change', changes: 'changes',
  kinds: { topic: 'Topic', content: 'Content', feature: 'Feature', change: 'Change', fix: 'Fix' }
});
useHead(() => ({ htmlAttrs: { lang: lang.value }, title: `${labels.value.title} — GAZLL`, meta: [{ name: 'description', content: labels.value.intro }], link: [{ rel: 'canonical', href: 'https://gazll.github.io/release-notes' }] }));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" tabindex="-1" class="view"><div class="page rn-page">
      <header><p class="eyebrow">{{ labels.eyebrow }}</p><h1>{{ labels.title }}</h1><p class="rn-intro">{{ labels.intro }}</p></header>
      <div class="rn-body"><section v-for="day in days" :key="day.date" class="rn-day"><header class="rn-dayhead"><time class="rn-date" :datetime="day.date">{{ dateLabel(day.date) }}</time><span v-if="day.releases.length > 1" class="rn-daymeta">{{ day.releases.length }} {{ day.releases.length === 1 ? labels.release : labels.releases }} · {{ day.changeCount }} {{ day.changeCount === 1 ? labels.change : labels.changes }}</span><span v-if="day.itemsAdded" class="rn-added">{{ day.itemsAdded }} {{ labels.questions }}</span></header>
        <section v-for="release in day.releases" :key="release.en.title" class="rn-rel"><header class="rn-relhead"><h2 class="rn-title">{{ release[lang]?.title || release.en.title }}</h2><span v-if="release.items_added" class="rn-added">{{ release.items_added }} {{ labels.questions }}</span></header><ul class="rn-changes"><li v-for="change in release.changes" :key="change[lang]?.text || change.en.text" class="rn-change" :class="`rn-k-${change.kind}`"><div class="rn-cmeta"><span class="rn-kind" :data-kind="change.kind">{{ labels.kinds[change.kind] || change.kind }}</span><span v-if="change.target" class="rn-target">{{ change.target }}</span></div><div class="rn-text" v-html="renderMarkdown(change[lang]?.text || change.en.text)" /></li></ul></section>
      </section></div>
    </div></main>
  </div>
</template>
