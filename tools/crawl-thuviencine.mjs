#!/usr/bin/env node
/* Crawl the public movie index at thuviencine.uk.

   The site keeps the Fshare URL one hop behind each movie post:

     post -> /download?id=... -> fshare.vn/{file,folder}/...

   Sitemap discovery is intentional. Movie pages contain links to many other
   movies, so following every internal anchor would duplicate work and make it
   too easy to leave the site's actual post index. The crawler only stores the
   final Fshare links, as text lines compatible with fshare-movie.mjs.

   Usage:
     node tools/crawl-thuviencine.mjs
     node tools/crawl-thuviencine.mjs --limit 20 --output /tmp/thuviencine.txt --state /tmp/thuviencine-state.json --no-register

   A state file is kept outside raw/ so fshare-movie.mjs never mistakes it for
   an export. Re-running the command resumes successful page fetches and
   retries only the pages that failed.
*/

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractFshareLinks } from '../public/fshare-tool/lib/movie-db.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SECRET_DIR = path.join(ROOT, 'secret', 'fshare-movie');
const RAW_DIR = path.join(SECRET_DIR, 'raw');
const SOURCES_FILE = path.join(SECRET_DIR, 'sources.json');
const DEFAULT_SITE = 'https://thuviencine.uk/';
const STATE_VERSION = 1;
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_DELAY_MS = 100;
const DEFAULT_TIMEOUT_MS = 20000;
const RETRIES = 3;
const CHECKPOINT_EVERY = 50;
const USER_AGENT = 'GAZLL thuviencine link crawler/1.0 (+https://gazll.github.io/)';

const out = (line) => process.stdout.write(String(line) + '\n');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const unique = (values) => [...new Set(values.filter(Boolean))];
const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** Decode the entities used in WordPress titles, hrefs and XML loc values. */
export function decodeHtml(value) {
  return String(value ?? '').replace(/&(#x?[0-9a-f]+|amp|apos|gt|lt|nbsp|quot|ndash|mdash|hellip);/gi, (full, entity) => {
    const lower = entity.toLowerCase();
    if (lower === 'amp') return '&';
    if (lower === 'apos') return "'";
    if (lower === 'gt') return '>';
    if (lower === 'lt') return '<';
    if (lower === 'nbsp') return ' ';
    if (lower === 'quot') return '"';
    if (lower === 'ndash') return '–';
    if (lower === 'mdash') return '—';
    if (lower === 'hellip') return '…';
    const number = lower[1] === 'x'
      ? Number.parseInt(lower.slice(2), 16)
      : Number.parseInt(lower.slice(1), 10);
    if (!Number.isFinite(number) || number < 0 || number > 0x10ffff) return full;
    try { return String.fromCodePoint(number); } catch { return full; }
  });
}

function attribute(tag, name) {
  const pattern = new RegExp('\\b' + name + '\\s*=\\s*(["\\x27])([\\s\\S]*?)\\1', 'i');
  const quoted = tag.match(pattern);
  if (quoted) return decodeHtml(quoted[2]);
  const bare = tag.match(new RegExp('\\b' + name + '\\s*=\\s*([^\\s>]+)', 'i'));
  return bare ? decodeHtml(bare[1]) : '';
}

function anchorTags(html) {
  return [...String(html ?? '').matchAll(/<a\b[^>]*>/gi)].map((match) => match[0]);
}

/** Turn a post title into the name that will be searchable in the movie DB. */
export function cleanMovieTitle(value) {
  return cleanText(decodeHtml(value))
    .replace(/^\s*(?:Tải\s+phim|Download)\s*(?:[-:–—]\s*)?/i, '')
    .replace(/\s*(?:[-|]\s*)?link\s+Fshare(?:\s*[-|]\s*CineTV)?\s*$/i, '')
    .replace(/\s*[-|]\s*CineTV\s*$/i, '')
    .trim();
}

function titleFromUrl(pageUrl) {
  let slug = '';
  try { slug = decodeURIComponent(new URL(pageUrl).pathname.split('/').filter(Boolean).at(-1) || ''); } catch { slug = ''; }
  return cleanText(slug.replace(/(?:^|-)fshare$/, '').replace(/^-+/, '').replace(/-/g, ' ')) || 'Unknown movie';
}

/** Extract a useful title regardless of whether meta attributes are reordered. */
export function extractPageTitle(html) {
  let raw = '';
  for (const tag of String(html ?? '').match(/<meta\b[^>]*>/gi) || []) {
    const property = attribute(tag, 'property').toLowerCase();
    const name = attribute(tag, 'name').toLowerCase();
    if (property === 'og:title' || name === 'og:title' || name === 'twitter:title') {
      raw = attribute(tag, 'content');
      if (raw) break;
    }
  }
  raw ||= String(html ?? '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  return cleanMovieTitle(raw);
}

function sameOrigin(value, siteUrl) {
  try { return new URL(value).origin === new URL(siteUrl).origin; } catch { return false; }
}

function canonicalSiteUrl(value, pageUrl) {
  try {
    const url = new URL(decodeHtml(value), pageUrl);
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.href;
  } catch { return ''; }
}

/** Extract only same-site /download?id=... anchors from a movie post. */
export function extractDownloadUrls(html, pageUrl, siteUrl = pageUrl) {
  const urls = [];
  for (const tag of anchorTags(html)) {
    const href = attribute(tag, 'href');
    if (!href) continue;
    const url = canonicalSiteUrl(href, pageUrl);
    if (!url || !sameOrigin(url, siteUrl)) continue;
    let parsed;
    try { parsed = new URL(url); } catch { continue; }
    if (parsed.pathname !== '/download' || !parsed.searchParams.get('id')) continue;
    parsed.pathname = '/download';
    parsed.hash = '';
    urls.push(parsed.href);
  }
  return unique(urls);
}

/** Extract canonical Fshare URLs from a download document and its link attrs. */
export function extractFshareLinksFromHtml(html) {
  const attrs = [];
  for (const tag of anchorTags(html)) {
    for (const name of ['href', 'data-href', 'data-url']) {
      const value = attribute(tag, name);
      if (value) attrs.push(value);
    }
  }
  // The fallback also handles a JSON/JS link used by an older template. The
  // Fshare parser canonicalises and de-duplicates the final list.
  return extractFshareLinks(attrs.join('\n') + '\n' + String(html ?? '')).map((link) => link.link);
}

/** Parse XML sitemap locs without bringing a DOM dependency into the crawler. */
export function parseLocs(xml, baseUrl = DEFAULT_SITE) {
  const values = [...String(xml ?? '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => decodeHtml(match[1]).trim());
  return unique(values.map((value) => {
    try { return new URL(value, baseUrl).href; } catch { return ''; }
  }));
}

export function selectPostSitemaps(xml, siteUrl = DEFAULT_SITE) {
  const site = new URL(siteUrl);
  return parseLocs(xml, site).filter((value) => {
    try {
      const url = new URL(value);
      return url.origin === site.origin && /\/post-sitemap\d*\.xml\/?$/i.test(url.pathname);
    } catch { return false; }
  });
}

export function selectPostUrls(xml, siteUrl = DEFAULT_SITE) {
  const site = new URL(siteUrl);
  return parseLocs(xml, site).filter((value) => {
    try {
      const url = new URL(value);
      return url.origin === site.origin && url.pathname !== '/';
    } catch { return false; }
  });
}

export function sitemapUrlsFromRobots(robotsText, baseUrl = DEFAULT_SITE) {
  return unique(String(robotsText ?? '').split(/\r?\n/)
    .map((line) => line.match(/^\s*sitemap\s*:\s*(\S+)/i)?.[1] || '')
    .map((value) => {
      try { return new URL(value, baseUrl).href; } catch { return ''; }
    }));
}

/** Minimal robots evaluator for the wildcard group, including Allow precedence. */
export function robotsAllows(robotsText, targetUrl) {
  let wildcard = false;
  const rules = [];
  for (const rawLine of String(robotsText ?? '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const userAgent = line.match(/^user-agent\s*:\s*(.+)$/i);
    if (userAgent) {
      wildcard = userAgent[1].split(',').some((value) => value.trim() === '*');
      continue;
    }
    if (!wildcard) continue;
    const rule = line.match(/^(allow|disallow)\s*:\s*(.*)$/i);
    if (rule && rule[2]) rules.push({ allow: rule[1].toLowerCase() === 'allow', path: rule[2].trim() });
  }
  if (!rules.length) return true;
  const target = new URL(targetUrl);
  const pathAndQuery = target.pathname + target.search;
  const matched = rules
    .filter((rule) => pathAndQuery.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return !matched || matched.allow;
}

class RequestGate {
  constructor(intervalMs) {
    this.intervalMs = Math.max(0, intervalMs);
    this.nextAt = 0;
  }

  async waitTurn() {
    const now = Date.now();
    const turn = Math.max(now, this.nextAt);
    this.nextAt = turn + this.intervalMs;
    if (turn > now) await wait(turn - now);
  }
}

class FetchClient {
  constructor({ delayMs = DEFAULT_DELAY_MS, timeoutMs = DEFAULT_TIMEOUT_MS, userAgent = USER_AGENT } = {}) {
    this.timeoutMs = timeoutMs;
    this.userAgent = userAgent;
    this.gate = new RequestGate(delayMs);
  }

  async text(url, label = url) {
    let lastError;
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      await this.gate.waitTurn();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          headers: { accept: 'text/html,application/xml,text/xml;q=0.9,*/*;q=0.1', 'user-agent': this.userAgent },
          signal: controller.signal
        });
        const body = await response.text();
        if (response.ok) return { body, status: response.status, url: response.url || url };
        const error = new Error(label + ': HTTP ' + response.status);
        error.status = response.status;
        error.retryAfter = response.headers.get('retry-after') || '';
        throw error;
      } catch (error) {
        lastError = error;
        const status = Number(error?.status || 0);
        const retryable = !status || status === 408 || status === 429 || status >= 500;
        if (!retryable || attempt === RETRIES) throw error;
        const retryAfter = Number.parseFloat(error?.retryAfter || '');
        const backoff = Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 30000) : 500 * (2 ** (attempt - 1));
        await wait(backoff);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }
}

async function mapConcurrent(items, concurrency, worker, onDone = async () => {}) {
  let cursor = 0;
  let done = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      const item = items[index];
      let result;
      try { result = await worker(item, index); }
      catch (error) { result = { error: String(error?.message || error) }; }
      done++;
      await onDone({ done, total: items.length, item, result });
    }
  });
  await Promise.all(workers);
}

async function readJson(file, fallback = undefined) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) {
    if (fallback !== undefined && error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function atomicWrite(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp-' + process.pid;
  await writeFile(temporary, value, 'utf8');
  await rename(temporary, file);
}

async function saveJson(file, value) {
  await atomicWrite(file, JSON.stringify(value, null, 2) + '\n');
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

function option(args, name, fallback) {
  const inline = args.find((arg) => arg.startsWith(name + '='));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : fallback;
}

function positiveOption(args, name, fallback, minimum = 1) {
  const value = Number(option(args, name, fallback));
  return Number.isFinite(value) && value >= minimum ? Math.floor(value) : fallback;
}

function defaults() {
  const date = new Date().toISOString().slice(0, 10);
  return {
    site: DEFAULT_SITE,
    output: path.join(RAW_DIR, 'thuviencine-' + date + '.txt'),
    state: path.join(SECRET_DIR, 'thuviencine-crawl-state.json'),
    report: path.join(SECRET_DIR, 'thuviencine-crawl-report.json'),
    manifest: SOURCES_FILE,
    concurrency: DEFAULT_CONCURRENCY,
    delayMs: DEFAULT_DELAY_MS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    limit: 0,
    fresh: false,
    register: true,
    allowPartial: false
  };
}

function parseOptions(args) {
  const base = defaults();
  const site = new URL(option(args, '--site', base.site));
  site.hash = '';
  site.pathname = site.pathname.replace(/\/+$/, '') + '/';
  return {
    ...base,
    site: site.href,
    output: path.resolve(option(args, '--output', base.output)),
    state: path.resolve(option(args, '--state', base.state)),
    report: path.resolve(option(args, '--report', base.report)),
    manifest: path.resolve(option(args, '--manifest', base.manifest)),
    concurrency: positiveOption(args, '--concurrency', base.concurrency),
    delayMs: positiveOption(args, '--delay-ms', base.delayMs, 0),
    timeoutMs: positiveOption(args, '--timeout-ms', base.timeoutMs),
    limit: positiveOption(args, '--limit', base.limit, 1) || 0,
    fresh: args.includes('--fresh'),
    register: !args.includes('--no-register'),
    allowPartial: args.includes('--allow-partial')
  };
}

async function discoverPosts(client, siteUrl) {
  let robotsText = '';
  try {
    robotsText = (await client.text(new URL('robots.txt', siteUrl).href, 'robots.txt')).body;
  } catch (error) {
    out('robots.txt unavailable (' + error.message + '); continuing with sitemap discovery.');
  }
  if (robotsText && !robotsAllows(robotsText, siteUrl)) {
    throw new Error('robots.txt disallows crawling ' + siteUrl);
  }

  const candidates = unique([
    ...sitemapUrlsFromRobots(robotsText, siteUrl),
    new URL('sitemap_index.xml', siteUrl).href,
    new URL('sitemap.xml', siteUrl).href
  ]);
  let lastError;
  for (const sitemapUrl of candidates) {
    let document;
    try { document = await client.text(sitemapUrl, sitemapUrl); }
    catch (error) { lastError = error; continue; }
    const postMaps = selectPostSitemaps(document.body, siteUrl);
    if (postMaps.length) {
      const postDocuments = [];
      for (const postMap of postMaps) {
        try { postDocuments.push((await client.text(postMap, postMap)).body); }
        catch (error) { throw new Error('Could not read ' + postMap + ': ' + error.message); }
      }
      const postUrls = unique(postDocuments.flatMap((xml) => selectPostUrls(xml, siteUrl)));
      if (postUrls.length) return { sitemapUrl: document.url || sitemapUrl, postMaps, postUrls };
    } else if (/<urlset\b/i.test(document.body)) {
      const postUrls = selectPostUrls(document.body, siteUrl);
      if (postUrls.length) return { sitemapUrl: document.url || sitemapUrl, postMaps: [document.url || sitemapUrl], postUrls };
    }
  }
  throw lastError || new Error('No post sitemap with movie URLs was found.');
}

function stateFor(siteUrl) {
  return {
    version: STATE_VERSION,
    site: siteUrl,
    updatedAt: new Date().toISOString(),
    sitemapUrl: '',
    postMaps: [],
    discoveredPostUrls: [],
    movieUrls: [],
    movies: {},
    downloadUrls: [],
    downloads: {}
  };
}

function usableState(value, siteUrl) {
  return value?.version === STATE_VERSION && value.site === siteUrl
    && value.movies && typeof value.movies === 'object'
    && value.downloads && typeof value.downloads === 'object'
    ? value
    : stateFor(siteUrl);
}

async function registerSource(file, manifestFile, siteUrl) {
  const relativeRaw = path.relative(RAW_DIR, file).replaceAll(path.sep, '/');
  if (!relativeRaw || relativeRaw.startsWith('../') || path.isAbsolute(relativeRaw)) {
    throw new Error('Cannot register output outside ' + relative(RAW_DIR) + ': ' + file);
  }
  const manifest = await readJson(manifestFile, { version: 1, sources: {} });
  manifest.version ||= 1;
  manifest.sources ||= {};
  manifest.sources[relativeRaw] = { originUrl: siteUrl };
  await saveJson(manifestFile, manifest);
}

function progressLogger(stage, state, saveState) {
  let lastLogAt = 0;
  return async ({ done, total }) => {
    const now = Date.now();
    if (done === 1 || done === total || done % CHECKPOINT_EVERY === 0 || now - lastLogAt >= 10000) {
      lastLogAt = now;
      out(stage + ': ' + done + '/' + total);
    }
    if (done % CHECKPOINT_EVERY === 0 || done === total) {
      state.updatedAt = new Date().toISOString();
      await saveState();
    }
  };
}

export async function crawl(options = {}) {
  const config = { ...defaults(), ...options };
  config.output = path.resolve(config.output);
  config.state = path.resolve(config.state);
  config.report = path.resolve(config.report);
  config.manifest = path.resolve(config.manifest);
  const siteUrl = new URL(config.site).href;
  const client = new FetchClient(config);
  let state = config.fresh ? stateFor(siteUrl) : usableState(await readJson(config.state, null), siteUrl);
  const saveState = async () => saveJson(config.state, state);

  out('Discovering post sitemap for ' + siteUrl);
  const discovery = await discoverPosts(client, siteUrl);
  const allMovieUrls = discovery.postUrls;
  const movieUrls = config.limit ? allMovieUrls.slice(0, config.limit) : allMovieUrls;
  state.sitemapUrl = discovery.sitemapUrl;
  state.postMaps = discovery.postMaps;
  state.discoveredPostUrls = allMovieUrls;
  state.movieUrls = movieUrls;
  await saveState();
  out('Found ' + allMovieUrls.length + ' post URL(s); crawling ' + movieUrls.length + '.');

  const pendingMovies = movieUrls.filter((url) => !state.movies[url]?.ok);
  await mapConcurrent(pendingMovies, config.concurrency, async (url) => {
    let result;
    try {
      const document = await client.text(url, url);
      result = {
        ok: true,
        url,
        title: extractPageTitle(document.body) || titleFromUrl(url),
        downloads: extractDownloadUrls(document.body, document.url || url, siteUrl),
        status: document.status,
        error: ''
      };
    } catch (error) {
      result = { ok: false, url, title: titleFromUrl(url), downloads: [], error: String(error?.message || error) };
    }
    state.movies[url] = result;
    return result;
  }, progressLogger('movie pages', state, saveState));

  state.downloadUrls = unique(movieUrls.flatMap((url) => state.movies[url]?.downloads || []));
  await saveState();
  const pendingDownloads = state.downloadUrls.filter((url) => !state.downloads[url]?.ok);
  out('Found ' + state.downloadUrls.length + ' unique download page(s).');

  await mapConcurrent(pendingDownloads, config.concurrency, async (url) => {
    let result;
    try {
      const document = await client.text(url, url);
      result = {
        ok: true,
        url,
        links: extractFshareLinksFromHtml(document.body),
        status: document.status,
        error: ''
      };
    } catch (error) {
      result = { ok: false, url, links: [], error: String(error?.message || error) };
    }
    state.downloads[url] = result;
    return result;
  }, progressLogger('download pages', state, saveState));

  const movieFailures = movieUrls
    .map((url) => state.movies[url])
    .filter((result) => !result?.ok)
    .map((result) => ({ url: result?.url, error: result?.error || 'unknown error' }));
  const downloadFailures = state.downloadUrls
    .map((url) => state.downloads[url])
    .filter((result) => !result?.ok)
    .map((result) => ({ url: result?.url, error: result?.error || 'unknown error' }));
  const moviesWithoutDownloads = movieUrls.filter((url) => !(state.movies[url]?.downloads || []).length);
  const associations = [];
  for (const url of movieUrls) {
    const movie = state.movies[url];
    for (const downloadUrl of movie?.downloads || []) {
      for (const link of state.downloads[downloadUrl]?.links || []) {
        associations.push({ title: movie.title || titleFromUrl(url), link });
      }
    }
  }
  const raw = associations.length
    ? associations.map(({ title, link }) => cleanText(title) + ' ' + link).join('\n') + '\n'
    : '';
  const report = {
    version: STATE_VERSION,
    site: siteUrl,
    crawledAt: new Date().toISOString(),
    sitemapUrl: state.sitemapUrl,
    postSitemaps: state.postMaps,
    counts: {
      discoveredPostUrls: allMovieUrls.length,
      moviePages: movieUrls.length,
      downloadPages: state.downloadUrls.length,
      moviesWithoutDownloads: moviesWithoutDownloads.length,
      movieFailures: movieFailures.length,
      downloadFailures: downloadFailures.length,
      fshareAssociations: associations.length,
      uniqueFshareLinks: new Set(associations.map(({ link }) => link)).size
    },
    failures: { moviePages: movieFailures, downloadPages: downloadFailures },
    complete: movieFailures.length === 0 && downloadFailures.length === 0 && associations.length > 0
  };
  await saveJson(config.report, report);
  await saveState();

  if (!report.complete && !config.allowPartial) {
    out('Crawl incomplete; raw output was not written. Report: ' + relative(config.report));
    if (!associations.length) out('No Fshare link was found yet. Re-run to retry the checkpointed pages.');
    else out(associations.length + ' association(s) are available, but every failed page must be retried before ingest.');
    return report;
  }

  await atomicWrite(config.output, raw);
  if (config.register) await registerSource(config.output, config.manifest, siteUrl);
  out('Wrote ' + associations.length + ' Fshare association(s) (' + report.counts.uniqueFshareLinks + ' unique) to ' + relative(config.output) + '.');
  if (moviesWithoutDownloads.length) out(moviesWithoutDownloads.length + ' post(s) had no /download link; see ' + relative(config.report) + '.');
  return report;
}

function usage() {
  out('Usage: node tools/crawl-thuviencine.mjs [--site URL] [--limit N] [--concurrency N] [--delay-ms N]');
  out('       [--output PATH] [--state PATH] [--report PATH] [--fresh] [--no-register] [--allow-partial]');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--help')) usage();
  else crawl(parseOptions(process.argv.slice(2)))
    .then((report) => { if (!report.complete) process.exitCode = 2; })
    .catch((error) => {
      process.stderr.write('crawl-thuviencine: ' + (error.stack || error.message || String(error)) + '\n');
      process.exitCode = 1;
    });
}
