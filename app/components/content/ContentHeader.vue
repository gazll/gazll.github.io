<script setup lang="ts">
defineProps<{ lang: 'en' | 'vi' }>();
const route = useRoute();
</script>

<template>
  <header class="top">
    <div class="top-inner">
      <NuxtLink class="topicpick" to="/">GAZLL</NuxtLink>
      <nav class="headright" aria-label="Main navigation">
        <NuxtLink class="searchtrigger" to="/system-design">System Design</NuxtLink>
        <NuxtLink class="searchtrigger" to="/case-studies">Case Studies</NuxtLink>
        <NuxtLink class="searchtrigger" to="/search">Search</NuxtLink>
        <NuxtLink :to="{ path: route.path, query: { lang: lang === 'vi' ? 'en' : 'vi' } }" class="langswitch hdr-lang">
          {{ lang === 'vi' ? 'VI → EN' : 'EN → VI' }}
        </NuxtLink>
        <ClientOnly><AuthAuthControl /></ClientOnly>
      </nav>
    </div>
  </header>
</template>
