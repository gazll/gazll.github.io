<script setup lang="ts">
/* The denominator comes from data/content-index.json, never from the topics
   that happen to be loaded: topic files arrive lazily, so counting what is in
   memory would shrink the ring to the one open topic. The index already drops
   everything routed to another surface, which is why it is smaller than what
   data/topics/ holds. */
const props = withDefaults(defineProps<{ lang?: 'en' | 'vi' }>(), { lang: 'en' });

const { reviewed } = useStudyProgress();
const { data: index } = await useAsyncData('content-index', () => $fetch<any>('/api/content/item-index'));

const trackIds = computed<Set<string>>(() => new Set(Object.keys(index.value?.items || {})));
const total = computed(() => trackIds.value.size);
// Items moved to another surface keep their ids as stored Sheet keys, so a
// reader's old progress rows stay in the Sheet but must not be counted here.
const done = computed(() => reviewed.value.filter(id => trackIds.value.has(id)).length);
const percent = computed(() => total.value ? Math.round(done.value / total.value * 100) : 0);
const label = computed(() => props.lang === 'vi' ? 'Đã ôn' : 'Reviewed');
</script>

<template>
  <div v-if="total" class="progress-wrap track-only">
    <div class="progress-meta">{{ label }}<br><b>{{ done }}</b> / <span>{{ total }}</span></div>
    <div
      class="ring" :style="{ '--p': percent }" role="img"
      :aria-label="`${label} ${done}/${total} (${percent}%)`"
    />
  </div>
</template>
