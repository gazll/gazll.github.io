<script setup lang="ts">
const props = defineProps<{ collection: 'case-studies' | 'photography' | 'homelab' }>();
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data } = await useAsyncData(`collection:${props.collection}`, () =>
  $fetch<any>(`/api/content/collection/${props.collection}/index`));
const copy = computed(() => data.value.library[lang.value] || data.value.library.en);
const text = (row: any) => row?.[lang.value] || row?.en || row?.vi || {};

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: `${copy.value.title} — GAZLL`,
  meta: [{ name: 'description', content: copy.value.intro }],
  link: [
    { rel: 'stylesheet', href: '/styles.css' },
    { rel: 'canonical', href: `https://gazll.github.io/${props.collection}` }
  ]
}));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" class="view">
      <div class="page cs-page">
        <header class="cs-library-head">
          <p class="eyebrow">{{ copy.eyebrow }}</p>
          <h1>{{ copy.title }}</h1>
          <p class="intro">{{ copy.intro }}</p>
        </header>
        <section v-for="(category, categoryId) in data.categories" :key="categoryId" class="cs-category">
          <h2>{{ text(category).label }}</h2>
          <p>{{ text(category).description }}</p>
          <div class="cs-grid">
            <NuxtLink
              v-for="article in data.articles.filter((row: any) => row.category === categoryId)"
              :key="article.slug"
              class="cs-card"
              :to="`/${collection}/${article.slug}?lang=${lang}`"
            >
              <img v-if="article.cover_image" :src="`/${article.cover_image}`" :alt="text(article.metadata).title">
              <span class="cs-card-kicker">{{ article.company || article.level }}<template v-if="article.read_minutes"> · {{ article.read_minutes }} min</template></span>
              <strong>{{ text(article.metadata).title }}</strong>
              <span>{{ text(article.metadata).excerpt }}</span>
              <span class="cs-card-tags">{{ (text(article.metadata).tags || []).join(' · ') }}</span>
            </NuxtLink>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
