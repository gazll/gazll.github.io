/* Search: the header overlay and the full-results panel.

   Two surfaces for one model. The overlay is the fast path — type, see the
   best dozen hits, press Enter — and it deliberately shows only a few rows per
   library so the shape of the answer stays readable. Everything beyond that is
   the panel at `#/search/<query>`, which is a real route, so a search can be
   shared or bookmarked like any other view.

   UI strings here are English like the rest of the interface; only the
   material they point at follows the EN/VI switch. */
import { escapeHtml } from '../lib/markdown.js';
import { debounce } from '../lib/ui.js';
import { Content } from '../lib/content.js';
import { SearchIndex, SURFACES, searchHash, queryFromRoute } from '../lib/search.js';
import { SearchHistory } from '../lib/search-history.js';
import { loadingBlock } from '../lib/loading.js';

const OVERLAY_PER_SURFACE = 5;
const OVERLAY_MAX = 12;
const PANEL_MAX = 200;

const SEARCH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
  + ' stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>';
const CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
  + ' stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const CLOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
  + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/></svg>';

const surfaceLabel = id => (SURFACES.find(row => row.id === id) || {}).label || id;

/** Search rows carry content text, so every field is escaped or pre-marked. */
function hitRow(hit, index) {
  const entry = hit.entry;
  const topicType = entry.topicType ? ' data-topic-type="' + escapeHtml(entry.topicType) + '"' : '';
  const level = entry.difficulty ? '<span class="gs-hit-level level-' + escapeHtml(entry.difficulty) + '">' + escapeHtml(entry.difficulty) + '</span>' : '';
  return '<a class="gs-hit" href="' + escapeHtml(entry.href) + '" data-index="' + index + '"'
    + ' data-key="' + escapeHtml(entry.key) + '"' + topicType + '>'
    + '<span class="gs-hit-badge">' + escapeHtml(entry.badge || '') + '</span>'
    + '<span class="gs-hit-main"><span class="gs-hit-title">' + hit.titleHtml + '</span>'
    + '<span class="gs-hit-context">' + escapeHtml(entry.context || '') + level + (entry.featured ? ' <span class="gs-hit-featured">★</span>' : '') + '</span>'
    + (hit.snippet ? '<span class="gs-hit-snippet">' + hit.snippet + '</span>' : '')
    + '</span><span class="gs-hit-go" aria-hidden="true">↵</span></a>';
}

/* `totals` is the count before the overlay's per-surface cap, so a group that
   shows five of twelve says so rather than contradicting the footer.

   Groups follow the ranking — the surface holding the best hit comes first —
   not the fixed SURFACES order. Fixed order buries the top result under a
   whole group of weaker ones, and since the first row is the one `Enter`
   opens, it also opens the wrong thing. */
function groupRows(hits, totals = null, indexOffset = 0) {
  let index = indexOffset;
  const order = [];
  for (const hit of hits) if (!order.includes(hit.entry.surface)) order.push(hit.entry.surface);

  return order.map(surface => {
    const rows = hits.filter(hit => hit.entry.surface === surface);
    const total = totals ? totals[surface] || rows.length : rows.length;
    const count = total > rows.length ? rows.length + ' of ' + total : String(rows.length);
    return '<section class="gs-group"><h3>' + escapeHtml(surfaceLabel(surface))
      + '<span>' + count + '</span></h3>'
      + rows.map(hit => hitRow(hit, index++)).join('') + '</section>';
  }).join('');
}

function historyRows(entries) {
  if (!entries.length) return '';
  return '<section class="gs-group gs-history"><h3>Recent searches'
    + '<button type="button" class="gs-clear" data-clear-history>Clear all</button></h3>'
    + entries.map(entry => '<div class="gs-recent-row">'
      + '<a class="gs-recent" href="' + escapeHtml(searchHash(entry.q)) + '" data-recent="'
      + escapeHtml(entry.q) + '">' + CLOCK_SVG + '<span>' + escapeHtml(entry.q) + '</span>'
      + (entry.hits > 1 ? '<i>' + entry.hits + '×</i>' : '') + '</a>'
      + '<button type="button" class="gs-forget" data-forget="' + escapeHtml(entry.q)
      + '" aria-label="Remove &quot;' + escapeHtml(entry.q) + '&quot; from recent searches">'
      + CLOSE_SVG + '</button></div>').join('')
    + '</section>';
}

const historyNote = () => SearchHistory.signedIn
  ? 'Recent searches are saved to your account.'
  : 'Recent searches are kept for this browser session. Sign in to keep them.';

/* ---------------------------------------------------------------------
   Overlay
--------------------------------------------------------------------- */

const overlay = {
  root: null, input: null, body: null, foot: null, scrim: null,
  open: false,
  active: -1,
  query: ''
};

function overlayMarkup() {
  return '<div class="gs-box"><span class="gs-box-icon">' + SEARCH_SVG + '</span>'
    + '<input id="gsInput" class="gs-input" type="search" autocomplete="off" spellcheck="false"'
    + ' placeholder="Search questions, blueprints and case studies…" aria-label="Search all material"'
    + ' aria-controls="gsBody">'
    + '<button type="button" class="gs-esc" data-close>Esc</button></div>'
    // Not role="listbox": the rows are real links, and a listbox whose children
    // are anchors is announced as an empty listbox.
    + '<div class="gs-body" id="gsBody" aria-label="Search results"></div>'
    + '<div class="gs-foot"><span data-foot-note></span>'
    + '<span class="gs-keys"><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>↵</kbd> open · <kbd>Esc</kbd> close</span></div>';
}

function paintOverlay() {
  const query = overlay.query.trim();
  if (!query) {
    overlay.active = -1;
    const entries = SearchHistory.entries;
    overlay.body.innerHTML = historyRows(entries)
      + '<p class="gs-empty">Search every question in the Study Track, every System Design blueprint '
      + 'and every case study at once.</p>';
    overlay.foot.textContent = entries.length ? historyNote() : 'Type at least two characters.';
    return;
  }

  const found = SearchIndex.search(query, { limit: PANEL_MAX });
  const shown = [];
  const perSurface = {};
  for (const hit of found.results) {
    const used = perSurface[hit.entry.surface] || 0;
    if (used >= OVERLAY_PER_SURFACE || shown.length >= OVERLAY_MAX) continue;
    perSurface[hit.entry.surface] = used + 1;
    shown.push(hit);
  }
  overlay.active = shown.length ? 0 : -1;

  const more = found.total > shown.length;
  overlay.body.innerHTML = shown.length
    ? (more
        ? '<a class="gs-more" href="' + escapeHtml(searchHash(query)) + '" data-index="0">'
          + 'See all ' + found.total + ' results for “' + escapeHtml(query) + '”'
          + '<span aria-hidden="true">→</span></a>'
        : '')
      + groupRows(shown, found.counts, more ? 1 : 0)
    : emptyResult(query);

  if (more) overlay.hits = [...shown, { more: true, href: searchHash(query) }];
  overlay.foot.textContent = found.total
    ? found.total + ' result' + (found.total === 1 ? '' : 's')
      + SURFACES.map(surface => found.counts[surface.id] ? ' · ' + found.counts[surface.id] + ' in ' + surface.label : '').join('')
    : (SearchIndex.ready ? 'Nothing found.' : 'Loading the libraries…');
  paintActive();
}

/* An index that has not finished building has no hits yet, which is not the
   same fact as "nothing matches" — printing the second while the first is true
   is the one thing that makes search look broken. */
function emptyResult(query) {
  if (!SearchIndex.ready) return loadingBlock('Loading the libraries…', { compact: true });
  return '<p class="gs-empty">No match for <b>' + escapeHtml(query) + '</b>.'
    + (SearchIndex.enriched ? '' : ' Archived case studies are still being indexed.') + '</p>';
}

function paintActive() {
  const rows = [...overlay.body.querySelectorAll('[data-index]')];
  rows.forEach(row => row.classList.toggle('is-active', Number(row.dataset.index) === overlay.active));
  const current = rows.find(row => Number(row.dataset.index) === overlay.active);
  if (current) current.scrollIntoView({ block: 'nearest' });
}

/** Keeps Tab inside the dialog, the way the nav panel does for the drawer. */
function trapTab(event) {
  const focusable = [...overlay.root.querySelectorAll('a[href], button:not([disabled]), input')]
    .filter(el => el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  else if (!overlay.root.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
}

function moveActive(step) {
  const rows = [...overlay.body.querySelectorAll('[data-index]')];
  if (!rows.length) return;
  const last = rows.length - 1;
  overlay.active = overlay.active < 0
    ? (step > 0 ? 0 : last)
    : Math.min(last, Math.max(0, overlay.active + step));
  paintActive();
}

/** Follows a result. Recording here, not on keystroke, keeps history meaningful. */
function goTo(href) {
  const query = overlay.query.trim();
  if (query) SearchHistory.record(query);
  closeOverlay({ refocus: false });
  if (location.hash === href) return;
  location.hash = href;
}

function openOverlay(initial = '') {
  if (!overlay.root) return;
  overlay.open = true;
  overlay.root.hidden = false;
  overlay.scrim.hidden = false;
  document.body.classList.add('search-open');
  if (initial) overlay.input.value = initial;
  overlay.query = overlay.input.value;
  paintOverlay();
  overlay.input.focus();
  overlay.input.select();
  loadIndex();
}

function closeOverlay({ refocus = true } = {}) {
  if (!overlay.open) return;
  overlay.open = false;
  if (overlay.root.contains(document.activeElement)) document.activeElement.blur();
  overlay.root.hidden = true;
  overlay.scrim.hidden = true;
  document.body.classList.remove('search-open');
  if (refocus) document.getElementById('searchTrigger')?.focus();
}

/* The index is built on demand and the archived articles arrive after it, so
   both passes repaint whatever is on screen when they land. */
let indexPromise = null;
function loadIndex() {
  if (!indexPromise) {
    indexPromise = SearchIndex.ensure().then(() => {
      repaintOpenSurfaces();
      return SearchIndex.enrich().then(repaintOpenSurfaces);
    }).catch(() => { indexPromise = null; });   // retry on the next search
  }
  return indexPromise;
}

let repaintPanel = null;   // set while the full panel is mounted
function repaintOpenSurfaces() {
  if (overlay.open) paintOverlay();
  if (repaintPanel) repaintPanel();
}

/** Header trigger, overlay and the global shortcuts. Called once at startup. */
export function mountSearchOverlay() {
  if (overlay.root) return;

  const scrim = document.createElement('div');
  scrim.className = 'gs-scrim';
  scrim.hidden = true;

  const root = document.createElement('div');
  root.className = 'gs-overlay';
  root.id = 'gsOverlay';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Search');
  root.hidden = true;
  root.innerHTML = overlayMarkup();

  document.body.append(scrim, root);
  overlay.root = root;
  overlay.scrim = scrim;
  overlay.input = root.querySelector('#gsInput');
  overlay.body = root.querySelector('#gsBody');
  overlay.foot = root.querySelector('[data-foot-note]');

  const repaint = debounce(() => paintOverlay(), 120);
  overlay.input.addEventListener('input', () => {
    overlay.query = overlay.input.value;
    repaint();
  });

  root.addEventListener('click', event => {
    if (event.target.closest('[data-close]')) { closeOverlay(); return; }

    // Both of these repaint the list under the button that was clicked, which
    // drops focus to <body>. Focus goes back to the field, or the next key
    // press lands outside the dialog.
    const forget = event.target.closest('[data-forget]');
    if (forget) {
      SearchHistory.remove(forget.dataset.forget);
      paintOverlay();
      overlay.input.focus();
      return;
    }
    if (event.target.closest('[data-clear-history]')) {
      SearchHistory.clear();
      paintOverlay();
      overlay.input.focus();
      return;
    }

    const link = event.target.closest('a[href]');
    if (!link) return;
    event.preventDefault();
    const recent = link.dataset.recent;
    if (recent) { openOverlay(recent); return; }
    goTo(link.getAttribute('href'));
  });

  scrim.addEventListener('click', () => closeOverlay());
  document.getElementById('searchTrigger')?.addEventListener('click', () => openOverlay());

  /* Every overlay key is handled here rather than on the dialog: repainting
     the list detaches whatever was focused, and a listener on the dialog goes
     deaf the moment focus falls back to <body>. */
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K')) {
      event.preventDefault();
      overlay.open ? closeOverlay() : openOverlay();
      return;
    }

    if (overlay.open) {
      if (event.key === 'Escape') { event.preventDefault(); closeOverlay(); return; }
      if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(1); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(-1); return; }
      // aria-modal promises the rest of the page is unreachable, and the scrim
      // enforces that for the mouse — Tab has to be held in too.
      if (event.key === 'Tab') { trapTab(event); return; }
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const rows = [...overlay.body.querySelectorAll('[data-index]')];
      const current = rows.find(row => Number(row.dataset.index) === overlay.active) || rows[0];
      if (current) goTo(current.getAttribute('href'));
      else if (overlay.query.trim()) goTo(searchHash(overlay.query));
      return;
    }

    const typing = event.target.closest && event.target.closest('input, textarea, select, [contenteditable]');
    if (event.key !== '/' || typing || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    openOverlay();
  });

  // A language switch rebuilds every string the index copied out of Content.
  Content.onChange(() => {
    SearchIndex.invalidate();
    indexPromise = null;
    if (overlay.open || repaintPanel) loadIndex();
  });

  SearchHistory.onChange(() => { if (overlay.open && !overlay.query.trim()) paintOverlay(); });
}

/* ---------------------------------------------------------------------
   Full-results panel — #/search/<query>
--------------------------------------------------------------------- */

export function renderSearch(routeParts = []) {
  const query = queryFromRoute(routeParts);
  return '<div class="page gs-page">'
    + '<header class="gs-page-head"><p class="cs-eyebrow">Search</p>'
    + '<h1>Everything, in one place</h1>'
    + '<p class="gs-page-intro">One query across the Study Track, the System Design blueprints '
    + 'and the case-study library. Results name the topic they belong to, so you can jump straight there.</p>'
    + '<div class="gs-page-box">' + SEARCH_SVG
    + '<input id="gsPageInput" class="gs-input" type="search" autocomplete="off" spellcheck="false"'
    + ' placeholder="Search questions, blueprints and case studies…" aria-label="Search all material"'
    + ' value="' + escapeHtml(query) + '"></div>'
    + '<div class="gs-filters" id="gsFilters"></div></header>'
    + '<div class="gs-page-body" id="gsResults">' + loadingBlock('Loading the libraries…', { compact: true })
    + '</div></div>';
}

export async function mountSearch(host, routeParts = []) {
  const root = host.querySelector('.gs-page');
  if (!root) return;

  const input = root.querySelector('#gsPageInput');
  const filters = root.querySelector('#gsFilters');
  const results = root.querySelector('#gsResults');
  let surface = 'all';

  const paint = () => {
    // The libraries and the language switch both repaint late; by then the
    // reader may have moved on and this DOM is detached.
    if (!root.isConnected) { repaintPanel = null; return; }
    const query = input.value.trim();
    if (!query) {
      filters.innerHTML = '';
      results.innerHTML = historyRows(SearchHistory.entries)
        + '<p class="gs-empty">' + escapeHtml(historyNote()) + '</p>';
      return;
    }

    const found = SearchIndex.search(query, { limit: PANEL_MAX, surface });
    const chip = (id, label, count) => '<button type="button" class="gchip gs-chip" data-surface="' + id + '"'
      + ' aria-pressed="' + (surface === id) + '">' + label + '<span class="gcount">' + count + '</span></button>';
    const totalAll = SURFACES.reduce((sum, row) => sum + (found.counts[row.id] || 0), 0);
    filters.innerHTML = chip('all', 'All', totalAll)
      + SURFACES.filter(row => found.counts[row.id]).map(row => chip(row.id, row.label, found.counts[row.id])).join('');

    results.innerHTML = found.results.length
      ? '<p class="gs-count">' + found.total + ' result' + (found.total === 1 ? '' : 's')
        + (surface === 'all' ? '' : ' in ' + escapeHtml(surfaceLabel(surface)))
        + ' for <b>' + escapeHtml(query) + '</b>'
        + (found.total > PANEL_MAX ? ' · showing the first ' + PANEL_MAX : '') + '</p>'
        + groupRows(found.results)
      : emptyResult(query);
  };

  repaintPanel = paint;

  const search = debounce(() => {
    const query = input.value.trim();
    // replaceState, not the hash: retyping must not stack one history entry
    // per keystroke, but the URL still has to stay shareable.
    history.replaceState(null, '', searchHash(query));
    paint();
  }, 200);
  input.addEventListener('input', search);

  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const query = input.value.trim();
    if (query) SearchHistory.record(query);
    paint();
  });

  filters.addEventListener('click', event => {
    const chip = event.target.closest('[data-surface]');
    if (!chip) return;
    surface = chip.dataset.surface;
    paint();
  });

  results.addEventListener('click', event => {
    const forget = event.target.closest('[data-forget]');
    if (forget) { SearchHistory.remove(forget.dataset.forget); paint(); return; }
    if (event.target.closest('[data-clear-history]')) { SearchHistory.clear(); paint(); return; }

    const recent = event.target.closest('[data-recent]');
    if (recent) {
      event.preventDefault();
      input.value = recent.dataset.recent;
      history.replaceState(null, '', searchHash(input.value));
      paint();
      input.focus();
      return;
    }
    const hit = event.target.closest('.gs-hit');
    if (hit) SearchHistory.record(input.value.trim());
  });

  const query = queryFromRoute(routeParts);
  if (query && query !== input.value) input.value = query;
  paint();
  // Landing here does not record: history is what the reader acted on, and
  // the overlay already recorded the query that sent them to this panel.
  await loadIndex();
  paint();
}
