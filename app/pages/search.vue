<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const query = ref(String(route.query.q || ''));
const surface = ref(String(route.query.surface || 'all'));
const { data: entries } = await useAsyncData('search:index', () => $fetch<any[]>('/api/content/search-index'));
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const matchingEntries = computed(() => {
  const terms = fold(query.value).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return (entries.value || []).filter(entry => {
    const text = fold(`${entry.en} ${entry.vi} ${entry.contextEn} ${entry.contextVi}`);
    return terms.every(term => text.includes(term));
  });
});
const results = computed(() => matchingEntries.value.filter(entry => surface.value === 'all' || entry.surface === surface.value).slice(0, 200));
const surfaces = [
  { id: 'all', label: 'All' },
  { id: 'track', label: 'Study Track' },
  { id: 'system-design', label: 'System Design' },
  { id: 'case-studies', label: 'Case Studies' },
  { id: 'photography', label: 'Photography' },
  { id: 'homelab', label: 'NAS / Home Server' }
];
const surfaceLabels = Object.fromEntries(surfaces.map(item => [item.id, item.label]));
const surfaceBadges: Record<string, string> = { track: 'TOPIC', 'system-design': 'DESIGN', 'case-studies': 'CASE', photography: 'PHOTO', homelab: 'LAB' };
const countFor = (id: string) => id === 'all' ? matchingEntries.value.length : matchingEntries.value.filter(entry => entry.surface === id).length;
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
});

useHead({
  title: 'Search — GAZLL',
  meta: [{ name: 'description', content: 'Search every GAZLL study and knowledge surface.' }],
  link: [{ rel: 'stylesheet', href: '/styles.css' }, { rel: 'canonical', href: 'https://gazll.github.io/search' }]
});
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" class="view">
      <div class="page gs-page">
        <header class="gs-page-head">
          <p class="cs-eyebrow">Search</p>
          <h1>Everything, in one place</h1>
          <p class="gs-page-intro">One query across the Study Track, System Design blueprints, case studies, photography and home-server notes. Every result names the library it belongs to.</p>
          <form class="gs-page-box" role="search" @submit.prevent>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
            <input v-model="query" class="gs-input" type="search" autofocus autocomplete="off" spellcheck="false" placeholder="Search questions, blueprints and case studies…" aria-label="Search all material">
          </form>
        </header>
        <div v-if="query" class="gs-filters" role="group" aria-label="Search surface">
          <button v-for="item in surfaces" :key="item.id" type="button" class="gchip gs-chip" :aria-pressed="surface === item.id" @click="surface = item.id">
            {{ item.label }} <span class="gcount">{{ countFor(item.id) }}</span>
          </button>
        </div>
        <div class="gs-page-body">
          <p v-if="!query" class="gs-empty">Start typing to search every GAZLL library.</p>
          <p v-else-if="!results.length" class="gs-empty">No result matches “{{ query }}”. Try fewer or broader terms.</p>
          <p v-else class="gs-count">{{ results.length }} result{{ results.length === 1 ? '' : 's' }}{{ surface === 'all' ? '' : ` in ${surfaceLabels[surface]}` }} for <b>{{ query }}</b></p>
          <section v-for="([resultSurface, rows]) in groupedResults" :key="resultSurface" class="gs-group">
            <h3>{{ surfaceLabels[resultSurface] }} <span>{{ rows.length }}</span></h3>
            <NuxtLink v-for="result in rows" :key="result.id" class="gs-hit" :to="resultRoute(result.href)">
              <span class="gs-hit-badge">{{ surfaceBadges[result.surface] }}</span>
              <span class="gs-hit-main">
                <span class="gs-hit-title">{{ lang === 'vi' ? result.vi : result.en }}</span>
                <span class="gs-hit-context">{{ lang === 'vi' ? result.contextVi : result.contextEn }}</span>
              </span>
            </NuxtLink>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>
