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
const moved = computed(() => new Set<string>(data.value?.row.system_design_items || []));
const sections = computed(() => (source.value?.sections || []).map((section: any) => ({
  ...section,
  items: section.items
    .filter((item: any) => !moved.value.has(item.id))
    .map((item: any) => ({ ...item, reviewed_at: data.value?.reviews[item.id]?.reviewed_at || '' }))
})).filter((section: any) => section.items.length));
const itemCount = computed(() => sections.value.reduce((sum: number, section: any) => sum + section.items.length, 0));
const dates = computed(() => contentDateFacts(data.value!.meta, lang.value));
/* One resolver for the whole page: a written (item-id) becomes a link labelled
   with the target QUESTION, not a bare Q3 that names nothing. content-index.json
   is the only file that carries every id with both languages of its question,
   and it is already fetched (and cached) for the progress ring. */
const { data: index } = await useAsyncData('content-index', () => $fetch<any>('/api/content/item-index'));
const resolveRef = computed(() => crossRefResolver({
  questions: index.value?.items || {},
  onTrack: trackItemIds(index.value),
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

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: `${metadata.value.title} — GAZLL`,
  meta: [{ name: 'description', content: metadata.value.intro }],
  link: [{ rel: 'canonical', href: `https://gazll.github.io/topics/${data.value!.stem}` }]
}));
</script>

<template>
  <div class="view-track">
    <ContentHeader :lang="lang" :topic="headerTopic" :topics="headerTopics" />

    <main>
      <section id="view-track" class="view">
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

          <div class="toolbar">
            <span class="sectioncount">{{ itemCount }} items · {{ sections.length }} sections</span>
            <div class="tb-actions"><button class="btn-ghost" type="button" @click="setAll(!expandAll)">{{ expandAll ? 'Collapse all' : 'Expand all' }}</button></div>
          </div>
          <template v-for="(section, sectionIndex) in sections" :key="section.title">
            <div :id="`${data!.stem}-section-${sectionIndex + 1}`" class="section-h">
              <a class="topic-heading-anchor" :href="`#${data!.stem}-section-${sectionIndex + 1}`">{{ section.title }}</a><span class="sline" />
            </div>
            <StudyQuestionCard v-for="item in section.items" :key="item.id" :item="item" :pair="itemPairs[item.id]" :lang="lang" :source-owners="data!.sourceOwners" :resolve-ref="resolveRef" :force-open="expandAll" :force-token="expandToken" />
          </template>
        </div>

        <nav class="pager" aria-label="Topic navigation">
          <NuxtLink v-if="previous" class="pbtn prev" :to="`/topics/${rowSlug(previous)}?lang=${lang}`">← Previous topic</NuxtLink>
          <span v-else class="pbtn prev" aria-disabled="true">← Previous topic</span>
          <div class="pcenter">Topic <b>{{ currentIndex + 1 }}</b> / {{ data!.rows.length }}</div>
          <NuxtLink v-if="next" class="pbtn next" :to="`/topics/${rowSlug(next)}?lang=${lang}`">Next topic →</NuxtLink>
          <span v-else class="pbtn next" aria-disabled="true">Finished ✓</span>
        </nav>
      </section>
    </main>
  </div>
</template>
