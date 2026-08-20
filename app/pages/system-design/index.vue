<script setup lang="ts">
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData('system-design:index', () => $fetch<any>('/api/content/system-design/index'));
const copy = computed(() => data.value.library[lang.value] || data.value.library.en);
const text = (row: any) => row[lang.value] || row.en || row.vi || {};

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
      <div class="page sd-page">
        <header class="sd-library-head">
          <p class="eyebrow">{{ copy.eyebrow }}</p>
          <h1>{{ copy.title }}</h1>
          <p class="intro">{{ copy.intro }}</p>
        </header>
        <section v-for="category in data.categories" :key="category.id" class="sd-category">
          <h2>{{ text(category).label }}</h2>
          <p>{{ text(category).description }}</p>
          <div class="sd-grid">
            <NuxtLink
              v-for="design in data.designs.filter((row: any) => row.category === category.id)"
              :key="design.slug"
              class="sd-card"
              :to="`/system-design/${design.slug}?lang=${lang}`"
            >
              <span class="sd-card-kicker">{{ design.level }} · {{ design.effort }}</span>
              <strong>{{ text(design).title }}</strong>
              <span>{{ text(design).excerpt }}</span>
              <span class="sd-card-tags">{{ (text(design).tags || []).join(' · ') }}</span>
            </NuxtLink>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
