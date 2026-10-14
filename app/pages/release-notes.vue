<script setup lang="ts">
import { renderMarkdown } from '~/utils/markdown.js';
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData('release-notes', () => $fetch<any>('/api/content/releases'));
const days = computed(() => {
  const groups = new Map<string, any[]>();
  for (const release of data.value.releases || []) (groups.get(release.date) || (groups.set(release.date, []), groups.get(release.date)!)).push(release);
  return [...groups.entries()].map(([date, releases]) => ({
    date, releases,
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
// Counts follow the year filter so a chip never promises rows the list will not show.
const kindOptions = computed(() => {
  const counts = new Map<string, number>();
  for (const release of data.value?.releases || []) {
    if (yearFilter.value !== 'all' && !String(release.date).startsWith(yearFilter.value)) continue;
    for (const change of release.changes || []) counts.set(change.kind, (counts.get(change.kind) || 0) + 1);
  }
  return ['topic', 'content', 'feature', 'change', 'fix'].filter(kind => counts.has(kind)).map(kind => ({ kind, count: counts.get(kind)! }));
});
const latest = computed(() => (data.value?.releases || [])[0]);
const isLatest = (release: any) => !!latest.value && release.date === latest.value.date && release.en.title === latest.value.en.title;
// Retired view names (boot, language, all-topics) stay unlinked: no route answers them.
const SURFACE_ROUTES: Record<string, string> = {
  'system-design': '/system-design', 'case-studies': '/case-studies', calendar: '/calendar',
  search: '/search', interviews: '/gazl-try', 'release-notes': '/release-notes'
};
const withLang = (to: string) => lang.value === 'vi' ? `${to}?lang=vi` : to;
function targetOf(change: any) {
  const target = change.target as string | undefined;
  if (!target) return null;
  const topic = data.value?.topics?.[target];
  if (topic) return { label: `${String(topic.n).padStart(2, '0')} · ${topic[lang.value] || topic.en}`, to: withLang(`/topics/${target}`), type: topic.topic_type };
  const surface = (labels.value.surfaces as Record<string, string>)[target];
  return { label: surface || target, to: SURFACE_ROUTES[target] ? withLang(SURFACE_ROUTES[target]) : '', type: '' };
}
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
// The rail shows the day as a large numeral; dateLabel stays the accessible name.
const dateParts = (value: string) => {
  const parts = new Intl.DateTimeFormat(lang.value === 'vi' ? 'vi-VN' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).formatToParts(new Date(`${value}T12:00:00`));
  const part = (type: string) => parts.find(entry => entry.type === type)?.value || '';
  return { day: part('day'), month: `${part('month')} ${part('year')}` };
};
const labels = computed(() => lang.value === 'vi' ? {
  eyebrow: 'Những gì đã thay đổi', title: 'Ghi chú phát hành', intro: 'Nội dung và tính năng mới nhất, theo thứ tự thời gian.',
  questions: 'câu hỏi mới', release: 'bản phát hành', releases: 'bản phát hành', change: 'thay đổi', changes: 'thay đổi', day: 'ngày',
  showing: 'Đang hiển thị',
  summary: 'Tóm tắt phát hành', latest: 'Mới nhất', question: 'câu hỏi',
  filterBy: 'Lọc nhật ký', year: 'Năm', kind: 'Loại', allYears: 'Tất cả năm', allKinds: 'Tất cả', clearFilters: 'Xoá bộ lọc', noMatches: 'Không có thay đổi phù hợp.', days: 'ngày',
  kinds: { topic: 'Chủ đề', content: 'Nội dung', feature: 'Tính năng', change: 'Thay đổi', fix: 'Sửa lỗi' },
  surfaces: { 'system-design': 'System Design', 'case-studies': 'Case Studies', calendar: 'Lịch', search: 'Tìm kiếm', interviews: 'Gazl Try', 'release-notes': 'Ghi chú phát hành', 'all-topics': 'Tất cả chủ đề', language: 'Ngôn ngữ', boot: 'Khởi động' }
} : {
  eyebrow: 'What changed', title: 'Release Notes', intro: 'The latest content and product changes, newest first.',
  questions: 'new questions', release: 'release', releases: 'releases', change: 'change', changes: 'changes', day: 'day',
  showing: 'Showing',
  summary: 'Release summary', latest: 'Latest', question: 'question',
  filterBy: 'Filter archive', year: 'Year', kind: 'Kind', allYears: 'All years', allKinds: 'All', clearFilters: 'Clear filters', noMatches: 'No changes match these filters.', days: 'days',
  kinds: { topic: 'Topic', content: 'Content', feature: 'Feature', change: 'Change', fix: 'Fix' },
  surfaces: { 'system-design': 'System Design', 'case-studies': 'Case Studies', calendar: 'Calendar', search: 'Search', interviews: 'Gazl Try', 'release-notes': 'Release Notes', 'all-topics': 'All topics', language: 'Language', boot: 'Startup' }
});
useHead(() => ({ htmlAttrs: { lang: lang.value }, title: `${labels.value.title} — GAZLL`, meta: [{ name: 'description', content: labels.value.intro }], link: [{ rel: 'canonical', href: 'https://gazll.github.io/release-notes' }] }));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" tabindex="-1" class="view"><div id="release-notes-page" data-ui="release-notes-page" class="page rn-page">
      <header id="release-notes-header" data-ui="release-notes-header" class="rn-head">
        <div class="rn-head-copy"><p class="eyebrow">{{ labels.eyebrow }}</p><h1>{{ labels.title }}</h1><p class="rn-intro">{{ labels.intro }}</p></div>
        <div id="release-notes-summary" data-ui="release-summary" class="rn-summary" role="group" :aria-label="labels.summary">
          <span><b>{{ totals.releases }}</b> {{ totals.releases === 1 ? labels.release : labels.releases }}</span>
          <span><b>{{ totals.changes }}</b> {{ totals.changes === 1 ? labels.change : labels.changes }}</span>
          <span><b>{{ totals.items }}</b> {{ labels.questions }}</span>
        </div>
        <div id="release-notes-filters" data-ui="release-filters" class="rn-filters" role="group" :aria-label="labels.filterBy">
          <div id="release-kind-filter" class="rn-filter-controls" role="group" :aria-label="labels.kind">
            <button type="button" class="rn-chip" :class="{ on: kindFilter === 'all' }" :aria-pressed="kindFilter === 'all'" @click="kindFilter = 'all'">{{ labels.allKinds }}</button>
            <button v-for="option in kindOptions" :key="option.kind" type="button" class="rn-chip" :class="{ on: kindFilter === option.kind }" :data-kind="option.kind" :aria-pressed="kindFilter === option.kind" @click="kindFilter = option.kind">{{ labels.kinds[option.kind] || option.kind }} <b>{{ option.count }}</b></button>
          </div>
          <div v-if="yearOptions.length > 1" id="release-year-filter" class="rn-filter-controls rn-years" role="group" :aria-label="labels.year">
            <button type="button" class="rn-chip" :class="{ on: yearFilter === 'all' }" :aria-pressed="yearFilter === 'all'" @click="yearFilter = 'all'">{{ labels.allYears }}</button>
            <button v-for="year in yearOptions" :key="year" type="button" class="rn-chip" :class="{ on: yearFilter === year }" :aria-pressed="yearFilter === year" @click="yearFilter = year">{{ year }}</button>
          </div>
          <button v-if="hasReleaseFilters" class="rn-filter-clear" type="button" @click="clearReleaseFilters">{{ labels.clearFilters }}</button>
        </div>
      </header>
      <p id="release-notes-filter-summary" data-ui="release-filter-summary" class="rn-filter-summary"><span>{{ labels.showing }}</span> <b>{{ filteredSummary.days }}</b> {{ filteredSummary.days === 1 ? labels.day : labels.days }} · <b>{{ filteredSummary.releases }}</b> {{ filteredSummary.releases === 1 ? labels.release : labels.releases }} · <b>{{ filteredSummary.changes }}</b> {{ filteredSummary.changes === 1 ? labels.change : labels.changes }}</p>
      <p id="release-notes-filter-status" class="sr-only" aria-live="polite">{{ labels.showing }} {{ filteredSummary.days }} {{ filteredSummary.days === 1 ? labels.day : labels.days }}, {{ filteredSummary.changes }} {{ filteredSummary.changes === 1 ? labels.change : labels.changes }}</p>
      <p v-if="!filteredDays.length" id="release-notes-empty" data-ui="release-empty" class="rn-empty" role="status">
        <span>{{ labels.noMatches }}</span>
        <button v-if="hasReleaseFilters" class="rn-empty-clear" type="button" @click="clearReleaseFilters">{{ labels.clearFilters }}</button>
      </p>
      <div v-else id="release-notes-list" data-ui="release-list" class="rn-body"><section v-for="day in filteredDays" :id="`release-day-${day.date}`" :key="day.date" data-ui="release-day" :data-date="day.date" class="rn-day">
        <header class="rn-dayhead"><time class="rn-date" :datetime="day.date"><span class="sr-only">{{ dateLabel(day.date) }}</span><span class="rn-date-day" aria-hidden="true">{{ dateParts(day.date).day }}</span><span class="rn-date-month" aria-hidden="true">{{ dateParts(day.date).month }}</span></time><span v-if="day.releases.length > 1" class="rn-daymeta">{{ day.releases.length }} {{ day.releases.length === 1 ? labels.release : labels.releases }} · {{ day.changeCount }} {{ day.changeCount === 1 ? labels.change : labels.changes }}</span></header>
        <div class="rn-day-releases">
          <section v-for="(release, releaseIndex) in day.releases" :id="`release-${day.date}-${releaseIndex + 1}`" :key="release.en.title" data-ui="release-item" class="rn-rel" :class="{ 'rn-rel-latest': isLatest(release) }">
            <header class="rn-relhead"><h2 class="rn-title">{{ release[lang]?.title || release.en.title }}</h2><span v-if="isLatest(release)" class="rn-latest">{{ labels.latest }}</span><span v-if="release.items_added && kindFilter === 'all'" class="rn-added">+{{ release.items_added }} {{ labels.questions }}</span></header>
            <ul class="rn-changes">
              <li v-for="change in release.changes" :key="change[lang]?.text || change.en.text" data-ui="release-change" class="rn-change" :class="`rn-k-${change.kind}`">
                <span class="rn-kind" :data-kind="change.kind">{{ labels.kinds[change.kind] || change.kind }}</span>
                <div class="rn-cbody">
                  <div class="rn-cmeta">
                    <template v-if="targetOf(change)">
                      <NuxtLink v-if="targetOf(change)!.to" class="rn-target" :to="targetOf(change)!.to" :data-topic-type="targetOf(change)!.type || undefined">{{ targetOf(change)!.label }}</NuxtLink>
                      <span v-else class="rn-target">{{ targetOf(change)!.label }}</span>
                    </template>
                    <span v-if="change[lang]?.section || change.en.section" class="rn-section">{{ change[lang]?.section || change.en.section }}</span>
                    <span v-if="change.count" class="rn-count">+{{ change.count }} {{ labels.question }}</span>
                  </div>
                  <div class="rn-text" v-html="renderMarkdown(change[lang]?.text || change.en.text)" />
                </div>
              </li>
            </ul>
          </section>
        </div>
      </section></div>
    </div></main>
  </div>
</template>
