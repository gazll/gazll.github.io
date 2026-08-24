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
const totals = computed(() => {
  const releases = data.value?.releases || [];
  return {
    releases: releases.length,
    changes: releases.reduce((sum, release) => sum + (release.changes || []).length, 0),
    items: releases.reduce((sum, release) => sum + (Number(release.items_added) || 0), 0)
  };
});
const yearFilter = ref('all');
const kindFilter = ref('all');
const yearOptions = computed(() => [...new Set((data.value?.releases || []).map((release: any) => String(release.date).slice(0, 4)))].sort((a, b) => Number(b) - Number(a)));
const kindOptions = computed(() => {
  const present = new Set((data.value?.releases || []).flatMap((release: any) => (release.changes || []).map((change: any) => change.kind)));
  return ['topic', 'content', 'feature', 'change', 'fix'].filter(kind => present.has(kind));
});
const filteredDays = computed(() => days.value.map(day => {
  if (yearFilter.value !== 'all' && !day.date.startsWith(yearFilter.value)) return null;
  const releases = day.releases.map((release: any) => ({
    ...release,
    changes: kindFilter.value === 'all'
      ? release.changes
      : (release.changes || []).filter((change: any) => change.kind === kindFilter.value)
  })).filter((release: any) => release.changes.length || kindFilter.value === 'all');
  if (!releases.length) return null;
  return {
    ...day,
    releases,
    itemsAdded: kindFilter.value === 'all' ? releases.reduce((sum: number, release: any) => sum + (Number(release.items_added) || 0), 0) : 0,
    changeCount: releases.reduce((sum: number, release: any) => sum + release.changes.length, 0)
  };
}).filter(Boolean));
const filteredSummary = computed(() => {
  const summary = { days: filteredDays.value.length, releases: 0, changes: 0 };
  for (const day of filteredDays.value as any[]) {
    summary.releases += day.releases.length;
    summary.changes += day.changeCount;
  }
  return summary;
});
const hasReleaseFilters = computed(() => yearFilter.value !== 'all' || kindFilter.value !== 'all');
function clearReleaseFilters() {
  yearFilter.value = 'all';
  kindFilter.value = 'all';
}
const dateLabel = (value: string) => new Intl.DateTimeFormat(lang.value === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`));
const labels = computed(() => lang.value === 'vi' ? {
  eyebrow: 'Những gì đã thay đổi', title: 'Ghi chú phát hành', intro: 'Nội dung và tính năng mới nhất, theo thứ tự thời gian.',
  questions: 'câu hỏi mới', release: 'bản phát hành', releases: 'bản phát hành', change: 'thay đổi', changes: 'thay đổi', day: 'ngày',
  showing: 'Đang hiển thị',
  summary: 'Tóm tắt phát hành',
  filterBy: 'Lọc nhật ký', year: 'Năm', kind: 'Loại', allYears: 'Tất cả năm', allKinds: 'Tất cả loại', clearFilters: 'Xoá bộ lọc', noMatches: 'Không có thay đổi phù hợp.', days: 'ngày',
  kinds: { topic: 'Chủ đề', content: 'Nội dung', feature: 'Tính năng', change: 'Thay đổi', fix: 'Sửa lỗi' }
} : {
  eyebrow: 'What changed', title: 'Release Notes', intro: 'The latest content and product changes, newest first.',
  questions: 'new questions', release: 'release', releases: 'releases', change: 'change', changes: 'changes', day: 'day',
  showing: 'Showing',
  summary: 'Release summary',
  filterBy: 'Filter archive', year: 'Year', kind: 'Kind', allYears: 'All years', allKinds: 'All kinds', clearFilters: 'Clear filters', noMatches: 'No changes match these filters.', days: 'days',
  kinds: { topic: 'Topic', content: 'Content', feature: 'Feature', change: 'Change', fix: 'Fix' }
});
useHead(() => ({ htmlAttrs: { lang: lang.value }, title: `${labels.value.title} — GAZLL`, meta: [{ name: 'description', content: labels.value.intro }], link: [{ rel: 'canonical', href: 'https://gazll.github.io/release-notes' }] }));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" tabindex="-1" class="view"><div id="release-notes-page" data-ui="release-notes-page" class="page rn-page">
      <header id="release-notes-header" data-ui="release-notes-header" class="rn-head">
        <div class="rn-head-copy"><p class="eyebrow">{{ labels.eyebrow }}</p><h1>{{ labels.title }}</h1><p class="rn-intro">{{ labels.intro }}</p></div>
        <div id="release-notes-summary" data-ui="release-summary" class="rn-summary" :aria-label="labels.summary">
          <span><b>{{ totals.releases }}</b> {{ totals.releases === 1 ? labels.release : labels.releases }}</span>
          <span><b>{{ totals.changes }}</b> {{ totals.changes === 1 ? labels.change : labels.changes }}</span>
          <span><b>{{ totals.items }}</b> {{ labels.questions }}</span>
        </div>
        <div id="release-notes-filters" data-ui="release-filters" class="rn-filters" :aria-label="labels.filterBy">
          <span class="rn-filter-title">{{ labels.filterBy }}</span>
          <div class="rn-filter-controls">
            <label class="rn-filter-field" for="release-year-filter"><span>{{ labels.year }}</span><select id="release-year-filter" v-model="yearFilter"><option value="all">{{ labels.allYears }}</option><option v-for="year in yearOptions" :key="year" :value="year">{{ year }}</option></select></label>
            <label class="rn-filter-field" for="release-kind-filter"><span>{{ labels.kind }}</span><select id="release-kind-filter" v-model="kindFilter"><option value="all">{{ labels.allKinds }}</option><option v-for="kind in kindOptions" :key="kind" :value="kind">{{ labels.kinds[kind] || kind }}</option></select></label>
            <button class="rn-filter-clear" type="button" :disabled="!hasReleaseFilters" @click="clearReleaseFilters">{{ labels.clearFilters }}</button>
          </div>
        </div>
      </header>
      <p id="release-notes-filter-summary" data-ui="release-filter-summary" class="rn-filter-summary"><span>{{ labels.showing }}</span> <b>{{ filteredSummary.days }}</b> {{ filteredSummary.days === 1 ? labels.day : labels.days }} · <b>{{ filteredSummary.releases }}</b> {{ filteredSummary.releases === 1 ? labels.release : labels.releases }} · <b>{{ filteredSummary.changes }}</b> {{ filteredSummary.changes === 1 ? labels.change : labels.changes }}</p>
      <p id="release-notes-filter-status" class="sr-only" aria-live="polite">{{ labels.showing }} {{ filteredSummary.days }} {{ filteredSummary.days === 1 ? labels.day : labels.days }}, {{ filteredSummary.changes }} {{ filteredSummary.changes === 1 ? labels.change : labels.changes }}</p>
      <p v-if="!filteredDays.length" id="release-notes-empty" data-ui="release-empty" class="rn-empty" role="status">
        <span>{{ labels.noMatches }}</span>
        <button v-if="hasReleaseFilters" class="rn-empty-clear" type="button" @click="clearReleaseFilters">{{ labels.clearFilters }}</button>
      </p>
      <div v-else id="release-notes-list" data-ui="release-list" class="rn-body"><section v-for="day in filteredDays" :id="`release-day-${day.date}`" :key="day.date" data-ui="release-day" :data-date="day.date" class="rn-day">
        <header class="rn-dayhead"><time class="rn-date" :datetime="day.date">{{ dateLabel(day.date) }}</time><span v-if="day.releases.length > 1" class="rn-daymeta">{{ day.releases.length }} {{ day.releases.length === 1 ? labels.release : labels.releases }} · {{ day.changeCount }} {{ day.changeCount === 1 ? labels.change : labels.changes }}</span><span v-if="day.itemsAdded && kindFilter === 'all'" class="rn-added">{{ day.itemsAdded }} {{ labels.questions }}</span></header>
        <div class="rn-day-releases">
          <section v-for="(release, releaseIndex) in day.releases" :id="`release-${day.date}-${releaseIndex + 1}`" :key="release.en.title" data-ui="release-item" class="rn-rel"><header class="rn-relhead"><h2 class="rn-title">{{ release[lang]?.title || release.en.title }}</h2><span v-if="release.items_added && kindFilter === 'all'" class="rn-added">{{ release.items_added }} {{ labels.questions }}</span></header><ul class="rn-changes"><li v-for="change in release.changes" :key="change[lang]?.text || change.en.text" data-ui="release-change" class="rn-change" :class="`rn-k-${change.kind}`"><div class="rn-cmeta"><span class="rn-kind" :data-kind="change.kind">{{ labels.kinds[change.kind] || change.kind }}</span><span v-if="change.target" class="rn-target">{{ change.target }}</span></div><div class="rn-text" v-html="renderMarkdown(change[lang]?.text || change.en.text)" /></li></ul></section>
        </div>
      </section></div>
    </div></main>
  </div>
</template>
