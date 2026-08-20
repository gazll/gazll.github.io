<script setup lang="ts">
type SearchEntry = {
  id: string;
  surface: string;
  en: string;
  vi: string;
  contextEn: string;
  contextVi: string;
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

const surfaceLabels: Record<string, string> = {
  track: 'Study Track',
  'system-design': 'System Design',
  'case-studies': 'Case Studies',
  photography: 'Photography',
  homelab: 'NAS / Home Server'
};
const surfaceBadges: Record<string, string> = {
  track: 'TOPIC', 'system-design': 'DESIGN', 'case-studies': 'CASE', photography: 'PHOTO', homelab: 'LAB'
};
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const results = computed(() => {
  const terms = fold(query.value).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return entries.value.filter(entry => {
    const text = fold(`${entry.en} ${entry.vi} ${entry.contextEn} ${entry.contextVi}`);
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
  close(false);
  await router.push(routeFor(entry));
}
async function showAll() {
  const value = query.value.trim();
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
onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => { document.removeEventListener('keydown', onKeydown); document.body.classList.remove('search-open'); });
</script>

<template>
  <div class="gs-scrim" :hidden="!isOpen" aria-hidden="true" @click="close()" />
  <section class="gs-overlay" :hidden="!isOpen" role="dialog" aria-modal="true" aria-label="Search">
    <div class="gs-box">
      <span class="gs-box-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg></span>
      <input ref="input" v-model="query" class="gs-input" type="search" autocomplete="off" spellcheck="false" placeholder="Search questions, blueprints and case studies…" aria-label="Search all material">
      <button class="gs-esc" type="button" @click="close()">Esc</button>
    </div>
    <div class="gs-body">
      <p v-if="loading" class="gs-empty">Loading the libraries…</p>
      <p v-else-if="loadError" class="gs-empty">Search could not load. Close this panel and try again.</p>
      <p v-else-if="!query.trim()" class="gs-empty">Type a few words to search every study and knowledge surface.</p>
      <p v-else-if="!results.length" class="gs-empty">No result matches “{{ query }}”. Try fewer or broader terms.</p>
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
      <button v-if="query.trim()" class="gs-more" type="button" @click="showAll()"><span>See all results for “{{ query }}”</span><span>→</span></button>
    </div>
    <footer class="gs-foot"><span>Search across every GAZLL library</span><span class="gs-keys"><kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>Enter</kbd> open</span></footer>
  </section>
</template>
