<script setup lang="ts">
/* The denominator comes from the compact topic payload, never from the topics
   that happen to be loaded: topic files arrive lazily, so counting what is in
   memory would shrink the ring to the one open topic. The legacy
   `/api/content/item-index` route remains available for older prerendered
   pages, while current pages receive the projection directly. */
const props = withDefaults(defineProps<{ lang?: 'en' | 'vi'; index?: any }>(), { lang: 'en' });

const { reviewed } = useStudyProgress();

const trackIds = computed<Set<string>>(() => new Set(
  props.index?.track_item_ids
    || Object.values(props.index?.topics || {}).flatMap((row: any) => row.track_item_ids || [])
));
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
