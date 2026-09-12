#!/usr/bin/env node
/* The separate X link catalog.

   X is intentionally not a second movie source. It has its own raw directory,
   catalog, public envelope, and UI dataset. The import is a searchable raw
   index; links are not called live until a future X-specific validation pass
   has actually checked them.

     node tools/fshare-x.mjs build
     node tools/fshare-x.mjs status
     node tools/fshare-x.mjs seal
     node tools/fshare-x.mjs --check
*/

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isEnvelope, seal, unseal } from '../public/lib/schedule-crypto.js';
import { keywordTokens, linkUrl, titleKey } from '../public/fshare-tool/lib/movie-db.js';
import { parseRawSource } from './fshare-movie.mjs';
import { passphrase } from './passphrase.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SECRET_DIR = path.join(ROOT, 'secret', 'fshare-x');
export const RAW_DIR = path.join(SECRET_DIR, 'raw');
export const SOURCES_FILE = path.join(SECRET_DIR, 'sources.json');
export const CATALOG_FILE = path.join(SECRET_DIR, 'catalog.json');
export const VALIDATION_REPORT_FILE = path.join(SECRET_DIR, 'validation-report.json');
export const SEALED_FILE = path.join(ROOT, 'public', 'data', 'fshare-x', 'catalog.enc.json');
export const X_CATALOG_VERSION = 1;

const RAW_EXTENSIONS = new Set(['.csv', '.txt', '.md', '.json']);
const out = (line) => process.stdout.write(`${line}\n`);
const die = (line) => { process.stderr.write(`${line}\n`); process.exit(1); };
const rel = (file) => path.relative(ROOT, file).replaceAll(path.sep, '/');

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

export const sourceId = (relativeFile) => `src-${createHash('sha1').update(relativeFile).digest('hex').slice(0, 10)}`;

export function emptyCatalog(now = new Date().toISOString()) {
  return {
    version: X_CATALOG_VERSION,
    kind: 'fshare-x-catalog',
    createdAt: now,
    updatedAt: now,
    validation: { ok: false, total: 0, folders: 0, files: 0, raw: 0, lastRunAt: null },
    sources: [],
    links: []
  };
}

function newLink(link, source, now) {
  const name = link.name || link.code;
  return {
    id: link.id,
    kind: link.kind,
    code: link.code,
    link: link.link || linkUrl(link.kind, link.code),
    name,
    aliases: [],
    keywords: keywordTokens([name, link.code]),
    titleKey: titleKey(name),
    sourceIds: [source],
    firstSeenAt: now,
    updatedAt: now,
    status: 'raw'
  };
}

function addName(row, value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  if (!name || name === row.name || row.aliases.includes(name)) return;
  if (row.name === row.code) {
    row.name = name;
    row.titleKey = titleKey(name);
    row.keywords = [...new Set([...(row.keywords || []), ...keywordTokens(name)])];
    return;
  }
  row.aliases.push(name);
  row.keywords = [...new Set([...(row.keywords || []), ...keywordTokens(name)])];
}

function recount(catalog) {
  const folders = catalog.links.filter((row) => row.kind === 'folder').length;
  const byStatus = { raw: 0, live: 0, dead: 0, unknown: 0 };
  catalog.links.forEach((row) => { if (Object.hasOwn(byStatus, row.status)) byStatus[row.status]++; else byStatus.raw++; });
  catalog.validation = {
    ok: false,
    total: catalog.links.length,
    folders,
    files: catalog.links.length - folders,
    raw: byStatus.raw,
    live: byStatus.live,
    dead: byStatus.dead,
    unknown: byStatus.unknown,
    lastRunAt: catalog.validation?.lastRunAt || null,
    scope: catalog.validation?.scope || 'raw-import'
  };
  return catalog.validation;
}

function sortLinks(catalog) {
  const byKind = { folder: 0, file: 1 };
  catalog.links.sort((a, b) =>
    a.titleKey.localeCompare(b.titleKey, 'vi') || byKind[a.kind] - byKind[b.kind] || a.code.localeCompare(b.code));
}

export function buildXCatalog(sources, manifest = {}, previous = null, now = new Date().toISOString()) {
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
      if (!row) {
        row = newLink(record, id, now);
        rows.set(row.id, row);
        catalog.links.push(row);
      } else {
        addName(row, record.name);
        if (!row.sourceIds.includes(id)) row.sourceIds.push(id);
      }
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
  catalog.links.forEach((row) => {
    row.status = ['raw', 'live', 'dead', 'unknown'].includes(row.status) ? row.status : 'raw';
    row.keywords = [...new Set([...(row.keywords || []), ...keywordTokens([row.name, ...(row.aliases || []), row.code])])];
  });
  sortLinks(catalog);
  recount(catalog);
  catalog.updatedAt = now;
  return catalog;
}

export function applyValidationReport(catalog, report) {
  if (!report || report.kind !== 'fshare-x-validation-report' || !Array.isArray(report.results)) return catalog;
  const rows = new Map(catalog.links.map((row) => [`${row.kind}:${row.code}`, row]));
  report.results.forEach((result) => {
    const key = `${result.kind}:${String(result.code || '').toUpperCase()}`;
    const row = rows.get(key);
    if (!row) return;
    row.status = ['live', 'dead', 'unknown'].includes(result.status) ? result.status : 'raw';
    row.checkedAt = result.checkedAt || report.checkedAt || null;
    row.error = row.status === 'live' ? '' : (result.error || '');
    row.via = result.probe?.source || 'probe';
    if (result.remoteName && row.name === row.code) {
      row.name = result.remoteName;
      row.titleKey = titleKey(row.name);
      row.keywords = [...new Set([...(row.keywords || []), ...keywordTokens(row.name)])];
    }
    if (result.probe && typeof result.probe === 'object') row.probe = result.probe;
  });
  catalog.validation = {
    ...(catalog.validation || {}),
    lastRunAt: report.completedAt || report.checkedAt || null,
    scope: report.policy?.scope || 'root-link-check'
  };
  recount(catalog);
  return catalog;
}

/** The X envelope intentionally carries raw searchable rows, not movie rows. */
export function projectXCatalog(catalog, sealedAt = new Date().toISOString()) {
  const validation = recount(structuredClone(catalog));
  return {
    version: X_CATALOG_VERSION,
    kind: 'fshare-x-db',
    catalogType: 'x',
    sealedAt,
    validated: false,
    checkedScope: validation.scope,
    counts: {
      total: validation.total,
      folders: validation.folders,
      files: validation.files,
      raw: validation.raw,
      live: validation.live,
      dead: validation.dead,
      unknown: validation.unknown
    },
    sources: catalog.sources.map((source) => ({ id: source.id, name: source.name })),
    links: catalog.links.map((row) => ({
      id: row.id,
      kind: row.kind,
      code: row.code,
      link: row.link,
      name: row.name,
      ...(row.aliases.length ? { aliases: row.aliases } : {}),
      keywords: row.keywords,
      titleKey: row.titleKey,
      sourceIds: row.sourceIds,
      status: row.status,
      ...(row.checkedAt ? { checkedAt: row.checkedAt } : {}),
      ...(row.error ? { error: row.error } : {}),
      ...(row.probe ? { probe: row.probe } : {})
    }))
  };
}

function statusLine(catalog) {
  const v = recount(catalog);
  return `${v.total} X links (${v.folders} folders, ${v.files} files) · live ${v.live} · dead ${v.dead} · unknown ${v.unknown} · raw ${v.raw}`;
}

async function loadCatalog() {
  const catalog = await readJson(CATALOG_FILE, null);
  if (!catalog) die(`${rel(CATALOG_FILE)} not found — run \`build\` first.`);
  if (catalog.version !== X_CATALOG_VERSION || catalog.kind !== 'fshare-x-catalog' || !Array.isArray(catalog.links)) {
    die(`${rel(CATALOG_FILE)} is not an X catalog this tool understands.`);
  }
  return catalog;
}

async function main() {
  const args = process.argv.slice(2);
  const command = ['build', 'status', 'seal'].find((name) => args.includes(name))
    || (args.includes('--check') ? 'check' : null);
  if (!command) die('Usage: fshare-x.mjs build | status | seal | --check');

  if (command === 'build') {
    const files = (await rawFiles(RAW_DIR)).sort((a, b) => a.localeCompare(b, 'vi'));
    if (!files.length) die(`No raw exports in ${rel(RAW_DIR)}.`);
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
    const catalog = buildXCatalog(sources, await readJson(SOURCES_FILE, {}), previous);
    const report = await readJson(VALIDATION_REPORT_FILE, null);
    const reportPath = String(report?.source?.path || '').replaceAll('\\', '/');
    const reportFile = reportPath
      ? files.find((file) => [path.relative(ROOT, file), path.relative(RAW_DIR, file)]
        .map((value) => value.replaceAll(path.sep, '/')).includes(reportPath))
      : files.length === 1 ? files[0] : null;
    const rawDigest = reportFile ? createHash('sha256').update(await readFile(reportFile)).digest('hex') : '';
    if (reportFile && report?.source?.sha256 === rawDigest) applyValidationReport(catalog, report);
    await writeJson(SOURCES_FILE, {
      version: 1,
      sources: Object.fromEntries(catalog.sources.map((source) => [source.file, { originUrl: source.originUrl }]))
    });
    await writeJson(CATALOG_FILE, catalog);
    out(`${rel(CATALOG_FILE)}: ${catalog.links.length} links from ${sources.length} raw file(s), ${catalog.links.length - before} new.`);
    return out(statusLine(catalog));
  }

  if (command === 'status') return out(statusLine(await loadCatalog()));

  if (command === 'seal') {
    const catalog = await loadCatalog();
    const projection = projectXCatalog(catalog);
    await writeJson(SEALED_FILE, await seal(projection, await passphrase(), { compress: true }));
    return out(`Sealed ${projection.links.length} raw X link(s) into ${rel(SEALED_FILE)}.`);
  }

  if (!existsSync(SEALED_FILE)) die(`${rel(SEALED_FILE)} not found.`);
  const envelope = await readJson(SEALED_FILE);
  if (!isEnvelope(envelope)) die('That file is not a sealed envelope.');
  const opened = await unseal(envelope, await passphrase());
  const local = projectXCatalog(await loadCatalog(), opened.sealedAt);
  if (JSON.stringify(local) !== JSON.stringify(opened)) {
    die('secret/fshare-x/catalog.json differs from the sealed envelope — run `seal` and commit.');
  }
  out(`Envelope opens; ${opened.links.length} raw X link(s), sealed ${envelope.sealed_at}.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((error) => die(error.stack || error.message || String(error)));
