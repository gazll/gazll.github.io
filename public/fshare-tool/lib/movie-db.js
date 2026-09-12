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

export function searchMovieLinks(links, query, { kind = 'all', status = 'all', sourceId = 'all' } = {}) {
  const tokens = queryTokens(query);
  return (links || []).filter((row) => {
    if (kind !== 'all' && row.kind !== kind) return false;
    if (status !== 'all' && row.status !== status) return false;
    if (sourceId !== 'all' && !(row.sourceIds || []).includes(sourceId)) return false;
    if (!tokens.length) return true;
    const haystack = fold([row.name, ...(row.aliases || []), ...(row.keywords || []), row.code, row.path || ''].join(' '));
    return tokens.every((token) => haystack.includes(token));
  });
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
