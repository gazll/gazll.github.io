<script setup lang="ts">
import { fold } from '../../../public/lib/search-text.js';
type SearchEntry = {
  id: string;
  surface: string;
  en: string;
  vi: string;
  contextEn: string;
  contextVi: string;
  bodyEn?: string;
  bodyVi?: string;
  href: string;
};

const props = defineProps<{ lang: 'en' | 'vi' }>();
const router = useRouter();
const isOpen = ref(false);
const query = ref('');
const entries = ref<SearchEntry[]>([]);
const loading = ref(false);
const loadError = ref(false);
const input = ref<HTMLInputElement>();
const activeIndex = ref(-1);
const { $searchHistory } = useNuxtApp() as any;
const historyRevision = ref(0);
let stopHistory: (() => void) | null = null;
const recent = computed(() => { historyRevision.value; return $searchHistory?.entries || []; });
const labels = computed(() => props.lang === 'vi' ? {
  search: 'Tìm kiếm câu hỏi, blueprint và case study…', searchAria: 'Tìm kiếm toàn bộ nội dung', dialog: 'Tìm kiếm', esc: 'Esc',
  loading: 'Đang tải thư viện…', error: 'Không thể tải tìm kiếm. Hãy đóng panel và thử lại.', recent: 'Tìm kiếm gần đây', clear: 'Xóa hết',
  empty: 'Nhập vài từ để tìm trên mọi khu vực kiến thức.', noResult: 'Không có kết quả cho “{query}”. Hãy thử từ khóa ngắn hoặc rộng hơn.',
  seeAll: 'Xem toàn bộ kết quả cho “{query}”', footer: 'Tìm kiếm trên mọi thư viện GAZLL', navigate: 'di chuyển', open: 'mở'
} : {
  search: 'Search questions, blueprints and case studies…', searchAria: 'Search all material', dialog: 'Search', esc: 'Esc',
  loading: 'Loading the libraries…', error: 'Search could not load. Close this panel and try again.', recent: 'Recent searches', clear: 'Clear all',
  empty: 'Type a few words to search every study and knowledge surface.', noResult: 'No result matches “{query}”. Try fewer or broader terms.',
  seeAll: 'See all results for “{query}”', footer: 'Search across every GAZLL library', navigate: 'navigate', open: 'open'
});

const surfaceLabels = computed<Record<string, string>>(() => props.lang === 'vi' ? {
  track: 'Lộ trình học', 'system-design': 'System Design', 'case-studies': 'Case Studies', photography: 'Nhiếp ảnh', homelab: 'NAS / Home Server'
} : {
  track: 'Study Track', 'system-design': 'System Design', 'case-studies': 'Case Studies', photography: 'Photography', homelab: 'NAS / Home Server'
});
const surfaceBadges: Record<string, string> = {
  track: 'TOPIC', 'system-design': 'DESIGN', 'case-studies': 'CASE', photography: 'PHOTO', homelab: 'LAB'
};

const results = computed(() => {
  const terms = fold(query.value).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return entries.value.filter(entry => {
    const text = fold(`${entry.en} ${entry.vi} ${entry.contextEn} ${entry.contextVi} ${entry.bodyEn || ''} ${entry.bodyVi || ''}`);
    return terms.every(term => text.includes(term));
  }).slice(0, 12);
});
const groupedResults = computed(() => Object.entries(results.value.reduce<Record<string, SearchEntry[]>>((groups, entry) => {
  (groups[entry.surface] ||= []).push(entry);
  return groups;
}, {})));

async function load() {
  if (entries.value.length || loading.value) return;
  loading.value = true;
  loadError.value = false;
  try {
    const response = await fetch('/api/content/search-index');
    if (!response.ok) throw new Error(`Search index returned ${response.status}`);
    entries.value = await response.json();
  } catch {
    loadError.value = true;
  } finally { loading.value = false; }
}
function open(initial = '') {
  if (initial) query.value = initial;
  isOpen.value = true;
  activeIndex.value = -1;
  document.body.classList.add('search-open');
  load();
  nextTick(() => { input.value?.focus(); input.value?.select(); });
}
function close(refocus = true) {
  isOpen.value = false;
  document.body.classList.remove('search-open');
  if (refocus) nextTick(() => document.querySelector<HTMLElement>('#searchTrigger')?.focus());
}
function routeFor(entry: SearchEntry) {
  const [path, hash = ''] = entry.href.split('#', 2);
  return { path, hash: hash ? `#${hash}` : '', query: props.lang === 'vi' ? { lang: 'vi' } : {} };
}
async function follow(entry: SearchEntry) {
  if (query.value.trim()) $searchHistory?.record(query.value.trim());
  close(false);
  await router.push(routeFor(entry));
}
function rememberQuery() {
  const value = query.value.trim();
  if (value) $searchHistory?.record(value);
  return value;
}
async function showAll() {
  const value = rememberQuery();
  close(false);
  await router.push({ path: '/search', query: { ...(value ? { q: value } : {}), ...(props.lang === 'vi' ? { lang: 'vi' } : {}) } });
}
function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    isOpen.value ? close() : open();
    return;
  }
  const typing = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]');
  if (!isOpen.value && event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault(); open(); return;
  }
  if (!isOpen.value) return;
  if (event.key === 'Escape') { event.preventDefault(); close(); return; }
  if (event.key === 'ArrowDown') {
    event.preventDefault(); activeIndex.value = Math.min(results.value.length - 1, activeIndex.value + 1); return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault(); activeIndex.value = Math.max(0, activeIndex.value - 1); return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const selected = results.value[activeIndex.value] || results.value[0];
    selected ? follow(selected) : showAll();
  }
}

defineExpose({ open });
watch(results, () => { activeIndex.value = -1; });
onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  stopHistory = $searchHistory?.onChange(() => { historyRevision.value += 1; }) || null;
});
onBeforeUnmount(() => { stopHistory?.(); document.removeEventListener('keydown', onKeydown); document.body.classList.remove('search-open'); });
</script>

<template>
  <div class="gs-scrim" :hidden="!isOpen" aria-hidden="true" @click="close()" />
  <section class="gs-overlay" :hidden="!isOpen" role="dialog" aria-modal="true" :aria-label="labels.dialog">
    <div class="gs-box">
      <span class="gs-box-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg></span>
      <input ref="input" v-model="query" class="gs-input" type="search" autocomplete="off" spellcheck="false" :placeholder="labels.search" :aria-label="labels.searchAria">
      <button class="gs-esc" type="button" @click="close()">{{ labels.esc }}</button>
    </div>
    <div class="gs-body">
      <p v-if="loading" class="gs-empty">{{ labels.loading }}</p>
      <p v-else-if="loadError" class="gs-empty">{{ labels.error }}</p>
      <section v-else-if="!query.trim() && recent.length" class="gs-group gs-history"><h3>{{ labels.recent }} <button type="button" class="gs-clear" @click="$searchHistory.clear()">{{ labels.clear }}</button></h3><div v-for="entry in recent" :key="entry.q" class="gs-recent-row"><button type="button" class="gs-recent" @click="query = entry.q">{{ entry.q }}</button><button type="button" class="gs-forget" :aria-label="`Remove ${entry.q}`" @click="$searchHistory.remove(entry.q)">×</button></div></section>
      <p v-else-if="!query.trim()" class="gs-empty">{{ labels.empty }}</p>
      <p v-else-if="!results.length" class="gs-empty">{{ labels.noResult.replace('{query}', query) }}</p>
      <template v-for="([surface, rows]) in groupedResults" :key="surface">
        <section class="gs-group">
          <h3>{{ surfaceLabels[surface] }} <span>{{ rows?.length }}</span></h3>
          <button v-for="entry in rows" :key="entry.id" type="button" class="gs-hit" :class="{ 'is-active': results.indexOf(entry) === activeIndex }" @click="follow(entry)">
            <span class="gs-hit-badge">{{ surfaceBadges[entry.surface] }}</span>
            <span class="gs-hit-main">
              <span class="gs-hit-title">{{ lang === 'vi' ? entry.vi : entry.en }}</span>
              <span class="gs-hit-context">{{ lang === 'vi' ? entry.contextVi : entry.contextEn }}</span>
            </span>
            <span class="gs-hit-go">↵</span>
          </button>
        </section>
      </template>
      <button v-if="query.trim()" class="gs-more" type="button" @click="showAll()"><span>{{ labels.seeAll.replace('{query}', query) }}</span><span>→</span></button>
    </div>
    <footer class="gs-foot"><span>{{ labels.footer }}</span><span class="gs-keys"><kbd>↑</kbd><kbd>↓</kbd> {{ labels.navigate }} · <kbd>Enter</kbd> {{ labels.open }}</span></footer>
  </section>
</template>
