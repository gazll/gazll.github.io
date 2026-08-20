<script setup lang="ts">
import { renderMarkdown } from '~/utils/markdown.js';

const props = defineProps<{
  item: { id: string, q: string, a: string, difficulty?: string, reviewed_at?: string }
  lang: 'en' | 'vi'
}>();

const open = ref(false);
const noteBody = ref('');
const card = ref<HTMLElement | null>(null);
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let dsaPlayer: any = null;

const progress = import.meta.client ? useStudyProgress() : null;
const isReviewed = computed(() => progress?.reviewed.value.includes(props.item.id) || false);
const sequence = computed(() => /\.q(\d+)$/.exec(props.item.id)?.[1] || '?');
const answer = computed(() => renderMarkdown(props.item.a, {
  headingPrefix: `question-${props.item.id}`,
  stableHeadingIds: true
}));

onMounted(() => { noteBody.value = progress?.note(props.item.id) || ''; });
onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
  if (card.value && dsaPlayer) dsaPlayer.stopDsaPlayers(card.value);
});

async function toggle() {
  open.value = !open.value;
  if (open.value) {
    progress?.markReviewed(props.item.id);
    await nextTick();
    dsaPlayer ||= await import(/* @vite-ignore */ '/views/dsa-player.js');
    if (card.value) dsaPlayer.mountDsaPlayers(card.value, props.lang);
  } else if (card.value && dsaPlayer) {
    dsaPlayer.stopDsaPlayers(card.value);
  }
}

function queueNote() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => progress?.saveNote(props.item.id, noteBody.value), 600);
}

async function copyLink() {
  const url = new URL(window.location.href);
  url.hash = `question-${props.item.id}`;
  await navigator.clipboard.writeText(url.href);
}
</script>

<template>
  <article
    ref="card"
    :id="`question-${item.id}`"
    class="qcard"
    :class="[{ open, done: isReviewed }, item.difficulty && `difficulty-${item.difficulty}`]"
    :data-qid="item.id"
  >
    <div class="qtop">
      <button class="qhead" type="button" :aria-expanded="open" @click="toggle">
        <span class="qid" :title="item.id">Q{{ sequence }}</span>
        <span v-if="item.difficulty" class="badge" :class="`badge-${item.difficulty}`">{{ item.difficulty }}</span>
        <span class="qtext">{{ item.q }}</span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
      <div class="qmeta">
        <button class="qcopy" type="button" aria-label="Copy link to this question" @click="copyLink">
          <span class="qcopy-label">Copy link</span>
        </button>
      </div>
    </div>
    <div class="qbody">
      <div class="qbody-inner">
        <div class="answer">
          <div class="answer-body" v-html="answer" />
          <div class="notebox" :class="{ 'has-note': noteBody.trim() }">
            <div class="note-head"><span class="note-label">My notes</span></div>
            <textarea
              v-model="noteBody"
              class="note-input"
              rows="3"
              placeholder="Write the answer back in your own words — this is the part that actually trains you."
              @input="queueNote"
              @blur="progress?.saveNote(item.id, noteBody)"
            />
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
