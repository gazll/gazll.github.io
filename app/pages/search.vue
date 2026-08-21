<script setup lang="ts">
import { prepareEntries, searchEntries } from '../../public/lib/search.js';
const route = useRoute();
const router = useRouter();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const query = ref(String(route.query.q || ''));
const surface = ref(String(route.query.surface || 'all'));
/* Fetched in the browser, never through useAsyncData: awaiting it here makes
   the index part of the prerendered payload, and even one language is ~480KB
   gzipped — every visit to /search would download the corpus before first
   paint, and the overlay would then fetch it a second time. Loading it on
   mount keeps the page itself small and lets results appear as soon as it
   lands. One file per language, so switching costs a fetch the browser cache
   then serves for free; carrying both cost every reader 425KB they never
   folded. It must match the language being rendered — an index projected to
   one language has nothing under the other one's keys. */
const entries = ref<any[]>([]);
const indexLoading = ref(true);
const indexFailed = ref(false);
async function loadIndex(which: 'en' | 'vi') {
  indexLoading.value = true;
  indexFailed.value = false;
  try {
    const response = await fetch(`/api/content/search-index/${which}`);
    if (!response.ok) throw new Error(`Search index returned ${response.status}`);
    entries.value = await response.json();
  } catch {
    entries.value = [];
    indexFailed.value = true;
  } finally {
    indexLoading.value = false;
  }
}
onMounted(() => loadIndex(lang.value));
watch(lang, next => loadIndex(next));
const nuxtApp = useNuxtApp() as any;
const recent = ref<any[]>([]);
let stopHistory: (() => void) | null = null;
const labels = computed(() => lang.value === 'vi' ? {
  eyebrow: 'Tìm kiếm', title: 'Mọi thứ, ở một nơi', intro: 'Một truy vấn cho Lộ trình học, blueprint System Design, case study, nhiếp ảnh và ghi chú home server. Mỗi kết quả đều cho biết thư viện của nó.',
  placeholder: 'Tìm câu hỏi, blueprint và case study…', searchAria: 'Tìm kiếm toàn bộ nội dung', surface: 'Khu vực tìm kiếm', recent: 'Tìm kiếm gần đây', clear: 'Xóa hết',
  start: 'Bắt đầu nhập để tìm trên mọi thư viện GAZLL.', loadingIndex: 'Đang tải chỉ mục tìm kiếm…', indexFailed: 'Không tải được chỉ mục tìm kiếm. Hãy tải lại trang.', noResult: 'Không có kết quả cho “{query}”. Hãy thử từ khóa ngắn hoặc rộng hơn.', result: 'kết quả', results: 'kết quả', in: 'trong', for: 'cho', all: 'Tất cả',
  track: 'Lộ trình học', system: 'System Design', cases: 'Case Studies', photography: 'Nhiếp ảnh', homelab: 'NAS / Home Server'
} : {
  eyebrow: 'Search', title: 'Everything, in one place', intro: 'One query across the Study Track, System Design blueprints, case studies, photography and home-server notes. Every result names the library it belongs to.',
  placeholder: 'Search questions, blueprints and case studies…', searchAria: 'Search all material', surface: 'Search surface', recent: 'Recent searches', clear: 'Clear all',
  start: 'Start typing to search every GAZLL library.', loadingIndex: 'Loading the search index…', indexFailed: 'The search index could not be loaded. Reload the page to try again.', noResult: 'No result matches “{query}”. Try fewer or broader terms.', result: 'result', results: 'results', in: 'in', for: 'for', all: 'All',
  track: 'Study Track', system: 'System Design', cases: 'Case Studies', photography: 'Photography', homelab: 'NAS / Home Server'
});

/* Folded once per language, not per keystroke: prepareEntries walks ~3k rows
   and every highlight offset is measured against the folded copies it builds. */
const prepared = computed(() => prepareEntries(entries.value, lang.value));
const found = computed(() => searchEntries(prepared.value, query.value, { surface: surface.value }));
const results = computed(() => found.value.results);
const surfaces = computed(() => [
  { id: 'all', label: labels.value.all },
  { id: 'track', label: labels.value.track },
  { id: 'system-design', label: labels.value.system },
  { id: 'case-studies', label: labels.value.cases },
  { id: 'photography', label: labels.value.photography },
  { id: 'homelab', label: labels.value.homelab }
]);
const surfaceLabels = computed(() => Object.fromEntries(surfaces.value.map(item => [item.id, item.label])));
const surfaceBadges: Record<string, string> = { track: 'TOPIC', 'system-design': 'DESIGN', 'case-studies': 'CASE', photography: 'PHOTO', homelab: 'LAB' };
const countFor = (id: string) => id === 'all'
  ? Object.values(found.value.counts).reduce((total: number, n: any) => total + n, 0)
  : found.value.counts[id] || 0;
const groupedResults = computed(() => Object.entries(results.value.reduce<Record<string, any[]>>((groups, entry) => {
  (groups[entry.surface] ||= []).push(entry);
  return groups;
}, {})));
const resultRoute = (href: string) => {
  const [path, hash = ''] = href.split('#', 2);
  return { path, hash: hash ? `#${hash}` : '', query: lang.value === 'vi' ? { lang: 'vi' } : {} };
};

watch([query, surface], () => router.replace({ query: {
  ...(query.value ? { q: query.value } : {}),
  ...(surface.value !== 'all' ? { surface: surface.value } : {}),
  ...(lang.value === 'vi' ? { lang: 'vi' } : {})
} }));
watch(() => route.query.q, value => {
  const next = String(value || '');
  if (next !== query.value) query.value = next;
});
watch(() => route.query.surface, value => {
  const next = String(value || 'all');
  if (next !== surface.value) surface.value = next;
});

onMounted(() => {
  query.value = String(route.query.q || '');
  surface.value = String(route.query.surface || 'all');
  const syncHistory = () => { recent.value = [...(nuxtApp.$searchHistory?.entries || [])]; };
  syncHistory();
  stopHistory = nuxtApp.$searchHistory?.onChange(syncHistory) || null;
});
onBeforeUnmount(() => stopHistory?.());
function rememberQuery() { if (query.value.trim()) nuxtApp.$searchHistory?.record(query.value.trim()); }
function followResult() { rememberQuery(); }
function submitSearch() { rememberQuery(); }

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: 'Search — GAZLL',
  meta: [{ name: 'description', content: 'Search every GAZLL study and knowledge surface.' }],
  link: [{ rel: 'canonical', href: 'https://gazll.github.io/search' }]
}));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" tabindex="-1" class="view">
      <div class="page gs-page">
        <header class="gs-page-head">
          <p class="cs-eyebrow">{{ labels.eyebrow }}</p>
          <h1>{{ labels.title }}</h1>
          <p class="gs-page-intro">{{ labels.intro }}</p>
          <form class="gs-page-box" role="search" @submit.prevent="submitSearch">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
            <input v-model="query" class="gs-input" type="search" autofocus autocomplete="off" spellcheck="false" :placeholder="labels.placeholder" :aria-label="labels.searchAria">
          </form>
        </header>
        <div v-if="query" class="gs-filters" role="group" :aria-label="labels.surface">
          <button v-for="item in surfaces" :key="item.id" type="button" class="gchip gs-chip" :aria-pressed="surface === item.id" @click="surface = item.id">
            {{ item.label }} <span class="gcount">{{ countFor(item.id) }}</span>
          </button>
        </div>
        <div class="gs-page-body">
          <section v-if="!query && recent.length" class="gs-group gs-history"><h3>{{ labels.recent }} <button type="button" class="gs-clear" @click="nuxtApp.$searchHistory?.clear()">{{ labels.clear }}</button></h3><div v-for="entry in recent" :key="entry.q" class="gs-recent-row"><button type="button" class="gs-recent" @click="query = entry.q">{{ entry.q }}</button><button type="button" class="gs-forget" @click="nuxtApp.$searchHistory?.remove(entry.q)">×</button></div></section>
          <p v-else-if="!query" class="gs-empty">{{ labels.start }}</p>
          <p v-else-if="indexFailed" class="gs-empty" role="alert">{{ labels.indexFailed }}</p>
          <p v-else-if="indexLoading" class="gs-empty" role="status">{{ labels.loadingIndex }}</p>
          <p v-else-if="!results.length" class="gs-empty">{{ labels.noResult.replace('{query}', query) }}</p>
          <p v-else class="gs-count">{{ results.length }} {{ results.length === 1 ? labels.result : labels.results }}{{ surface === 'all' ? '' : ` ${labels.in} ${surfaceLabels[surface]}` }} {{ labels.for }} <b>{{ query }}</b></p>
          <section v-for="([resultSurface, rows]) in groupedResults" :key="resultSurface" class="gs-group">
            <h3>{{ surfaceLabels[resultSurface] }} <span>{{ rows.length }}</span></h3>
            <NuxtLink v-for="result in rows" :key="result.id" class="gs-hit" :to="resultRoute(result.href)" @click="followResult">
              <span class="gs-hit-badge">{{ surfaceBadges[result.surface] }}</span>
              <span class="gs-hit-main">
                <span class="gs-hit-title" v-html="result.titleHtml" />
                <span v-if="result.snippet" class="gs-hit-snippet" v-html="result.snippet" />
                <span class="gs-hit-context">{{ result.context }}</span>
              </span>
            </NuxtLink>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>
