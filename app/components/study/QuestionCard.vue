<script setup lang="ts">
import { copyText } from '../../../public/lib/clipboard.js';
import { DIFFICULTY_LABEL } from '../../../public/lib/constants.js';
import { contentDateFacts } from '~/utils/content-dates.js';
import { renderMarkdown } from '~/utils/markdown.js';
import { safeDecodeURIComponent } from '~/utils/uri.js';

const props = defineProps<{
  item: { id: string, q: string, a: string, difficulty?: string, reviewed_at?: string }
  pair?: Record<'en' | 'vi', any>
  lang: 'en' | 'vi'
  sourceOwners?: Record<string, string>
  /* Built once per page from data/content-index.json — see lib/cross-ref.js.
     Passed in rather than built here so 26 cards share one resolver. */
  resolveRef?: (id: string) => { href: string, label: string } | null
  forceOpen?: boolean
  forceToken?: number
}>();

const open = ref(false);
const localLang = ref<'en' | 'vi'>(props.lang);
const copied = ref(false);
const languageAnnouncement = ref('');
const noteBody = ref('');
const noteOpen = ref(false);
const noteSaving = ref(false);
const noteSaved = ref(false);
const card = ref<HTMLElement | null>(null);
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let savedTimer: ReturnType<typeof setTimeout> | null = null;
let languageTimer: ReturnType<typeof setTimeout> | null = null;
let dsaPlayer: any = null;

const progress = import.meta.client ? useStudyProgress() : null;
const isReviewed = computed(() => progress?.reviewed.value.includes(props.item.id) || false);
const currentItem = computed(() => props.pair?.[localLang.value] || props.pair?.en || props.item);
const sequence = computed(() => /\.q(\d+)$/.exec(currentItem.value.id)?.[1] || '?');
/* Difficulty and the collection level are the same closed set drawn the same
   way, so they share .content-level rather than keeping a second badge whose
   border and colours the migration dropped. */
const difficultyLabel = computed(() => DIFFICULTY_LABEL[currentItem.value.difficulty as 'core'] || currentItem.value.difficulty);
const answer = computed(() => renderMarkdown(currentItem.value.a, {
  resolveRef: props.resolveRef,
  headingPrefix: `question-${currentItem.value.id}`,
  stableHeadingIds: true,
  headingLinkLabel: localLang.value === 'vi' ? 'Liên kết đến mục này' : 'Link to this section'
}));
/* One reviewed stamp, and it lives in the answer rather than on the collapsed
   row. Repeated down 26 collapsed cards it was chrome competing with the
   questions; inside the answer it sits next to the claim it vouches for. The
   shared stamp also means this date is worded like every other date on the
   site instead of keeping a second format of its own. */
const reviewedFact = computed(() =>
  contentDateFacts({ reviewed_at: currentItem.value.reviewed_at }, localLang.value)[0] || null);
const uiLabels = computed(() => localLang.value === 'vi' ? {
  copied: 'Đã sao chép',
  copy: 'Sao chép liên kết',
  language: 'Hiển thị câu hỏi bằng tiếng Anh',
  notes: 'Ghi chú cá nhân',
  addNote: 'Thêm ghi chú',
  hideNote: 'Ẩn ghi chú',
  saving: 'Đang lưu',
  saved: 'Đã lưu',
  notePlaceholder: 'Viết lại câu trả lời bằng lời của bạn — đây là phần thực sự giúp bạn luyện tập.'
} : {
  copied: 'Copied',
  copy: 'Copy link',
  language: 'Show this question in Vietnamese',
  notes: 'My notes',
  addNote: 'Add note',
  hideNote: 'Hide note',
  saving: 'Saving',
  saved: 'Saved',
  notePlaceholder: 'Write the answer back in your own words — this is the part that actually trains you.'
});

const languageActionLabel = computed(() => {
  const target = localLang.value === 'vi' ? 'en' : 'vi';
  if (props.lang === 'vi') return target === 'vi'
    ? 'Hi\u1ec3n th\u1ecb c\u00e2u h\u1ecfi b\u1eb1ng ti\u1ebfng Vi\u1ec7t'
    : 'Hi\u1ec3n th\u1ecb c\u00e2u h\u1ecfi b\u1eb1ng ti\u1ebfng Anh';
  return target === 'vi' ? 'Show this question in Vietnamese' : 'Show this question in English';
});
const languageChangedLabel = computed(() => {
  if (props.lang === 'vi') return localLang.value === 'vi'
    ? 'C\u00e2u h\u1ecfi hi\u1ec7n hi\u1ec3n th\u1ecb b\u1eb1ng ti\u1ebfng Vi\u1ec7t'
    : 'C\u00e2u h\u1ecfi hi\u1ec7n hi\u1ec3n th\u1ecb b\u1eb1ng ti\u1ebfng Anh';
  return localLang.value === 'vi' ? 'Question is now shown in Vietnamese' : 'Question is now shown in English';
});

const shortUiLabels = computed(() => localLang.value === 'vi'
  ? { link: '\u004c\u0069\u00ea\u006e \u006b\u1ebft', copied: '\u0110\u00e3 copy' }
  : { link: 'Link', copied: 'Copied' });

async function setOpen(next: boolean) {
  if (open.value === next) return;
  open.value = next;
  if (open.value) {
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
  noteOpen.value = Boolean(noteBody.value.trim());
  revealHash();
  window.addEventListener('hashchange', revealHash);
});
onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
  if (savedTimer) clearTimeout(savedTimer);
  if (languageTimer) clearTimeout(languageTimer);
  if (card.value && dsaPlayer) dsaPlayer.stopDsaPlayers(card.value);
  window.removeEventListener('hashchange', revealHash);
});
watch(() => props.lang, value => { localLang.value = value; });
/* Switching one card's language replaces its answer markup, so the running
   player must be stopped before the old nodes go and remounted against the
   new ones — skip the stop and the setInterval keeps stepping a detached
   figure. mountDsaPlayers takes the language explicitly because this switch
   deliberately does not touch the global content language. */
watch(localLang, async language => {
  if (!open.value || !card.value || !dsaPlayer) return;
  dsaPlayer.stopDsaPlayers(card.value);
  await nextTick();
  if (card.value) dsaPlayer.mountDsaPlayers(card.value, language);
});
watch(() => props.forceToken, () => setOpen(Boolean(props.forceOpen)));

async function toggle() {
  await setOpen(!open.value);
}

function switchLanguage() {
  const previousTop = card.value?.getBoundingClientRect().top ?? null;
  localLang.value = localLang.value === 'vi' ? 'en' : 'vi';
  if (languageTimer) clearTimeout(languageTimer);
  void nextTick(() => {
    /* Localized answers can have very different heights. Keeping this card's
       top edge fixed prevents a long mobile answer from jumping away. */
    if (previousTop != null && card.value && typeof window !== 'undefined') {
      const delta = card.value.getBoundingClientRect().top - previousTop;
      if (Math.abs(delta) > 1) window.scrollBy(0, delta);
    }
    languageAnnouncement.value = languageChangedLabel.value;
    languageTimer = setTimeout(() => { languageAnnouncement.value = ''; }, 1800);
  });
}

function persistNote() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  progress?.saveNote(props.item.id, noteBody.value);
  noteSaving.value = false;
  noteSaved.value = true;
  if (savedTimer) clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { noteSaved.value = false; }, 1600);
}
function queueNote() {
  if (saveTimer) clearTimeout(saveTimer);
  noteSaving.value = true;
  noteSaved.value = false;
  saveTimer = setTimeout(persistNote, 600);
}

function toggleNote() {
  noteOpen.value = !noteOpen.value;
}

async function copyLink() {
  const url = new URL(window.location.href);
  url.hash = `question-${props.item.id}`;
  try { await copyText(url.href); }
  catch { window.prompt(uiLabels.value.copy, url.href); }
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
    data-ui="study-question-card"
  >
    <div class="qtop" data-ui="question-header">
      <button class="qhead" :id="`question-${item.id}-toggle`" data-ui="question-toggle" type="button" :aria-expanded="open" :aria-controls="`question-${item.id}-body`" @click="toggle">
        <span class="qid" :title="item.id">Q{{ sequence }}</span>
        <span class="qprompt">
          <span v-if="currentItem.difficulty" class="content-level" :class="`level-${currentItem.difficulty}`">{{ difficultyLabel }}</span>
          <span class="qtext">{{ currentItem.q }}</span>
        </span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
      <div class="qmeta">
        <StudyManualReviewButton :review-id="item.id" :lang="localLang" />
        <button class="qcopy" type="button" :class="{ 'is-copied': copied }" :aria-label="copied ? uiLabels.copied : uiLabels.copy" :title="copied ? uiLabels.copied : uiLabels.copy" @click="copyLink">
          <svg class="qcopy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path v-if="copied" d="M5 13l4 4L19 7" />
            <path v-else d="M10 13a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.6 5.7M14 11a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.4-1.4" />
          </svg>
          <span class="qcopy-label">{{ copied ? uiLabels.copied : uiLabels.copy }}</span>
          <span class="qcopy-short" aria-hidden="true">{{ copied ? shortUiLabels.copied : shortUiLabels.link }}</span>
        </button>
        <span class="sr-only" role="status" aria-live="polite">{{ languageAnnouncement || (copied ? uiLabels.copied : '') }}</span>
        <button v-if="pair?.vi" class="langswitch qlangbtn" type="button" role="switch" :aria-checked="localLang === 'vi'" :aria-label="languageActionLabel" :title="languageActionLabel" @click="switchLanguage">
          <span class="lang-label" data-lang="en">EN</span><span class="lang-track" aria-hidden="true"><span class="lang-knob"><ContentFlagIcon :lang="localLang" /></span></span><span class="lang-label" data-lang="vi">VI</span><span class="qlang-current" aria-hidden="true">{{ localLang.toUpperCase() }}</span>
        </button>
      </div>
    </div>
    <div :id="`question-${item.id}-body`" class="qbody" data-ui="question-body" role="region" :aria-labelledby="`question-${item.id}-toggle`" :hidden="!open">
      <div class="qbody-inner">
        <div :id="`question-${item.id}-answer`" class="answer" data-ui="question-answer">
          <div v-if="reviewedFact" class="content-dates qreview">
            <ContentDateStamp :fact="reviewedFact" :lang="localLang" />
          </div>
          <div :id="`question-${item.id}-answer-body`" class="answer-body" data-ui="answer-body" v-html="answer" />
          <div class="notebox" :class="{ 'has-note': noteBody.trim(), 'is-open': noteOpen }">
            <div class="note-head">
              <span class="note-title-group"><span :id="`question-${item.id}-notes-label`" class="note-label">{{ uiLabels.notes }}</span><span class="note-status" role="status" aria-live="polite">{{ noteSaving ? uiLabels.saving : noteSaved ? uiLabels.saved : '' }}</span></span>
              <button type="button" class="note-toggle" :aria-expanded="noteOpen" :aria-controls="`question-${item.id}-notes`" @click="toggleNote">
                {{ noteOpen ? uiLabels.hideNote : uiLabels.addNote }}
              </button>
            </div>
            <textarea v-if="noteOpen"
              v-model="noteBody"
              :id="`question-${item.id}-notes`"
              class="note-input"
              data-ui="answer-notes"
              :aria-labelledby="`question-${item.id}-notes-label`"
              rows="3"
              :placeholder="uiLabels.notePlaceholder"
              @input="queueNote"
              @blur="persistNote"
            />
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
