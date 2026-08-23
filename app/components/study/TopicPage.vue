<script setup lang="ts">
import { contentDateFacts } from '~/utils/content-dates.js';
import { crossRefResolver, trackItemIds } from '../../../public/lib/cross-ref.js';

const props = defineProps<{ slug?: string }>();
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');

const { data, error } = await useAsyncData(`topic:${props.slug || 'first'}`, async () => {
  return $fetch<any>(`/api/content/topic/${props.slug || 'first'}`);
});

if (error.value) throw error.value;

const source = computed(() => lang.value === 'vi' && data.value?.vi ? data.value.vi : data.value?.en);
const metadata = computed(() => {
  const entry = data.value!.meta;
  return entry[lang.value] || entry.en || entry.vi || {};
});
const studyProgress = import.meta.client ? useStudyProgress() : null;
const moved = computed(() => new Set<string>(data.value?.row.system_design_items || []));
const sections = computed(() => (source.value?.sections || []).map((section: any) => ({
  ...section,
  items: section.items
    .filter((item: any) => !moved.value.has(item.id))
    .map((item: any) => ({ ...item, reviewed_at: data.value?.reviews[item.id]?.reviewed_at || '' }))
})).filter((section: any) => section.items.length));
const itemCount = computed(() => sections.value.reduce((sum: number, section: any) => sum + section.items.length, 0));
const reviewedCount = computed(() => {
  const reviewed = new Set(studyProgress?.reviewed.value || []);
  return sections.value.reduce((sum: number, section: any) => sum + section.items.filter((item: any) => reviewed.has(item.id)).length, 0);
});
const nextUnreviewedId = computed(() => {
  const reviewed = new Set(studyProgress?.reviewed.value || []);
  for (const section of sections.value) {
    const item = section.items.find((candidate: any) => !reviewed.has(candidate.id));
    if (item) return item.id;
  }
  return '';
});
const dates = computed(() => contentDateFacts(data.value!.meta, lang.value));
const pageLabels = computed(() => lang.value === 'vi' ? {
  items: 'mục',
  sections: 'phần',
  reviewed: 'đã ôn',
  continue: 'Tiếp tục học',
  complete: 'Đã hoàn tất',
  toolbar: 'Điều khiển học',
  expandAll: 'Mở tất cả',
  collapseAll: 'Thu tất cả',
  previous: 'Chủ đề trước',
  next: 'Chủ đề tiếp theo',
  finished: 'Đã hoàn tất',
  topic: 'Chủ đề',
  navigation: 'Điều hướng chủ đề'
} : {
  items: 'items',
  sections: 'sections',
  reviewed: 'reviewed',
  continue: 'Continue studying',
  complete: 'All caught up',
  toolbar: 'Study controls',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  previous: 'Previous topic',
  next: 'Next topic',
  finished: 'Finished',
  topic: 'Topic',
  navigation: 'Topic navigation'
});
/* One resolver for the whole page: the server projects only the question
   labels cited by this topic. The full content index no longer rides along
   with every first view just to make a handful of cross-reference links. */
const resolveRef = computed(() => crossRefResolver({
  // Older prerendered pages can still use `/api/content/item-index`; new
  // payloads carry only the cross-references needed by this topic.
  questions: data.value?.crossRefs || {},
  onTrack: trackItemIds({ topics: data.value?.progressIndex?.topics || [] }),
  owners: data.value?.sourceOwners || {},
  lang: lang.value
}));
const currentIndex = computed(() => data.value!.rows.findIndex((row: any) => row.n === data.value!.row.n));
const rowSlug = (row: any) => row.file.split('/').pop().replace(/\.json$/, '');
const previous = computed(() => data.value!.rows[currentIndex.value - 1]);
const next = computed(() => data.value!.rows[currentIndex.value + 1]);
const headerTopics = computed(() => data.value!.rows.map((row: any) => ({
  ...row,
  label: data.value!.topicMeta?.[String(row.n)]?.[lang.value]?.label
    || data.value!.topicMeta?.[String(row.n)]?.en?.label
    || row.file.split('/').pop().replace(/\.json$/, '')
})));
const headerTopic = computed(() => headerTopics.value.find((row: any) => row.n === data.value!.row.n));
const itemPairs = computed(() => {
  const pairs: Record<string, any> = {};
  for (const language of ['en', 'vi']) {
    for (const section of data.value?.[language]?.sections || []) {
      for (const item of section.items || []) (pairs[item.id] ||= {})[language] = {
        ...item, reviewed_at: data.value?.reviews[item.id]?.reviewed_at || ''
      };
    }
  }
  return pairs;
});
const expandAll = ref(false);
const expandToken = ref(0);
function setAll(open: boolean) {
  expandAll.value = open;
  expandToken.value += 1;
}
function continueStudy() {
  if (!import.meta.client || !nextUnreviewedId.value) return;
  const hash = `question-${nextUnreviewedId.value}`;
  const target = document.getElementById(hash);
  if (!target) return;
  if (window.location.hash !== `#${hash}`) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${hash}`);
  }
  window.dispatchEvent(new Event('hashchange'));
  target.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start'
  });
  void nextTick(() => document.getElementById(`${hash}-toggle`)?.focus({ preventScroll: true }));
}

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: `${metadata.value.title} — GAZLL`,
  meta: [{ name: 'description', content: metadata.value.intro }],
  link: [{ rel: 'canonical', href: `https://gazll.github.io/topics/${data.value!.stem}` }]
}));
</script>

<template>
  <div class="view-track">
    <ContentHeader :lang="lang" :topic="headerTopic" :topics="headerTopics" :progress-index="data!.progressIndex" />

    <main>
      <section id="view-track" tabindex="-1" class="view">
        <div class="day-panel">
          <section class="hero">
            <div class="hero-head">
              <div class="daynum" :data-topic-type="data!.row.topic_type">
                <small>{{ data!.row.topic_type.toUpperCase() }}</small>{{ data!.row.n }}
              </div>
              <div>
                <h1>{{ metadata.title }}</h1>
                <p class="intro">{{ metadata.intro }}</p>
                <div class="content-dates">
                  <ContentDateStamp v-for="fact in dates" :key="fact.kind" :fact="fact" :lang="lang" />
                </div>
                <div class="tags"><span v-for="tag in metadata.tags || []" :key="tag" class="tag">{{ tag }}</span></div>
              </div>
            </div>
          </section>

          <div id="study-toolbar" class="toolbar" role="toolbar" :aria-label="pageLabels.toolbar">
            <span class="sectioncount" aria-live="polite" aria-atomic="true">
              <span><b>{{ itemCount }}</b> {{ pageLabels.items }}</span>
              <span><b>{{ sections.length }}</b> {{ pageLabels.sections }}</span>
              <span class="study-progress"><b>{{ reviewedCount }}</b>/{{ itemCount }} {{ pageLabels.reviewed }}</span>
            </span>
            <div class="tb-actions">
              <button v-if="nextUnreviewedId" id="study-continue" class="btn-primary study-continue" type="button" @click="continueStudy">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h10M10 5l5 5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <span>{{ pageLabels.continue }}</span>
              </button>
              <span v-else class="study-complete" role="status">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4.5 10 3.3 3.3 7.7-7.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <span>{{ pageLabels.complete }}</span>
              </span>
              <button class="btn-ghost" type="button" :aria-pressed="expandAll" @click="setAll(!expandAll)">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path v-if="expandAll" d="m5.5 12.5 4.5-4.5 4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  <path v-else d="m5.5 7.5 4.5 4.5 4.5-4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span>{{ expandAll ? pageLabels.collapseAll : pageLabels.expandAll }}</span>
              </button>
            </div>
          </div>
          <template v-for="(section, sectionIndex) in sections" :key="section.title">
            <h2 :id="`${data!.stem}-section-${sectionIndex + 1}`" class="section-h">
              <span class="section-index" aria-hidden="true">{{ String(sectionIndex + 1).padStart(2, '0') }}</span>
              <a class="topic-heading-anchor" :href="`#${data!.stem}-section-${sectionIndex + 1}`">{{ section.title }}</a><span class="sline" />
            </h2>
            <StudyQuestionCard v-for="item in section.items" :key="item.id" :item="item" :pair="itemPairs[item.id]" :lang="lang" :source-owners="data!.sourceOwners" :resolve-ref="resolveRef" :force-open="expandAll" :force-token="expandToken" />
          </template>
        </div>

        <nav class="pager" :aria-label="pageLabels.navigation">
          <NuxtLink v-if="previous" class="pbtn prev" :to="`/topics/${rowSlug(previous)}?lang=${lang}`">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m12.5 4.5-5.5 5.5 5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
            <span>{{ pageLabels.previous }}</span>
          </NuxtLink>
          <span v-else class="pbtn prev" aria-disabled="true">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m12.5 4.5-5.5 5.5 5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
            <span>{{ pageLabels.previous }}</span>
          </span>
          <div class="pcenter">{{ pageLabels.topic }} <b>{{ currentIndex + 1 }}</b> / {{ data!.rows.length }}</div>
          <NuxtLink v-if="next" class="pbtn next" :to="`/topics/${rowSlug(next)}?lang=${lang}`">
            <span>{{ pageLabels.next }}</span>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m7.5 4.5 5.5 5.5-5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </NuxtLink>
          <span v-else class="pbtn next" aria-disabled="true">
            <span>{{ pageLabels.finished }}</span>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4.5 10 3.3 3.3 7.7-7.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </span>
        </nav>
      </section>
    </main>
  </div>
</template>
