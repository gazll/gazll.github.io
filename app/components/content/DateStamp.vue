<script setup lang="ts">
import { relativeContentDate } from '~/utils/content-dates.js';

/* One date stamp, shared by every surface that prints authored-content dates:
   the two library index cards, both article heads and the topic hero.

   The relative wording is resolved on mount, never during SSR. Every route
   here is prerendered, so a server-rendered "3 days ago" would be frozen at
   build time — wrong for the reader and a hydration mismatch besides. The
   absolute date is what the server prints, what `datetime` carries and what
   the tooltip keeps. */
const props = defineProps<{
  fact: { kind: string; label: string; value: string; formatted: string };
  lang: 'en' | 'vi';
  /** Cards print `Updated 3 days ago` inline; article heads stack label over date. */
  inline?: boolean;
}>();

const relative = ref('');
onMounted(() => { relative.value = relativeContentDate(props.fact.value, props.lang); });
const display = computed(() => relative.value || props.fact.formatted);
</script>

<template>
  <span v-if="inline" class="datestamp is-inline">
    <b>{{ fact.label }}</b><time :datetime="fact.value" :title="fact.formatted">{{ display }}</time>
  </span>
  <span v-else class="datestamp" :data-kind="fact.kind">
    <b>{{ fact.label }}</b><time :datetime="fact.value" :title="fact.formatted">{{ display }}</time>
  </span>
</template>
