<script setup lang="ts">
import { renderMarkdown } from '~/utils/markdown.js';
import { safeDecodeURIComponent } from '~/utils/uri.js';

const props = defineProps<{
  item: { id: string, q: string, a: string, difficulty?: string, reviewed_at?: string }
  pair?: Record<'en' | 'vi', any>
  lang: 'en' | 'vi'
  sourceOwners?: Record<string, string>
  forceOpen?: boolean
  forceToken?: number
}>();

const open = ref(false);
const localLang = ref<'en' | 'vi'>(props.lang);
const copied = ref(false);
const noteBody = ref('');
const card = ref<HTMLElement | null>(null);
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let dsaPlayer: any = null;

const progress = import.meta.client ? useStudyProgress() : null;
const isReviewed = computed(() => progress?.reviewed.value.includes(props.item.id) || false);
const currentItem = computed(() => props.pair?.[localLang.value] || props.pair?.en || props.item);
const sequence = computed(() => /\.q(\d+)$/.exec(currentItem.value.id)?.[1] || '?');
const answer = computed(() => renderMarkdown(currentItem.value.a, {
  resolveRef: (id: string) => {
    const owner = props.sourceOwners?.[id];
    const href = owner ? `/system-design/${owner}#question-${encodeURIComponent(id)}` : `/topics/${id.split('.')[0]}#question-${encodeURIComponent(id)}`;
    return { href, label: `Q${/\.q(\d+)$/.exec(id)?.[1] || ''}` };
  },
  headingPrefix: `question-${currentItem.value.id}`,
  stableHeadingIds: true,
  headingLinkLabel: localLang.value === 'vi' ? 'Liên kết đến mục này' : 'Link to this section'
}));
const reviewedLabel = computed(() => {
  if (!currentItem.value.reviewed_at) return '';
  try { return new Intl.DateTimeFormat(localLang.value === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium' }).format(new Date(currentItem.value.reviewed_at)); }
  catch { return currentItem.value.reviewed_at; }
});

async function setOpen(next: boolean) {
  if (open.value === next) return;
  open.value = next;
  if (open.value) {
    progress?.markReviewed(props.item.id);
    await nextTick();
    const dsaPlayerUrl = new URL('/lib/dsa-player.js', window.location.origin).href;
    dsaPlayer ||= await import(/* @vite-ignore */ dsaPlayerUrl);
    if (card.value) dsaPlayer.mountDsaPlayers(card.value, localLang.value);
  } else if (card.value && dsaPlayer) dsaPlayer.stopDsaPlayers(card.value);
}
function revealHash() {
  const hash = safeDecodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (hash === `question-${props.item.id}` || hash.startsWith(`question-${props.item.id}-`)) {
    setOpen(true).then(() => document.getElementById(`question-${props.item.id}`)?.scrollIntoView({ block: 'start' }));
  }
}
onMounted(() => {
  noteBody.value = progress?.note(props.item.id) || '';
  revealHash();
  window.addEventListener('hashchange', revealHash);
});
onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
  if (card.value && dsaPlayer) dsaPlayer.stopDsaPlayers(card.value);
  window.removeEventListener('hashchange', revealHash);
});
watch(() => props.lang, value => { localLang.value = value; });
watch(() => props.forceToken, () => setOpen(Boolean(props.forceOpen)));

async function toggle() {
  await setOpen(!open.value);
}

function queueNote() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => progress?.saveNote(props.item.id, noteBody.value), 600);
}

async function copyLink() {
  const url = new URL(window.location.href);
  url.hash = `question-${props.item.id}`;
  try { await navigator.clipboard.writeText(url.href); }
  catch { window.prompt('Copy this link', url.href); }
  copied.value = true;
  window.setTimeout(() => { copied.value = false; }, 1600);
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
        <span v-if="currentItem.difficulty" class="badge" :class="`badge-${currentItem.difficulty}`">{{ currentItem.difficulty }}</span>
        <span class="qtext">{{ currentItem.q }}</span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
      <div class="qmeta">
        <time v-if="reviewedLabel" class="qreview" :datetime="currentItem.reviewed_at">Reviewed {{ reviewedLabel }}</time>
        <button class="qcopy" type="button" aria-label="Copy link to this question" @click="copyLink">
          <span class="qcopy-label">{{ copied ? 'Copied' : 'Copy link' }}</span>
        </button>
        <button v-if="pair?.vi" class="langswitch qlangbtn" type="button" role="switch" :aria-checked="localLang === 'vi'" aria-label="Show this question in the other language" @click="localLang = localLang === 'vi' ? 'en' : 'vi'">
          <span class="lang-label">EN</span><span class="lang-track" aria-hidden="true"><span class="lang-knob">{{ localLang === 'vi' ? '🇻🇳' : '🇬🇧' }}</span></span><span class="lang-label">VI</span>
        </button>
      </div>
    </div>
    <div class="qbody">
      <div class="qbody-inner">
        <div class="answer">
          <p v-if="reviewedLabel" class="qreview-mobile">Technically reviewed <time :datetime="currentItem.reviewed_at">{{ reviewedLabel }}</time></p>
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
