/* The movie catalog's data model, shared by tools/fshare-movie.mjs (which
   builds and validates it) and the Movie tab (which reads the sealed
   projection). Pure: no DOM, no fetch, no state — so both sides agree on what
   a link id is, what makes two rows the same title, and what a status means.

   One row per Fshare link, never per title. The id is the stored key that a
   check result hangs off, exactly as item_id is for progress; two links that
   share a title stay two rows and are grouped by `titleKey` at read time, so a
   renamed title can never orphan a status. */

export const MOVIE_DB_URL = '/data/fshare-movie/catalog.enc.json';
export const CATALOG_VERSION = 1;

/* pending: never checked · live/dead: the last check said so · unknown: the
   last check could not tell (timeout, 5xx, proxy down). Only pending is a
   "no answer yet" — an unknown is a real answer that needs another attempt. */
export const STATUSES = ['pending', 'live', 'dead', 'unknown'];

const LINK_RE = /(?:https?:\/\/)?(?:www\.)?fshare\.vn\/(file|folder)\/([A-Za-z0-9]{4,})(?=[/?#\s,;"')]|$)/gi;

export const linkId = (kind, code) => `fshare-${kind}-${String(code).toUpperCase()}`;
export const linkUrl = (kind, code) => `https://www.fshare.vn/${kind}/${String(code).toUpperCase()}`;

/** Every distinct Fshare link in a piece of text, canonicalised. */
export function extractFshareLinks(value) {
  const links = [];
  const seen = new Set();
  const text = String(value ?? '');
  LINK_RE.lastIndex = 0;
  let match;
  while ((match = LINK_RE.exec(text))) {
    const kind = match[1].toLowerCase();
    const code = match[2].toUpperCase();
    const id = linkId(kind, code);
    if (seen.has(id)) continue;
    seen.add(id);
    links.push({ id, kind, code, link: linkUrl(kind, code) });
  }
  return links;
}

/** Lowercase, diacritics stripped, đ folded — the same folding search uses. */
export function fold(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi');
}

/**
 * What makes two rows "the same title". Leading list bullets (`- - `), release
 * punctuation (`.`, `_`, brackets) and a trailing file extension are noise;
 * the year is kept because `Dune (1984)` and `Dune (2021)` are different films.
 * Deliberately no quality-tag stripping: `1080p` vs `2160p` of one film are
 * near each other by sort already, and guessing further merges the wrong pair.
 */
export function titleKey(name) {
  return fold(name)
    .replace(/\.(mkv|mp4|avi|ts|m2ts|iso|srt|rar|zip)$/i, '')
    .replace(/^[\s\-–—·•*_.]+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Search tokens: every word of the folded query. */
export function queryTokens(value) {
  return fold(value).replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter(Boolean);
}

/** Stable, deduplicated tokens stored with a row for fast client-side search. */
export function keywordTokens(values) {
  const value = Array.isArray(values) ? values.join(' ') : values;
  return [...new Set(queryTokens(value))];
}

/** Bring a sealed projection into the shape the view renders. */
export function normalizeMovieDatabase(value) {
  if (!value || value.version !== CATALOG_VERSION || !Array.isArray(value.links)) {
    throw new Error('Movie catalog is missing or has an unsupported version');
  }
  return {
    version: value.version,
    sealedAt: value.sealedAt || null,
    validated: value.validated === true,
    counts: value.counts || {},
    sources: Array.isArray(value.sources) ? value.sources : [],
    links: value.links
      .filter((row) => row && row.kind && row.code)
      .map((row) => ({
        ...row,
        id: row.id || linkId(row.kind, row.code),
        link: row.link || linkUrl(row.kind, row.code),
        status: STATUSES.includes(row.status) ? row.status : 'pending',
        aliases: Array.isArray(row.aliases) ? row.aliases : [],
        keywords: Array.isArray(row.keywords)
          ? row.keywords
          : keywordTokens([row.name, ...(Array.isArray(row.aliases) ? row.aliases : []), row.path || '']),
        parents: Array.isArray(row.parents) ? row.parents : [],
        sourceIds: Array.isArray(row.sourceIds) ? row.sourceIds : [],
        titleKey: row.titleKey || titleKey(row.name)
      }))
  };
}

/** id → row, for walking parents. */
export function indexById(links) {
  return new Map((links || []).map((row) => [row.id, row]));
}

/**
 * The folder chain above a row, root first, as names. A file's place is its
 * `parents`; each parent is itself a row with parents, so the chain is walked
 * through the same map. Only the first parent is followed when a file was
 * seen in several folders — the others are counted, not drawn.
 */
export function folderChain(row, byId, limit = 8) {
  const names = [];
  const seen = new Set([row.id]);
  let cursor = row;
  while (cursor && cursor.parents && cursor.parents.length && names.length < limit) {
    const parent = byId.get(cursor.parents[0]);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    names.unshift(parent.name);
    cursor = parent;
  }
  return names;
}

/* One collator, not `localeCompare(…, "vi")` per comparison: the locale
   string form re-resolves the collation on every call, which is what made
   sorting an unfiltered catalog cost a second. */
const COLLATOR = new Intl.Collator('vi');

/**
 * The folded text a movie row is searched by. The folder names above a file
 * are part of what it is called — a reader searching "dune" expects
 * Dune.2021.mkv inside "Dune (2021)" to match even when the file itself is
 * named for its release group.
 */
export function movieHaystack(row, byId = null) {
  const chain = byId ? folderChain(row, byId) : [];
  return fold([row.name, ...(row.aliases || []), ...(row.keywords || []), row.code, row.path || '', ...chain].join(' '));
}

/**
 * Folded search text and sort key per row, computed once per unlock instead
 * of once per keystroke. `fold()` normalises and lowercases, and doing that
 * for 74k rows on every input event is what made typing stutter; with the
 * index a search is 74k `includes` calls, which is milliseconds. Keyed by row
 * identity so the rows themselves stay exactly what the envelope shipped.
 */
export function buildSearchIndex(links, haystack) {
  const hay = new Map();
  const nameKey = new Map();
  for (const row of links || []) {
    hay.set(row, haystack(row));
    nameKey.set(row, fold(row.name));
  }
  return { hay, nameKey };
}

/**
 * True when every row matching `next` also matched `prev`, so a view may
 * search the previous result set instead of the whole catalog. Each token is
 * a substring test, so the guarantee holds when every previous token is
 * contained in some next token — typing "dun" → "dune", or adding a word.
 * Deleting a character breaks it and the caller falls back to the full scan.
 */
export function narrowsSearch(prev, next) {
  const before = queryTokens(prev);
  if (!before.length) return true;
  const after = queryTokens(next);
  return before.every((token) => after.some((candidate) => candidate.includes(token)));
}

export function searchMovieLinks(links, query, { kind = 'all', status = 'all', sourceId = 'all', byId = null, index = null } = {}) {
  const tokens = queryTokens(query);
  const hayOf = (row) => (index && index.hay.get(row)) ?? movieHaystack(row, byId);
  return (links || []).filter((row) => {
    if (kind !== 'all' && row.kind !== kind) return false;
    if (status !== 'all' && row.status !== status) return false;
    if (sourceId !== 'all' && !(row.sourceIds || []).includes(sourceId)) return false;
    if (!tokens.length) return true;
    const haystack = hayOf(row);
    return tokens.every((token) => haystack.includes(token));
  });
}

/** Files grouped by the folder they sit in, so a result reads as a place, not a list. */
export function groupByFolder(links, byId, index = null) {
  const groups = new Map();
  const nameOf = (row) => (index && index.nameKey.get(row)) ?? fold(row.name);
  (links || []).forEach((row) => {
    const parentId = row.parents && row.parents.length ? row.parents[0] : '';
    const key = parentId || '(standalone)';
    let group = groups.get(key);
    if (!group) {
      // Every row in a group shares the parent, so the chain is walked once
      // per folder rather than once per file.
      const chain = folderChain(row, byId);
      group = { key, folder: parentId ? byId.get(parentId) || null : null, chain, links: [], sortKey: fold(chain.join(' / ')) };
      groups.set(key, group);
    }
    group.links.push(row);
  });
  // Sort keys are folded once per row, never inside the comparator.
  return [...groups.values()]
    .sort((a, b) => COLLATOR.compare(a.sortKey, b.sortKey))
    .map(({ sortKey, ...group }) => ({
      ...group,
      links: group.links
        .map((row) => [nameOf(row), row])
        .sort((a, b) => COLLATOR.compare(a[0], b[0]))
        .map((pair) => pair[1])
    }));
}

/** Rows that share a titleKey become one group, so two copies of one film sit together. */
export function groupByTitle(links) {
  const groups = new Map();
  (links || []).forEach((row) => {
    const key = row.titleKey || titleKey(row.name);
    let group = groups.get(key);
    if (!group) {
      group = { key, name: row.name, links: [] };
      groups.set(key, group);
    }
    group.links.push(row);
  });
  const byKind = { folder: 0, file: 1 };
  return [...groups.values()]
    .sort((a, b) => a.key.localeCompare(b.key, 'vi') || a.name.localeCompare(b.name, 'vi'))
    .map((group) => ({
      ...group,
      links: group.links.slice().sort((a, b) => (byKind[a.kind] - byKind[b.kind]) || a.code.localeCompare(b.code))
    }));
}

export function sourceName(sourceMap, sourceId) {
  return sourceMap.get(sourceId)?.name || sourceId;
}
