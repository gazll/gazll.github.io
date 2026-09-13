/* The X dataset contract. It is deliberately a different envelope kind and
   URL from the Movie catalog, even though both use the same link primitives. */

import { keywordTokens, linkId, linkUrl, queryTokens, titleKey, fold } from './movie-db.js';

export const X_DB_URL = '/data/fshare-x/catalog.enc.json';
export const X_CATALOG_VERSION = 1;
const X_STATUSES = new Set(['raw', 'live', 'dead', 'unknown']);

export function normalizeXDatabase(value) {
  if (!value || value.version !== X_CATALOG_VERSION || value.kind !== 'fshare-x-db' || !Array.isArray(value.links)) {
    throw new Error('The X catalog is missing or has an unsupported version');
  }
  return {
    version: value.version,
    catalogType: 'x',
    sealedAt: value.sealedAt || null,
    validated: false,
    checkedScope: value.checkedScope || 'raw-import',
    counts: value.counts || {},
    sources: Array.isArray(value.sources) ? value.sources : [],
    links: value.links
      .filter((row) => row && (row.kind === 'file' || row.kind === 'folder') && row.code)
      .map((row) => ({
        ...row,
        id: row.id || linkId(row.kind, row.code),
        link: row.link || linkUrl(row.kind, row.code),
        name: row.name || row.code,
        aliases: Array.isArray(row.aliases) ? row.aliases : [],
        keywords: Array.isArray(row.keywords)
          ? row.keywords
          : keywordTokens([row.name, ...(Array.isArray(row.aliases) ? row.aliases : []), row.code]),
        sourceIds: Array.isArray(row.sourceIds) ? row.sourceIds : [],
        titleKey: row.titleKey || titleKey(row.name),
        status: X_STATUSES.has(row.status) ? row.status : 'raw'
      }))
  };
}

/** The folded text an X row is searched by; no folder chain, X is a flat index. */
export function xHaystack(row) {
  return fold([row.name, ...(row.aliases || []), ...(row.keywords || []), row.code].join(' '));
}

export function searchXLinks(links, query, { sourceId = 'all', index = null } = {}) {
  const tokens = queryTokens(query);
  const hayOf = (row) => (index && index.hay.get(row)) ?? xHaystack(row);
  return (links || []).filter((row) => {
    if (sourceId !== 'all' && !(row.sourceIds || []).includes(sourceId)) return false;
    if (!tokens.length) return true;
    const haystack = hayOf(row);
    return tokens.every((token) => haystack.includes(token));
  });
}
