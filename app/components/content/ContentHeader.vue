<script setup lang="ts">
type TopicRow = { n: number; file: string; topic_type: string; label: string };
type ReleaseMetadata = { version: string; revision: string; deployed_at: string };

const props = defineProps<{ lang: 'en' | 'vi'; topic?: TopicRow; topics?: TopicRow[]; progressIndex?: any }>();
const route = useRoute();
const drawerOpen = ref(false);
const topicOpen = ref(false);
const topicQuery = ref('');
const drawerReturnFocus = ref<HTMLElement | null>(null);
const topicReturnFocus = ref<HTMLElement | null>(null);
const drawer = ref<HTMLElement | null>(null);
const topicMenu = ref<HTMLElement | null>(null);
const searchOverlay = ref<{ open: (query?: string) => void }>();
const nuxtApp = useNuxtApp() as any;
const isAdmin = ref(false);
const releaseMetadata = ref<ReleaseMetadata | null>(null);
const releaseChecked = ref(false);
const LANGUAGE_SCROLL_KEY = 'gazll:language-scroll';
let stopAuth: (() => void) | null = null;

const viLabels: Record<string, string> = {
  Technical: 'Kỹ thuật', Experience: 'Trải nghiệm', Tools: 'Công cụ', 'Study Track': 'Lộ trình học',
  'Interview preparation topics': 'Chủ đề chuẩn bị phỏng vấn', 'Interview journal and notes': 'Nhật ký và ghi chú phỏng vấn',
  Stats: 'Thống kê', 'Progress and study activity': 'Tiến độ và hoạt động học', 'All-user overview': 'Tổng quan toàn bộ người dùng',
  'Architecture blueprints': 'Blueprint kiến trúc', 'Engineering deep dives': 'Phân tích kỹ thuật chuyên sâu', Project: 'Dự án',
  'Selected work and experience': 'Công việc và trải nghiệm đã chọn', Photography: 'Nhiếp ảnh', 'Field notes and visual stories': 'Ghi chép thực địa và câu chuyện hình ảnh',
  'NAS / Home Server': 'NAS / Home Server', 'Self-hosting and infrastructure': 'Tự host và hạ tầng', 'Fshare Bulk Copy': 'Fshare Bulk Copy',
  'Copy many Fshare links at once': 'Sao chép nhiều link Fshare cùng lúc', 'Course Registration': 'Đăng ký môn học',
  'Plan and register course sets': 'Lập kế hoạch và đăng ký nhóm môn', Calendar: 'Lịch',
  'Lunar dates, holidays and reminders': 'Lịch âm, ngày lễ và nhắc việc', 'Release Notes': 'Ghi chú phát hành', Search: 'Tìm kiếm',
  'English speaking system and 26-week roadmap': 'Hệ thống luyện nói và lộ trình 26 tuần',
  'Last release': 'Bản phát hành gần nhất', 'Checking release…': 'Đang kiểm tra release…',
  'Release not stamped': 'Chưa có dấu phát hành', 'Release time unavailable': 'Không có thời gian phát hành',
  'Knowledge Base': 'Kho kiến thức', topic: 'chủ đề', 'Open navigation menu': 'Mở menu điều hướng', 'Previous topic': 'Chủ đề trước',
  'Next topic': 'Chủ đề tiếp theo', 'Search all material': 'Tìm kiếm toàn bộ nội dung', 'Search (Ctrl+K)': 'Tìm kiếm (Ctrl+K)',
  'Content language': 'Ngôn ngữ nội dung', 'Close menu': 'Đóng menu', 'Filter topics…': 'Lọc chủ đề…', 'Filter topics': 'Lọc chủ đề',
  Topics: 'Chủ đề', 'Nothing matches that filter.': 'Không có kết quả phù hợp.', 'Main navigation': 'Điều hướng chính',
  'Header controls': 'Điều khiển header', 'One query across every surface': 'Một truy vấn cho mọi khu vực', 'Ctrl K': 'Ctrl K',
  'Skip to content': 'Tới nội dung chính', 'Toggle contents': 'Bật/tắt mục lục', 'Everything works signed out — progress is saved on this device.': 'Mọi thứ đều dùng được khi đăng xuất — tiến độ được lưu trên thiết bị này.'
};
const localize = (value: string) => props.lang === 'vi' ? viLabels[value] || value : value;
const releaseTime = computed(() => {
  const deployedAt = releaseMetadata.value?.deployed_at;
  if (!deployedAt) return '';
  const date = new Date(deployedAt);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(props.lang === 'vi' ? 'vi-VN' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Bangkok', timeZoneName: 'short'
  }).format(date);
});
const releaseStatus = computed(() => {
  if (!releaseChecked.value) return localize('Checking release…');
  if (!releaseMetadata.value) return localize('Release not stamped');
  return releaseTime.value || localize('Release time unavailable');
});
const languageActionLabel = computed(() => props.lang === 'vi'
  ? 'Chuyển nội dung sang tiếng Anh'
  : 'Switch content to Vietnamese');

const navGroups = [
  { label: 'Technical', links: [
    { to: '/', label: 'Study Track', desc: 'Interview preparation topics', icon: ['M4 6h16M4 12h16M4 18h10'] },
    { to: '/system-design', label: 'System Design', desc: 'Architecture blueprints', icon: ['M4 5h6v5H4zM14 5h6v5h-6zM9 15h6v5H9z', 'M7 10v2.5h10V10M12 12.5V15'] },
    { to: '/case-studies', label: 'Case Studies', desc: 'Engineering deep dives', icon: ['M5 5h14v14H5z', 'M8 9h8M8 13h5M9 5V3h6v2'] },
    { to: '/admin', label: 'Admin', desc: 'All-user overview', icon: ['M12 3l7 3v5c0 4.2-2.8 7.6-7 10-4.2-2.4-7-5.8-7-10V6z'] },
    { to: '/gazl-try', label: 'Gazl Try', desc: 'Interview journal and notes', icon: ['M5 4h11l3 3v13H5z', 'M8 10h8M8 14h5'] },
    { to: '/stats', label: 'Stats', desc: 'Progress and study activity', icon: ['M5 19V10M12 19V5M19 19v-6'] }
  ] },
  { label: 'Experience', links: [
    { to: '/english-study', label: 'English Study', desc: 'English speaking system and 26-week roadmap', icon: ['M4 5h16v14H4z', 'M8 9h8M8 13h5', 'M8 17h3'] },
    { to: '/project', label: 'Project', desc: 'Selected work and experience', icon: ['M4 6.5h6l2 2h8V18H4z', 'M4 6.5V5h6l2 3.5'] },
    { to: '/photography', label: 'Photography', desc: 'Field notes and visual stories', icon: ['M3 8.5h4L8.5 6h7L17 8.5h4V19H3z', 'M8.5 13a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0'] },
    { to: '/homelab', label: 'NAS / Home Server', desc: 'Self-hosting and infrastructure', icon: ['M4 5h16v5H4zM4 14h16v5H4z', 'M7.5 7.5h.01M7.5 16.5h.01'] },
    { to: '/calendar', label: 'Calendar', desc: 'Lunar dates, holidays and reminders', icon: ['M4 6h16v14H4z', 'M4 10h16M8 3.5v4M16 3.5v4'] }
  ] },
  { label: 'Tools', links: [
    { to: '/fshare-tool', label: 'Fshare Bulk Copy', desc: 'Copy many Fshare links at once', icon: ['M14.5 3.5a5 5 0 0 0-6.1 6.7L3.5 15v5.5H9l4.8-4.9a5 5 0 0 0 6.7-6.1L17 12l-2.5-.5L14 9z'] },
    { to: '/course-registration', label: 'Course Registration', desc: 'Plan and register course sets', icon: ['M14.5 3.5a5 5 0 0 0-6.1 6.7L3.5 15v5.5H9l4.8-4.9a5 5 0 0 0 6.7-6.1L17 12l-2.5-.5L14 9z'] }
  ] }
];

const routeLabels: Record<string, string> = {
  '/': 'Study Track', '/english-study': 'English Study', '/gazl-try': 'Gazl Try', '/stats': 'Stats', '/admin': 'Admin',
  '/system-design': 'System Design', '/case-studies': 'Case Studies', '/project': 'Project',
  '/photography': 'Photography', '/homelab': 'NAS / Home Server', '/fshare-tool': 'Fshare Bulk Copy',
  '/course-registration': 'Course Registration', '/calendar': 'Calendar',
  '/release-notes': 'Release Notes', '/search': 'Search'
};
const currentLabel = computed(() => {
  if (routeLabels[route.path]) return localize(routeLabels[route.path]);
  const prefix = Object.keys(routeLabels).filter(key => key !== '/' && route.path.startsWith(`${key}/`)).sort((a, b) => b.length - a.length)[0];
  return localize(routeLabels[prefix] || 'Knowledge Base');
});
const visibleNavGroups = computed(() => navGroups.map(group => ({
  ...group, links: group.links.filter(link => link.to !== '/admin' || isAdmin.value)
})));
const currentTopicIndex = computed(() => props.topics?.findIndex(row => row.n === props.topic?.n) ?? -1);
const previousTopic = computed(() => props.topics?.[currentTopicIndex.value - 1]);
const nextTopic = computed(() => props.topics?.[currentTopicIndex.value + 1]);
const filteredTopics = computed(() => {
  const needle = topicQuery.value.trim().toLocaleLowerCase();
  if (!needle) return props.topics || [];
  return (props.topics || []).filter(row => `${row.n} ${row.label} ${row.topic_type}`.toLocaleLowerCase().includes(needle));
});

const withLang = (path: string) => ({ path, query: props.lang === 'vi' ? { lang: 'vi' } : {} });
const topicPath = (row: TopicRow) => `/topics/${row.file.split('/').pop()!.replace(/\.json$/, '')}`;
const isCurrent = (path: string) => path === '/'
  ? route.path === '/' || route.path.startsWith('/topics/')
  : route.path === path || route.path.startsWith(`${path}/`);

function setDrawer(open: boolean) {
  if (open && !drawerOpen.value && import.meta.client) {
    drawerReturnFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  const wasOpen = drawerOpen.value;
  drawerOpen.value = open;
  if (import.meta.client) document.body.classList.toggle('nav-open', open);
  if (open) nextTick(() => document.querySelector<HTMLElement>('.np-body .navlink')?.focus());
  else if (wasOpen) nextTick(() => {
    if (drawerReturnFocus.value?.isConnected) drawerReturnFocus.value.focus();
    drawerReturnFocus.value = null;
  });
}
function setTopic(open: boolean) {
  if (open && !topicOpen.value && import.meta.client) {
    topicReturnFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  const wasOpen = topicOpen.value;
  topicOpen.value = open;
  if (!open) topicQuery.value = '';
  if (import.meta.client) document.body.classList.toggle('topic-open', open);
  if (open) nextTick(() => document.querySelector<HTMLInputElement>('.tm-search input')?.focus());
  else if (wasOpen) nextTick(() => {
    if (topicReturnFocus.value?.isConnected) topicReturnFocus.value.focus();
    topicReturnFocus.value = null;
  });
}
function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    setDrawer(false);
    setTopic(false);
  }
  trapMenuFocus(event);
  if (event.key === 'Escape') { setDrawer(false); setTopic(false); }
}
function openSearch() {
  setDrawer(false);
  setTopic(false);
  searchOverlay.value?.open();
}

/* The topic picker is a searchable listbox. Once the filter input has done
   its job, arrow keys should move through the visible rows instead of making
   a reader tab past every result. */
function moveTopic(event: KeyboardEvent) {
  if (!topicOpen.value || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const rows = Array.from(topicMenu.value?.querySelectorAll<HTMLElement>('.tm-row') || [])
    .filter(row => row.getClientRects().length > 0);
  if (!rows.length) return;
  const current = rows.indexOf(document.activeElement as HTMLElement);
  const next = event.key === 'Home' ? 0
    : event.key === 'End' ? rows.length - 1
      : current < 0 ? (event.key === 'ArrowUp' ? rows.length - 1 : 0)
        : Math.max(0, Math.min(rows.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
  event.preventDefault();
  rows[next]?.focus();
}

/* Language changes keep the same article/topic open, so returning the reader
   to the old viewport is less surprising than Nuxt's default scroll-to-top.
   Store a one-shot record so it also survives a shared-header remount. */
function rememberLanguageScroll(event?: MouseEvent) {
  if (!import.meta.client || (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey))) return;
  try {
    sessionStorage.setItem(LANGUAGE_SCROLL_KEY, JSON.stringify({
      path: route.path,
      lang: props.lang === 'vi' ? 'en' : 'vi',
      y: Math.max(0, Math.round(window.scrollY))
    }));
  } catch (error) { /* private mode: the route still changes normally */ }
}
function restoreLanguageScroll() {
  if (!import.meta.client) return;
  try {
    const raw = sessionStorage.getItem(LANGUAGE_SCROLL_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved?.path !== route.path || saved?.lang !== props.lang || !Number.isFinite(saved.y)) return;
    sessionStorage.removeItem(LANGUAGE_SCROLL_KEY);
    const y = Math.max(0, Number(saved.y));
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(() => window.scrollTo(0, y));
    else window.setTimeout(() => window.scrollTo(0, y), 0);
  } catch (error) { /* malformed or unavailable storage: use normal router scroll */ }
}

function trapMenuFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;
  const root = drawerOpen.value ? drawer.value : topicOpen.value ? topicMenu.value : null;
  if (!root) return;
  const focusable = Array.from(root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
  )).filter(node => node.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!root.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function loadReleaseMetadata() {
  if (!import.meta.client) return;
  try {
    const url = new URL('/version.json', window.location.origin);
    url.searchParams.set('_', String(Date.now()));
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    const version = typeof payload?.version === 'string' ? payload.version : '';
    const revision = typeof payload?.revision === 'string' ? payload.revision : '';
    const deployedAt = typeof payload?.deployed_at === 'string' ? payload.deployed_at : '';
    if (!/^[A-Za-z0-9._-]{7,64}$/.test(version)
      || !/^[A-Za-z0-9._-]{7,64}$/.test(revision)
      || !deployedAt || Number.isNaN(Date.parse(deployedAt))) return;
    releaseMetadata.value = { version, revision, deployed_at: deployedAt };
  } catch {
    // A missing version file means the artifact was not stamped or is unavailable.
  } finally {
    releaseChecked.value = true;
  }
}

watch(() => route.fullPath, () => {
  setDrawer(false);
  setTopic(false);
  void nextTick(restoreLanguageScroll);
});
/* The progress ring is Study Track chrome — styles.css gates it behind
   `body.view-track`, a class the retired hash router used to set and nothing
   replaced, so the ring was in the DOM and display:none on every page. The
   header already knows whether it is showing a topic, so it owns the flag. */
const markTrack = () => {
  if (import.meta.client) document.body.classList.toggle('view-track', Boolean(props.topic));
};
watch(() => props.topic, markTrack);
/* Hides the header on scroll-down and publishes --hdr-h, which every sticky
   offset in styles.css is measured against. */
useHeadroom();
onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  markTrack();
  restoreLanguageScroll();
  const updateAdmin = () => { isAdmin.value = Boolean(nuxtApp.$auth?.isAdmin); };
  updateAdmin();
  stopAuth = nuxtApp.$auth?.onChange(updateAdmin) || null;
  void loadReleaseMetadata();
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  stopAuth?.();
  document.body.classList.remove('nav-open', 'topic-open', 'view-track');
});
</script>

<template>
  <a class="skiplink" :href="topic ? '#view-track' : '#view-host'">{{ localize('Skip to content') }}</a>
  <header id="site-header" class="top" data-ui="site-header">
    <div id="top-inner" class="top-inner" data-ui="top-inner">
      <button id="site-nav-toggle" class="navtoggle" data-ui="navigation-toggle" type="button" :aria-label="localize('Open navigation menu')" :aria-expanded="drawerOpen" aria-controls="navPanel" @click="setDrawer(true)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>

      <button v-if="topic" id="topic-picker" class="topicpick" data-ui="topic-picker" type="button" :data-topic-type="topic.topic_type" aria-haspopup="listbox" :aria-expanded="topicOpen" aria-controls="topicList" @click="setTopic(!topicOpen)">
        <span class="tp-n">{{ String(topic.n).padStart(2, '0') }}</span>
        <span class="tp-text"><span class="tp-label">{{ topic.label }}</span><span class="tp-sub">{{ topic.topic_type }} {{ localize('topic') }}</span></span>
        <svg class="tp-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      <NuxtLink v-else class="topicpick" id="site-brand" data-ui="site-brand" :to="withLang('/')">
        <span class="tp-n">&lt;/&gt;</span>
        <span class="tp-text"><span class="tp-label">GAZLL</span><span class="tp-sub">{{ currentLabel }}</span></span>
      </NuxtLink>

      <div v-if="topic && topics?.length" id="topic-stepper" class="tb-steps" data-ui="topic-stepper">
        <NuxtLink v-if="previousTopic" class="tstep" :to="withLang(topicPath(previousTopic))" :aria-label="localize('Previous topic')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><polyline points="15 6 9 12 15 18" /></svg>
        </NuxtLink>
        <button v-else class="tstep" type="button" disabled :aria-label="localize('Previous topic')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><polyline points="15 6 9 12 15 18" /></svg>
        </button>
        <span class="tb-count"><b>{{ currentTopicIndex + 1 }}</b>/{{ topics.length }}</span>
        <NuxtLink v-if="nextTopic" class="tstep" :to="withLang(topicPath(nextTopic))" :aria-label="localize('Next topic')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><polyline points="9 6 15 12 9 18" /></svg>
        </NuxtLink>
        <button v-else class="tstep" type="button" disabled :aria-label="localize('Next topic')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><polyline points="9 6 15 12 9 18" /></svg>
        </button>
      </div>

      <nav id="header-controls" class="headright" data-ui="header-controls" :aria-label="localize('Header controls')">
        <button id="searchTrigger" class="searchtrigger" data-ui="search-trigger" type="button" :aria-label="localize('Search all material')" :title="localize('Search (Ctrl+K)')" @click="openSearch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
          <span class="st-label">{{ localize('Search') }}</span><kbd class="st-key">{{ localize('Ctrl K') }}</kbd>
        </button>
        <!-- The denominator is useful only on study pages. Avoid constructing
             the async content-index reader on tools and long-form surfaces. -->
        <ClientOnly v-if="topic"><StudyProgressRing :lang="lang" :index="progressIndex" /></ClientOnly>
        <NuxtLink id="header-language-switch" class="langswitch hdr-lang" data-ui="language-switch" role="switch" :aria-checked="lang === 'vi'" :aria-label="languageActionLabel" :to="{ path: route.path, query: { ...route.query, lang: lang === 'vi' ? 'en' : 'vi' }, hash: route.hash || undefined }" @click="rememberLanguageScroll">
          <span class="lang-label" data-lang="en">EN</span>
          <span class="lang-track" aria-hidden="true"><span class="lang-knob"><ContentFlagIcon :lang="lang" /></span></span>
          <span class="lang-label" data-lang="vi">VI</span>
        </NuxtLink>
        <ClientOnly><AuthControl /></ClientOnly>
      </nav>

      <div v-if="topic" id="topicMenu" ref="topicMenu" class="topicmenu" data-ui="topic-menu" :hidden="!topicOpen" @keydown="moveTopic">
        <div class="tm-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
          <input v-model="topicQuery" type="search" :placeholder="localize('Filter topics…')" autocomplete="off" :aria-label="localize('Filter topics')">
        </div>
        <div id="topicList" class="tm-list" role="listbox" :aria-label="localize('Topics')">
          <NuxtLink v-for="row in filteredTopics" :key="row.n" class="tm-row" role="option" :data-topic-type="row.topic_type" :aria-selected="row.n === topic.n" :to="withLang(topicPath(row))">
            <span class="tm-n">{{ String(row.n).padStart(2, '0') }}</span>
            <span class="tm-main"><span class="tm-label">{{ row.label }}</span><span class="tm-meta">{{ row.topic_type }}</span></span>
            <ClientOnly><StudyTopicProgress :n="row.n" :index="progressIndex" /></ClientOnly>
          </NuxtLink>
          <p v-if="!filteredTopics.length" class="tm-empty">{{ localize('Nothing matches that filter.') }}</p>
        </div>
      </div>
    </div>
  </header>

  <div v-if="topic" class="topic-scrim" aria-hidden="true" @click="setTopic(false)" />
  <div class="nav-scrim" aria-hidden="true" @click="setDrawer(false)" />
  <aside id="navPanel" ref="drawer" class="navpanel" data-ui="navigation-panel" :aria-label="localize('Main navigation')" :aria-hidden="!drawerOpen" :inert="!drawerOpen">
    <div class="np-head">
      <div class="np-brand"><span class="seal">&lt;/&gt;</span><b>GAZLL</b></div>
    </div>
    <nav class="np-body">
      <button class="navlink nv-lead" type="button" @click="openSearch">
        <svg class="nv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
        <span class="nv-text"><span class="nv-label">Search</span><span class="nv-desc">{{ localize('One query across every surface') }}</span></span>
        <span class="nv-shortcut">{{ localize('Ctrl K') }}</span>
      </button>
      <section v-for="group in visibleNavGroups" :key="group.label" class="nv-sec">
        <h2 class="nv-sectitle">{{ group.label }}</h2>
        <NuxtLink v-for="link in group.links" :key="link.to" class="navlink" :aria-current="isCurrent(link.to) ? 'page' : undefined" :to="withLang(link.to)">
          <svg class="nv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path v-for="path in link.icon" :key="path" :d="path" /></svg>
          <span class="nv-text"><span class="nv-label">{{ link.label }}</span><span class="nv-desc">{{ localize(link.desc) }}</span></span>
        </NuxtLink>
      </section>
    </nav>
    <div class="np-foot">
      <NuxtLink class="np-action np-foot-action" :aria-current="route.path === '/release-notes' ? 'page' : undefined" :to="withLang('/release-notes')">
        <svg class="nv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3h9l3 3v15H6zM9 11h6M9 15h6" /></svg><span>Release Notes</span>
      </NuxtLink>
      <p class="np-foot-note">{{ localize('Everything works signed out — progress is saved on this device.') }}</p>
      <p class="np-foot-release" aria-live="polite">
        <span class="np-foot-release-label">{{ localize('Last release') }}</span>
        <template v-if="releaseMetadata && releaseTime">
          <time :datetime="releaseMetadata.deployed_at">{{ releaseTime }}</time>
          <code :title="releaseMetadata.revision">{{ releaseMetadata.version }}</code>
        </template>
        <span v-else>{{ releaseStatus }}</span>
      </p>
    </div>
  </aside>
  <ClientOnly><SearchOverlay ref="searchOverlay" :lang="lang" /></ClientOnly>
</template>
