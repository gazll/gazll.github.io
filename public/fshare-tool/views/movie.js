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
  MOVIE_DB_URL, folderChain, groupByFolder, indexById, normalizeMovieDatabase, searchMovieLinks, sourceName
} from '../lib/movie-db.js';
import { validateMovieEntries } from '../lib/movie-check.js';
import { isEnvelope, MAX_ENVELOPE_JSON_CHARS, unseal } from '../../lib/schedule-crypto.js';

const KEY_STORE = 'gazll:schedule-key';
const ROW_LIMIT = 150;
const STATUS_TEXT = {
  pending: 'not checked',
  checking: 'checking',
  live: 'live',
  partial: 'partial',
  dead: 'dead',
  unknown: 'unknown',
  empty: 'no files'
};

const movie = {
  database: null,
  shown: [],
  selected: new Set(),
  statuses: new Map(),
  output: new Map(),
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

/* ---------- unlock ---------- */

async function openSealed(secret) {
  const response = await fetch(MOVIE_DB_URL, { cache: 'no-cache' });
  if (!response.ok) throw new Error('No sealed catalog is published yet — run `node tools/fshare-movie.mjs seal` and deploy.');
  const text = await response.text();
  if (text.length > MAX_ENVELOPE_JSON_CHARS) throw new Error('The sealed catalog is larger than this page will read.');
  let envelope;
  try { envelope = JSON.parse(text); } catch (error) { throw new Error('The sealed catalog is not valid JSON.'); }
  if (!isEnvelope(envelope)) throw new Error('The published file is not a sealed envelope.');
  movie.database = normalizeMovieDatabase(await unseal(envelope, secret));
  movie.sourceMap = new Map(movie.database.sources.map((source) => [source.id, source]));
  // The envelope ships no path strings; a file's place is walked through its parents.
  movie.byId = indexById(movie.database.links);
  const select = $('movieSourceSelect');
  select.replaceChildren(new Option('All sources', 'all'));
  movie.database.sources.forEach((source) => select.appendChild(new Option(source.name, source.id)));
}

function paintLockState() {
  const locked = !movie.database;
  $('movieUnlock').hidden = !locked;
  $('movieBody').hidden = locked;
  const meta = $('movieDbMeta');
  if (locked) { meta.textContent = 'Locked'; return; }
  const { counts, validated, sealedAt } = movie.database;
  meta.textContent = '';
  meta.append(`${number(counts.live)} live · ${number(counts.dead)} dead · ${number(counts.unknown)} unknown`
    + (counts.pending ? ` · ${number(counts.pending)} pending` : '') + ` · sealed ${fmtDay(sealedAt) || '?'}`);
  const badge = document.createElement('span');
  badge.className = 'movie-validated ' + (validated ? 'ok' : 'no');
  badge.textContent = validated ? 'VALIDATED' : 'NOT VALIDATED';
  badge.title = validated ? 'Every catalog link has been checked' : 'Links are still pending in the catalog — the tool has not finished a full run';
  meta.appendChild(badge);
}

async function unlock(event) {
  if (event) event.preventDefault();
  const input = $('moviePassphrase');
  const secret = input.value;
  if (!secret || movie.unlocking) return;
  movie.unlocking = true;
  $('movieUnlockBtn').disabled = true;
  setText('movieUnlockErr', '');
  try {
    await openSealed(secret);
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
  }
}

function lock() {
  stopValidation();
  movie.database = null;
  movie.shown = [];
  movie.selected.clear();
  movie.statuses.clear();
  movie.output.clear();
  try { sessionStorage.removeItem(KEY_STORE); localStorage.removeItem(KEY_STORE); } catch (error) { /* private mode */ }
  paintLockState();
  renderControls();
}

async function restore() {
  if (movie.database) return;
  let stored = '';
  try { stored = sessionStorage.getItem(KEY_STORE) || localStorage.getItem(KEY_STORE) || ''; } catch (error) { return; }
  if (!stored) return;
  try {
    await openSealed(stored);
    paintLockState();
    renderResults();
    renderOutput();
  } catch (error) { /* stale key or no file yet: stay locked */ }
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
  validate.textContent = movie.activeRun ? 'Checking...' : `Re-check selected${selected ? ` (${selected})` : ''}`;
}

function currentStatus(row) {
  const record = movie.statuses.get(row.id);
  return record ? { status: record.status, error: record.error } : { status: row.status, error: row.error || '' };
}

function rowMeta(row) {
  const parts = [row.code];
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
function makeGroupHead(group) {
  const head = document.createElement('div');
  head.className = 'movie-group-head movie-folder-head';
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

function renderResults() {
  const list = $('movieResults');
  if (!list || !movie.database) return;
  const query = $('movieSearchInput').value || '';
  const sourceId = $('movieSourceSelect').value || 'all';
  const showDead = $('movieShowDead').checked;
  // Files only: a folder is where a file lives, not a result of its own.
  // Its name still matches, through the file's folder chain.
  const matches = searchMovieLinks(movie.database.links, query, { kind: 'file', sourceId, byId: movie.byId })
    .filter((row) => showDead || currentStatus(row).status === 'live');
  const groups = groupByFolder(matches, movie.byId);

  movie.shown = [];
  list.innerHTML = '';
  if (!groups.length) {
    const empty = movie.database.links.length
      ? 'Nothing matches these filters. Try an alias, a year, a link code — or show dead links.'
      : 'The sealed catalog holds no checked links yet. Run the validator, then seal and deploy.';
    list.innerHTML = `<div class="movie-empty">${empty}</div>`;
    setText('movieResultCount', `0 of ${number(movie.database.links.filter((row) => row.kind === 'file').length)} files`);
    renderControls();
    return;
  }
  const fragment = document.createDocumentFragment();
  let rows = 0;
  for (const group of groups) {
    if (rows >= ROW_LIMIT) break;
    fragment.appendChild(makeGroupHead(group));
    for (const row of group.links) {
      if (rows >= ROW_LIMIT) break;
      fragment.appendChild(makeRow(row));
      movie.shown.push(row);
      rows++;
    }
  }
  list.appendChild(fragment);
  const suffix = matches.length > ROW_LIMIT ? ` · showing first ${number(ROW_LIMIT)}` : '';
  setText('movieResultCount', `${number(matches.length)} file${matches.length === 1 ? '' : 's'} in ${number(groups.length)} folder${groups.length === 1 ? '' : 's'}${suffix} · ${number(movie.selected.size)} selected`);
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
  ['movieCopyOutput', 'movieDownloadOutput', 'movieClearOutput'].forEach((id) => { $(id).disabled = !rows.length; });
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
  $('movieUnlock').addEventListener('submit', unlock);
  $('movieLockBtn').addEventListener('click', lock);
  $('movieSearchInput').addEventListener('input', rerender);
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
  $('movieClearOutput').addEventListener('click', () => { movie.output.clear(); renderOutput(); });
  $('movieCopyOutput').addEventListener('click', () => {
    const rows = outputRows();
    copyText(rows.map((row) => row.link).join('\n'))
      .then(() => toast('Copied ' + rows.length + ' working links'))
      .catch(() => toast('Clipboard blocked', true));
  });
  $('movieDownloadOutput').addEventListener('click', () => {
    downloadTxt(JSON.stringify(outputRows(), null, 2), 'fshare-movie-working-files.json');
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
