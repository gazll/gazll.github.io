#!/usr/bin/env node
/*
   Read-only parallel shard for pending Fshare movie-FILE checks.

   This process never writes the catalog. It reads one stable snapshot, probes
   a deterministic disjoint subset through the same folder proxy used by the
   movie tool, and writes merge-ready results to an explicitly named output
   file.

   Files only, on purpose. A folder is proven by its listing, and a listing is
   what `fshare-movie.mjs validate` reads (crawlMovieFolder, one cache per
   run); a probe answers "the folder exists" and nothing about what it holds.
   The 2026-09-16 run used a `--kind all` mode that has since been removed and
   shipped 5,881 folders as validated with children: null. A dead answer here
   also carries fshare.vn's second opinion, because `merge` refuses one
   without it — the proxy's 404 alone once called a forwarded file dead.

   Example:
     node tools/fshare-movie-shard.mjs \
       --catalog secret/fshare-movie/catalog.json \
       --output secret/fshare-movie/shards/files-0.json \
       --shard-index 0 --shard-count 4 --limit 200 --concurrency 4

   Shard indexes are zero-based. Selection is sorted by kind/code/id and then
   assigned with `position % shardCount`, so shard outputs do not overlap when
   they use the same catalog snapshot hash.
*/

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { probeFileOnWeb, readCatalogSnapshot, shardDir } from './fshare-movie.mjs';

const FSHARE_API = 'https://fshare.annnekkk.com/api/folder';
const FSHARE_SORT = 'type,name';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const MAX_SHARD_COUNT = 10_000;
const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 8;
const DEFAULT_RETRIES = 3;
const MAX_RETRIES = 5;
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_TIMEOUT_MS = 60_000;
const SNAPSHOT_READ_ATTEMPTS = 5;
const VALID_KINDS = new Set(['file']);
const VALID_STATUSES = new Set(['pending', 'live', 'dead', 'unknown']);

const out = (line) => process.stdout.write(`${line}\n`);
const fail = (message) => { throw new Error(message); };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function valueAfter(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} needs a value.`);
  return value;
}

function integerOption(value, name, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    fail(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return number;
}

function optionValue(argv, index, name) {
  const argument = argv[index];
  const prefix = `${name}=`;
  if (argument.startsWith(prefix)) return argument.slice(prefix.length);
  return valueAfter(argv, index, name);
}

export function parseArgs(argv) {
  const options = {
    catalogPath: '',
    outputPath: '',
    kind: 'file',
    statuses: ['pending'],
    shardIndex: 0,
    shardCount: 1,
    limit: DEFAULT_LIMIT,
    concurrency: DEFAULT_CONCURRENCY,
    retries: DEFAULT_RETRIES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    force: false,
    quiet: false,
    help: false
  };

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '-h' || argument === '--help') { options.help = true; continue; }
    if (argument === '--force') { options.force = true; continue; }
    if (argument === '--quiet') { options.quiet = true; continue; }
    if (argument === '--catalog' || argument.startsWith('--catalog=')) {
      options.catalogPath = optionValue(argv, index, '--catalog');
      if (!argument.includes('=')) index++;
      continue;
    }
    if (argument === '--output' || argument.startsWith('--output=')) {
      options.outputPath = optionValue(argv, index, '--output');
      if (!argument.includes('=')) index++;
      continue;
    }
    if (argument === '--kind' || argument.startsWith('--kind=')) {
      options.kind = optionValue(argv, index, '--kind').toLowerCase();
      if (!argument.includes('=')) index++;
      continue;
    }
    if (argument === '--status' || argument.startsWith('--status=')) {
      options.statuses = optionValue(argv, index, '--status')
        .split(',')
        .map((status) => status.trim().toLowerCase())
        .filter(Boolean);
      if (!argument.includes('=')) index++;
      continue;
    }
    if (argument === '--shard-index' || argument.startsWith('--shard-index=')) {
      options.shardIndex = integerOption(optionValue(argv, index, '--shard-index'), '--shard-index', 0, MAX_SHARD_COUNT - 1);
      if (!argument.includes('=')) index++;
      continue;
    }
    if (argument === '--shard-count' || argument.startsWith('--shard-count=')) {
      options.shardCount = integerOption(optionValue(argv, index, '--shard-count'), '--shard-count', 1, MAX_SHARD_COUNT);
      if (!argument.includes('=')) index++;
      continue;
    }
    if (argument === '--limit' || argument.startsWith('--limit=')) {
      options.limit = integerOption(optionValue(argv, index, '--limit'), '--limit', 1, MAX_LIMIT);
      if (!argument.includes('=')) index++;
      continue;
    }
    if (argument === '--concurrency' || argument.startsWith('--concurrency=')) {
      options.concurrency = integerOption(optionValue(argv, index, '--concurrency'), '--concurrency', 1, MAX_CONCURRENCY);
      if (!argument.includes('=')) index++;
      continue;
    }
    if (argument === '--retries' || argument.startsWith('--retries=')) {
      options.retries = integerOption(optionValue(argv, index, '--retries'), '--retries', 1, MAX_RETRIES);
      if (!argument.includes('=')) index++;
      continue;
    }
    if (argument === '--timeout-ms' || argument.startsWith('--timeout-ms=')) {
      options.timeoutMs = integerOption(optionValue(argv, index, '--timeout-ms'), '--timeout-ms', 1, MAX_TIMEOUT_MS);
      if (!argument.includes('=')) index++;
      continue;
    }
    fail(`Unknown option: ${argument}`);
  }

  if (options.help) return options;
  if (!options.catalogPath) fail('--catalog is required.');
  if (!options.outputPath) fail('--output is required.');
  if (!VALID_KINDS.has(options.kind)) fail('--kind must be file - folders are crawled by fshare-movie.mjs validate, never probed.');
  if (!options.statuses.length || options.statuses.some((status) => !VALID_STATUSES.has(status))) {
    fail('--status must contain pending, live, dead, or unknown.');
  }
  if (options.shardIndex >= options.shardCount) {
    fail('--shard-index must be smaller than --shard-count.');
  }
  return options;
}

export function helpText() {
  return [
    'Safe Fshare movie validation shard',
    '',
    'Required:',
    '  --catalog PATH       Read-only catalog JSON (normally secret/fshare-movie/catalog.json)',
    '  --output PATH        Result JSON; must not be catalog.json',
    '',
    'Selection:',
    '  --kind file          only file is accepted; folders are crawled by validate',
    '  --status pending     Comma-separated statuses (default: pending)',
    '  --shard-index 0      Zero-based shard index (default: 0)',
    '  --shard-count 1      Number of disjoint shards (default: 1)',
    '  --limit 100          Maximum rows this shard probes (default: 100, max: 500)',
    '',
    'Safety/performance:',
    '  --concurrency 4      Parallel requests (max: 8)',
    '  --retries 3          Attempts per link (max: 5)',
    '  --timeout-ms 20000   Per-request timeout (max: 60000)',
    '  --force              Allow replacing an existing output file',
    '  --quiet              Suppress per-row progress',
    '',
    'Example:',
    '  node tools/fshare-movie-shard.mjs --catalog secret/fshare-movie/catalog.json --output secret/fshare-movie/shards/files-0.json --shard-index 0 --shard-count 4'
  ].join('\n');
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}


function samePath(first, second) {
  const a = path.resolve(first);
  const b = path.resolve(second);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function codeFromLink(link) {
  const match = String(link || '').match(/fshare\.vn\/(?:file|folder)\/([A-Za-z0-9]{4,})/i);
  return match ? match[1].toUpperCase() : '';
}

function codeOf(row) {
  return String(row?.code || row?.linkcode || codeFromLink(row?.link) || '').trim().toUpperCase();
}

function kindOf(row) {
  const kind = String(row?.kind || '').trim().toLowerCase();
  if (kind === 'file' || kind === 'folder') return kind;
  return /fshare\.vn\/folder\//i.test(String(row?.link || '')) ? 'folder' : 'file';
}

function rowIdentity(row) {
  return String(row.id || `fshare-${row.kind}-${row.code}`);
}

function remoteIsFolder(item) {
  return item?.type === 0 || item?.type === '0' || item?.mimetype === 'folder' || item?.ftype === 'folder';
}

function remoteCodeOf(item) {
  return String(item?.linkcode || item?.code || '').trim().toUpperCase();
}

function remoteItem(payload, code) {
  const candidates = [];
  if (payload?.current && typeof payload.current === 'object') candidates.push(payload.current);
  if (payload?.item && typeof payload.item === 'object') candidates.push(payload.item);
  if (Array.isArray(payload?.items)) candidates.push(...payload.items.filter((item) => item && typeof item === 'object'));
  return candidates.find((item) => remoteCodeOf(item) === code) || candidates[0] || null;
}

function remoteResponseMeta(payload) {
  const meta = {};
  if (!payload || typeof payload !== 'object') return meta;
  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'items' || key === 'current' || key === 'item') return;
    try { meta[key] = cloneJson(value); } catch { /* Ignore an unexpected non-JSON value. */ }
  });
  return meta;
}

function sizeBytes(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.round(value);
  const text = String(value ?? '').trim().replace(',', '.');
  const match = text.match(/^([0-9]+(?:\.[0-9]+)?)\s*(b|kb|mb|gb|tb)?$/i);
  if (!match) return 0;
  const multipliers = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };
  return Math.round(Number(match[1]) * (multipliers[(match[2] || 'b').toLowerCase()] || 1));
}

function candidateRows(catalog, options) {
  const links = Array.isArray(catalog) ? catalog : catalog?.links;
  if (!Array.isArray(links)) fail('Catalog must contain a links array.');
  const wantedStatuses = new Set(options.statuses || ['pending']);
  const seen = new Set();
  let skipped = 0;
  let duplicates = 0;
  const candidates = [];

  links.forEach((sourceRow, sourceIndex) => {
    if (!sourceRow || typeof sourceRow !== 'object') { skipped++; return; }
    const code = codeOf(sourceRow);
    const kind = kindOf(sourceRow);
    if (!code || (kind !== 'file' && kind !== 'folder')) { skipped++; return; }
    const status = VALID_STATUSES.has(sourceRow.status) ? sourceRow.status : 'pending';
    if (!wantedStatuses.has(status)) return;
    if (options.kind !== kind) return;

    const id = rowIdentity({ ...sourceRow, kind, code });
    const identity = `${kind}:${code}`;
    if (seen.has(identity)) { duplicates++; return; }
    seen.add(identity);
    candidates.push({ sourceRow, sourceIndex, id, identity, code, kind, status });
  });

  candidates.sort((a, b) =>
    a.identity.localeCompare(b.identity) || a.id.localeCompare(b.id) || a.sourceIndex - b.sourceIndex);
  return { candidates, skipped, duplicates };
}

/** Select one deterministic, disjoint shard without changing catalog rows. */
export function selectRows(catalog, options = {}) {
  const normalized = {
    kind: options.kind || 'file',
    statuses: options.statuses || ['pending'],
    shardIndex: options.shardIndex ?? 0,
    shardCount: options.shardCount ?? 1,
    limit: options.limit ?? DEFAULT_LIMIT
  };
  const selected = candidateRows(catalog, normalized);
  const shardRows = selected.candidates.filter((row, index) => index % normalized.shardCount === normalized.shardIndex);
  return {
    ...selected,
    shardRows,
    selected: shardRows.slice(0, normalized.limit),
    shardCandidateCount: shardRows.length
  };
}

/* The catalog is a header plus shard files; readCatalogSnapshot assembles
   them and hashes exactly the bytes it read, and `merge` recomputes that same
   digest. Reading twice catches a checkpoint landing between two shards. */
async function readStableCatalog(catalogPath) {
  let lastError;
  for (let attempt = 1; attempt <= SNAPSHOT_READ_ATTEMPTS; attempt++) {
    try {
      const quiet = { log: () => {} };
      const first = await readCatalogSnapshot(catalogPath, quiet);
      const second = await readCatalogSnapshot(catalogPath, quiet);
      if (first.digest !== second.digest) throw new Error('Catalog changed while it was being read.');
      if (!Array.isArray(first.catalog?.links)) throw new Error('Catalog must contain a links array.');
      return { catalog: first.catalog, digest: first.digest };
    } catch (error) {
      lastError = error;
      if (attempt < SNAPSHOT_READ_ATTEMPTS) await wait(250 * attempt);
    }
  }
  throw new Error(`Could not read a stable catalog snapshot: ${lastError?.message || lastError}`);
}

function responseError(message, status = 0) {
  const error = new Error(message);
  if (status) error.status = status;
  return error;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Fshare returned an invalid response.');
  const code = Number(payload.code);
  if (Number.isFinite(code) && code >= 400) {
    throw responseError(`${payload.msg || payload.message || 'Fshare rejected the link'} (HTTP ${code})`, code);
  }
  if (payload.error && !Array.isArray(payload.items)) throw new Error(String(payload.error));
  if (!Array.isArray(payload.items) && !payload.current && !payload.item) {
    throw new Error('Fshare returned no link metadata.');
  }
  return payload;
}

function retryable(error) {
  const status = Number(error?.status || 0);
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  return true;
}

async function requestWithTimeout(fetcher, url, options, timeoutMs, label) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(responseError(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      fetcher(url, { ...options, signal: controller.signal }),
      timeout
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function responseJson(response) {
  if (typeof response.arrayBuffer !== 'function') return response.json();
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error(`Fshare response exceeded ${MAX_RESPONSE_BYTES} bytes.`);
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function requestPage(code, {
  fetcher = fetch,
  endpoint = FSHARE_API,
  retries = DEFAULT_RETRIES,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const url = `${endpoint}?linkcode=${encodeURIComponent(code)}&sort=${encodeURIComponent(FSHARE_SORT)}&page=1`;
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await requestWithTimeout(
        fetcher,
        url,
        { cache: 'no-store' },
        timeoutMs,
        `Fshare request ${code} page 1`
      );
      if (!response.ok) throw responseError(`HTTP ${response.status}`, response.status);
      const payload = await requestWithTimeout(
        () => responseJson(response),
        url,
        {},
        timeoutMs,
        `Fshare response ${code} page 1`
      );
      return { payload: validatePayload(payload), attempts: attempt, url };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      lastError.attempts = attempt;
      lastError.url = url;
      if (!retryable(lastError) || attempt === retries) throw lastError;
      await wait(400 * attempt);
    }
  }
  throw lastError;
}

function isDead(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || error);
  return status === 404 || status === 410
    || /HTTP\s+(404|410)|not\s+found|does\s+not\s+exist|không\s+tồn\s+tại|khÃ´ng\s+tá»“n\s+táº¡i/i.test(message);
}

function linkFor(kind, code) {
  return `https://www.fshare.vn/${kind}/${code}`;
}

async function failureRow(candidate, error, checkedAt, started, options) {
  const row = cloneJson(candidate.sourceRow);
  row.id = candidate.id;
  row.kind = candidate.kind;
  row.code = candidate.code;
  row.link = row.link || linkFor(candidate.kind, candidate.code);
  row.status = isDead(error) ? 'dead' : 'unknown';
  row.checkedAt = checkedAt;
  row.via = 'probe';
  row.error = String(error?.message || error);
  row.probe = {
    endpoint: options.endpoint,
    attempts: Number(error?.attempts || options.retries),
    durationMs: 0,
    response: {}
  };
  if (row.status === 'dead') {
    // The proxy's 404 is one opinion. fshare.vn's page is the second, and a
    // dead row without it is refused at merge time.
    const second = await options.webProbe(candidate.code, options.fetcher);
    row.web = { status: second.status, error: second.error || '' };
    if (second.status === 'live') {
      row.status = 'live';
      row.via = 'web';
      row.error = '';
      row.lastLiveAt = checkedAt;
      row.deadSince = null;
      if (second.name) row.name = second.name;
    } else {
      row.deadSince = row.deadSince || checkedAt;
    }
  }
  row.probe.durationMs = Date.now() - started;
  return row;
}

/** Probe one catalog row and return a new merge-ready row snapshot. */
export async function probeRow(candidate, options = {}) {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  const probeOptions = {
    endpoint: FSHARE_API,
    retries: DEFAULT_RETRIES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    fetcher: fetch,
    webProbe: probeFileOnWeb,
    ...options
  };
  try {
    const response = await requestPage(candidate.code, probeOptions);
    const remote = remoteItem(response.payload, candidate.code);
    if (!remote) throw new Error('Fshare returned no matching link metadata.');
    const remoteKind = remoteIsFolder(remote) ? 'folder' : 'file';
    if (remoteKind !== candidate.kind) {
      throw new Error(`Fshare returned ${remoteKind} metadata for a ${candidate.kind} row.`);
    }

    const row = cloneJson(candidate.sourceRow);
    const name = remote.name || remote.filename || remote.title || row.name || candidate.code;
    const size = sizeBytes(remote.size) || sizeBytes(remote.filesize) || sizeBytes(row.size);
    const remotePath = remote.path || remote.parentPath || row.path || '';
    row.id = candidate.id;
    row.kind = candidate.kind;
    row.code = candidate.code;
    row.link = row.link || linkFor(candidate.kind, candidate.code);
    row.name = name;
    row.size = size;
    row.path = remotePath;
    row.status = 'live';
    row.checkedAt = checkedAt;
    row.lastLiveAt = checkedAt;
    row.deadSince = null;
    row.via = 'probe';
    row.error = '';
    row.remote = cloneJson(remote);
    row.probe = {
      endpoint: probeOptions.endpoint,
      attempts: response.attempts,
      durationMs: Date.now() - started,
      response: remoteResponseMeta(response.payload)
    };
    return row;
  } catch (error) {
    return failureRow(candidate, error, checkedAt, started, probeOptions);
  }
}

async function probeRows(rows, options) {
  const results = new Array(rows.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= rows.length) return;
      results[index] = await probeRow(rows[index], options);
      if (!options.quiet) {
        const result = results[index];
        out(`${index + 1}/${rows.length} · ${result.kind} ${result.code} → ${result.status}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(options.concurrency, Math.max(1, rows.length)) }, worker));
  return results;
}

function counts(rows) {
  const result = { total: rows.length, live: 0, dead: 0, unknown: 0, pending: 0 };
  rows.forEach((row) => { if (Object.hasOwn(result, row.status)) result[row.status]++; });
  return result;
}

async function writeOutput(outputPath, value, force) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  if (!force && existsSync(outputPath)) {
    fail(`Output already exists: ${outputPath} (use --force to replace it).`);
  }
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: force ? 'w' : 'wx'
  });
}

async function run(options) {
  const catalogPath = path.resolve(options.catalogPath);
  const outputPath = path.resolve(options.outputPath);
  if (samePath(catalogPath, outputPath) || path.basename(outputPath).toLowerCase() === 'catalog.json'
    || path.resolve(outputPath).startsWith(path.resolve(shardDir(catalogPath)) + path.sep)) {
    fail('Output must be a separate JSON path — not catalog.json and not inside its shard directory.');
  }

  const snapshot = await readStableCatalog(catalogPath);
  const selection = selectRows(snapshot.catalog, options);
  const startedAt = new Date().toISOString();
  if (!options.quiet) {
    out(`Snapshot ${snapshot.digest.slice(0, 12)} · ${selection.candidates.length} candidates · ${selection.selected.length} selected`);
  }

  const rows = await probeRows(selection.selected, options);
  const completedAt = new Date().toISOString();
  const result = {
    version: 1,
    kind: 'fshare-movie-shard-results',
    createdAt: startedAt,
    completedAt,
    catalog: {
      path: catalogPath,
      sha256: snapshot.digest,
      updatedAt: snapshot.catalog?.updatedAt || null,
      version: snapshot.catalog?.version || null
    },
    selection: {
      kind: options.kind,
      statuses: options.statuses,
      shardIndex: options.shardIndex,
      shardCount: options.shardCount,
      algorithm: 'sorted kind/code/id, then position modulo shardCount',
      candidates: selection.candidates.length,
      shardCandidates: selection.shardCandidateCount,
      selected: rows.length,
      limit: options.limit,
      skippedMalformed: selection.skipped,
      duplicatesRemoved: selection.duplicates
    },
    probe: {
      endpoint: FSHARE_API,
      concurrency: options.concurrency,
      retries: options.retries,
      timeoutMs: options.timeoutMs,
      maxResponseBytes: MAX_RESPONSE_BYTES,
      counts: counts(rows)
    },
    rows
  };
  await writeOutput(outputPath, result, options.force);
  out(`Wrote ${rows.length} result(s) to ${outputPath}`);
  out(`Summary · live ${result.probe.counts.live} · dead ${result.probe.counts.dead} · unknown ${result.probe.counts.unknown}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) out(helpText());
    else await run(options);
  } catch (error) {
    process.stderr.write(`fshare-movie-shard: ${error?.message || error}\n`);
    process.exitCode = 1;
  }
}
