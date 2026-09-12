#!/usr/bin/env node
/* The Fshare movie catalog, end to end.

     node tools/fshare-movie.mjs ingest <sheet-url|file|fshare-link…>  # → secret/fshare-movie/raw/
     node tools/fshare-movie.mjs build        # raw exports → secret/fshare-movie/catalog.json
     node tools/fshare-movie.mjs status       # what is pending / live / dead / unknown
     node tools/fshare-movie.mjs validate     # check links against Fshare, in place, resumable
     node tools/fshare-movie.mjs seal         # checked links → public/data/fshare-movie/catalog.enc.json
     node tools/fshare-movie.mjs unseal       # the envelope → secret/ (recovery)
     node tools/fshare-movie.mjs --check      # the envelope opens and matches the catalog

   Three files, one direction. Raw exports are whatever the community shared —
   a Sheet tab as CSV, a pasted list — and are never edited. The catalog is the
   working database: every link ever seen, one row per link, with the result of
   its last check; `build` only ever adds to it and `validate` only ever
   updates rows in place, so a link that died keeps its history. The envelope
   is the projection the site ships: checked rows only, gzipped and sealed,
   because this repository is public and everything under public/data/ answers
   a plain GET. Raw and catalog live under secret/ and never enter git.

   NOT part of tools/check.mjs, for the same reason schedule-seal is not: CI
   has neither the passphrase nor secret/. */

import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isEnvelope, seal, unseal } from '../public/lib/schedule-crypto.js';
import {
  CATALOG_VERSION, STATUSES, extractFshareLinks, keywordTokens, linkId, linkUrl, queryTokens, titleKey
} from '../public/fshare-tool/lib/movie-db.js';
import { crawlMovieFolder, remoteMetadata } from '../public/fshare-tool/lib/movie-check.js';
import { passphrase } from './passphrase.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SECRET_DIR = path.join(ROOT, 'secret', 'fshare-movie');
export const RAW_DIR = path.join(SECRET_DIR, 'raw');
export const SOURCES_FILE = path.join(SECRET_DIR, 'sources.json');
export const CATALOG_FILE = path.join(SECRET_DIR, 'catalog.json');
export const SEALED_FILE = path.join(ROOT, 'public', 'data', 'fshare-movie', 'catalog.enc.json');

export const FSHARE_API = 'https://fshare.annnekkk.com/api/folder';
const FSHARE_WEB = 'https://www.fshare.vn';
const PAGE_SIZE = 50;
const RETRIES = 3;
const SORT = 'type,name';
const CHECKPOINT_EVERY = 25;
const REQUEST_TIMEOUT_MS = 20000;
const LISTING_PAGE_CONCURRENCY = 4;
const FOLDER_CONCURRENCY = 8;
const RAW_EXTENSIONS = new Set(['.csv', '.txt', '.md', '.json']);

const out = (line) => process.stdout.write(`${line}\n`);
const die = (line) => { process.stderr.write(`${line}\n`); process.exit(1); };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
  });
  try { return await Promise.race([promise, timeout]); }
  finally { clearTimeout(timer); }
}
const unique = (values) => [...new Set(values.filter(Boolean))];
const rel = (file) => path.relative(ROOT, file).replaceAll(path.sep, '/');

/* ---------- raw parsing ---------- */

const cleanText = (value) => String(value ?? '').replace(/\uFEFF/g, '').replace(/\s+/g, ' ').trim();

/** RFC 4180-ish CSV, including quoted commas and quoted newlines. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = [];
  let quoted = false;
  const endRow = () => {
    row.push(cell.join('').replace(/\r$/, ''));
    if (row.some((part) => cleanText(part))) rows.push(row);
    row = [];
    cell = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell.push('"'); i++; }
      else if (ch === '"') quoted = false;
      else cell.push(ch);
    } else if (ch === '"' && cell.length === 0) quoted = true;
    else if (ch === ',') { row.push(cell.join('')); cell = []; }
    else if (ch === '\n') endRow();
    else cell.push(ch);
  }
  if (cell.length || row.length) endRow();
  return rows;
}

function usableTitle(value) {
  const title = cleanText(value);
  if (!title || extractFshareLinks(title).length || /^https?:\/\//i.test(title)) return '';
  return title;
}

/* A sheet row names the film in one cell and links it in another; the nearest
   non-link cell is the title. A text line is the link plus whatever is left. */
function recordsFromRows(rows) {
  const records = [];
  rows.forEach((row) => {
    const cells = row.map(cleanText);
    const titles = cells.map((value, index) => ({ value: usableTitle(value), index })).filter((c) => c.value);
    cells.forEach((cell, cellIndex) => {
      extractFshareLinks(cell).forEach((link) => {
        const nearest = titles.slice().sort((a, b) => Math.abs(a.index - cellIndex) - Math.abs(b.index - cellIndex))[0];
        records.push({ ...link, name: nearest?.value || link.code });
      });
    });
  });
  return records;
}

function recordsFromText(text) {
  const records = [];
  String(text).split(/\r?\n/).forEach((line) => {
    const links = extractFshareLinks(line);
    if (!links.length) return;
    const remainder = line
      .replace(/(?:https?:\/\/)?(?:www\.)?fshare\.vn\/(?:file|folder)\/[A-Za-z0-9]+/gi, '')
      .replace(/[\s,;|:[\](){}]+/g, ' ')
      .replace(/^[-\s]+|[-\s]+$/g, '');
    const name = usableTitle(remainder);
    links.forEach((link) => records.push({ ...link, name: name || link.code }));
  });
  return records;
}

function recordsFromJson(value, records = []) {
  if (Array.isArray(value)) { value.forEach((child) => recordsFromJson(child, records)); return records; }
  if (!value || typeof value !== 'object') return records;
  const title = usableTitle(value.name || value.title || value.filename || value.label);
  const links = extractFshareLinks(value.link || value.url || value.href);
  if (links.length) links.forEach((link) => records.push({ ...link, name: title || link.code }));
  else Object.values(value).forEach((child) => recordsFromJson(child, records));
  return records;
}

export function parseRawSource(file, text) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.csv') return recordsFromRows(parseCsv(text));
  if (ext === '.json') {
    try { return recordsFromJson(JSON.parse(text)); } catch { return recordsFromText(text); }
  }
  return recordsFromText(text);
}

async function rawFiles(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await rawFiles(file));
    else if (RAW_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(file);
  }
  return files;
}

/* ---------- the catalog ---------- */

export const sourceId = (relativeFile) => `src-${createHash('sha1').update(relativeFile).digest('hex').slice(0, 10)}`;

export function emptyCatalog(now = new Date().toISOString()) {
  return {
    version: CATALOG_VERSION,
    kind: 'fshare-movie-catalog',
    createdAt: now,
    updatedAt: now,
    validation: { ok: false, total: 0, pending: 0, live: 0, dead: 0, unknown: 0, lastRunAt: null },
    sources: [],
    links: []
  };
}

function newLink(link, origin, now) {
  const row = {
    id: link.id,
    kind: link.kind,
    code: link.code,
    link: link.link || linkUrl(link.kind, link.code),
    name: link.name || link.code,
    aliases: [],
    keywords: keywordTokens(link.name || link.code),
    titleKey: titleKey(link.name || link.code),
    origin,
    sourceIds: [],
    parents: [],
    path: '',
    size: 0,
    firstSeenAt: now,
    status: 'pending',
    checkedAt: null,
    lastLiveAt: null,
    deadSince: null,
    via: '',
    error: '',
    ...(link.kind === 'folder' ? { children: null } : {})
  };
  if (link.remote && Object.keys(link.remote).length) row.remote = remoteMetadata(link.remote);
  return row;
}

function addName(row, name) {
  const clean = cleanText(name);
  if (!clean || clean === row.name || row.aliases.includes(clean)) return;
  // A raw title beats a bare code that a link-only line left behind.
  if (row.name === row.code) {
    row.name = clean;
    row.titleKey = titleKey(clean);
    row.keywords = [...new Set([...(row.keywords || []), ...keywordTokens(clean)])];
    return;
  }
  row.aliases.push(clean);
  row.keywords = [...new Set([...(row.keywords || []), ...keywordTokens(clean)])];
}

function refreshKeywords(row) {
  row.keywords = [...new Set([
    ...(row.keywords || []),
    ...keywordTokens([row.name, ...(row.aliases || []), row.code, row.path || ''])
  ])];
}

/** Every folder's child counts, from the rows that name it as a parent. */
export function recountChildren(catalog) {
  const counts = new Map();
  catalog.links.forEach((row) => {
    row.parents.forEach((parentId) => {
      let bucket = counts.get(parentId);
      if (!bucket) { bucket = { folders: 0, files: 0, live: 0, dead: 0, unknown: 0, pending: 0 }; counts.set(parentId, bucket); }
      bucket[row.kind === 'folder' ? 'folders' : 'files']++;
      if (row.kind === 'file') bucket[row.status]++;
    });
  });
  catalog.links.forEach((row) => {
    if (row.kind !== 'folder') return;
    const bucket = counts.get(row.id);
    if (!bucket && !row.children) return;
    row.children = { ...(row.children || {}), ...(bucket || { folders: 0, files: 0, live: 0, dead: 0, unknown: 0, pending: 0 }) };
  });
  return catalog;
}

export function summarize(catalog, lastRunAt = catalog.validation?.lastRunAt || null) {
  const validation = { ok: false, total: catalog.links.length, pending: 0, live: 0, dead: 0, unknown: 0, lastRunAt };
  catalog.links.forEach((row) => { validation[row.status]++; });
  // The database is "OK" only when nothing is left unanswered — a pending
  // row is a link nobody has looked at, and that is the one state the site
  // must never present as a result.
  validation.ok = validation.total > 0 && validation.pending === 0;
  catalog.validation = validation;
  return validation;
}

function sortLinks(catalog) {
  const byKind = { folder: 0, file: 1 };
  catalog.links.sort((a, b) =>
    a.titleKey.localeCompare(b.titleKey, 'vi') || (byKind[a.kind] - byKind[b.kind]) || a.code.localeCompare(b.code));
}

/**
 * Raw sources into the catalog. Pure over its inputs so the merge rules are
 * testable: `sources` is [{ file, text, updatedAt }], `previous` the catalog
 * on disk (or null). Rows are only ever added or enriched, never removed —
 * a raw file that disappears does not un-know a link.
 */
export function buildCatalog(sources, manifest = {}, previous = null, now = new Date().toISOString()) {
  const catalog = previous ? structuredClone(previous) : emptyCatalog(now);
  const rows = new Map(catalog.links.map((row) => [row.id, row]));
  const sourceRows = new Map(catalog.sources.map((source) => [source.id, source]));

  sources.forEach((source) => {
    const id = sourceId(source.file);
    const configured = manifest.sources?.[source.file];
    const originUrl = (typeof configured === 'string' ? configured : configured?.originUrl)
      || manifest.defaultOriginUrl || sourceRows.get(id)?.originUrl || '';
    const records = parseRawSource(source.file, source.text);
    const linkIds = new Set();
    records.forEach((record) => {
      let row = rows.get(record.id);
      if (!row) { row = newLink(record, 'raw', now); rows.set(row.id, row); catalog.links.push(row); }
      if (record.name && record.name !== record.code) addName(row, record.name);
      if (!row.sourceIds.includes(id)) row.sourceIds.push(id);
      linkIds.add(row.id);
    });
    const prior = sourceRows.get(id);
    sourceRows.set(id, {
      id,
      name: path.basename(source.file, path.extname(source.file)),
      file: source.file,
      originUrl,
      importedAt: prior?.importedAt || now,
      updatedAt: source.updatedAt || now,
      records: records.length,
      links: linkIds.size
    });
  });

  catalog.sources = [...sourceRows.values()].sort((a, b) => a.file.localeCompare(b.file, 'vi'));
  catalog.links.forEach(refreshKeywords);
  sortLinks(catalog);
  recountChildren(catalog);
  summarize(catalog);
  catalog.updatedAt = now;
  return catalog;
}

/** What ships: checked rows only, trimmed to what the tab renders. Nothing
    derivable rides along — id, titleKey and keywords are rebuilt on load,
    and a file's place is its `parents` (names resolve in the same file), not
    the full path string, which alone was 9MB across 60k rows. */
export function projectCatalog(catalog, sealedAt = new Date().toISOString()) {
  const validation = summarize(structuredClone(catalog));
  const links = catalog.links
    .filter((row) => row.status !== 'pending')
    .map((row) => ({
      kind: row.kind,
      code: row.code,
      name: row.name,
      ...(row.aliases.length ? { aliases: row.aliases } : {}),
      status: row.status,
      checkedAt: row.checkedAt,
      ...(row.status !== 'live' && row.lastLiveAt ? { lastLiveAt: row.lastLiveAt } : {}),
      ...(row.deadSince ? { deadSince: row.deadSince } : {}),
      ...(row.size ? { size: row.size } : {}),
      ...(row.parents.length ? { parents: row.parents } : {}),
      ...(row.sourceIds.length ? { sourceIds: row.sourceIds } : {}),
      ...(row.children ? { children: row.children } : {})
    }));
  return {
    version: CATALOG_VERSION,
    kind: 'fshare-movie-db',
    sealedAt,
    validated: validation.ok,
    counts: { total: validation.total, pending: validation.pending, live: validation.live, dead: validation.dead, unknown: validation.unknown },
    sources: catalog.sources.map((source) => ({ id: source.id, name: source.name })),
    links
  };
}

/* ---------- Fshare transport (Node) ---------- */

function validatePayload(data) {
  if (!data || typeof data !== 'object') throw new Error('Fshare returned an invalid response');
  const code = Number(data.code);
  if (Number.isFinite(code) && code >= 400) {
    throw new Error(`${data.msg || data.message || 'Fshare rejected the link'} (HTTP ${code})`);
  }
  if (data.error && !Array.isArray(data.items)) throw new Error(String(data.error));
  if (!Array.isArray(data.items) && !data.current && !data.item) throw new Error('Fshare returned no link metadata');
  return data;
}

export async function requestPage(code, page = 1, fetcher = fetch) {
  const url = `${FSHARE_API}?linkcode=${encodeURIComponent(code)}&sort=${encodeURIComponent(SORT)}&page=${page}`;
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        : undefined;
      const response = await withTimeout(
        fetcher(url, { cache: 'no-store', ...(signal ? { signal } : {}) }),
        `Fshare request ${code} page ${page}`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return validatePayload(await withTimeout(response.json(), `Fshare response ${code} page ${page}`));
    } catch (error) {
      lastError = error;
      if (/HTTP 4\d\d/.test(String(error.message)) || attempt === RETRIES) throw error;
      await wait(400 * attempt);
    }
  }
  throw lastError;
}

function lastPage(data, count) {
  const match = String(data?._links?.last || '').match(/[?&]page=(\d+)/);
  if (match) return parseInt(match[1], 10);
  return count < PAGE_SIZE ? 1 : 2;
}

/**
 * The fetchPages adapter the shared crawler expects, with one listing cache
 * for the whole run: raw sheets link a root folder AND its sub-folders as
 * separate rows, so without this every subtree is listed once per ancestor.
 */
export function createListingFetcher(fetcher = fetch, cache = new Map()) {
  return function fetchPages(code, sort, shouldStop) {
    if (!cache.has(code)) {
      cache.set(code, (async () => {
        const first = await requestPage(code, 1, fetcher);
        let items = (first.items || []).slice();
        const pages = lastPage(first, items.length);
        for (let start = 2; start <= pages; start += LISTING_PAGE_CONCURRENCY) {
          if (shouldStop && shouldStop()) throw new Error('Validation stopped');
          const batch = [];
          for (let page = start; page < start + LISTING_PAGE_CONCURRENCY && page <= pages; page++) {
            batch.push(requestPage(code, page, fetcher));
          }
          const currentPages = await Promise.all(batch);
          currentPages.forEach((current) => { items = items.concat(current.items || []); });
        }
        return { items, meta: first, cached: false };
      })().catch((error) => { cache.delete(code); throw error; }));
    }
    return cache.get(code);
  };
}

const isDeadMessage = (message) => /HTTP\s+(404|410)|not found|does not exist|không tồn tại/i.test(message);

/** One file link through the proxy: live, dead, or unknown — never a guess. */
export async function probeFile(code, fetcher = fetch) {
  try {
    const data = await requestPage(code, 1, fetcher);
    const current = data.current || data.item || (data.items || []).find((item) => String(item.linkcode).toUpperCase() === code);
    if (!current) return { status: 'unknown', error: 'Fshare returned no file metadata' };
    if (Number(current.type) === 0) return { status: 'unknown', error: 'Link is a folder, not a file' };
    return {
      status: 'live',
      name: current.name || '',
      size: Number(current.size) || 0,
      path: current.path || '',
      remote: remoteMetadata(current),
      via: 'probe'
    };
  } catch (error) {
    const message = String(error?.message || error);
    return { status: isDeadMessage(message) ? 'dead' : 'unknown', error: message, via: 'probe' };
  }
}

/**
 * Second opinion straight from fshare.vn, for a file the proxy called dead.
 * The page is a 302 to itself plus a token and then 200 either way; what
 * tells the cases apart is the <title>: a dead link is "Không tìm thấy",
 * a live one is the file name. Node only — the browser is blocked by CORS.
 */
export async function probeFileOnWeb(code, fetcher = fetch) {
  try {
    const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      : undefined;
    const response = await withTimeout(fetcher(`${FSHARE_WEB}/file/${code}`, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0' },
      ...(signal ? { signal } : {})
    }), `Fshare web request ${code}`);
    const html = await withTimeout(response.text(), `Fshare web response ${code}`);
    const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || '').trim();
    /* Only the file's own page, answered 200, can vouch for it. A 503 page, an
       "Đã có lỗi xảy ra" page and the homepage (where a folder-shaped code
       lands) all carry a <title> too — 38 dead links were once recorded live
       with "503 Service Temporarily Unavailable" as their name. */
    if (!response.ok) return { status: 'unknown', error: `fshare.vn answered HTTP ${response.status}`, via: 'web' };
    if (!title) return { status: 'unknown', error: `fshare.vn answered without a title (HTTP ${response.status})`, via: 'web' };
    if (/không tìm thấy|not found/i.test(title)) return { status: 'dead', error: title, via: 'web' };
    const finalUrl = String(response.url || '');
    if ((finalUrl && !finalUrl.toUpperCase().includes(`/FILE/${code}`)) || /lỗi|error|unavailable|dịch vụ lưu trữ/i.test(title)) {
      return { status: 'unknown', error: `fshare.vn did not show the file page: ${title}`, via: 'web' };
    }
    return { status: 'live', name: title.replace(/\s*-\s*Fshare\s*$/i, ''), via: 'web' };
  } catch (error) {
    return { status: 'unknown', error: String(error?.message || error), via: 'web' };
  }
}

/* ---------- validate ---------- */

function applyResult(row, result, now) {
  row.status = result.status;
  row.checkedAt = now;
  row.via = result.via || row.via;
  row.error = result.status === 'live' ? '' : (result.error || '');
  if (result.probe && typeof result.probe === 'object') row.probe = remoteMetadata(result.probe);
  if (result.remote && Object.keys(result.remote).length) {
    row.remote = { ...(row.remote || {}), ...remoteMetadata(result.remote) };
  }
  if (result.status === 'live') {
    row.lastLiveAt = now;
    row.deadSince = null;
    if (result.name) addName(row, result.name);
    if (result.size) row.size = result.size;
    if (result.path) {
      row.path = result.path;
      row.keywords = [...new Set([...(row.keywords || []), ...queryTokens(result.path)])];
    }
    refreshKeywords(row);
  } else if (result.status === 'dead' && !row.deadSince) {
    row.deadSince = now;
  }
}

/** Merge a shard output only after its caller has verified the catalog hash. */
export function mergeShardResults(catalog, payload, now = new Date().toISOString()) {
  if (!payload || payload.kind !== 'fshare-movie-shard-results' || !Array.isArray(payload.rows)) {
    throw new Error('That file is not a valid Fshare movie shard result.');
  }
  const rows = new Map(catalog.links.map((row) => [row.id, row]));
  const updates = payload.rows.map((result) => {
    const target = rows.get(result.id);
    if (!target || target.kind !== result.kind || target.code !== result.code) {
      throw new Error(`Shard row does not match catalog: ${result.id || '(missing id)'}`);
    }
    if (!STATUSES.includes(result.status) || result.status === 'pending') {
      throw new Error(`Shard row has an invalid result status: ${result.id || '(missing id)'}`);
    }
    return { target, result };
  });
  updates.forEach(({ target, result }) => {
    applyResult(target, result, result.checkedAt || now);
    if (result.probe && typeof result.probe === 'object') target.probe = remoteMetadata(result.probe);
  });
  return { merged: updates.length };
}

const parseDuration = (value) => {
  const match = String(value || '').match(/^(\d+)\s*([dhm])?$/i);
  if (!match) return 0;
  const n = parseInt(match[1], 10);
  return n * ({ d: 86400000, h: 3600000, m: 60000 }[(match[2] || 'd').toLowerCase()]);
};

/** Which rows a run looks at: folders before files, never-checked before stale. */
export function selectEntries(catalog, { only = ['pending', 'unknown'], staleMs = 0, limit = 0, now = Date.now() } = {}) {
  const wanted = new Set(only);
  const rank = { pending: 0, unknown: 1, dead: 2, live: 3 };
  const stale = (row) => staleMs > 0 && row.checkedAt && now - Date.parse(row.checkedAt) >= staleMs;
  const entries = catalog.links
    .filter((row) => wanted.has(row.status) || stale(row))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'folder' ? -1 : 1) || rank[a.status] - rank[b.status]);
  return limit > 0 ? entries.slice(0, limit) : entries;
}

async function validate(catalog, options) {
  const {
    concurrency = 4, web = true, dryRun = false, fetcher = fetch, log = out,
    onCheckpoint = async () => {}
  } = options;
  const entries = selectEntries(catalog, options);
  if (!entries.length) { log('Nothing to validate.'); return { checked: 0 }; }

  const rows = new Map(catalog.links.map((row) => [row.id, row]));
  const fetchPages = createListingFetcher(fetcher);
  const crawled = new Set();   // folders listed this run, by any ancestor
  const probed = new Set();    // files answered this run
  const queue = entries.slice();
  let total = entries.length;
  let stopping = false;
  let done = 0;
  let sinceCheckpoint = 0;
  const started = Date.now();

  const stop = () => { if (!stopping) { stopping = true; log('Stopping after the current checks…'); } };
  process.once('SIGINT', stop);

  const upsert = (link, origin, now) => {
    let row = rows.get(link.id);
    if (!row) { row = newLink(link, origin, now); rows.set(row.id, row); catalog.links.push(row); }
    return row;
  };

  const checkFile = async (row, now) => {
    if (probed.has(row.code)) return;
    probed.add(row.code);
    let result = await probeFile(row.code, fetcher);
    // Only a proxy "dead" earns the slower page fetch: it is the answer that
    // deletes a row from what the site shows, so it gets the second opinion.
    if (web && result.status === 'dead') {
      const second = await probeFileOnWeb(row.code, fetcher);
      if (second.status !== 'unknown') result = second;
    }
    applyResult(row, result, now);
  };

  const checkFolder = async (row, now) => {
    if (crawled.has(row.code)) return;
    const result = await crawlMovieFolder(row, {
      shouldStop: () => stopping,
      fetchPages,
      maxDepth: 40,
      maxFolders: 200000,
      concurrency: FOLDER_CONCURRENCY
    });
    const seenChildren = new Set();
    result.folders.forEach((folder) => {
      crawled.add(folder.linkcode);
      const target = folder.linkcode === row.code
        ? row
        : upsert({ id: linkId('folder', folder.linkcode), kind: 'folder', code: folder.linkcode, name: folder.name }, 'crawl', now);
      if (folder.name) addName(target, folder.name);
      if (folder.path) target.path = folder.path;
      if (folder.parent) {
        const parentId = linkId('folder', folder.parent);
        if (!target.parents.includes(parentId)) target.parents.push(parentId);
        seenChildren.add(target.id);
      }
      applyResult(target, { status: folder.status, error: folder.error, remote: folder.remote, via: 'crawl' }, now);
      target.children = { ...(target.children || {}), crawledAt: now, truncated: result.truncated && folder.linkcode === row.code };
    });
    result.files.forEach((file) => {
      const target = upsert({ id: file.id, kind: 'file', code: file.linkcode, name: file.name }, 'crawl', now);
      addName(target, file.name);
      const parentId = linkId('folder', file.parent);
      if (!target.parents.includes(parentId)) target.parents.push(parentId);
      seenChildren.add(target.id);
      probed.add(file.linkcode);
      // A file in a live listing is live by that listing; Fshare does not
      // list what it has deleted. A direct probe is spent only on rows the
      // listing no longer names.
      applyResult(target, {
        status: 'live',
        name: file.name,
        size: file.size,
        path: file.parentPath,
        remote: file.remote,
        via: 'listing'
      }, now);
    });
    // Children known from an earlier crawl and absent now: ask about them
    // directly instead of guessing — a file moved out of a folder can still
    // answer on its own link.
    const listed = new Set(result.folders.map((folder) => linkId('folder', folder.linkcode)));
    catalog.links.forEach((child) => {
      if (seenChildren.has(child.id) || !child.parents.some((parentId) => listed.has(parentId))) return;
      if (child.kind === 'file' ? !probed.has(child.code) : !crawled.has(child.code)) { queue.push(child); total++; }
    });
  };

  const worker = async () => {
    while (queue.length && !stopping) {
      const row = queue.shift();
      const now = new Date().toISOString();
      try {
        if (row.kind === 'folder') await checkFolder(row, now);
        else await checkFile(row, now);
      } catch (error) {
        if (!/Validation stopped/.test(String(error?.message))) applyResult(row, { status: 'unknown', error: String(error?.message || error) }, now);
      }
      done++;
      sinceCheckpoint++;
      if (done % CHECKPOINT_EVERY === 0 || row.kind === 'folder') {
        const elapsed = Math.round((Date.now() - started) / 1000);
        log(`${done}/${total} · ${row.kind} ${row.code} → ${row.status} · ${elapsed}s`);
      }
      if (sinceCheckpoint >= CHECKPOINT_EVERY && !dryRun) {
        sinceCheckpoint = 0;
        await onCheckpoint(catalog);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  process.off('SIGINT', stop);
  return { checked: done, stopped: stopping };
}

/* ---------- ingest ---------- */

const SHEET_RE = /docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/;

async function ingest(args) {
  await mkdir(RAW_DIR, { recursive: true });
  const manifest = await readJson(SOURCES_FILE, { version: 1, sources: {} });
  const gidOption = option(args, '--gid', '');
  const gids = gidOption.split(',').map((g) => g.trim()).filter(Boolean);
  const inputs = args.filter((arg, index) => !arg.startsWith('--') && !(gidOption && arg === gidOption && args[index - 1] === '--gid'));
  if (!inputs.length) die('ingest needs a Google Sheet URL, a local file, or Fshare links.');
  const written = [];
  const pasted = [];

  for (const input of inputs) {
    const sheet = input.match(SHEET_RE);
    if (sheet) {
      const fromUrl = input.match(/[?#&]gid=(\d+)/)?.[1];
      const tabs = gids.length ? gids : fromUrl ? [fromUrl] : [];
      if (!tabs.length) die('A Sheet URL needs a gid (in the URL, or --gid 123,456) — one CSV per tab.');
      for (const gid of tabs) {
        const url = `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=csv&gid=${gid}`;
        const response = await fetch(url, { redirect: 'follow' });
        if (!response.ok || !/text\/csv/.test(response.headers.get('content-type') || '')) {
          die(`Could not export gid ${gid} as CSV (HTTP ${response.status}) — the Sheet must be shared "anyone with the link".`);
        }
        const file = `sheet-${sheet[1].slice(0, 8)}-gid${gid}.csv`;
        await writeFile(path.join(RAW_DIR, file), await response.text(), 'utf8');
        manifest.sources[file] = { originUrl: `https://docs.google.com/spreadsheets/d/${sheet[1]}/edit#gid=${gid}` };
        written.push(file);
      }
    } else if (extractFshareLinks(input).length) {
      pasted.push(input);
    } else if (existsSync(input)) {
      const file = path.basename(input);
      await copyFile(input, path.join(RAW_DIR, file));
      written.push(file);
    } else {
      die(`Not a Sheet URL, an existing file, or an Fshare link: ${input}`);
    }
  }
  if (pasted.length) {
    const file = `links-${new Date().toISOString().slice(0, 10)}.txt`;
    const target = path.join(RAW_DIR, file);
    const existing = existsSync(target) ? await readFile(target, 'utf8') : '';
    await writeFile(target, `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${pasted.join('\n')}\n`, 'utf8');
    written.push(file);
  }
  await writeJson(SOURCES_FILE, manifest);
  out(`Ingested ${written.length} raw file(s) into ${rel(RAW_DIR)}: ${unique(written).join(', ')}`);
  out('Next: node tools/fshare-movie.mjs build');
}

/* ---------- io + cli ---------- */

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch (error) {
    if (fallback !== undefined && error.code === 'ENOENT') return fallback;
    throw error;
  }
}
async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function option(args, name, fallback) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : fallback;
}

async function loadCatalog() {
  const catalog = await readJson(CATALOG_FILE, null);
  if (!catalog) die(`${rel(CATALOG_FILE)} not found — run \`build\` first.`);
  if (catalog.version !== CATALOG_VERSION || catalog.kind !== 'fshare-movie-catalog' || !Array.isArray(catalog.links)) {
    die(`${rel(CATALOG_FILE)} is not a movie catalog this tool understands.`);
  }
  return catalog;
}

async function saveCatalog(catalog) {
  catalog.links.forEach(refreshKeywords);
  recountChildren(catalog);
  summarize(catalog);
  catalog.updatedAt = new Date().toISOString();
  await writeJson(CATALOG_FILE, catalog);
}

async function mergeShards(files) {
  const payloads = [];
  for (const file of files) {
    const payload = await readJson(file, null);
    if (!payload || payload.kind !== 'fshare-movie-shard-results' || !payload.catalog?.sha256) {
      die(`${file} is not a shard result with a catalog snapshot hash.`);
    }
    payloads.push({ file, payload });
  }
  const snapshotHashes = new Set(payloads.map(({ payload }) => payload.catalog.sha256));
  if (snapshotHashes.size !== 1) die('Shard results were created from different catalog snapshots.');
  const catalogText = await readFile(CATALOG_FILE, 'utf8');
  if (createHash('sha256').update(catalogText).digest('hex') !== payloads[0].payload.catalog.sha256) {
    die('Catalog changed since this shard was created - rerun the shard instead of merging stale results.');
  }
  const catalog = JSON.parse(catalogText);
  const resultIds = new Set();
  let merged = 0;
  for (const { payload } of payloads) {
    for (const row of payload.rows || []) {
      if (resultIds.has(row.id)) die(`The same row appears in more than one shard: ${row.id || '(missing id)'}`);
      resultIds.add(row.id);
    }
    merged += mergeShardResults(catalog, payload).merged;
  }
  await saveCatalog(catalog);
  out(`Merged ${merged} shard result(s) from ${files.length} file(s) into ${rel(CATALOG_FILE)}.`);
  return out(statusLine(catalog));
}

function statusLine(catalog) {
  const v = summarize(structuredClone(catalog));
  const folders = catalog.links.filter((row) => row.kind === 'folder').length;
  return `${v.total} links (${folders} folders, ${v.total - folders} files) · pending ${v.pending} · live ${v.live} · dead ${v.dead} · unknown ${v.unknown}`
    + ` · validated: ${v.ok ? 'OK' : 'NO'}${v.lastRunAt ? ` · last run ${v.lastRunAt}` : ''}`;
}

async function main() {
  const args = process.argv.slice(2);
  const command = ['ingest', 'build', 'status', 'validate', 'merge', 'seal', 'unseal'].find((name) => args.includes(name))
    || (args.includes('--check') ? 'check' : null);
  if (!command) die('Usage: fshare-movie.mjs ingest <…> | build | status | validate [--only …] [--stale 30d] [--limit N] [--concurrency 4] [--no-web] [--dry-run] | seal | unseal | --check');

  if (command === 'ingest') return ingest(args.filter((arg) => arg !== 'ingest'));

  if (command === 'build') {
    const files = (await rawFiles(RAW_DIR)).sort((a, b) => a.localeCompare(b, 'vi'));
    if (!files.length) die(`No raw exports in ${rel(RAW_DIR)} — run \`ingest\` first.`);
    const sources = [];
    for (const file of files) {
      const info = await stat(file);
      sources.push({
        file: path.relative(RAW_DIR, file).replaceAll(path.sep, '/'),
        text: await readFile(file, 'utf8'),
        updatedAt: new Date(info.mtimeMs).toISOString()
      });
    }
    const previous = await readJson(CATALOG_FILE, null);
    const before = previous ? previous.links.length : 0;
    const catalog = buildCatalog(sources, await readJson(SOURCES_FILE, {}), previous);
    await writeJson(CATALOG_FILE, catalog);
    out(`${rel(CATALOG_FILE)}: ${catalog.links.length} links from ${sources.length} raw file(s), ${catalog.links.length - before} new.`);
    return out(statusLine(catalog));
  }

  if (command === 'status') return out(statusLine(await loadCatalog()));

  if (command === 'merge') {
    const files = args.filter((arg) => arg !== 'merge' && !arg.startsWith('--'));
    if (!files.length) die('merge needs one or more shard result JSON paths.');
    return mergeShards(files.map((file) => path.resolve(file)));
  }

  if (command === 'validate') {
    const catalog = await loadCatalog();
    const only = option(args, '--only', 'pending,unknown');
    const dryRun = args.includes('--dry-run');
    const result = await validate(catalog, {
      only: only === 'all' ? STATUSES : only.split(',').map((s) => s.trim()).filter((s) => STATUSES.includes(s)),
      staleMs: parseDuration(option(args, '--stale', '0')),
      limit: Number(option(args, '--limit', 0)) || 0,
      concurrency: Number(option(args, '--concurrency', 4)) || 4,
      web: !args.includes('--no-web'),
      dryRun,
      onCheckpoint: saveCatalog
    });
    catalog.validation.lastRunAt = new Date().toISOString();
    if (!dryRun) await saveCatalog(catalog);
    out(`${result.stopped ? 'Stopped' : 'Done'}: ${result.checked} entries checked${dryRun ? ' (dry run, nothing written)' : ''}.`);
    return out(statusLine(catalog));
  }

  if (command === 'seal') {
    const catalog = await loadCatalog();
    const projection = projectCatalog(catalog);
    if (!projection.validated) {
      out(`Warning: ${projection.counts.pending} link(s) still pending — sealing ${projection.links.length} checked row(s) with validated: false.`);
    }
    await writeJson(SEALED_FILE, await seal(projection, await passphrase(), { compress: true }));
    return out(`Sealed ${projection.links.length} checked link(s) into ${rel(SEALED_FILE)} (validated: ${projection.validated}). Commit it.`);
  }

  if (!existsSync(SEALED_FILE)) die(`${rel(SEALED_FILE)} not found.`);
  const envelope = await readJson(SEALED_FILE);
  if (!isEnvelope(envelope)) die('That file is not a sealed envelope.');
  const opened = await unseal(envelope, await passphrase());

  if (command === 'unseal') {
    const target = path.join(SECRET_DIR, 'catalog.unsealed.json');
    await writeJson(target, opened);
    return out(`Recovered ${opened.links?.length ?? 0} checked link(s) into ${rel(target)} — the projection, not the full catalog; merge by id if catalog.json is lost.`);
  }

  // --check: opens, and matches what the local catalog would seal now.
  if (existsSync(CATALOG_FILE)) {
    const local = projectCatalog(await loadCatalog(), opened.sealedAt);
    if (JSON.stringify(local.links) !== JSON.stringify(opened.links) || local.validated !== opened.validated) {
      die('secret/fshare-movie/catalog.json differs from the sealed envelope — run `seal` and commit.');
    }
  }
  out(`Envelope opens; ${opened.links.length} link(s), validated: ${opened.validated}; sealed ${envelope.sealed_at}.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((error) => die(error.stack || error.message || String(error)));
