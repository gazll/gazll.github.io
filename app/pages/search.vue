<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const query = ref(String(route.query.q || ''));
const surface = ref(String(route.query.surface || 'all'));
const { data: entries } = await useAsyncData('search:index', () => $fetch<any[]>('/api/content/search-index'));
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const results = computed(() => {
  const terms = fold(query.value).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return (entries.value || []).filter(entry => {
    if (surface.value !== 'all' && entry.surface !== surface.value) return false;
    const text = fold(`${entry.en} ${entry.vi} ${entry.contextEn} ${entry.contextVi}`);
    return terms.every(term => text.includes(term));
  }).slice(0, 200);
});
const surfaces = ['all', 'track', 'system-design', 'case-studies', 'photography', 'homelab'];
const resultRoute = (href: string) => {
  const [path, hash = ''] = href.split('#', 2);
  return { path, hash: hash ? `#${hash}` : '', query: lang.value === 'vi' ? { lang: 'vi' } : {} };
};

watch([query, surface], () => router.replace({ query: {
  ...(query.value ? { q: query.value } : {}),
  ...(surface.value !== 'all' ? { surface: surface.value } : {}),
  ...(lang.value === 'vi' ? { lang: 'vi' } : {})
} }));

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
      <div class="page search-page">
        <header><p class="eyebrow">Everything in one place</p><h1>Search</h1></header>
        <form class="search-form" role="search" @submit.prevent>
          <input v-model="query" type="search" autofocus placeholder="Search topics, designs and articles…" aria-label="Search">
        </form>
        <div class="search-filters" role="group" aria-label="Search surface">
          <button v-for="item in surfaces" :key="item" type="button" :class="{ active: surface === item }" @click="surface = item">{{ item }}</button>
        </div>
        <p v-if="query" class="search-summary">{{ results.length }} result{{ results.length === 1 ? '' : 's' }}</p>
        <div class="search-results">
          <NuxtLink v-for="result in results" :key="result.id" class="search-result" :to="resultRoute(result.href)">
            <span class="search-result-surface">{{ result.surface }}</span>
            <strong>{{ lang === 'vi' ? result.vi : result.en }}</strong>
            <span>{{ lang === 'vi' ? result.contextVi : result.contextEn }}</span>
          </NuxtLink>
        </div>
      </div>
    </main>
  </div>
</template>
