'use strict';

/* Entry point. The topic track renders here (Microservices is topic_type
   "microservice", one topic among the others — no separate view); shared
   pieces live in lib/ and the larger views in views/.

   Adding a menu = adding one entry to VIEWS below.

   Shared shell strings stay English; reader surfaces use the global EN/VI
   state when they have localized material — see CLAUDE.md. */
import { renderMarkdown, escapeHtml } from './lib/markdown.js';
import { chevSVG, BADGE, debounce } from './lib/ui.js';
import { Content } from './lib/content.js';
import { contentDateFacts, formatContentDate } from './lib/content-dates.js';
import { clearArticleStructuredData, setArticleStructuredData } from './lib/structured-data.js';
import { setPageMetadata } from './lib/page-metadata.js';
import { crossRefResolver } from './lib/cross-ref.js';
import { copyText } from './lib/clipboard.js';
import {
  findQuestion,
  questionHash,
  questionIdFromRoute,
  questionUrl,
  systemDesignQuestionHash
} from './lib/question-links.js';
import { SystemDesign } from './lib/system-design.js';
import { TOPIC_TYPES, TOPIC_TYPE_LABEL } from './lib/constants.js';
import { Store } from './lib/store.js';
import { Auth, mountAuthUI } from './lib/auth.js';
import { renderInterviews, mountInterviews } from './views/interviews.js';
import { renderStats, mountStats } from './views/stats.js';
import { renderAdmin, mountAdmin } from './views/admin.js';
import { renderSystemDesign, mountSystemDesign } from './views/system-design.js';
import { renderCaseStudies, mountCaseStudies } from './views/case-studies.js';
import { renderProject, mountProject } from './views/project.js';
import { renderPhotography, mountPhotography, renderHomelab, mountHomelab } from './views/knowledge.js';
import { renderReleaseNotes, mountReleaseNotes } from './views/release-notes.js';
import { renderSearch, mountSearch, mountSearchOverlay } from './views/search.js';
import { SearchHistory } from './lib/search-history.js';
import { mountDsaPlayers, stopDsaPlayers } from './views/dsa-player.js';
import {
  anchorHref,
  decorateHeadingPermalinks,
  routeAnchorFromHash,
  routeLanguageFromHash,
  routePathFromHash,
  routePathWithoutQuery,
  scrollToAnchor,
  updateRouteLanguage,
  wireAnchorLinks,
  wireHeadingPermalinks,
  withRouteLanguage
} from './lib/anchors.js';

let TOPICS = [];
let current = 0;
let totalQ = 0;
let topicItemIds = new Set();
let typeFilter = 'all';
let topicQuery = '';

// Inline SVG, not 🇬🇧/🇻🇳 emoji: Windows renders flag emoji as "GB"/"VN" text everywhere.
const LANG_FLAG = {
  en: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
    + '<rect width="24" height="24" fill="#00247D"/>'
    + '<g stroke="#FFFFFF" stroke-width="4"><line x1="0" y1="0" x2="24" y2="24"/><line x1="24" y1="0" x2="0" y2="24"/></g>'
    + '<g stroke="#CF142B" stroke-width="1.6"><line x1="0" y1="0" x2="24" y2="24"/><line x1="24" y1="0" x2="0" y2="24"/></g>'
    + '<g stroke="#FFFFFF" stroke-width="8"><line x1="12" y1="0" x2="12" y2="24"/><line x1="0" y1="12" x2="24" y2="12"/></g>'
    + '<g stroke="#CF142B" stroke-width="4"><line x1="12" y1="0" x2="12" y2="24"/><line x1="0" y1="12" x2="24" y2="12"/></g>'
    + '</svg>',
  vi: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
    + '<rect width="24" height="24" fill="#DA251D"/>'
    + '<polygon fill="#FFCD00" points="12,3 14.06,9.17 20.56,9.22 15.33,13.08 17.29,19.28 12,15.5 6.71,19.28 8.67,13.08 3.44,9.22 9.94,9.17"/>'
    + '</svg>'
};

const panel = document.getElementById('panel');
const dots = document.getElementById('dots');

const COPY_LINK_SVG = '<svg class="qcopy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M10.5 13.5a4.5 4.5 0 0 0 6.4.1l2.2-2.2A4.5 4.5 0 0 0 12.7 5l-1.3 1.3"/>'
  + '<path d="M13.5 10.5a4.5 4.5 0 0 0-6.4-.1l-2.2 2.2A4.5 4.5 0 0 0 11.3 19l1.3-1.3"/></svg>';

/* ---------- Views / navigation ---------- */
const GUIDE_MD = [
  'This is an **all-in-one** site. The ☰ button opens the **navigation panel**, grouped into `Technical` (the study path plus the System Design and Case Studies reference libraries), `Other knowledge` (personal projects and material outside interview prep), `Tools` (standalone utilities) and `About`. Every view has its own URL (e.g. `#/guide`), so any of them can be shared or bookmarked.',
  '',
  'The **search** control in the header (`Ctrl`/`⌘` + `K`, or just `/`) queries the Study Track, the System Design blueprints and the case studies in one pass. Each result names the topic or blueprint it belongs to and opens that card directly; accents are optional, so `dong bo` finds `đồng bộ`. `See all results` opens the full panel at `#/search/<query>`, which can be filtered by surface and shared like any other view. Recent searches stay in the browser session while signed out and move into your account when you sign in.',
  '',
  ':::tip Adding a menu entry',
  'Open `app.js` and push one object into the `VIEWS` array — nothing else needs touching. The `sec` field decides which section of the panel it lands in.',
  ':::',
  '',
  'Four kinds of entry:',
  '',
  '- Markdown view: `{ id: "snippets", sec: "about", label: "Snippets", md: "..." }`',
  '- Free-form HTML view: `{ id: "x", sec: "technical", render: () => "&lt;div&gt;...&lt;/div&gt;" }`',
  '- **Link to another tool**: `{ id: "abc", sec: "tool", label: "ABC", href: "abc-tool/" }` — an entry with `href` opens in a new tab and the router skips it, so adding a sibling app costs one line',
  '- View limited to some users: add `when: () => Auth.isAdmin`',
  '',
  ':::deep Storage and languages',
  'Progress, notes and the interview journal are written to `localStorage` immediately, then synced to a **Google Sheet** through Apps Script once you are signed in with Google. Losing the network or closing the tab mid-save costs nothing — the queue lives in `localStorage` and is resent on the next visit.',
  '',
  'The study material lives under `data/` (JSON + Markdown): `data/manifest.json` lists every numbered source and points at its `data/topics/NN-slug.json` file; `data/meta.json` holds each topic\'s label/title/intro/tags. A manifest row with `surface: "system-design"` remains available for stable references but is presented in the dedicated System Design library instead of Study Track. Supported syntax: **bold**, *italic*, `code`, `-` lists, and three callout blocks — `:::tip Label`, `:::warn Label`, `:::deep`.',
  '',
  'The interface is always English. The **material** has an `EN`/`VI` switch in the header. Every topic\'s base file (`data/topics/NN-slug.json`) is complete English and every `NN-slug.vi.json` companion is complete Vietnamese. Both are loaded up front, and the header switch selects which complete version to read. If a Vietnamese companion cannot be loaded, VI mode gracefully displays the English base instead of failing.',
  '',
  'Every topic carries a `topic_type` field (`core` · `data` · `design` · `platform` · `algorithm` · `microservice`, from `lib/constants.js`) — that is what drives the filter chips in the topic picker. Every item carries a `difficulty` (`core` · `hard` · `ext`) — the ESSENTIAL/ADVANCED/EXTRA badge.',
  '',
  'Raw HTML (SVG diagrams, tables) can be embedded straight into the Markdown. To update content: edit the topic\'s file under `data/topics/`, then `git push` — GitHub Actions deploys it.',
  '',
  '**System Design** is a long-form Experience library driven by `data/system-design/catalog.json`. Each blueprint follows the same review shape — framing, functional and quality requirements, capacity, architecture, data model, technology choices and trade-offs — and keeps its diagram as editable Mermaid source. Topic 10–11 deep dives plus the OTA/whiteboard overlap from Topic 16 are mapped into these articles by immutable item id; the architecture category moved from Case Studies is preserved there as production evidence.',
  '',
  '**Project** is the implementation-facing SRS surface. It keeps a project manifest, runtime/module decisions, requirements, copied source documents and sanitized code/config samples together, so a design decision can be checked against the current working tree.',
  '',
  'The 15 patterns in **DSA & LeetCode** are *animated*: press play and each step runs in turn, or scrub and arrow-key through them. Frames live in `data/dsa-animations.json` and were produced by running the real algorithm, so the animation cannot disagree with the code beside it. The drawing is shared between languages and only the step captions are translated.',
  '',
  '**Release Notes** (last entry in `Other`) records what material arrived and when. Entries live in `data/release-notes.json`, newest release first, so adding one never touches `app.js`. Each release and change carries `en` and `vi` blocks in that one file and follows the header switch like any other material; a note written in only one language falls back rather than rendering blank. A change may name a topic by its `key` — the view resolves that to the topic\'s current label, so renaming a topic never leaves a stale note behind.',
  '',
  'Write **one entry per release** and keep them newest-first; releases that share a date are grouped under a single date heading when the page renders, with a `2 releases · 3 changes` roll-up. So several releases in one day cost nothing extra — do not merge them by hand.',
  ':::'
].join('\n');

/* Nav panel sections, in display order. `key` matches the `sec` of a view. */
const NAV_SECTIONS = [
  { key: 'technical', label: 'Technical' },
  { key: 'knowledge', label: 'Other knowledge' },
  { key: 'tool', label: 'Tools' },
  // Renamed from "Other" when the knowledge section arrived: two sections
  // called Other would say nothing about which one holds what.
  { key: 'about', label: 'About' }
];

/* One entry per menu row.

   An entry with `href` is an external destination (another app under
   public/, or any URL) — it renders as a link and is never routed to.
   Everything else is an in-page view: `md`, or `render` (+ optional `mount`).
   `when` hides the row; `desc` is the second line in the panel. */
const VIEWS = [
  { id: 'track', sec: 'technical', label: 'Study Track', desc: 'Topic-based learning path', icon: 'track' },
  // Routable so a search can be shared; the header trigger and Ctrl+K open the
  // same query in the overlay first.
  { id: 'search', sec: 'technical', label: 'Search', desc: 'One query across every surface', icon: 'search',
    render: renderSearch, mount: mountSearch },
  { id: 'gazl', sec: 'technical', label: 'Gazl Try', desc: 'Companies interviewed', icon: 'journal',
    render: renderInterviews, mount: mountInterviews },
  { id: 'stats', sec: 'technical', label: 'Stats', desc: 'Streak, heatmap, progress', icon: 'stats',
    render: renderStats, mount: mountStats },
  { id: 'admin', sec: 'technical', label: 'Admin', desc: 'All-user overview', icon: 'admin',
    render: renderAdmin, mount: mountAdmin, when: () => Auth.isAdmin },

  // Reference libraries rather than the daily path: same section, own group.
  { id: 'system-design', sec: 'technical', divider: true, label: 'System Design',
    desc: 'Blueprints, diagrams & trade-offs', icon: 'design',
    render: renderSystemDesign, mount: mountSystemDesign },
  { id: 'case-studies', sec: 'technical', label: 'Case Studies', desc: 'Data, mobile & engineering stories', icon: 'case',
    render: renderCaseStudies, mount: mountCaseStudies },

  { id: 'project', sec: 'knowledge', label: 'Project', desc: 'CalebZone SRS & implementation evidence', icon: 'project',
    render: renderProject, mount: mountProject },
  { id: 'photography', sec: 'knowledge', label: 'Photography', desc: 'Exposure, glass & the edit', icon: 'photo',
    render: renderPhotography, mount: mountPhotography },
  { id: 'homelab', sec: 'knowledge', label: 'NAS / Home Server', desc: 'Storage, hardware & services at home', icon: 'server',
    render: renderHomelab, mount: mountHomelab },

  { id: 'fshare', sec: 'tool', label: 'Fshare Bulk Copy', desc: 'Collect download links in bulk',
    icon: 'tool', href: 'fshare-tool/' },
  { id: 'course-registration', sec: 'tool', label: 'Course Registration', desc: 'Explore NTT classes and schedules',
    icon: 'tool', href: 'course-registration/' },

  { id: 'guide', sec: 'about', label: 'Guide', desc: 'Site structure & syntax', icon: 'guide',
    md: GUIDE_MD },
  // Last entry, last section: the changelog belongs at the foot of the panel.
  { id: 'release-notes', sec: 'about', label: 'Release Notes', desc: 'What content was added, and when',
    icon: 'release', render: renderReleaseNotes, mount: mountReleaseNotes }
];

/* Inline so the panel needs no network and no icon font. */
const ICONS = {
  track: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  journal: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 10h8M8 14h5"/>',
  stats: '<path d="M5 19V10M12 19V5M19 19v-6"/>',
  admin: '<path d="M12 3l7 3v5c0 4.2-2.8 7.6-7 10-4.2-2.4-7-5.8-7-10V6z"/>',
  design: '<path d="M4 5h6v5H4zM14 5h6v5h-6zM9 15h6v5H9z"/><path d="M7 10v2.5h10V10M12 12.5V15"/>',
  project: '<path d="M4 6.5h6l2 2h8v9.5H4z"/><path d="M4 6.5V5h6l2 2.5"/>',
  case: '<path d="M5 5h14v14H5z"/><path d="M8 9h8M8 13h5M9 5V3h6v2"/>',
  tool: '<path d="M14.5 3.5a5 5 0 0 0-6.1 6.7L3.5 15v5.5H9l4.8-4.9a5 5 0 0 0 6.7-6.1L17 12l-2.5-.5L14 9z"/>',
  guide: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.2 3.1c-.6.3-.8.7-.8 1.4"/><path d="M12 17h.01"/>',
  release: '<path d="M4 8.5V5h3.5L18 15.5 14.5 19z"/><path d="M7.5 8.5h.01"/><path d="M13 4h7v7"/>',
  photo: '<path d="M3 8.5h4L8.5 6h7L17 8.5h4V19H3z"/><circle cx="12" cy="13" r="3.5"/>',
  server: '<path d="M4 5h16v5H4zM4 14h16v5H4z"/><path d="M7.5 7.5h.01M7.5 16.5h.01"/>'
};
const iconSVG = name => '<svg class="nv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + (ICONS[name] || ICONS.guide) + '</svg>';

/* ---------- personal notes, appended to every question card ---------- */

function noteBox(id) {
  const val = Store.getNote(id);
  return '<div class="notebox' + (val ? ' has-note' : '') + '">'
    + '<div class="note-head"><span class="note-label">My notes</span>'
    + '<span class="note-state" data-note-state="' + id + '"></span></div>'
    + '<textarea class="note-input" data-note="' + id + '" rows="3" '
    + 'placeholder="Write the answer back in your own words — this is the part that actually trains you.">'
    + escapeHtml(val) + '</textarea></div>';
}

function renderAnswerMarkdown(item, answer) {
  return renderMarkdown(answer, {
    resolveRef: crossRefResolver(),
    headingPrefix: 'question-' + item.id,
    stableHeadingIds: true,
    headingRoute: questionHash(item.id).slice(1),
    headingLinkLabel: 'Link to this section'
  });
}

function wireNotes(root) {
  (root || document).querySelectorAll('.note-input').forEach(ta => {
    const id = ta.dataset.note;
    const state = (root || document).querySelector('[data-note-state="' + id + '"]');

    // Local save after 600ms idle; getting it to the Sheet is Store's job.
    const save = debounce(() => {
      Store.setNote(id, ta.value);
      ta.closest('.notebox').classList.toggle('has-note', Boolean(ta.value.trim()));
      if (state) {
        state.textContent = 'saved';
        setTimeout(() => { if (state.textContent === 'saved') state.textContent = ''; }, 1600);
      }
    }, 600);

    ta.addEventListener('input', () => {
      if (state) state.textContent = 'typing…';
      save();
    });
    // Leaving the field saves now, without waiting out the debounce.
    ta.addEventListener('blur', () => Store.setNote(id, ta.value));
  });
}

function qcard(it) {
  const badge = BADGE[it.difficulty] || '';
  const diffClass = it.difficulty ? (' difficulty-' + it.difficulty) : '';
  const done = Store.reviewed.has(it.id) ? ' done' : '';
  // Show the trailing qN, not the whole id — the full string is the Sheet key, too long to read here.
  const seq = (/\.q(\d+)$/.exec(it.id) || [, '?'])[1];
  const pair = Content.itemPair(it.id);
  const safeId = escapeHtml(it.id);
  const langBtn = (pair && pair.vi)
    ? '<button class="langswitch qlangbtn" type="button" role="switch" data-item-lang="' + Content.lang + '" '
      + 'aria-checked="' + (Content.lang === 'vi') + '" aria-label="Show this question in the other language">'
      + '<span class="lang-label" data-lang="en">EN</span>'
      + '<span class="lang-track" aria-hidden="true"><span class="lang-knob">' + LANG_FLAG[Content.lang] + '</span></span>'
      + '<span class="lang-label" data-lang="vi">VI</span></button>'
    : '';
  const copyBtn = '<button class="qcopy" type="button" data-copy-qid="' + safeId + '"'
    + ' aria-label="Copy link to this question" title="Copy link to this question">'
    + COPY_LINK_SVG + '<span class="qcopy-label">Copy link</span></button>';
  const reviewed = formatContentDate(it.reviewed_at, Content.lang);
  const reviewDate = reviewed ? '<time class="qreview" datetime="' + escapeHtml(it.reviewed_at)
    + '" title="Technically reviewed ' + escapeHtml(reviewed) + '">Reviewed ' + escapeHtml(reviewed) + '</time>' : '';
  const mobileReview = reviewed ? '<p class="qreview-mobile">Technically reviewed <time datetime="'
    + escapeHtml(it.reviewed_at) + '">' + escapeHtml(reviewed) + '</time></p>' : '';
  return '<div class="qcard' + diffClass + done + '" id="question-' + safeId + '" data-qid="' + safeId + '">'
    + '<div class="qtop"><button class="qhead" aria-expanded="false">'
    + '<span class="qid" title="' + safeId + '">Q' + seq + '</span>'
    + badge
    + '<span class="qtext">' + it.q + '</span>'
    + chevSVG + '</button><div class="qmeta">' + reviewDate + copyBtn + langBtn + '</div></div>'
    + '<div class="qbody"><div class="qbody-inner"><div class="answer">' + mobileReview
    + '<div class="answer-body">' + renderAnswerMarkdown(it, it.a) + '</div>' + noteBox(it.id)
    + '</div></div></div></div>';
}

function showCopyFeedback(button) {
  const label = button.querySelector('.qcopy-label');
  button.classList.add('is-copied');
  button.setAttribute('aria-label', 'Link copied');
  button.title = 'Link copied';
  if (label) label.textContent = 'Copied';
  clearTimeout(button._copyReset);
  button._copyReset = setTimeout(() => {
    button.classList.remove('is-copied');
    button.setAttribute('aria-label', 'Copy link to this question');
    button.title = 'Copy link to this question';
    if (label) label.textContent = 'Copy link';
  }, 1800);
}

/** Collapse toggling; first open is what marks an item reviewed. */
function wireQcards(root, onMark) {
  (root || document).querySelectorAll('.qcard').forEach(card => {
    const head = card.querySelector('.qhead');
    head.addEventListener('click', () => {
      const open = card.classList.toggle('open');
      head.setAttribute('aria-expanded', open);
      if (open) {
        Store.logOpen(card.dataset.qid);
        if (Store.markReviewed(card.dataset.qid)) card.classList.add('done');
        if (onMark) onMark();
        // Animations mount on first open, not on render: a collapsed card must
        // not fetch the frame data or leave a timer running.
        mountDsaPlayers(card);
      } else {
        stopDsaPlayers(card);
      }
    });

    const copyBtn = card.querySelector('.qcopy');
    if (copyBtn) {
      const activate = async () => {
        const url = questionUrl(window.location.href, copyBtn.dataset.copyQid);
        try {
          await copyText(url);
          showCopyFeedback(copyBtn);
        } catch (e) {
          window.prompt('Copy this link:', url);
        }
      };
      copyBtn.addEventListener('click', e => {
        e.stopPropagation();
        activate();
      });
    }

    const langBtn = card.querySelector('.qlangbtn');
    if (langBtn) {
      const activate = () => {
        const pair = Content.itemPair(card.dataset.qid);
        if (!pair) return;
        const shown = langBtn.dataset.itemLang;
        const next = shown === 'vi' ? 'en' : 'vi';
        const nextText = pair[next] || pair.en;   // en always exists
        card.querySelector('.qtext').textContent = nextText.q;
        // Replacing .answer-body drops the old player nodes, so stop their
        // timers first and re-mount into the fresh markup.
        stopDsaPlayers(card);
        card.querySelector('.answer-body').innerHTML = renderAnswerMarkdown({ id: card.dataset.qid }, nextText.a);
        // This card's own language, which may differ from Content.lang.
        if (card.classList.contains('open')) mountDsaPlayers(card, next);
        langBtn.dataset.itemLang = next;
        langBtn.setAttribute('aria-checked', String(next === 'vi'));
        const knob = langBtn.querySelector('.lang-knob');
        if (knob) knob.innerHTML = LANG_FLAG[next];
      };
      langBtn.addEventListener('click', e => {
        e.stopPropagation();
        activate();
      });
    }
  });
  wireNotes(root);
}

/* ---------------------------------------------------------------------
   Navigation
--------------------------------------------------------------------- */

function visibleViews() { return VIEWS.filter(v => !v.when || v.when()); }
/** Views the hash router can actually show — external links are not routable. */
function routableViews() { return visibleViews().filter(v => !v.href); }

function buildNav() {
  const active = currentViewId();
  const nav = document.getElementById('mainnav');
  if (!nav) return;

  const row = v => {
    const external = Boolean(v.href);
    const attrs = external
      ? 'href="' + v.href + '" target="_blank" rel="noopener noreferrer"'
      : 'href="' + withRouteLanguage('#/' + v.id, Content.lang) + '" aria-current="' + (v.id === active) + '"';
    return '<a class="navlink' + (external ? ' is-external' : '') + '" data-view="' + v.id + '" ' + attrs + '>'
      + iconSVG(v.icon)
      + '<span class="nv-text"><span class="nv-label">' + v.label + '</span>'
      + (v.desc ? '<span class="nv-desc">' + v.desc + '</span>' : '') + '</span>'
      + (external ? '<span class="nv-ext" aria-hidden="true">↗</span>' : '')
      + '</a>';
  };

  /* `divider` groups rows inside one section without inventing a second
     heading: the library surfaces are Technical, just not the daily path. */
  const rule = v => v.divider ? '<hr class="nv-div">' : '';

  const shown = visibleViews();
  nav.innerHTML = NAV_SECTIONS.map(sec => {
    const items = shown.filter(v => v.sec === sec.key);
    if (!items.length) return '';
    return '<div class="nv-sec"><h3 class="nv-sectitle">' + sec.label + '</h3>'
      + items.map(v => rule(v) + row(v)).join('') + '</div>';
  }).join('');
}

/* The panel is a focus-trapped drawer: it takes over the tab order while open
   and hands focus back to the toggle on close, so keyboard users are not
   dropped at the top of the document. */
function wireNavPanel() {
  const toggle = document.getElementById('navToggle');
  const panelEl = document.getElementById('navPanel');
  const scrim = document.getElementById('navScrim');
  const nav = document.getElementById('mainnav');
  if (!toggle || !panelEl || !scrim || !nav) return;

  const isOpen = () => document.body.classList.contains('nav-open');

  const open = () => {
    document.body.classList.add('nav-open');
    toggle.setAttribute('aria-expanded', 'true');
    panelEl.removeAttribute('inert');
    (panelEl.querySelector('.navlink[aria-current="true"]') || panelEl.querySelector('.navlink'))?.focus();
  };
  const close = ({ refocus = true } = {}) => {
    if (!isOpen()) return;
    // Blur before `inert`: a focused element inside an inert subtree keeps focus.
    if (panelEl.contains(document.activeElement)) document.activeElement.blur();
    document.body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    panelEl.setAttribute('inert', '');
    if (refocus) toggle.focus();
  };

  panelEl.setAttribute('inert', '');
  toggle.addEventListener('click', e => { e.stopPropagation(); isOpen() ? close() : open(); });
  scrim.addEventListener('click', () => close());
  document.getElementById('navClose')?.addEventListener('click', () => close());

  // Follow the link first, then close — closing on an external link would
  // otherwise blur the anchor before the browser opens the new tab.
  nav.addEventListener('click', e => {
    if (e.target.closest('.navlink')) close({ refocus: false });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) { close(); return; }
    if (e.key !== 'Tab' || !isOpen()) return;
    const f = [...panelEl.querySelectorAll('a[href], button:not([disabled]), input')].filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

/* ---------- content language switch ---------- */

function paintLangSwitch() {
  const box = document.querySelector('.langswitch.hdr-lang');
  if (!box) return;
  box.setAttribute('aria-checked', String(Content.lang === 'vi'));
  const knob = box.querySelector('.lang-knob');
  if (knob) knob.innerHTML = LANG_FLAG[Content.lang] || '';
}

function wireLangSwitch() {
  const box = document.querySelector('.langswitch.hdr-lang');
  if (!box) return;

  const flip = async () => {
    const next = Content.lang === 'vi' ? 'en' : 'vi';
    box.classList.add('busy');   // setLang re-applies the overlay
    updateRouteLanguage(next);
    await Content.setLang(next);
    box.classList.remove('busy');
  };
  box.addEventListener('click', flip);
  box.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    flip();
  });

  Content.onChange(paintLangSwitch);
  paintLangSwitch();
}

/* ---- Header: hide on scroll down, reveal on scroll up ---- */
function wireHeader() {
  const header = document.querySelector('header.top');
  if (!header) return;

  // Headroom: hide going down, reveal going up.
  //
  // The threshold is measured from where the current direction STARTED, not
  // from the previous event. Comparing against the previous event means a few
  // px of momentum wobble flips the class every frame, and each flip restarts
  // the .26s transform transition — that is the juddering.
  const FLIP_PX = 14;    // must travel this far one way before the state flips
  const TOP_ZONE = 160;  // always visible near the top

  let lastY = Math.max(0, window.scrollY);
  let anchorY = lastY;   // scroll position where the current direction began
  let dir = 0;           // 1 down, -1 up
  let queued = false;

  // --hdr-h: the sticky open-question title's top offset — 0 while headroom-hidden, real height otherwise.
  const syncHeaderOffset = () => {
    const h = header.classList.contains('hidden') ? 0 : header.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--hdr-h', h + 'px');
  };
  new ResizeObserver(syncHeaderOffset).observe(header);

  const apply = () => {
    queued = false;
    const y = Math.max(0, window.scrollY);

    const d = y > lastY ? 1 : y < lastY ? -1 : dir;
    if (d !== dir) { dir = d; anchorY = lastY; }   // turned around: re-anchor
    lastY = y;

    // `nav-open` lives on <body>; reading it off the header always said false.
    if (document.body.classList.contains('topic-open')
      || document.body.classList.contains('nav-open') || y <= TOP_ZONE) {
      header.classList.remove('hidden');
      syncHeaderOffset();
      return;
    }
    if (dir === 1 && y - anchorY > FLIP_PX) header.classList.add('hidden');
    else if (dir === -1 && anchorY - y > FLIP_PX) header.classList.remove('hidden');
    syncHeaderOffset();
  };

  // Coalesce to one update per frame; scroll can fire far more often than that.
  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }, { passive: true });
  apply();
}

function isTrackActive() { return document.body.classList.contains('view-track'); }
function currentRoute() {
  const routePath = routePathFromHash(location.hash);
  const routeWithoutSlash = routePathWithoutQuery(routePath).replace(/^\/?/, '');
  const anchor = routeAnchorFromHash(location.hash);
  const parts = routeWithoutSlash.split('/').filter(Boolean);
  const id = parts[0];
  return routableViews().some(v => v.id === id)
    ? { id, parts: parts.slice(1), anchor }
    : { id: 'track', parts: [], anchor: '' };
}
function currentViewId() {
  return currentRoute().id;
}
let routeRun = 0;
async function route() {
  const run = ++routeRun;
  const lang = routeLanguageFromHash(location.hash, Content.lang);
  if (lang !== Content.lang) {
    await Content.setLang(lang);
    if (run === routeRun) route();
    return;
  }
  updateRouteLanguage(lang);
  const currentRouteState = currentRoute();
  if (currentRouteState.id === 'track' && currentRouteState.parts[0]) {
    await Content.ensureTopic(currentRouteState.parts[0]);
    if (run !== routeRun) return;
    TOPICS = Content.topics;
  }
  if (currentRouteState.anchor) showView(currentRouteState.id, currentRouteState.parts, currentRouteState.anchor);
  else showView(currentRouteState.id, currentRouteState.parts);
}

/* One fragment navigation raises BOTH popstate and hashchange, so the pair of
   listeners below rendered every view twice — the second pass refetched the
   body and, because the shell shrinks to its loading state in between, threw
   away whatever scroll position the first pass had restored. Coalescing on the
   URL keeps one render per navigation; `route()` called directly (a language
   change, refreshCurrentView) still repaints unconditionally. */
let renderedHref = '';
function routeFromNavigation() {
  if (location.href === renderedHref) return;
  renderedHref = location.href;
  route();
}

function showView(id, routeParts = [], anchor = '') {
  clearArticleStructuredData();
  // Swap only the view-* class; `nav-open` and anything else stays put.
  document.body.classList.forEach(c => { if (c.startsWith('view-')) document.body.classList.remove(c); });
  document.body.classList.add('view-' + id);
  if (id !== 'track') closeTopicMenu();

  document.querySelectorAll('#mainnav .navlink:not(.is-external)')
    .forEach(a => a.setAttribute('aria-current', a.dataset.view === id));

  // The header shows the topic, not the view, so the tab title carries the
  // view name — the nav panel's aria-current is the other half of that.
  const v0 = VIEWS.find(x => x.id === id);
  if (v0) setPageMetadata({ title: v0.label, description: v0.desc, url: window.location.href });
  const track = document.getElementById('view-track');
  const host = document.getElementById('view-host');
  let linkedCard = null;
  let mountResult = null;
  if (id === 'track') {
    track.hidden = false; host.hidden = true;
    linkedCard = showLinkedQuestion(routeParts);
    const topicRoute = routeParts.length === 1 && TOPICS.some(topic => topic.key === decodeRoutePart(routeParts[0]));
    if (!linkedCard && !topicRoute) redirectMovedQuestion(routeParts);
  } else {
    track.hidden = true; host.hidden = false;
    const v = VIEWS.find(x => x.id === id);
    if (v && v.md) host.innerHTML = '<div class="page">' + renderMarkdown(v.md) + '</div>';
    else if (v && v.render) host.innerHTML = v.render(routeParts, anchor);
    else host.innerHTML = '';
    decorateHeadingPermalinks(host);
    if (v && v.mount) mountResult = v.mount(host, routeParts, anchor);
  }
  paintLangSwitch();
  window.scrollTo({ top: 0 });
  if (anchor || linkedCard) {
    const settleAnchor = () => {
      if (anchor) {
        // Track owns a special reveal step for collapsed question cards. Every
        // other view uses the shared host, including Markdown-only views whose
        // headings are rendered synchronously.
        if (id === 'track') scrollToTopicAnchor(anchor);
        else {
          decorateHeadingPermalinks(host);
          scrollToAnchor(host, anchor, { behavior: 'auto' });
        }
      } else if (linkedCard) linkedCard.scrollIntoView({ block: 'start', inline: 'nearest' });
    };

    requestAnimationFrame(settleAnchor);
    // System Design, Project, Case Studies, Search and Release Notes fetch
    // their body after the shell is mounted. Retry once the view's async
    // mount has replaced its loading state, so a copied heading URL works on
    // a fresh tab as well as after an in-app click.
    if (anchor && mountResult && typeof mountResult.then === 'function') {
      mountResult.then(() => requestAnimationFrame(settleAnchor), () => {});
    }
  }
}

function decodeRoutePart(value) {
  try { return decodeURIComponent(value || ''); } catch (error) { return ''; }
}

/** Preserve shared links after Study Track topics 10–11 moved into System Design. */
async function redirectMovedQuestion(routeParts) {
  const questionId = questionIdFromRoute(routeParts);
  if (!questionId) return;
  try {
    const collection = await SystemDesign.load(Content.lang);
    if (location.hash !== questionHash(questionId)) return;
    const design = collection.designForSourceItem(questionId);
    if (!design) return;
    history.replaceState(null, '', systemDesignQuestionHash(design.slug, questionId));
    route();
  } catch (error) {}
}

/* ---------------------------------------------------------------------
   Topic picker

   Replaced a horizontally scrolling strip of 24 buttons: the topic you
   wanted was usually off-screen, and the strip fought the page scroll.
--------------------------------------------------------------------- */

const pick = {};

function cacheTopicEls() {
  pick.btn = document.getElementById('topicPick');
  pick.menu = document.getElementById('topicMenu');
  pick.list = document.getElementById('topicList');
  pick.search = document.getElementById('topicSearch');
  pick.scrim = document.getElementById('topicScrim');
  pick.empty = document.getElementById('tmEmpty');
  pick.num = document.getElementById('tpNum');
  pick.label = document.getElementById('tpLabel');
  pick.sub = document.getElementById('tpSub');
}

const pad2 = n => String(n).padStart(2, '0');

function topicProgress(t) {
  const ids = t.item_ids || [];
  let done = 0;
  for (const id of ids) if (Store.reviewed.has(id)) done++;
  return { done, total: ids.length };
}

function topicMatches(t) {
  if (typeFilter !== 'all' && t.topic_type !== typeFilter) return false;
  if (!topicQuery) return true;
  const hay = [pad2(t.n), t.label, t.title, (t.tags || []).join(' '), TOPIC_TYPE_LABEL[t.topic_type] || '']
    .join(' ').toLowerCase();
  return hay.includes(topicQuery);
}

function buildTopicList() {
  let shown = 0;
  pick.list.innerHTML = TOPICS.map((t, i) => {
    const { done, total } = topicProgress(t);
    const pct = total ? Math.round(done / total * 100) : 0;
    const hit = topicMatches(t);
    if (hit) shown++;
    return '<button class="tm-row" role="option" data-i="' + i + '" data-topic-type="' + t.topic_type + '"'
      + ' aria-selected="' + (i === current) + '"' + (hit ? '' : ' hidden') + '>'
      + '<span class="tm-n">' + pad2(t.n) + '</span>'
      + '<span class="tm-main">'
      + '<span class="tm-label">' + escapeHtml(t.label) + '</span>'
      + '<span class="tm-meta">' + (TOPIC_TYPE_LABEL[t.topic_type] || t.topic_type) + ' · ' + total + ' items</span>'
      + '</span>'
      + '<span class="tm-prog" title="' + done + ' of ' + total + ' reviewed">'
      + '<span class="tm-bar" style="--p:' + pct + '"></span>'
      + '<span class="tm-pct">' + done + '/' + total + '</span>'
      + '</span></button>';
  }).join('');

  pick.empty.hidden = shown > 0;
  pick.list.querySelectorAll('.tm-row').forEach(b => {
    b.addEventListener('click', () => { goTo(parseInt(b.dataset.i, 10)); closeTopicMenu(); });
  });
}

function paintTopicButton() {
  const t = TOPICS[current];
  if (!t || !pick.btn) return;
  const { done, total } = topicProgress(t);
  pick.num.textContent = pad2(t.n);
  pick.btn.dataset.topicType = t.topic_type;
  pick.num.dataset.topicType = t.topic_type;
  pick.label.textContent = t.label;
  pick.sub.textContent = (TOPIC_TYPE_LABEL[t.topic_type] || t.topic_type) + ' · ' + done + '/' + total + ' reviewed';
  document.getElementById('tbCur').textContent = current + 1;
  document.getElementById('prevTopic').disabled = current === 0;
  document.getElementById('nextTopic').disabled = current === TOPICS.length - 1;
}

function openTopicMenu() {
  if (!pick.menu) return;
  buildTopicList();
  pick.menu.hidden = false;
  document.body.classList.add('topic-open');
  pick.btn.setAttribute('aria-expanded', 'true');
  const cur = pick.list.querySelector('[aria-selected="true"]');
  if (cur) cur.scrollIntoView({ block: 'nearest' });
  // On a phone the keyboard would cover the list you came here to read.
  if (window.matchMedia('(min-width: 761px)').matches) pick.search.focus();
}

function closeTopicMenu() {
  if (!pick.menu || pick.menu.hidden) return;
  if (pick.menu.contains(document.activeElement)) pick.btn.focus();
  pick.menu.hidden = true;
  document.body.classList.remove('topic-open');
  pick.btn.setAttribute('aria-expanded', 'false');
}

function isTopicMenuOpen() { return pick.menu && !pick.menu.hidden; }

function wireTopicPicker() {
  cacheTopicEls();
  if (!pick.btn) return;

  pick.btn.addEventListener('click', e => {
    e.stopPropagation();
    isTopicMenuOpen() ? closeTopicMenu() : openTopicMenu();
  });
  pick.scrim.addEventListener('click', () => closeTopicMenu());
  document.addEventListener('click', e => {
    // A chip that rebuilt the group bar is detached by the time the click
    // gets here, so `menu.contains()` says "outside" and shuts the panel.
    if (!e.target.isConnected) return;
    if (isTopicMenuOpen() && !pick.menu.contains(e.target) && !pick.btn.contains(e.target)) closeTopicMenu();
  });

  pick.search.addEventListener('input', () => {
    topicQuery = pick.search.value.trim().toLowerCase();
    buildTopicList();
  });

  pick.menu.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); closeTopicMenu(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = [...pick.list.querySelectorAll('.tm-row:not([hidden])')];
    if (!rows.length) return;
    e.preventDefault();
    const at = rows.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown'
      ? (at < 0 ? 0 : Math.min(at + 1, rows.length - 1))
      : (at <= 0 ? 0 : at - 1);
    rows[next].focus();
  });

  document.getElementById('prevTopic').addEventListener('click', () => goTo(current - 1));
  document.getElementById('nextTopic').addEventListener('click', () => goTo(current + 1));

  buildTypeBar();
  paintTopicButton();
  dots.innerHTML = TOPICS.map((_, i) => '<span class="pdot' + (i === current ? ' on' : '') + '"></span>').join('');
}

/* ---------- topic track view ---------- */

/* Filtering only hides rows: TOPICS and every index stay whole, so `current`,
   the dots and the pager keep counting across the full track. */
function buildTypeBar() {
  const bar = document.getElementById('groupbar');
  if (!bar) return;
  const counts = TOPICS.reduce((m, t) => (m[t.topic_type] = (m[t.topic_type] || 0) + 1, m), {});
  const chip = (key, label, n) =>
    '<button class="gchip" data-g="' + key + '" data-topic-type="' + key + '" '
    + 'aria-pressed="' + (typeFilter === key) + '">' + label
    + '<span class="gcount">' + n + '</span></button>';

  bar.innerHTML = chip('all', 'All', TOPICS.length)
    + TOPIC_TYPES.filter(g => counts[g.key]).map(g => chip(g.key, g.label, counts[g.key])).join('');

  bar.querySelectorAll('.gchip').forEach(b => b.addEventListener('click', () => {
    const g = b.dataset.g;
    const hadFocus = bar.contains(document.activeElement);
    typeFilter = typeFilter === g ? 'all' : g;
    buildTypeBar();
    buildTopicList();
    // The rebuild threw away the chip that was clicked; without this the
    // keyboard lands on <body> and the menu's Escape/arrow keys go dead.
    if (hadFocus) bar.querySelector('[data-g="' + g + '"]')?.focus();
  }));
}

function topicRoute(topic) {
  return '/track/' + encodeURIComponent(topic.key);
}

function topicHeadingId(topic, sectionIndex) {
  return topic.key + '-section-' + (sectionIndex + 1);
}

function topicHeadingLink(topic, id, label, className = 'topic-heading-anchor') {
  const route = topicRoute(topic);
  return '<a class="' + className + '" data-anchor-link data-anchor-id="' + escapeHtml(id)
    + '" data-anchor-route="' + escapeHtml(route) + '" href="' + escapeHtml(anchorHref(id, route))
    + '" aria-label="Link to this section">' + escapeHtml(label) + '</a>';
}

function topicDates(topic) {
  const facts = contentDateFacts(topic, Content.lang);
  return '<div class="content-dates">' + facts.map(fact => '<span><b>' + escapeHtml(fact.label)
    + '</b><time datetime="' + escapeHtml(fact.value) + '">' + escapeHtml(fact.formatted) + '</time></span>').join('')
    + '</div>';
}

function renderDay() {
  // panel.innerHTML below detaches every card; stop their timers first.
  stopDsaPlayers(panel);
  const t = TOPICS[current];
  const sectionsHTML = t.sections.map((sec, sectionIndex) =>
    '<div class="section-h" id="' + escapeHtml(topicHeadingId(t, sectionIndex)) + '">'
    + topicHeadingLink(t, topicHeadingId(t, sectionIndex), sec.title) + '<span class="sline"></span></div>'
    + sec.items.map(it => qcard(it)).join('')
  ).join('');
  const topicQcount = t.sections.reduce((a, s) => a + s.items.length, 0);
  const topicTitleId = t.key + '-title';

  panel.innerHTML =
    '<section class="hero"><div class="hero-head">'
    + '<div class="daynum" data-topic-type="' + t.topic_type + '"><small>'
    + (TOPIC_TYPE_LABEL[t.topic_type] || t.topic_type).toUpperCase() + '</small>' + t.n + '</div>'
    + '<div><h2 id="' + escapeHtml(topicTitleId) + '">' + topicHeadingLink(t, topicTitleId, t.title)
    + '</h2><p class="intro">' + t.intro + '</p>'
    + topicDates(t)
    + '<div class="tags">' + t.tags.map(tag => '<span class="tag">' + tag + '</span>').join('') + '</div></div>'
    + '</div></section>'
    + '<div class="toolbar">'
    + '<span class="sectioncount">' + topicQcount + ' items · ' + t.sections.length + ' sections</span>'
    + '<div class="tb-actions"><button class="btn-ghost" id="toggleAll">Expand all</button></div>'
    + '</div>' + sectionsHTML;

  setArticleStructuredData(t, {
    headline: t.title,
    description: t.intro,
    lang: Content.lang,
    url: window.location.href
  });

  wireQcards(panel, () => { updateProgress(); paintTopicButton(); });
  decorateHeadingPermalinks(panel);

  const toggleAll = document.getElementById('toggleAll');
  toggleAll.addEventListener('click', () => {
    const cards = [...panel.querySelectorAll('.qcard')];
    const anyClosed = cards.some(c => !c.classList.contains('open'));
    cards.forEach(c => {
      c.classList.toggle('open', anyClosed);
      c.querySelector('.qhead').setAttribute('aria-expanded', anyClosed);
      if (anyClosed && Store.markReviewed(c.dataset.qid)) c.classList.add('done');
    });
    if (anyClosed) mountDsaPlayers(panel); else stopDsaPlayers(panel);
    updateProgress(); paintTopicButton(); syncToggleAllLabel();
  });
  syncToggleAllLabel();

  document.getElementById('curDay').textContent = current + 1;
  document.getElementById('prevBtn').disabled = current === 0;
  const nextBtn = document.getElementById('nextBtn');
  nextBtn.disabled = current === TOPICS.length - 1;
  nextBtn.textContent = current === TOPICS.length - 1 ? 'Finished ✓' : 'Next topic →';
  prefetchNearbyTopics();
}

/** Select and reveal the topic named by a question deep link. */
function showLinkedQuestion(routeParts) {
  const questionId = questionIdFromRoute(routeParts);
  const found = findQuestion(TOPICS, questionId);
  if (!found) {
    let topicKey = '';
    try { topicKey = routeParts.length === 1 ? decodeURIComponent(routeParts[0]) : ''; } catch (error) {}
    const topicIndex = TOPICS.findIndex(topic => topic.key === topicKey);
    if (topicIndex < 0) return null;
    if (current !== topicIndex) {
      current = topicIndex;
      dots.querySelectorAll('.pdot').forEach((dot, index) => dot.classList.toggle('on', index === current));
      renderDay();
      paintTopicButton();
      paintLangSwitch();
    }
    return null;
  }

  if (current !== found.topicIndex) {
    current = found.topicIndex;
    dots.querySelectorAll('.pdot').forEach((dot, index) => dot.classList.toggle('on', index === current));
    renderDay();
    paintTopicButton();
    paintLangSwitch();
  }

  const card = [...panel.querySelectorAll('.qcard')]
    .find(candidate => candidate.dataset.qid === questionId);
  panel.querySelectorAll('.qcard.link-target').forEach(candidate => candidate.classList.remove('link-target'));
  if (card) card.classList.add('link-target');
  return card || null;
}

function scrollToTopicAnchor(anchor) {
  return scrollToAnchor(panel, anchor, {
    reveal: target => {
      const card = target.closest('.qcard');
      if (!card || card.classList.contains('open')) return;
      card.classList.add('open');
      card.querySelector('.qhead')?.setAttribute('aria-expanded', 'true');
      mountDsaPlayers(card);
    }
  });
}

function syncToggleAllLabel() {
  const cards = [...panel.querySelectorAll('.qcard')];
  const allOpen = cards.length && cards.every(c => c.classList.contains('open'));
  const btn = document.getElementById('toggleAll');
  if (btn) btn.textContent = allOpen ? 'Collapse all' : 'Expand all';
}

function updateProgress() {
  let done = 0;
  for (const id of Store.reviewed) if (topicItemIds.has(id)) done++;
  document.getElementById('reviewedCount').textContent = done;
  document.getElementById('totalCount').textContent = totalQ;
  document.getElementById('ring').style.setProperty('--p', totalQ ? Math.round(done / totalQ * 100) : 0);
}

let topicLoadRun = 0;
async function goTo(i) {
  if (i < 0 || i >= TOPICS.length) return;
  const run = ++topicLoadRun;
  const target = TOPICS[i];
  await Content.ensureTopic(target.key);
  if (run !== topicLoadRun) return;
  TOPICS = Content.topics;
  if (isTrackActive() && questionIdFromRoute(currentRoute().parts)) {
    history.replaceState(null, '', withRouteLanguage('#/track', Content.lang));
  }
  current = i;
  dots.querySelectorAll('.pdot').forEach((dt, idx) => dt.classList.toggle('on', idx === current));
  renderDay();
  paintTopicButton();
  paintLangSwitch();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prefetchNearbyTopics() {
  const work = () => [TOPICS[current - 1], TOPICS[current + 1]].filter(Boolean)
    .forEach(topic => Content.ensureTopic(topic.key).catch(() => {}));
  if (typeof requestIdleCallback === 'function') requestIdleCallback(work, { timeout: 1500 });
  else setTimeout(work, 400);
}

/* ---------- sync status indicator ---------- */

const SYNC_TEXT = {
  offline: ['On this device only', 'No backend configured — see the README to turn on sync.'],
  local: ['Not signed in', 'Progress is kept on this device. Sign in to sync it to Google Sheets.'],
  syncing: ['Saving…', 'Sending changes to Google Sheets.'],
  synced: ['Synced', 'Everything has been saved to Google Sheets.'],
  stale: ['Sign in again', 'The session ended. Your data is safe on this device and will be sent once you sign back in.'],
  error: ['Save failed — will retry', 'Could not reach the Sheet. Your data is still on this device and will be retried.']
};

function mountSyncState(el) {
  if (!el) return;
  const paint = () => {
    const [label, hint] = SYNC_TEXT[Store.status] || SYNC_TEXT.local;
    const pending = Store.queue.length;
    el.className = 'syncstate s-' + Store.status;
    el.textContent = label + (pending ? ' (' + pending + ')' : '');
    el.title = (Store.lastError ? Store.lastError + ' — ' : '') + hint;
  };
  paint();
  Store.onSync(paint);
  Auth.onChange(paint);

  // Click to retry now rather than waiting for the debounce, and to surface
  // the failure reason — a title tooltip is unreachable on touch devices.
  el.addEventListener('click', () => {
    if (Store.lastError) {
      alert('Last sync error:\n\n' + Store.lastError
        + '\n\nYour data is still safe on this device (' + Store.queue.length + ' change(s) pending).');
    }
    Store.flush();
  });
}

/* ---------- startup ---------- */

async function init() {
  try {
    const initial = currentRoute();
    await Content.load(initial.id === 'track' ? initial.parts[0] : '');
    TOPICS = Content.topics;
    if (initial.id === 'track' && initial.parts[0]) {
      let requested = '';
      try { requested = decodeURIComponent(initial.parts[0]); } catch (error) {}
      const topicKey = requested.split('.')[0];
      const requestedIndex = TOPICS.findIndex(topic => topic.key === topicKey || topic.n === Number(requested));
      if (requestedIndex >= 0) current = requestedIndex;
    }
  } catch (e) {
    panel.innerHTML = '<section class="hero"><div style="padding:8px 4px">'
      + '<h2>Could not load the content</h2>'
      + '<p class="intro">The page reads <code>data/manifest.json</code> over <code>fetch</code>, so it has to run on '
      + 'a web server (HTTP) — opening the file directly with <code>file://</code> will not work.</p>'
      + '<p class="intro">To view it locally: open a terminal in <code>public/</code>, run '
      + '<code>python -m http.server 8080</code> and go to <code>http://localhost:8080</code>.</p>'
      + '<p class="intro" style="color:var(--clay)">Error detail: ' + (e && e.message ? e.message : e) + '</p>'
      + '</div></section>';
    return;
  }

  topicItemIds = Content.topicItemIds;
  totalQ = Content.totalTopicItems;
  document.getElementById('totDay').textContent = TOPICS.length;
  document.getElementById('tbTot').textContent = TOPICS.length;

  // Must precede the first render: qcard() reads reviewed state and notes.
  Store.attachAuth();
  // Before Auth.init(), so signing in later carries the session's searches over.
  SearchHistory.attachAuth();

  wireTopicPicker();
  renderDay();
  updateProgress();

  buildNav();
  wireNavPanel();
  wireLangSwitch();
  wireHeader();
  wireAnchorLinks(document);
  wireHeadingPermalinks(document);
  // Registers its own Content.onChange first, so the index is dropped before
  // the repaint below re-mounts a view that reads it.
  mountSearchOverlay();
  mountAuthUI(document.getElementById('authbar'));
  mountSyncState(document.getElementById('syncState'));

  window.addEventListener('hashchange', routeFromNavigation);
  // Heading permalinks use pushState so clicking them does not remount the
  // current view; Back/Forward must still restore the previous anchor.
  window.addEventListener('popstate', routeFromNavigation);
  routeFromNavigation();

  document.getElementById('prevBtn').addEventListener('click', () => goTo(current - 1));
  document.getElementById('nextBtn').addEventListener('click', () => goTo(current + 1));
  document.addEventListener('keydown', e => {
    if (e.target.closest('button')) return;
    // Arrow keys belong to the note field, and to the topic menu while open.
    if (e.target.closest('input, textarea, [contenteditable]')) return;
    if (isTopicMenuOpen() || !isTrackActive()) return;
    if (e.key === 'ArrowRight') goTo(current + 1);
    if (e.key === 'ArrowLeft') goTo(current - 1);
  });

  Content.onChange(() => {
    TOPICS = Content.topics;
    buildTypeBar();
    paintTopicButton();
    if (isTopicMenuOpen()) buildTopicList();
    refreshCurrentView();
  });

  // Signing in reveals the Admin menu and brings in merged Sheet data, so
  // the current view has to be repainted.
  let lastUid = Auth.session?.sub || null;
  Auth.onChange(() => {
    buildNav();
    const uid = Auth.session?.sub || null;
    if (uid !== lastUid) { lastUid = uid; refreshCurrentView(); }
  });
  Store.onSync(() => { if (isTrackActive()) { updateProgress(); paintTopicButton(); } });

  // One repaint once the first merge from the Sheet completes.
  let merged = false;
  Store.onSync(() => {
    if (merged || Store.status !== 'synced') return;
    merged = true;
    refreshCurrentView();
  });

  await Auth.init();
}

/** Repaints the open view so new data shows (checkmarks, note contents). */
function refreshCurrentView() {
  if (isTrackActive()) {
    renderDay();
    updateProgress();
    paintTopicButton();
    showLinkedQuestion(currentRoute().parts);
  }
  else route();
}

init();
