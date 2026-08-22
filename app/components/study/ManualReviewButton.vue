<script setup lang="ts">
const props = defineProps<{ reviewId: string }>();

const progress = import.meta.client ? useStudyProgress() : null;
const isReviewed = computed(() => progress?.reviewed.value.includes(props.reviewId) || false);

function markReviewed() {
  progress?.markReviewed(props.reviewId);
}
</script>

<template>
  <button
    class="manual-review"
    :class="{ 'is-reviewed': isReviewed }"
    type="button"
    :aria-pressed="isReviewed"
    :aria-label="isReviewed ? 'Reviewed' : 'Mark reviewed'"
    :title="isReviewed ? 'Reviewed' : 'Mark reviewed'"
    @click.stop="markReviewed"
  >
    <span class="manual-review-box" aria-hidden="true">{{ isReviewed ? '✓' : '□' }}</span>
    <span class="manual-review-label">{{ isReviewed ? 'Reviewed' : 'Mark reviewed' }}</span>
  </button>
</template>
