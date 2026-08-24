<script setup lang="ts">
import { parseEnglishStudyPlan } from '~/utils/english-study.js';
import { renderMarkdown } from '~/utils/markdown.js';

const props = defineProps<{ markdown: string }>();

const SECTION_KEY = 'gazll:english-study:sections';
const SETUP_KEY = 'gazll:english-study:setup';
const SETUP_OPEN_KEY = 'gazll:english-study:setup-open';
const CHECK_KEY = 'gazll:english-study:checks';

const setupItems = [
  { key: 'project', label: 'Create the ChatGPT Project “English OS — Senior Software Engineer” and use Project-only memory.', source: 'Plan 15' },
  { key: 'instructions', label: 'Paste the Project Instructions into the project settings.', source: 'Plan 16' },
  { key: 'chats', label: 'Create the eight core chats: Daily Speaking, Vocabulary Activation, Workplace English, Technical & System Design, Behavioral Interview, Error Lab, Weekly Review and Monthly Benchmark.', source: 'Plan 15' },
  { key: 'ledger', label: 'Create the English Learning Ledger with an original version, better version, type, priority, retest and status.', source: 'Plan 26' },
  { key: 'wordlists', label: 'Create the five Memrise lists: Core Conversation Chunks, Workplace English, Backend & System Design, Interview Stories and Recurring Errors.', source: 'Plan 6' },
  { key: 'first-chunks', label: 'Add the first eight Core Conversation chunks and begin the A1/A2 fast refresh.', source: 'Plans 6, 10, 31' },
  { key: 'permissions', label: 'Update Memrise and ChatGPT, then allow microphone access for both apps.', source: 'Plan 38' },
  { key: 'environment', label: 'Place Memrise, ChatGPT and Voice Memos where they are easy to open; pair the headset and use Focus/Do Not Disturb for deep sessions.', source: 'Plans 37, 38, 74' },
  { key: 'baseline', label: 'Record the baseline self-introduction without reading a script.', source: 'Plans 29, 55' }
];

const parsed = computed(() => parseEnglishStudyPlan(props.markdown));
const openSections = ref<Record<string, boolean>>({});
const setupState = ref<Record<string, boolean>>({});
const checkboxState = ref<Record<string, boolean>>({});
const setupOpen = ref(true);

const setupDone = computed(() => setupItems.filter(item => setupState.value[item.key]).length);
const setupComplete = computed(() => setupDone.value === setupItems.length);
const overviewHtml = computed(() => renderMarkdown(parsed.value.intro, {
  headingPrefix: 'english-study-overview',
  headingLinkLabel: 'Link to this section'
}));
const renderedSections = computed(() => parsed.value.sections.map(section => ({
  ...section,
  html: renderSection(section.markdown, section.id)
})));

function readRecord(key: string) {
  if (!import.meta.client) return {};
  try {
    const parsedValue = JSON.parse(localStorage.getItem(key) || '{}');
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  } catch (error) {
    return {};
  }
}

function persist(key: string, value: Record<string, boolean>) {
  if (!import.meta.client) return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* private mode */ }
}

function renderSection(markdown: string, sectionId: string) {
  let checkboxIndex = 0;
  const html = renderMarkdown(markdown, {
    headingPrefix: sectionId,
    headingLinkLabel: 'Link to this section'
  });
  return html.replace(/<li>\[([ xX])\]\s*([\s\S]*?)<\/li>/g, (_match, marker: string, body: string) => {
    const key = `${sectionId}:${checkboxIndex++}`;
    const checked = checkboxState.value[key] ?? marker.toLowerCase() === 'x';
    return `<li class="es-check-item"><label><input type="checkbox" data-es-check-id="${key}"${checked ? ' checked' : ''}><span>${body}</span></label></li>`;
  });
}

function sectionIsOpen(id: string) {
  return Boolean(openSections.value[id]);
}

function onSectionToggle(id: string, event: Event) {
  const detail = event.currentTarget as HTMLDetailsElement | null;
  if (!detail) return;
  openSections.value = { ...openSections.value, [id]: detail.open };
  persist(SECTION_KEY, openSections.value);
}

function setAllSections(open: boolean) {
  openSections.value = Object.fromEntries(parsed.value.sections.map(section => [section.id, open]));
  persist(SECTION_KEY, openSections.value);
}

function setSetupItem(key: string, event: Event) {
  const input = event.target as HTMLInputElement | null;
  if (!input) return;
  setupState.value = { ...setupState.value, [key]: input.checked };
  persist(SETUP_KEY, setupState.value);
  if (setupItems.every(item => item.key === key ? input.checked : setupState.value[item.key])) {
    setupOpen.value = false;
    if (import.meta.client) localStorage.setItem(SETUP_OPEN_KEY, 'closed');
  }
}

function onSetupToggle(event: Event) {
  const detail = event.currentTarget as HTMLDetailsElement | null;
  if (!detail) return;
  setupOpen.value = detail.open;
  if (import.meta.client) localStorage.setItem(SETUP_OPEN_KEY, detail.open ? 'open' : 'closed');
}

function onPlanChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const key = input?.dataset.esCheckId;
  if (!input || !key) return;
  checkboxState.value = { ...checkboxState.value, [key]: input.checked };
  persist(CHECK_KEY, checkboxState.value);
}

onMounted(() => {
  openSections.value = readRecord(SECTION_KEY);
  setupState.value = readRecord(SETUP_KEY);
  checkboxState.value = readRecord(CHECK_KEY);
  setupOpen.value = setupComplete.value
    ? false
    : localStorage.getItem(SETUP_OPEN_KEY) !== 'closed';
});
</script>

<template>
  <div class="english-study-shell" @change="onPlanChange">
    <header class="es-head">
      <p class="es-eyebrow">English Study · 2026 operating system</p>
      <h1>{{ parsed.title }}</h1>
      <p class="es-deck">Memrise + ChatGPT Voice cho Senior Software Developer</p>
      <div class="es-meta" aria-label="English study plan metadata">
        <span>26-week roadmap</span><span>Memrise + ChatGPT Voice</span><span>Output &gt; app completion</span>
      </div>
    </header>

    <section class="es-overview pj-doc-body" aria-label="English study plan overview">
      <div v-html="overviewHtml" />
    </section>

    <details class="es-setup" :open="setupOpen" @toggle="onSetupToggle">
      <summary>
        <span class="es-summary-main">
          <span class="es-number">SETUP</span>
          <span class="es-summary-text"><strong>Start here</strong><small>{{ setupDone }}/{{ setupItems.length }} setup steps complete · collapses automatically when finished</small></span>
        </span>
        <span class="es-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="es-setup-body">
        <p class="es-setup-note">Complete the small environment setup first. The detailed operating rules, prompts and 26-week roadmap stay below as closed notes.</p>
        <ul class="es-setup-list">
          <li v-for="item in setupItems" :key="item.key">
            <label>
              <input type="checkbox" :checked="Boolean(setupState[item.key])" @change="setSetupItem(item.key, $event)">
              <span><strong>{{ item.label }}</strong><small>{{ item.source }}</small></span>
            </label>
          </li>
        </ul>
      </div>
    </details>

    <div class="es-toolbar" aria-label="English study notes controls">
      <p><strong>{{ parsed.sections.length }}</strong> plan notes · closed by default</p>
      <div>
        <button type="button" class="btn-ghost" @click="setAllSections(true)">Expand all</button>
        <button type="button" class="btn-ghost" @click="setAllSections(false)">Collapse all</button>
      </div>
    </div>

    <section class="es-sections" aria-label="English study plan notes">
      <details v-for="section in renderedSections" :key="section.id" class="es-note" :open="sectionIsOpen(section.id)" @toggle="onSectionToggle(section.id, $event)">
        <summary>
          <span class="es-summary-main">
            <span class="es-number">{{ section.number }}</span>
            <span class="es-summary-text"><strong>{{ section.title }}</strong><small>Open note to review this part of the plan</small></span>
          </span>
          <span class="es-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="es-section-body pj-doc-body" v-html="section.html" />
      </details>
    </section>
  </div>
</template>
