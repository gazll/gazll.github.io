<script setup lang="ts">
const props = withDefaults(defineProps<{ reviewId: string; lang?: 'en' | 'vi' }>(), {
  lang: 'en'
});

const progress = import.meta.client ? useStudyProgress() : null;
const isReviewed = computed(() => progress?.reviewed.value.includes(props.reviewId) || false);
const announcement = ref('');
const statusLabels = computed(() => props.lang === 'vi'
  ? { on: '\u0110\u00e3 \u0111\u00e1nh d\u1ea5u \u0111\u00e3 \u00f4n', off: '\u0110\u00e3 b\u1ecf \u0111\u00e1nh d\u1ea5u' }
  : { on: 'Marked reviewed', off: 'Review mark removed' });
let announcementTimer: ReturnType<typeof setTimeout> | null = null;
const labels = computed(() => props.lang === 'vi'
  ? { pending: 'Đánh dấu đã ôn', done: 'Bỏ đánh dấu đã ôn' }
  : { pending: 'Mark reviewed', done: 'Unmark reviewed' });

const shortLabels = computed(() => props.lang === 'vi'
  ? { pending: '\u00d4n xong', done: '\u0110\u00e3 \u00f4n' }
  : { pending: 'Review', done: 'Reviewed' });

function toggleReviewed() {
  const next = !isReviewed.value;
  progress?.toggleReviewed(props.reviewId);
  announcement.value = next ? statusLabels.value.on : statusLabels.value.off;
  if (announcementTimer) clearTimeout(announcementTimer);
  announcementTimer = setTimeout(() => { announcement.value = ''; }, 1800);
}
onBeforeUnmount(() => { if (announcementTimer) clearTimeout(announcementTimer); });
</script>

<template>
  <button
    class="manual-review"
    :class="{ 'is-reviewed': isReviewed }"
    type="button"
    :aria-pressed="isReviewed"
    :aria-label="isReviewed ? labels.done : labels.pending"
    :title="isReviewed ? labels.done : labels.pending"
    @click.stop="toggleReviewed"
  >
    <svg class="manual-review-glyph" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="3" stroke="currentColor" stroke-width="1.5" />
      <path class="manual-review-checkmark" d="m5 8.1 2 2 4.2-4.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span class="manual-review-label">{{ isReviewed ? labels.done : labels.pending }}</span>
    <span class="manual-review-short" aria-hidden="true">{{ isReviewed ? shortLabels.done : shortLabels.pending }}</span>
  </button>
  <span class="sr-only" role="status" aria-live="polite">{{ announcement }}</span>
</template>
