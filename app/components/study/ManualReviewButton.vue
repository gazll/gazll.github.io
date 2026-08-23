<script setup lang="ts">
const props = defineProps<{ reviewId: string }>();

const progress = import.meta.client ? useStudyProgress() : null;
const isReviewed = computed(() => progress?.reviewed.value.includes(props.reviewId) || false);

function toggleReviewed() {
  progress?.toggleReviewed(props.reviewId);
}
</script>

<template>
  <button
    class="manual-review"
    :class="{ 'is-reviewed': isReviewed }"
    type="button"
    :aria-pressed="isReviewed"
    :aria-label="isReviewed ? 'Unmark reviewed' : 'Mark reviewed'"
    :title="isReviewed ? 'Unmark reviewed' : 'Mark reviewed'"
    @click.stop="toggleReviewed"
  >
    <svg class="manual-review-glyph" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="3" stroke="currentColor" stroke-width="1.5" />
      <path class="manual-review-checkmark" d="m5 8.1 2 2 4.2-4.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span class="manual-review-label">{{ isReviewed ? 'Unmark reviewed' : 'Mark reviewed' }}</span>
  </button>
</template>
