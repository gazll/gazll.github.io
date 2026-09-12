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

export function searchMovieLinks(links, query, { kind = 'all', status = 'all', sourceId = 'all', byId = null } = {}) {
  const tokens = queryTokens(query);
  return (links || []).filter((row) => {
    if (kind !== 'all' && row.kind !== kind) return false;
    if (status !== 'all' && row.status !== status) return false;
    if (sourceId !== 'all' && !(row.sourceIds || []).includes(sourceId)) return false;
    if (!tokens.length) return true;
    // The folder names above a file are part of what it is called — a reader
    // searching "dune" expects Dune.2021.mkv inside "Dune (2021)" to match
    // even when the file itself is named for its release group.
    const chain = byId ? folderChain(row, byId) : [];
    const haystack = fold([row.name, ...(row.aliases || []), ...(row.keywords || []), row.code, row.path || '', ...chain].join(' '));
    return tokens.every((token) => haystack.includes(token));
  });
}

/** Files grouped by the folder they sit in, so a result reads as a place, not a list. */
export function groupByFolder(links, byId) {
  const groups = new Map();
  (links || []).forEach((row) => {
    const chain = folderChain(row, byId);
    const parentId = row.parents && row.parents.length ? row.parents[0] : '';
    const key = parentId || '(standalone)';
    let group = groups.get(key);
    if (!group) {
      group = { key, folder: parentId ? byId.get(parentId) || null : null, chain, links: [] };
      groups.set(key, group);
    }
    group.links.push(row);
  });
  return [...groups.values()]
    .sort((a, b) => fold(a.chain.join(' / ')).localeCompare(fold(b.chain.join(' / ')), 'vi'))
    .map((group) => ({ ...group, links: group.links.slice().sort((a, b) => fold(a.name).localeCompare(fold(b.name), 'vi')) }));
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
