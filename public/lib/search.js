/* Ranking, highlighting and snippets for site-wide search.

   The index itself is built at prerender time by
   `server/api/content/search-index.get.ts` and shipped as JSON, so this file
   owns no fetches and no data model — it turns a query plus that flat entry
   list into scored, highlighted results. (It used to build the index in the
   browser out of the client-side Content/SystemDesign/collection models; those
   models went with the Nuxt migration, and the half of this file that drove
   them went with them.)

   Two rules the rest of the file follows:

   1. `fold()` must not change a string's length. Snippet offsets are found in
      the folded text and applied to the original, so an NFD expansion (one
      character becoming three) would slice a highlight through the middle of
      a word. Folding is therefore per character, base letter only.
   2. An entry's `href` is a real route, never a reconstruction. It arrives on
      the entry from the index builder, which knows whether a Study Track item
      still lives on the track or has moved into the blueprint that owns it. */
import { escapeHtml } from './markdown.js';
/* fold() and plainText() live in their own leaf module so the server can reuse
   them without importing this one. One implementation, re-exported here for
   every existing caller. */
import { fold, plainText } from './search-text.js';
export { fold, plainText };

/** Surface ids, in the order results are grouped. Labels are chrome — English. */
export const SURFACES = Object.freeze([
  { id: 'track', label: 'Study Track' },
  { id: 'system-design', label: 'System Design' },
  { id: 'case-studies', label: 'Case Studies' },
  { id: 'photography', label: 'Photography' },
  { id: 'homelab', label: 'NAS / Home Server' }
]);

const WORD = /[\p{L}\p{N}]/u;
const SPLIT = /[^\p{L}\p{N}]+/u;
const MAX_HITS_PER_TERM = 200;   // a pathological query must not walk 5k offsets

/* ---------------------------------------------------------------------
   Query
--------------------------------------------------------------------- */

/** `{ raw, phrase, terms }` — terms are AND-ed, the phrase only adds score. */
export function parseQuery(query) {
  const raw = String(query == null ? '' : query).trim();
  const phrase = fold(raw).replace(/\s+/g, ' ').trim();
  const all = [...new Set(phrase.split(SPLIT).filter(Boolean))];
  // Single letters match everything, so they are dropped — unless dropping
  // them would leave nothing to search for ("q3" is two, "5" is one).
  const terms = all.filter(term => term.length > 1);
  return { raw, phrase, terms: terms.length ? terms : all };
}

/** First index, total count and whether any hit starts a word. */
function countTerm(hay, term) {
  let at = hay.indexOf(term);
  if (at < 0) return null;
  const first = at;
  let count = 0;
  let boundary = false;
  while (at >= 0 && count < MAX_HITS_PER_TERM) {
    count++;
    if (!boundary && (at === 0 || !WORD.test(hay[at - 1]))) boundary = true;
    at = hay.indexOf(term, at + term.length);
  }
  return { first, count, boundary };
}

/* A word-start hit is worth roughly twice a mid-word one: "log" inside
   "dialog" is a coincidence, "log" starting a word is the subject.

   `strict` drops mid-word hits entirely, and only short terms use it. A
   Vietnamese syllable is two or three letters — "bộ" folds to "bo", which
   appears inside a hundred unrelated English words, so counting those turns
   every two-syllable Vietnamese query into a list of accidents. */
function fieldScore(hay, term, base, strict) {
  const hit = hay ? countTerm(hay, term) : null;
  if (!hit || (strict && !hit.boundary)) return 0;
  return base * (hit.boundary ? 1 : 0.5) + Math.min(hit.count - 1, 3) * base * 0.12;
}

/** Score for one entry, or 0 when any term is missing (AND semantics). */
export function scoreEntry(entry, { phrase, terms }) {
  if (!terms.length) return 0;
  let score = 0;
  for (const term of terms) {
    const strict = term.length <= 2;
    const termScore = fieldScore(entry.titleFold, term, 60, strict)
      + fieldScore(entry.tagFold, term, 26, strict)
      + fieldScore(entry.contextFold, term, 14, strict)
      + fieldScore(entry.bodyFold, term, 9, strict);
    if (!termScore) return 0;
    score += termScore;
  }
  // A phrase says the words belong together; scattered terms do not.
  if (phrase.includes(' ')) {
    if (entry.titleFold.includes(phrase)) score += 70;
    if (entry.bodyFold.includes(phrase)) score += 22;
  }
  if (entry.titleFold.startsWith(phrase)) score += 35;
  return score + (entry.weight || 0);
}

/* ---------------------------------------------------------------------
   Highlighting
--------------------------------------------------------------------- */

function rangesFor(folded, terms) {
  const ranges = [];
  for (const term of terms) {
    let at = folded.indexOf(term);
    let seen = 0;
    while (at >= 0 && seen < MAX_HITS_PER_TERM) {
      ranges.push([at, at + term.length]);
      seen++;
      at = folded.indexOf(term, at + term.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}

/**
 * `text[from,to)` as escaped HTML with every term wrapped in `<mark>`.
 * `folded` must be `fold(text)` — same length, so one index serves both.
 */
export function markText(text, terms, { folded = null, from = 0, to = null } = {}) {
  const source = String(text == null ? '' : text);
  const end = to == null ? source.length : Math.min(to, source.length);
  const start = Math.max(0, Math.min(from, end));
  const hay = folded == null ? fold(source) : folded;
  let html = '';
  let at = start;
  for (const [a, b] of rangesFor(hay.slice(start, end), terms)) {
    const open = a + start;
    const close = b + start;
    if (close <= at) continue;
    html += escapeHtml(source.slice(at, Math.max(open, at)))
      + '<mark>' + escapeHtml(source.slice(Math.max(open, at), close)) + '</mark>';
    at = close;
  }
  return html + escapeHtml(source.slice(at, end));
}

/** Window of body text around the strongest match, highlighted, with ellipses. */
export function buildSnippet(entry, terms, { radius = 100, width = 240 } = {}) {
  const body = entry.body || '';
  if (!body) return '';
  const hay = entry.bodyFold;

  // Longest term first: it is the most specific, so it frames the best window.
  const ordered = [...terms].sort((a, b) => b.length - a.length);
  let found = -1;
  for (const term of ordered) {
    const at = hay.indexOf(term);
    if (at >= 0) { found = at; break; }
  }

  let start = found < 0 ? 0 : Math.max(0, found - radius);
  if (start > 0) {
    const space = body.lastIndexOf(' ', start);
    start = space > 0 ? space + 1 : start;
  }
  let end = Math.min(body.length, start + width);
  if (end < body.length) {
    const space = body.indexOf(' ', end);
    end = space > 0 ? space : end;
  }

  return (start > 0 ? '… ' : '')
    + markText(body, terms, { folded: hay, from: start, to: end })
    + (end < body.length ? ' …' : '');
}

/* ---------------------------------------------------------------------
   The index
--------------------------------------------------------------------- */

/**
 * Fold one shipped index row for the language being read.
 *
 * The index carries both languages on every row so the header switch never
 * refetches; only the folded copies are per language, and they are what every
 * offset in a highlight is measured against.
 */
function finalize(entry, order, lang) {
  const title = (lang === 'vi' ? entry.vi : entry.en) || entry.en || '';
  const context = (lang === 'vi' ? entry.contextVi : entry.contextEn) || entry.contextEn || '';
  const body = (lang === 'vi' ? entry.bodyVi : entry.bodyEn) || entry.bodyEn || '';
  const tags = (entry.tags || []).filter(Boolean).map(String);
  return {
    ...entry,
    order,
    title,
    context,
    tags,
    body,
    titleFold: fold(title),
    contextFold: fold(context),
    tagFold: fold(tags.join(' ')),
    // The id joins the body so a pasted item id finds its own card.
    bodyFold: fold(entry.id ? body + ' ' + entry.id : body)
  };
}

/**
 * The shipped index, folded for one language and ordered by surface.
 *
 * Order is the tie-break inside a score, and it follows SURFACES so equally
 * strong hits list the way the groups read. Callers memoise this per language:
 * folding ~3k rows is cheap once and wasteful per keystroke.
 */
export function prepareEntries(entries, lang = 'en') {
  const rank = new Map(SURFACES.map((surface, index) => [surface.id, index]));
  const ordered = [...(entries || [])].map((entry, index) => ({ entry, index }));
  ordered.sort((a, b) =>
    (rank.get(a.entry.surface) ?? SURFACES.length) - (rank.get(b.entry.surface) ?? SURFACES.length)
    || a.index - b.index);
  return ordered.map((row, order) => finalize(row.entry, order, lang));
}

/** Scored, grouped-ready results plus per-surface counts for the filter bar. */
export function searchEntries(entries, query, { limit = 200, surface = 'all' } = {}) {
  const parsed = parseQuery(query);
  if (!parsed.terms.length) return { query: parsed, total: 0, results: [], counts: {} };

  const scored = [];
  const counts = {};
  for (const entry of entries) {
    const score = scoreEntry(entry, parsed);
    if (!score) continue;
    counts[entry.surface] = (counts[entry.surface] || 0) + 1;
    if (surface !== 'all' && entry.surface !== surface) continue;
    scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.order - b.entry.order);

  return {
    query: parsed,
    total: scored.length,
    counts,
    results: scored.slice(0, limit).map(hit => ({
      ...hit.entry,
      score: hit.score,
      titleHtml: markText(hit.entry.title, parsed.terms, { folded: hit.entry.titleFold }),
      snippet: buildSnippet(hit.entry, parsed.terms)
    }))
  };
}
