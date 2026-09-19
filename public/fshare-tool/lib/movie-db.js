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

/** Lowercase, diacritics stripped, đ folded — the same folding search uses.
    81% of names are plain ASCII and skip the normalize; plain toLowerCase()
    is identical to the 'vi' locale (only tr/az/lt lowercase differently) and
    twice as fast. Measured on 113k names: 305ms → 137ms per pass, and this
    runs several times per row at unlock. */
const ASCII = /^[\x00-\x7f]*$/;
export function fold(value) {
  const text = String(value || '');
  return (ASCII.test(text)
    ? text
    : text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  ).toLowerCase();
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

/* What content a link actually is — not every Fshare share in these sources
   is a movie. `movie`/`software`/`music` split the one Movie tab into three,
   without touching the crawl/validate pipeline, which does not care what a
   link contains. Extension is decisive where a file carries one — the video
   and audio containers below cover 99%+ of the 2026-09-18 catalog and never
   collide with a title. Only the extension-less remainder (folders, .iso/
   .rar/.zip wrappers, bare titles) falls to name markers, and those are
   tuned for PRECISION over recall against that same catalog: bare, common
   English words ("action", "driver", "portable") matched real film titles
   (Taxi Driver, Missing in Action, The Portable Door) and were dropped —
   a real movie missing from the Movie tab is worse than a software/music
   link staying put. A generic marker present in all three ("remastered")
   was dropped the same way after it tagged "Spider-Man Remastered" as
   music. "crack" keeps only its bare form for the same reason: it still
   catches "Crack.rar" and "-CRACKFIX-CPY" but a word-boundary match already
   excludes "cracked" on its own (no boundary between "crack" and the "ed"
   that follows) — kept that way on purpose after "Vết Nứt Ám Hồn Trong
   Tranh - Cracked 2022", a real film, showed up tagged software during a
   post-seal audit. Unmarked and ambiguous rows default to `movie`, the
   majority case. */
export const CATEGORIES = ['movie', 'software', 'music'];
const VIDEO_EXT = new Set(['mkv', 'mp4', 'avi', 'ts', 'm2ts', 'wmv', 'mov', 'flv', 'rmvb', 'vob', 'mpg', 'mpeg', 'm4v', 'divx', 'webm', '3gp']);
const AUDIO_EXT = new Set(['mp3', 'flac', 'wav', 'm4a', 'wma', 'aac', 'dsf', 'ogg', 'ape', 'alac', 'opus']);
const APP_EXT = new Set(['exe', 'msi', 'apk', 'dmg', 'appimage', 'deb', 'ipa']);
const MOVIE_MARKERS = /\b(1080p|2160p|720p|480p|4k|uhd|bluray|blu-ray|web-?dl|webrip|hdtv|hdrip|dvdrip|remux|x264|x265|h\.?26[45]|hevc|dts(-hd)?|ddp\d?|atmos|complete|iqiyi|netflix|nf\.web|amzn|s\d{2}e\d{2})\b/i;
const SOFTWARE_MARKERS = /-(codex|skidrow|reloaded|cpy|plaza|hoodlum|tenoke|rune|flt|razor1911|prophet|gog|darksiders)\b|\b(crackfix|full\s?crack|keygen|activator|repack|multilingual|ph[aầ]n\s?m[eề]m|setup|installer|incl\.?\s?dlc|adobe|photoshop|premiere\s?pro|illustrator|autocad|solidworks|sketchup|revit|vmware|windows\s?(7|8|10|11)|microsoft|antivirus|kaspersky|\bidm\b|winrar|plugin|overlays?|presets?|crack)\b/i;
const MUSIC_MARKERS = /\b(flac|wav|ost|soundtrack|lossless|karaoke|hi-res|accuraterip|vinyl|24bit|96khz|cd\d|tncd\d+|lvcd\d+|asia\d+cd\d+)\b/i;

function extOf(name) {
  const match = /\.([a-z0-9]{2,8})$/i.exec(String(name || '').trim());
  return match ? match[1].toLowerCase() : '';
}

export function categoryOf(name) {
  const ext = extOf(name);
  if (VIDEO_EXT.has(ext)) return 'movie';
  if (AUDIO_EXT.has(ext)) return 'music';
  if (APP_EXT.has(ext)) return 'software';
  const text = String(name || '');
  if (MOVIE_MARKERS.test(text)) return 'movie';
  if (SOFTWARE_MARKERS.test(text)) return 'software';
  if (MUSIC_MARKERS.test(text)) return 'music';
  return 'movie';
}

/* Adult content shares the same crawled sources as everything else and does
   not get its own `category` — it belongs in the separate X dataset
   (public/fshare-tool/lib/x-db.js), not the Movie/Software/Music split
   above, so `tools/fshare-movie.mjs move-to-x` uses this to pull matching
   rows out of the movie catalog entirely (see docs/fshare-x-playbook.md's
   "moved-from-movie" transfer file). Studio/site names are the strongest,
   least ambiguous signal; explicit acts are next; a bare "xxx" is weakest
   and excluded by name for the one franchise that spells its title that way.
   SERIES_GUARD and KNOWN_TITLE_EXCLUDE exist because real titles collide
   with adult vocabulary more than any of the movie/software/music markers
   did: "Stepmom (1998)", "Hardcore Henry (2015)", the Korean dramas
   "Mischievous Kiss" ("...Little Vixen") and literally titled "Threesome"
   (season/episode numbering, guarded), the anime "Swallowed Star", the
   Netflix show "The End of the F***ing World", and the films "Orgasm Inc",
   "The Year I Started Masturbating" and "Don't Fuck in the Woods" — each
   found by checking real hits against the 2026-09-18 catalog, not guessed.
   `hardcore`, `stepmom/-sis/-dad/-bro`, bare `vixen` and `swallowed` were
   dropped as markers entirely rather than special-cased, since normal
   English usage of them is common and a false positive here means a real
   title silently vanishes from the Movie tab. A folder is worse again —
   `strict` below exists because one folder's meaningless "XXX" ("- - Paris
   by night Clollection 001 - XXX Update") would otherwise have cascaded
   `move-to-x` onto every real Paris By Night disc inside it. */
const ADULT_STUDIO_MARKERS = /\b(intheCrack|wowgirls|blacked(raw)?|tushy(raw)?|realitykings|reality[ .]kings|bangbros|digitalplayground|digital[ .]playground|marc[ .]dorcel|wickedpictures|evilangel|evil[ .]angel|metart|nubilefilms|nubile[ .]films|babes\.com|momsfamilysecrets|handsonhardcore|naughtyamerica|naughty[ .]america|brazzers|mofos|bangbus|teamskeet|povperv|myfamilypies|familystrokes|deeplush|pervmom|pervtherapy|21sextury|allanal|analvids|facialabuse|littlecaprice|clubseventeen|femjoy|watch4beauty|hegre|joymii|onlyfans|manyvids|thothub|elegantangel|newsensations|defloration|cum4k|dorcel|brattysis|teenslikeitbig|sexselector)\b/i;
const ADULT_EXPLICIT_MARKERS = /\b(blowjob|creampie|gangbang|deepthroat|cumshot|masturbat(e|ing|ion)?|orgasm|fuck(ed|ing)?|jerk(ed|ing)?\s?off)\b/i;
const ADULT_VIXEN_DATED = /vixen\.com|\bvixen\b[.\s-]*\d{2,4}[.\-]\d{2}[.\-]\d{2}/i;
const ADULT_XXX_MARKER = /\bxxx\b/i;
const ADULT_XXX_EXCLUDE = /xander[.\s]?cage|xxx[.\s]*:?[.\s]*state[.\s]+of[.\s]+the[.\s]+union/i;
const SERIES_GUARD = /\bs\d{2}e\d{2}\b|\bseason\s?\d+\b|\bphần\s?\d+\b|\btập\s?\d+\b/i;
const KNOWN_TITLE_EXCLUDE = /orgasm[.\s]inc|year[.\s]i[.\s]started[.\s]masturbating|young[.\s]people[.\s]fucking|don.?t[.\s]+fuck[.\s]+in[.\s]+the[.\s]+woods|end[.\s]of[.\s]the[.\s]f\S*ing[.\s]world|swallowed[.\s]star|swallowed[.\s]the[.\s]sun/i;

/**
 * A folder is a much bigger blast radius than a file: `move-to-x` cascades a
 * matched folder onto every row under it (see the comment above), so a bare
 * "XXX" false positive on a folder drags real content down with it — found
 * on a real folder, "- - Paris by night Clollection 001 - XXX Update", whose
 * "XXX" meant nothing but held nothing but legitimate Paris By Night discs.
 * `strict: true` (used for folders) drops that weakest signal and asks for a
 * studio/site name or an explicit act instead; a file keeps the full check.
 */
export function isAdultContent(name, { strict = false } = {}) {
  const text = String(name || '');
  if (KNOWN_TITLE_EXCLUDE.test(text) || SERIES_GUARD.test(text)) return false;
  if (ADULT_STUDIO_MARKERS.test(text)) return true;
  if (ADULT_EXPLICIT_MARKERS.test(text)) return true;
  if (ADULT_VIXEN_DATED.test(text)) return true;
  if (strict) return false;
  return ADULT_XXX_MARKER.test(text) && !ADULT_XXX_EXCLUDE.test(text);
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
        parents: Array.isArray(row.parents) ? row.parents : [],
        sourceIds: Array.isArray(row.sourceIds) ? row.sourceIds : [],
        titleKey: row.titleKey || titleKey(row.name),
        category: CATEGORIES.includes(row.category) ? row.category : 'movie'
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
  return ancestors(row, byId, limit).map((folder) => folder.name);
}

/** The folder rows above a row, root first. */
function ancestors(row, byId, limit = 8) {
  const chain = [];
  const seen = new Set([row.id]);
  let cursor = row;
  while (cursor && cursor.parents && cursor.parents.length && chain.length < limit) {
    const parent = byId.get(cursor.parents[0]);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    chain.unshift(parent);
    cursor = parent;
  }
  return chain;
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
/* No keyword list: every token of the name/aliases/path is already a
   substring of the folded name/aliases/path, so a per-row token array was
   a second copy of the same text — 17% of the catalog and ~2s of the unlock. */
export function movieHaystack(row, byId = null, aboveCache = null) {
  return fold([row.name, ...(row.aliases || []), row.code, row.path || '', aboveText(row, byId, aboveCache)].join(' '));
}

/* The folder names and aliases above a row — a folder's aliases count too:
   the Vietnamese title a source gave a folder is how a reader looks for the
   English-named files inside it. Rows under one folder share this text, so
   the index computes it once per parent, not once per file: 88k files sit
   under 25k folders, and this walk was most of the index build. */
function aboveText(row, byId, cache) {
  if (!byId) return '';
  const parentId = row.parents && row.parents.length ? row.parents[0] : '';
  if (!parentId) return '';
  if (cache && cache.has(parentId)) return cache.get(parentId);
  const text = ancestors(row, byId).flatMap((folder) => [folder.name, ...(folder.aliases || [])]).join(' ');
  if (cache) cache.set(parentId, text);
  return text;
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
  const above = new Map();
  for (const row of links || []) {
    hay.set(row, haystack(row, above));
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

const sizeOf = (row) => Number.isFinite(Number(row?.size)) ? Number(row.size) : 0;

/* Numeric-aware: "Tập 2" before "Tập 10". A folder is read as its owner
   listed it — episodes, parts, discs — and that listing is in name order. */
const NAME_ORDER = new Intl.Collator('vi', { numeric: true });

/**
 * Name order, then size, then code — the order inside one folder. It was
 * size first, which shuffled a 29-episode folder into a random-looking
 * list; the sizes of one film's versions still sit together because those
 * rows share a name stem, and size only breaks the tie between equal names.
 */
export function sortMovieRows(rows, nameOf = (row) => fold(row.name)) {
  return (rows || [])
    .map((row) => [nameOf(row), sizeOf(row), String(row.code || ''), row])
    .sort((a, b) => NAME_ORDER.compare(a[0], b[0]) || a[1] - b[1] || a[2].localeCompare(b[2]))
    .map((pair) => pair[3]);
}

/**
 * The rows a query matches, in catalog order and nothing else: a one-letter
 * query matches 60k of 88k files, and sorting those to show 150 was what
 * made the first keystroke stall. Every token must be a substring of the
 * row's folded haystack (name, aliases, code, path, the folders above it).
 */
export function matchMovieLinks(links, query, { kind = 'all', status = 'all', sourceId = 'all', category = 'all', byId = null, index = null } = {}) {
  const tokens = queryTokens(query);
  const hayOf = (row) => (index && index.hay.get(row)) ?? movieHaystack(row, byId);
  return (links || []).filter((row) => {
    if (kind !== 'all' && row.kind !== kind) return false;
    if (status !== 'all' && row.status !== status) return false;
    if (category !== 'all' && (row.category || 'movie') !== category) return false;
    if (sourceId !== 'all' && !(row.sourceIds || []).includes(sourceId)) return false;
    if (!tokens.length) return true;
    const haystack = hayOf(row);
    return tokens.every((token) => haystack.includes(token));
  });
}

export function searchMovieLinks(links, query, options = {}) {
  const nameOf = (row) => (options.index && options.index.nameKey.get(row)) ?? fold(row.name);
  return sortMovieRows(matchMovieLinks(links, query, options), nameOf);
}

/**
 * Matches grouped under their holding folder, groups ordered by how well the
 * folder answers the query: a folder whose own name or alias carries every
 * token first (the film was filed under that name), then folders where some
 * token is in the folder, then folders reached only through a file's own
 * name or a grandparent; ties by name, and with no query plain name order —
 * the browse view. Only the ORDER OF GROUPS is decided here: a group's rows
 * are sorted by the caller for the groups it renders (sortMovieRows),
 * so a query matching 8k folders costs one pass and one 8k-element sort.
 */
export function rankFolderGroups(matches, query, byId, index = null) {
  const tokens = queryTokens(query);
  const nameOf = (row) => (index && index.nameKey.get(row)) ?? fold(row.name);
  const groups = new Map();
  for (const row of matches || []) {
    const parentId = row.parents && row.parents.length ? row.parents[0] : '';
    let group = groups.get(parentId);
    if (!group) {
      const folder = parentId && byId ? byId.get(parentId) || null : null;
      group = { key: parentId || '(standalone)', folder, links: [], score: 0, nameKey: folder ? nameOf(folder) : '' };
      groups.set(parentId, group);
    }
    group.links.push(row);
  }
  if (tokens.length) {
    for (const group of groups.values()) {
      const folderText = group.folder ? fold([group.folder.name, ...(group.folder.aliases || [])].join(' ')) : '';
      const inFolder = tokens.filter((token) => folderText.includes(token)).length;
      const byOwnName = group.links.some((row) => { const name = nameOf(row); return tokens.every((token) => name.includes(token)); });
      group.score = (inFolder === tokens.length ? 4 : inFolder ? 2 : 0) + (byOwnName ? 1 : 0);
    }
  }
  return [...groups.values()].sort((a, b) => b.score - a.score || COLLATOR.compare(a.nameKey, b.nameKey) || a.key.localeCompare(b.key));
}

/**
 * fold() for highlighting: the same folding, one output unit per input unit,
 * so an offset found in the folded text is the offset in the original.
 * fold() itself may not be used for this — NFKD turns "ế" into three units.
 */
export function foldAligned(text) {
  let out = '';
  for (const ch of String(text || '')) {
    let folded = ch === 'đ' || ch === 'Đ' ? 'd' : (ch.normalize('NFKD')[0] || ch).toLowerCase();
    if (folded.length !== ch.length) folded = ch;
    out += folded;
  }
  return out;
}

/** [start, end) ranges of every token in `text`, merged, for <mark>. */
export function matchRanges(text, tokens) {
  const folded = foldAligned(text);
  const ranges = [];
  for (const token of tokens || []) {
    if (!token) continue;
    let from = 0;
    while (from < folded.length) {
      const at = folded.indexOf(token, from);
      if (at < 0) break;
      ranges.push([at, at + token.length]);
      from = at + token.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push(range.slice());
  }
  return merged;
}

/** Files grouped by folder, with the smallest result first within each group. */
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
      links: sortMovieRows(group.links, nameOf)
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
