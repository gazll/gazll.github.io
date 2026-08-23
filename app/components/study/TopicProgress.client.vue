<script setup lang="ts">
/* Per-topic progress in the topic dropdown.

   The header ring answers "how far through the track am I"; this answers the
   question a reader actually has while picking the next topic — "which one have
   I not finished". The migration dropped it and left the `.tm-prog/.tm-bar/
   .tm-pct` rules behind with nothing rendering them.

   Client-only, and it receives the compact progress projection from the
   current topic payload, so opening the picker never starts one request per
   row. The denominator is that projection: item files load lazily, so
   counting what is in memory would shrink to the open topic. The legacy
   `/api/content/item-index` route remains available for older prerendered
   pages. */
const props = defineProps<{ n: number; index?: any }>();

const { reviewed } = useStudyProgress();

const itemIds = computed<string[]>(() => {
  const rows: any[] = Object.values(props.index?.topics || {});
  return rows.find(row => row.n === props.n)?.item_ids || [];
});
const total = computed(() => itemIds.value.length);
const done = computed(() => {
  const seen = new Set(reviewed.value);
  return itemIds.value.filter(id => seen.has(id)).length;
});
const percent = computed(() => total.value ? Math.round(done.value / total.value * 100) : 0);
</script>

<template>
  <span v-if="total" class="tm-prog" :aria-label="`${done}/${total}`">
    <span class="tm-bar" :style="{ '--p': percent }" />
    <span class="tm-pct">{{ done }}/{{ total }}</span>
  </span>
</template>
