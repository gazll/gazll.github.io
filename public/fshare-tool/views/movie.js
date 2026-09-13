/* Movie catalog tab: unlock the sealed database, search it grouped by title,
   re-check a selection in the browser, and copy what works.

   The catalog ships encrypted (see tools/fshare-movie.mjs) and the passphrase
   is the same one the private schedule uses, under the same storage key —
   so opening one opens the other, and locking either drops both. A browser
   re-check only updates what is on screen: the catalog on disk is the tool's
   to write, which is why the note beside the output list says so. */

import { $ } from '../lib/state.js';
import { copyText, debounce, downloadTxt, fmtSize, toast } from '../lib/util.js';
import {
  MOVIE_DB_URL, buildSearchIndex, groupByFolder, indexById, movieHaystack, narrowsSearch, normalizeMovieDatabase,
  searchMovieLinks, sourceName
} from '../lib/movie-db.js';
import { X_DB_URL, normalizeXDatabase, searchXLinks, xHaystack } from '../lib/x-db.js';
import { validateMovieEntries } from '../lib/movie-check.js';
import { isEnvelope, MAX_ENVELOPE_JSON_CHARS, unseal } from '../../lib/schedule-crypto.js';

const KEY_STORE = 'gazll:schedule-key';
const ROW_LIMIT = 150;
const CATALOG_TYPES = Object.freeze({
  movie: {
    label: 'Movie',
    url: MOVIE_DB_URL,
    raw: false,
    description: 'Validated movie files',
    unlockNote: 'The movie database is sealed in the repository. Enter the passphrase to open it in this browser.',
    empty: 'Nothing matches these filters. Try an alias, a year, a link code — or show dead links.',
    placeholder: 'Try: Dune 2021, anime, 4K...'
  },
  x: {
    label: 'X',
    url: X_DB_URL,
    raw: true,
    description: 'Separate X index · root checks only',
    unlockNote: 'The X index is imported separately from x.csv. Root links have a status check; folder children are not crawled here.',
    empty: 'Nothing matches this X dataset. Try a name, folder, or link code.',
    placeholder: 'Try: a name, folder, or link code...'
  }
});
/* Static markup: the icon says folder or link before a name is read. */
const ICONS = {
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>'
};
const STATUS_TEXT = {
  pending: 'not checked',
  raw: 'raw input',
  checking: 'checking',
  live: 'live',
  partial: 'partial',
  dead: 'dead',
  unknown: 'unknown',
  empty: 'no files'
};

const movie = {
  catalogType: 'movie',
  database: null,
  databases: new Map(),
  indexes: new Map(),
  index: null,
  fileCount: 0,
  /* The last search's matches, before the status filter. A query that only
     narrows the previous one is searched within this set instead of the
     whole catalog — see narrowsSearch. */
  lastSearch: null,
  shown: [],
  selected: new Set(),
  statuses: new Map(),
  output: new Map(),
  /* True from the first re-check until the output is cleared: the Working
     files panel is only shown once there is a check to report on. */
  checked: false,
  activeRun: null,
  wired: false,
  unlocking: false,
  sourceMap: new Map(),
  byId: new Map()
};

const number = (value) => Number(value || 0).toLocaleString('en-US');
const fmtDay = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : '');

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function catalogConfig(type = movie.catalogType) {
  return CATALOG_TYPES[type] || CATALOG_TYPES.movie;
}

function setCurrentDatabase(type, database) {
  movie.catalogType = type;
  movie.database = database || null;
  movie.sourceMap = database ? new Map(database.sources.map((source) => [source.id, source])) : new Map();
  movie.byId = database ? indexById(database.links) : new Map();
  movie.index = database ? movie.indexes.get(type) || null : null;
  movie.fileCount = database ? database.links.reduce((total, row) => total + (row.kind === 'file' ? 1 : 0), 0) : 0;
  movie.lastSearch = null;
}

function clearWorkingState() {
  movie.lastSearch = null;
  movie.shown = [];
  movie.selected.clear();
  movie.statuses.clear();
  movie.output.clear();
  movie.checked = false;
}

function storedSecret() {
  try { return sessionStorage.getItem(KEY_STORE) || localStorage.getItem(KEY_STORE) || ''; } catch (error) { return ''; }
}

function paintTypeSwitch() {
  const config = catalogConfig();
  document.querySelectorAll('[data-movie-type]').forEach((button) => {
    const active = button.getAttribute('data-movie-type') === movie.catalogType;
    button.classList.toggle('on', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.disabled = movie.unlocking;
  });
  setText('movieUnlockType', config.label);
  setText('movieUnlockNote', config.unlockNote);
  setText('movieTypeDescription', config.description);
  setText('movieResultsTitle', config.raw ? 'X links' : 'Files, by folder');
  setText('movieStatusLabel', config.raw ? 'Raw links are not validated' : 'Show dead & unknown');
  setText('movieSearchLabel', config.raw ? 'Search X links by name or link code' : 'Search files by name, folder, alias, or link code');
  const panel = $('movieSearchPanel');
  if (panel) panel.setAttribute('aria-label', config.raw ? 'X link filters' : 'Movie catalog filters');
  const input = $('movieSearchInput');
  if (input) input.placeholder = config.placeholder;
  const statusFilter = $('movieStatusFilter');
  if (statusFilter) statusFilter.hidden = config.raw;
  const outputNote = $('movieOutputNote');
  if (outputNote) {
    outputNote.textContent = config.raw
      ? 'Selected X links can be re-checked here. This browser check is temporary and does not change the separate raw X catalog.'
      : 'Files confirmed live by a re-check in this browser. Folders are crawled, never listed. A re-check here does not update the catalog — run the tool to persist it.';
  }
}

function populateSourceSelect() {
  const select = $('movieSourceSelect');
  if (!select || !movie.database) return;
  select.replaceChildren(new Option('All sources', 'all'));
  movie.database.sources.forEach((source) => select.appendChild(new Option(source.name, source.id)));
}

/* ---------- unlock ---------- */

async function openSealed(secret, type = movie.catalogType) {
  const config = catalogConfig(type);
  const response = await fetch(config.url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`No sealed ${config.label} catalog is published yet — run \`node tools/fshare-${type}.mjs seal\` and deploy.`);
  const text = await response.text();
  if (text.length > MAX_ENVELOPE_JSON_CHARS) throw new Error('The sealed catalog is larger than this page will read.');
  let envelope;
  try { envelope = JSON.parse(text); } catch (error) { throw new Error('The sealed catalog is not valid JSON.'); }
  if (!isEnvelope(envelope)) throw new Error('The published file is not a sealed envelope.');
  const opened = await unseal(envelope, secret);
  const database = config.raw ? normalizeXDatabase(opened) : normalizeMovieDatabase(opened);
  // Folded once here, behind the unlock spinner, so no keystroke pays for it.
  const byId = indexById(database.links);
  movie.indexes.set(type, buildSearchIndex(database.links, config.raw ? xHaystack : (row) => movieHaystack(row, byId)));
  movie.databases.set(type, database);
  if (type === movie.catalogType) {
    setCurrentDatabase(type, database);
    populateSourceSelect();
  }
  return database;
}

function paintLockState() {
  paintTypeSwitch();
  const locked = !movie.database;
  $('movieUnlock').hidden = !locked;
  $('movieBody').hidden = locked;
  const meta = $('movieDbMeta');
  if (locked) { meta.textContent = 'Locked'; return; }
  const { counts, validated, sealedAt } = movie.database;
  meta.textContent = '';
  const config = catalogConfig();
  if (config.raw) {
    meta.append(`${number(counts.live)} live · ${number(counts.dead)} dead · ${number(counts.unknown)} unknown`
      + (counts.raw ? ` · ${number(counts.raw)} unchecked` : '') + ' · root checks only'
      + ` · sealed ${fmtDay(sealedAt) || '?'}`);
  } else {
    meta.append(`${number(counts.live)} live · ${number(counts.dead)} dead · ${number(counts.unknown)} unknown`
      + (counts.pending ? ` · ${number(counts.pending)} pending` : '') + ` · sealed ${fmtDay(sealedAt) || '?'}`);
  }
  const badge = document.createElement('span');
  badge.className = 'movie-validated ' + (validated ? 'ok' : 'no');
  badge.textContent = config.raw ? 'X ROOT CHECKS' : (validated ? 'VALIDATED' : 'NOT VALIDATED');
  badge.title = config.raw
    ? 'Imported from x.csv; only the root links were checked, with no folder traversal'
    : (validated ? 'Every catalog link has been checked' : 'Links are still pending in the catalog — the tool has not finished a full run');
  meta.appendChild(badge);
}

async function unlock(event) {
  if (event) event.preventDefault();
  const input = $('moviePassphrase');
  const secret = input.value;
  if (!secret || movie.unlocking) return;
  movie.unlocking = true;
  paintTypeSwitch();
  $('movieUnlockBtn').disabled = true;
  setText('movieUnlockErr', '');
  try {
    await openSealed(secret, movie.catalogType);
    /* Session by default, device only when asked — the same promise the
       calendar makes, and the same key, so one unlock serves both pages. */
    const store = $('movieRemember').checked ? localStorage : sessionStorage;
    try { store.setItem(KEY_STORE, secret); } catch (error) { /* private mode */ }
    input.value = '';
    paintLockState();
    renderResults();
    renderOutput();
  } catch (error) {
    setText('movieUnlockErr', error.message || String(error));
  } finally {
    movie.unlocking = false;
    $('movieUnlockBtn').disabled = false;
    paintTypeSwitch();
  }
}

function lock() {
  stopValidation();
  movie.databases.clear();
  movie.indexes.clear();
  setCurrentDatabase('movie', null);
  clearWorkingState();
  try { sessionStorage.removeItem(KEY_STORE); localStorage.removeItem(KEY_STORE); } catch (error) { /* private mode */ }
  paintLockState();
  renderControls();
}

async function restore() {
  if (movie.database) return;
  const stored = storedSecret();
  if (!stored) return;
  try {
    await openSealed(stored, movie.catalogType);
    paintLockState();
    renderResults();
    renderOutput();
  } catch (error) { /* stale key or no file yet: stay locked */ }
}

async function switchCatalogType(type) {
  if (!CATALOG_TYPES[type] || type === movie.catalogType || movie.unlocking) return;
  stopValidation();
  movie.catalogType = type;
  setCurrentDatabase(type, movie.databases.get(type) || null);
  clearWorkingState();
  $('movieSearchInput').value = '';
  $('movieSourceSelect').value = 'all';
  $('movieShowDead').checked = false;
  paintLockState();
  renderControls();
  renderOutput();
  if (movie.database) { renderResults(); return; }

  const secret = storedSecret();
  if (!secret) return;
  movie.unlocking = true;
  paintLockState();
  try {
    await openSealed(secret, type);
    paintLockState();
    renderResults();
    renderOutput();
  } catch (error) {
    setText('movieUnlockErr', error.message || String(error));
  } finally {
    movie.unlocking = false;
    paintLockState();
  }
}

/* ---------- catalog list ---------- */

function selectedVisibleCount() {
  return movie.shown.reduce((total, row) => total + (movie.selected.has(row.id) ? 1 : 0), 0);
}

function renderControls() {
  const visible = movie.shown.length;
  const selectedVisible = selectedVisibleCount();
  const selected = movie.selected.size;
  const select = $('movieSelectVisible');
  const clear = $('movieClearSelection');
  const copy = $('movieCopySelected');
  const validate = $('movieValidateBtn');
  select.disabled = !visible;
  select.textContent = visible && selectedVisible === visible ? 'Clear visible' : 'Select visible';
  clear.disabled = !selected;
  copy.disabled = !selected;
  validate.disabled = !selected || !!movie.activeRun;
  validate.textContent = movie.activeRun ? 'Checking...' : `Re-check Fshare now${selected ? ` (${selected})` : ''}`;
}

function currentStatus(row) {
  const record = movie.statuses.get(row.id);
  return record ? { status: record.status, error: record.error } : { status: row.status, error: row.error || '' };
}

function rowMeta(row) {
  const parts = catalogConfig().raw ? [row.kind, row.code] : [row.code];
  if (row.kind === 'file' && row.size) parts.push(fmtSize(row.size));
  if (row.parents && row.parents.length > 1) parts.push(`also in ${row.parents.length - 1} other folder${row.parents.length > 2 ? 's' : ''}`);
  if (row.sourceIds && row.sourceIds.length) parts.push(sourceName(movie.sourceMap, row.sourceIds[0]) + (row.sourceIds.length > 1 ? ` +${row.sourceIds.length - 1}` : ''));
  if (row.checkedAt) parts.push(`checked ${fmtDay(row.checkedAt)}`);
  if (row.status === 'dead' && row.deadSince) parts.push(`dead since ${fmtDay(row.deadSince)}`);
  return parts.join(' · ');
}

function childrenSummary(row) {
  const c = row.children;
  if (!c) return '';
  // Fshare answers an empty listing for a folder the owner has not made
  // public (its own web page shows the same nothing), so say so rather than
  // print no summary — a reader would otherwise assume the crawl skipped it.
  if (!c.files && !c.folders) return c.crawledAt ? 'nothing listed' : '';
  const bits = [];
  if (c.folders) bits.push(`${number(c.folders)} folder${c.folders > 1 ? 's' : ''}`);
  if (c.files) bits.push(`${number(c.files)} file${c.files > 1 ? 's' : ''}`);
  if (c.files && (c.dead || c.unknown)) bits.push(`${number(c.live)} live · ${number(c.dead)} dead${c.unknown ? ` · ${number(c.unknown)} unknown` : ''}`);
  return bits.join(' · ');
}

function makeRow(row) {
  const element = document.createElement('article');
  const state = currentStatus(row);
  element.className = 'movie-result-row' + (movie.selected.has(row.id) ? ' selected' : '') + (state.status === 'dead' ? ' is-dead' : '');
  element.dataset.itemId = row.id;

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.checked = movie.selected.has(row.id);
  check.setAttribute('aria-label', 'Select ' + row.name);
  check.addEventListener('change', () => {
    if (check.checked) movie.selected.add(row.id); else movie.selected.delete(row.id);
    element.classList.toggle('selected', check.checked);
    renderControls();
  });
  element.appendChild(check);

  const details = document.createElement('div');
  details.className = 'movie-result-details';
  const titleLine = document.createElement('div');
  titleLine.className = 'movie-result-title';
  const title = document.createElement('a');
  title.href = row.link;
  title.target = '_blank';
  title.rel = 'noopener noreferrer';
  title.textContent = row.name;
  title.title = [row.name, ...(row.aliases || [])].join('\n');
  titleLine.appendChild(title);
  const children = childrenSummary(row);
  if (children) {
    const summary = document.createElement('span');
    summary.className = 'movie-result-meta movie-result-children';
    summary.textContent = children;
    titleLine.appendChild(summary);
  }
  details.appendChild(titleLine);

  const meta = document.createElement('div');
  meta.className = 'movie-result-meta';
  meta.textContent = rowMeta(row);
  meta.title = meta.textContent;
  details.appendChild(meta);
  element.appendChild(details);

  const status = document.createElement('span');
  status.className = 'movie-status status-' + state.status;
  status.textContent = STATUS_TEXT[state.status] || state.status;
  status.title = state.error || status.textContent;
  element.appendChild(status);

  const open = document.createElement('a');
  open.className = 'movie-row-action';
  open.href = row.link;
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  open.textContent = 'Open';
  open.setAttribute('aria-label', 'Open ' + row.name);
  element.appendChild(open);

  const copy = document.createElement('button');
  copy.className = 'movie-row-action';
  copy.type = 'button';
  copy.textContent = 'Copy';
  copy.addEventListener('click', () => copyText(row.link)
    .then(() => toast('Link copied'))
    .catch(() => toast('Clipboard blocked', true)));
  element.appendChild(copy);
  return element;
}

/* A group is a folder: its breadcrumb is the heading, the files sit under
   it. The last crumb — the folder that actually holds the files — is the
   strong one; the ancestors are context. A file that came from the Sheet
   with no folder is listed under "Direct links". */
function groupIcon(kind) {
  const icon = document.createElement('span');
  icon.className = 'movie-group-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = ICONS[kind];
  return icon;
}

function makeGroupHead(group) {
  const head = document.createElement('div');
  head.className = 'movie-folder-head';
  head.appendChild(groupIcon(group.chain.length ? 'folder' : 'link'));
  const crumbs = document.createElement('span');
  crumbs.className = 'movie-crumbs';
  if (!group.chain.length) {
    const only = document.createElement('strong');
    only.className = 'movie-crumb is-leaf';
    only.textContent = 'Direct links';
    crumbs.appendChild(only);
  } else {
    group.chain.forEach((name, index) => {
      if (index) {
        const sep = document.createElement('i');
        sep.className = 'movie-crumb-sep';
        sep.textContent = '›';
        crumbs.appendChild(sep);
      }
      const last = index === group.chain.length - 1;
      const crumb = document.createElement(last ? 'strong' : 'span');
      crumb.className = 'movie-crumb' + (last ? ' is-leaf' : '');
      // Sheet titles carry list bullets ("- - Bluray…"); they are not part of the name.
      crumb.textContent = name.replace(/^[\s\-–—·•*]+/, '');
      crumb.title = name;
      crumbs.appendChild(crumb);
    });
  }
  head.appendChild(crumbs);
  const meta = document.createElement('span');
  meta.className = 'movie-folder-meta';
  const bits = [`${group.links.length} file${group.links.length === 1 ? '' : 's'}`];
  if (group.folder) {
    const c = group.folder.children;
    if (c && c.files && c.files !== group.links.length) bits.push(`of ${number(c.files)} in folder`);
    if (group.folder.status === 'dead') bits.push('folder dead');
  }
  meta.textContent = bits.join(' · ');
  head.appendChild(meta);
  if (group.folder) {
    const open = document.createElement('a');
    open.className = 'movie-row-action';
    open.href = group.folder.link;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = 'Open folder';
    head.appendChild(open);
  }
  return head;
}

function makeRawHead(count) {
  const head = document.createElement('div');
  head.className = 'movie-folder-head movie-raw-head';
  head.appendChild(groupIcon('link'));
  const title = document.createElement('strong');
  title.className = 'movie-crumb is-leaf';
  title.textContent = 'X links';
  head.appendChild(title);
  const meta = document.createElement('span');
  meta.className = 'movie-folder-meta';
  meta.textContent = `${number(count)} raw link${count === 1 ? '' : 's'}`;
  head.appendChild(meta);
  return head;
}

function renderResults() {
  const list = $('movieResults');
  if (!list || !movie.database) return;
  const config = catalogConfig();
  const query = $('movieSearchInput').value || '';
  const sourceId = $('movieSourceSelect').value || 'all';
  const showDead = $('movieShowDead').checked;
  // "dun" → "dune" can only lose rows, so it is searched within the previous
  // matches; the status filter is re-applied afterwards because a re-check
  // in this browser may have changed a row since that set was built.
  const searchKey = `${movie.catalogType}|${sourceId}`;
  const previous = movie.lastSearch;
  const pool = previous && previous.key === searchKey && narrowsSearch(previous.query, query)
    ? previous.rows
    : movie.database.links;
  // Movie is a file-only projection grouped by its holding folder. X is an
  // independent raw index, so folders and files remain searchable as links.
  const found = config.raw
    ? searchXLinks(pool, query, { sourceId, index: movie.index })
    : searchMovieLinks(pool, query, { kind: 'file', sourceId, byId: movie.byId, index: movie.index });
  movie.lastSearch = { key: searchKey, query, rows: found };
  const matches = config.raw ? found : found.filter((row) => showDead || currentStatus(row).status === 'live');
  const groups = config.raw ? [] : groupByFolder(matches, movie.byId, movie.index);

  movie.shown = [];
  list.innerHTML = '';
  list.classList.remove('is-searching');
  list.removeAttribute('aria-busy');
  if (!matches.length) {
    const empty = movie.database.links.length ? config.empty : 'This sealed catalog holds no links yet.';
    list.innerHTML = `<div class="movie-empty">${empty}</div>`;
    setText('movieResultCount', config.raw
      ? `0 of ${number(movie.database.links.length)} raw links`
      : `0 of ${number(movie.fileCount)} files`);
    renderControls();
    return;
  }
  const fragment = document.createDocumentFragment();
  let rows = 0;
  // Each group is its own card, so the head sticks only while its own rows
  // are in view and the gap between cards is what separates two folders.
  const makeGroup = (head, links, direct) => {
    const section = document.createElement('section');
    section.className = 'movie-group' + (direct ? ' is-direct' : '');
    section.appendChild(head);
    for (const row of links) {
      if (rows >= ROW_LIMIT) break;
      section.appendChild(makeRow(row));
      movie.shown.push(row);
      rows++;
    }
    return section;
  };
  if (config.raw) {
    fragment.appendChild(makeGroup(makeRawHead(matches.length), matches, true));
  } else {
    for (const group of groups) {
      if (rows >= ROW_LIMIT) break;
      fragment.appendChild(makeGroup(makeGroupHead(group), group.links, !group.chain.length));
    }
  }
  list.appendChild(fragment);
  const suffix = matches.length > ROW_LIMIT ? ` · showing first ${number(ROW_LIMIT)}` : '';
  if (config.raw) {
    setText('movieResultCount', `${number(matches.length)} raw X link${matches.length === 1 ? '' : 's'}${suffix} · ${number(movie.selected.size)} selected`);
  } else {
    setText('movieResultCount', `${number(matches.length)} file${matches.length === 1 ? '' : 's'} in ${number(groups.length)} folder${groups.length === 1 ? '' : 's'}${suffix} · ${number(movie.selected.size)} selected`);
  }
  renderControls();
}

function paintStatus(itemId, status, error) {
  const row = [...($('movieResults')?.querySelectorAll('[data-item-id]') || [])]
    .find((element) => element.dataset.itemId === itemId);
  if (!row) return;
  const element = row.querySelector('.movie-status');
  if (!element) return;
  element.className = 'movie-status status-' + status;
  element.textContent = STATUS_TEXT[status] || status;
  element.title = error || element.textContent;
  row.classList.toggle('is-dead', status === 'dead');
}

/* ---------- output ---------- */

function outputRecord(file) {
  return {
    id: file.id,
    name: file.name,
    linkcode: file.linkcode,
    link: file.link,
    size: file.size || 0,
    parentTitle: file.parentTitle || file.parentTitles?.[0] || '',
    parentTitles: file.parentTitles || [],
    parentPath: file.parentPath || file.parentPaths?.[0] || ''
  };
}

const outputRows = () => [...movie.output.values()].map(outputRecord);

function renderOutput() {
  const list = $('movieOutputList');
  if (!list) return;
  $('movieOutputPanel').hidden = !movie.checked;
  $('movieOutputPanel').parentElement.classList.toggle('is-solo', !movie.checked);
  const rows = outputRows();
  const hasUnknown = [...movie.statuses.values()].some((record) => record.status === 'unknown');
  if (!rows.length) {
    list.innerHTML = '<div class="movie-output-empty">Working file results will appear here after a re-check.</div>';
    setText('movieOutputCount', hasUnknown ? 'No confirmed files · unknown checks were excluded' : 'No confirmed files yet');
  } else {
    setText('movieOutputCount', `${number(rows.length)} confirmed file${rows.length === 1 ? '' : 's'} · live checks only`);
    list.innerHTML = '';
    const fragment = document.createDocumentFragment();
    rows.forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'movie-output-row';
      const indexEl = document.createElement('span');
      indexEl.className = 'movie-output-index';
      indexEl.textContent = String(index + 1).padStart(2, '0');
      row.appendChild(indexEl);
      const details = document.createElement('div');
      details.className = 'movie-output-details';
      const link = document.createElement('a');
      link.href = file.link;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = file.name;
      link.title = file.name;
      details.appendChild(link);
      const parent = document.createElement('span');
      parent.className = 'movie-output-parent';
      parent.textContent = file.parentTitle ? 'parent: ' + file.parentTitle : 'direct file';
      parent.title = file.parentPath || parent.textContent;
      details.appendChild(parent);
      row.appendChild(details);
      const size = document.createElement('span');
      size.className = 'movie-output-size';
      size.textContent = fmtSize(file.size);
      row.appendChild(size);
      fragment.appendChild(row);
    });
    list.appendChild(fragment);
  }
  ['movieCopyOutput', 'movieDownloadOutput'].forEach((id) => { $(id).disabled = !rows.length; });
  // A run that confirmed nothing still needs Clear, or the panel cannot be dismissed.
  $('movieClearOutput').disabled = !movie.checked || !!movie.activeRun;
}

/* ---------- re-check ---------- */

function paintProgress(index, total, checked, live, label) {
  const value = total ? Math.round(index / total * 100) : 0;
  $('movieProgressFill').style.transform = 'scaleX(' + Math.min(100, value) / 100 + ')';
  setText('movieProgressText', label || `Checking ${index + 1} of ${total}...`);
  setText('movieProgressDetail', `${index}/${total} links completed · ${number(checked)} files probed · ${number(live)} working`);
}

function startValidation() {
  if (!movie.database || movie.activeRun || !movie.selected.size) return;
  // The shared crawler reads `linkcode`; the catalog row calls it `code`.
  const entries = movie.database.links
    .filter((row) => movie.selected.has(row.id))
    .map((row) => ({ ...row, linkcode: row.code }));
  if (!entries.length) return;

  movie.output.clear();
  movie.checked = true;
  renderOutput();
  const run = { abort: false };
  movie.activeRun = run;
  $('movieProgress').hidden = false;
  $('movieCancelBtn').disabled = false;
  let checkedFiles = 0;
  let liveFiles = 0;
  paintProgress(0, entries.length, checkedFiles, liveFiles, 'Preparing checks...');
  renderControls();

  validateMovieEntries(entries, {
    shouldStop: () => run.abort,
    onEntry: (report, index, total) => {
      movie.statuses.set(report.entry.id, report);
      paintStatus(report.entry.id, report.status, report.error);
      const label = report.status === 'checking'
        ? `Checking ${report.entry.name}`
        : `${report.entry.name} · ${STATUS_TEXT[report.status]}`;
      paintProgress(report.status === 'checking' ? index : index + 1, total, checkedFiles, liveFiles, label);
    },
    onFile: (result) => {
      checkedFiles++;
      if (result.status === 'live') liveFiles++;
      paintProgress(entries.findIndex((entry) => entry.id === result.entry.id), entries.length, checkedFiles, liveFiles, `Checking ${result.file.name}`);
    }
  }).then((result) => {
    result.files.forEach((file) => movie.output.set(file.id, file));
    if (result.cancelled) toast('Re-check stopped — confirmed results kept');
    else toast(`Re-checked ${entries.length} link${entries.length === 1 ? '' : 's'} (not saved to the catalog)`);
  }).catch((error) => {
    toast('Re-check failed: ' + (error.message || 'unknown error'), true);
  }).finally(() => {
    if (movie.activeRun !== run) return;
    movie.activeRun = null;
    $('movieProgress').hidden = true;
    renderResults();
    renderOutput();
  });
}

function stopValidation() {
  if (movie.activeRun) movie.activeRun.abort = true;
}

/* ---------- wiring ---------- */

function selectVisible() {
  const allSelected = movie.shown.length > 0 && selectedVisibleCount() === movie.shown.length;
  movie.shown.forEach((row) => { if (allSelected) movie.selected.delete(row.id); else movie.selected.add(row.id); });
  renderResults();
}

function copySelected() {
  const links = movie.database.links.filter((row) => movie.selected.has(row.id)).map((row) => row.link);
  copyText(links.join('\n'))
    .then(() => toast(`Copied ${links.length} link${links.length === 1 ? '' : 's'}`))
    .catch(() => toast('Clipboard blocked', true));
}

function wireMovieEvents() {
  if (movie.wired) return;
  movie.wired = true;
  const rerender = debounce(renderResults, 120);
  /* The debounce is the only wait left now that a search is milliseconds,
     but during it the list still shows the previous query's rows. Mark it
     stale on the first keystroke so it reads as "updating", not "wrong". */
  const searchTyped = () => {
    const list = $('movieResults');
    if (list && movie.database) {
      list.classList.add('is-searching');
      list.setAttribute('aria-busy', 'true');
    }
    rerender();
  };
  document.querySelectorAll('[data-movie-type]').forEach((button) => {
    button.addEventListener('click', () => { void switchCatalogType(button.getAttribute('data-movie-type')); });
  });
  $('movieUnlock').addEventListener('submit', unlock);
  $('movieLockBtn').addEventListener('click', lock);
  $('movieSearchInput').addEventListener('input', searchTyped);
  ['movieSourceSelect', 'movieShowDead'].forEach((id) => $(id).addEventListener('change', renderResults));
  $('movieClearSearch').addEventListener('click', () => {
    $('movieSearchInput').value = '';
    $('movieSourceSelect').value = 'all';
    $('movieShowDead').checked = false;
    renderResults();
  });
  $('movieSelectVisible').addEventListener('click', selectVisible);
  $('movieClearSelection').addEventListener('click', () => { movie.selected.clear(); renderResults(); });
  $('movieCopySelected').addEventListener('click', copySelected);
  $('movieValidateBtn').addEventListener('click', startValidation);
  $('movieCancelBtn').addEventListener('click', stopValidation);
  $('movieClearOutput').addEventListener('click', () => { movie.output.clear(); movie.checked = false; renderOutput(); });
  $('movieCopyOutput').addEventListener('click', () => {
    const rows = outputRows();
    copyText(rows.map((row) => row.link).join('\n'))
      .then(() => toast('Copied ' + rows.length + ' working links'))
      .catch(() => toast('Clipboard blocked', true));
  });
  $('movieDownloadOutput').addEventListener('click', () => {
    downloadTxt(JSON.stringify(outputRows(), null, 2), `fshare-${movie.catalogType}-working-files.json`);
  });
}

export function initMovieView() {
  wireMovieEvents();
  paintLockState();
  renderControls();
  renderOutput();
  if (!movie.database) void restore();
}

export function stopMovieValidation() {
  stopValidation();
}
