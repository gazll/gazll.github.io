<script setup lang="ts">
import { contentDateFacts } from '~/utils/content-dates.js';

const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData('system-design:index', () => $fetch<any>('/api/content/system-design/index'));
const copy = computed(() => data.value.library[lang.value] || data.value.library.en);
const text = (row: any) => row?.[lang.value] || row?.en || row?.vi || {};
const groups = computed(() => (data.value.categories || []).map((category: any) => ({
  ...category,
  copy: text(category),
  designs: (data.value.designs || []).filter((design: any) => design.category === category.id)
})).filter((group: any) => group.designs.length));
const production = computed(() => text(data.value.production));
const designRoute = (slug: string) => ({ path: `/system-design/${slug}`, query: lang.value === 'vi' ? { lang: 'vi' } : {} });
const caseRoute = (slug: string) => ({ path: `/case-studies/${slug}`, query: lang.value === 'vi' ? { lang: 'vi' } : {} });
const lastDate = (row: any) => contentDateFacts(row, lang.value).at(-1);
const levelLabel = (level: string) => ({ core: 'Core', advanced: 'Advanced', extra: 'Extra' }[level] || 'Advanced');

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: `${copy.value.title} — GAZLL`,
  meta: [{ name: 'description', content: copy.value.intro }],
  link: [{ rel: 'stylesheet', href: '/styles.css' }, { rel: 'canonical', href: 'https://gazll.github.io/system-design' }]
}));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" class="view">
      <div class="sd-library">
        <header class="sd-hero">
          <p class="cs-eyebrow">{{ copy.eyebrow }}</p>
          <h1>{{ copy.title }}</h1>
          <p>{{ copy.intro }}</p>
          <div class="cs-library-stats">
            <span><b>{{ data.designs.length }}</b> blueprints</span>
            <span><b>{{ data.cases?.length || 0 }}</b> production cases</span>
            <span>Mermaid · EN/VI</span>
          </div>
        </header>

        <section v-for="group in groups" :key="group.id" class="sd-group" :aria-labelledby="`sd-group-${group.id}`">
          <header>
            <div><p>Blueprint collection</p><h2 :id="`sd-group-${group.id}`">{{ group.copy.label }}</h2><span>{{ group.copy.description }}</span></div>
            <b>{{ group.designs.length }}</b>
          </header>
          <div class="sd-list">
            <NuxtLink v-for="design in group.designs" :key="design.slug" class="sd-card" :to="designRoute(design.slug)">
              <span class="sd-card-num">{{ String(design.n).padStart(2, '0') }}</span>
              <span class="sd-card-main">
                <span class="sd-card-kicker">Blueprint <span class="content-level" :class="`level-${design.level || 'advanced'}`">{{ levelLabel(design.level) }}</span><span v-if="design.featured" class="featured-mark" role="img" aria-label="Featured">★</span></span>
                <strong>{{ text(design).title }}</strong>
                <span>{{ text(design).excerpt }}</span>
                <span class="sd-card-tags"><i v-for="tag in (text(design).tags || []).slice(0, 4)" :key="tag">{{ tag }}</i></span>
                <span class="sd-card-meta"><span>{{ design.effort || '45 min' }}</span><span v-if="lastDate(design)">{{ lastDate(design).label }} {{ lastDate(design).formatted }}</span></span>
              </span>
              <span class="sd-card-arrow" aria-hidden="true">→</span>
            </NuxtLink>
          </div>
        </section>

        <section v-if="data.cases?.length" class="sd-group sd-production" aria-labelledby="sd-group-production-cases">
          <header>
            <div><p>Production evidence</p><h2 id="sd-group-production-cases">{{ production.label }}</h2><span>{{ production.description }}</span></div>
            <b>{{ data.cases.length }}</b>
          </header>
          <div class="sd-list">
            <NuxtLink v-for="article in data.cases" :key="article.slug" class="sd-card sd-case-card" :to="caseRoute(article.slug)">
              <span class="sd-case-art" aria-hidden="true"><img :src="`/${article.cover_image}`" alt="" loading="lazy"></span>
              <span class="sd-card-main">
                <span class="sd-card-kicker">Production case · {{ article.company }} <span class="content-level" :class="`level-${article.level || 'advanced'}`">{{ levelLabel(article.level) }}</span></span>
                <strong>{{ text(article.metadata).title }}</strong>
                <span>{{ text(article.overview).lens || text(article.metadata).excerpt }}</span>
                <span class="sd-card-tags"><i v-for="tag in (text(article.metadata).tags || []).slice(0, 4)" :key="tag">{{ tag }}</i></span>
                <span class="sd-card-meta"><span>{{ article.read_minutes }} min read</span><span v-if="lastDate(article)">{{ lastDate(article).label }} {{ lastDate(article).formatted }}</span></span>
              </span>
              <span class="sd-card-arrow" aria-hidden="true">→</span>
            </NuxtLink>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
