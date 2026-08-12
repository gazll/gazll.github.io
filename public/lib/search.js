/* Site-wide search over the three reading surfaces.

   There is no build step and no server, so the index is built in the browser
   from the data that is already loaded: Study Track content is in memory from
   startup, and the two Experience libraries are fetched on first search and
   then cached by their own data models. That is the whole reason this file
   holds no fetch of its own except the case-study article bodies.

   Two rules the rest of the file follows:

   1. `fold()` must not change a string's length. Snippet offsets are found in
      the folded text and applied to the original, so an NFD expansion (one
      character becoming three) would slice a highlight through the middle of
      a word. Folding is therefore per character, base letter only.
   2. An entry's `href` is a real route, never a reconstruction. Study Track
      items route by their stored item id and migrated deep dives route into
      the blueprint that owns them — the same two routes lib/cross-ref.js
      resolves, for the same reason: an item lives on exactly one surface. */
import { escapeHtml } from './markdown.js';
import { Content } from './content.js';
import { SystemDesign } from './system-design.js';
import { CaseStudies } from './case-studies.js';
import { questionHash, systemDesignQuestionHash } from './question-links.js';
import { TOPIC_TYPE_LABEL } from './constants.js';

/** Surface ids, in the order results are grouped. Labels are chrome — English. */
export const SURFACES = Object.freeze([
  { id: 'track', label: 'Study Track' },
  { id: 'system-design', label: 'System Design' },
  { id: 'case-studies', label: 'Case Studies' }
]);

const PRODUCTION_CATEGORY = 'systems-architecture';
const WORD = /[\p{L}\p{N}]/u;
const SPLIT = /[^\p{L}\p{N}]+/u;
const MAX_HITS_PER_TERM = 200;   // a pathological query must not walk 5k offsets

const pad2 = n => String(n).padStart(2, '0');

/* ---------------------------------------------------------------------
   Text preparation
--------------------------------------------------------------------- */

/**
 * Lowercase, strip Vietnamese diacritics, keep the length identical.
 *
 * Length matters: "đồng bộ" and "dong bo" must be the same 7 characters so a
 * match found in the folded copy can be highlighted in the original. Hence
 * per-character folding rather than `normalize('NFD').replace(...)`, which
 * would expand every accented letter into two or three code units.
 */
export function fold(text) {
  const source = String(text == null ? '' : text);
  let out = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const lower = ch.toLowerCase();
    // Some code points lowercase into two characters; keep the original then.
    const one = lower.length === 1 ? lower : ch;
    if (one === 'đ') { out += 'd'; continue; }
    const decomposed = one.normalize('NFD');
    out += decomposed.length > 1 ? decomposed[0] : one;
  }
  return out;
}

/**
 * Readable text out of an answer written for `renderMarkdown`.
 *
 * SVG goes first and whole: diagram labels are single words positioned by
 * coordinates, so they read as noise in a snippet. Entities are decoded after
 * tags are stripped, never before — `&lt;pid&gt;` is text the author wrote and
 * must survive as `<pid>`, not become a tag that the next rule deletes.
 */
export function plainText(markdown) {
  return String(markdown == null ? '' : markdown)
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&amp;/gi, '&')
    .replace(/^\s*:::(?:deep|tip|warn)\s*/gm, ' ')
    .replace(/^\s*:::\s*$/gm, ' ')
    .replace(/\[\[[rgob]:([^\]]+)\]\]/g, '$1')
    .replace(/```[a-z]*/gi, ' ')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, ' ')
    // Emphasis and code markers are removed, not spaced out: a space before
    // the "." of `` `jcmd`. `` would read as a typo in the snippet.
    .replace(/[*`]/g, '')
    .replace(/[|#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every string inside a nested guide/overview object, in declaration order. */
function flattenText(value, depth = 0) {
  if (value == null || depth > 4) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(item => flattenText(item, depth + 1));
  if (typeof value === 'object') return Object.values(value).flatMap(item => flattenText(item, depth + 1));
  return [];
}

const joinText = (...parts) => parts.flat().filter(Boolean).map(String).join(' · ');

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

function finalize(entry, order) {
  const tags = (entry.tags || []).filter(Boolean).map(String);
  const body = entry.body || '';
  return {
    ...entry,
    order,
    tags,
    body,
    titleFold: fold(entry.title || ''),
    contextFold: fold(entry.context || ''),
    tagFold: fold(tags.join(' ')),
    // The id joins the body so a pasted item id finds its own card.
    bodyFold: fold(entry.id ? body + ' ' + entry.id : body)
  };
}

/** Appends article text to an entry already in the index (see `enrich`). */
function extendBody(entry, extra) {
  if (!extra) return entry;
  entry.body = entry.body ? entry.body + ' ' + extra : extra;
  entry.bodyFold = fold(entry.id ? entry.body + ' ' + entry.id : entry.body);
  return entry;
}

/**
 * One flat list of everything a reader can open, in surface order.
 *
 * The models are parameters rather than imports-in-place so a test can build
 * an index from fixtures without a browser.
 */
export function buildEntries({
  content = Content,
  systemDesign = SystemDesign,
  caseStudies = CaseStudies
} = {}) {
  const entries = [];
  const push = entry => { entries.push(finalize(entry, entries.length)); };

  for (const topic of content.topics || []) {
    const num = pad2(topic.n);
    const ids = (topic.sections || []).flatMap(section => (section.items || []).map(item => item.id));
    push({
      key: 'topic:' + (topic.key || num),
      surface: 'track',
      kind: 'topic',
      title: topic.title || topic.label || '',
      // A topic has no route of its own, so it opens at its first card — which
      // is what selects the topic in the track view.
      href: ids.length ? questionHash(ids[0]) : '#/track',
      context: joinText('Topic ' + num, topic.label, TOPIC_TYPE_LABEL[topic.topic_type] || topic.topic_type),
      badge: 'Topic ' + num,
      topicType: topic.topic_type,
      tags: topic.tags,
      body: joinText(topic.intro, topic.label),
      weight: 14
    });

    for (const section of topic.sections || []) {
      for (const item of section.items || []) {
        push({
          key: item.id,
          id: item.id,
          surface: 'track',
          kind: 'item',
          title: plainText(item.q),
          href: questionHash(item.id),
          context: joinText(num + ' ' + (topic.label || ''), plainText(section.title)),
          badge: 'Q' + (/\.q(\d+)$/.exec(item.id) || [, '?'])[1],
          topicType: topic.topic_type,
          difficulty: item.difficulty,
          body: plainText(item.a)
        });
      }
    }
  }

  const categoryLabel = (list, id) => (list || []).find(row => row.id === id)?.label || id;

  for (const design of systemDesign.designs || []) {
    push({
      key: 'design:' + design.slug,
      surface: 'system-design',
      kind: 'design',
      title: design.title || '',
      href: '#/system-design/' + encodeURIComponent(design.slug),
      context: joinText('Blueprint', categoryLabel(systemDesign.categories, design.category)),
      badge: 'Blueprint',
      tags: design.tags,
      body: joinText(design.excerpt, design.scope, design.functional, design.quality,
        design.capacity, design.data_model, design.stack, design.tradeoffs),
      weight: 12
    });

    // Migrated deep dives keep their item id, so they stay reachable by id and
    // land on the blueprint that owns them rather than on the track.
    for (const note of design.sourceNotes || []) {
      push({
        key: note.id,
        id: note.id,
        surface: 'system-design',
        kind: 'item',
        title: plainText(note.q),
        href: systemDesignQuestionHash(design.slug, note.id),
        context: joinText('Deep dive', design.title),
        badge: 'Q' + (/\.q(\d+)$/.exec(note.id) || [, '?'])[1],
        body: plainText(note.a)
      });
    }
  }

  for (const article of systemDesign.cases || []) {
    const overview = systemDesign.caseOverview ? systemDesign.caseOverview(article.slug) : null;
    push({
      key: 'production:' + article.slug,
      surface: 'system-design',
      kind: 'case',
      title: article.title || '',
      href: '#/system-design/case/' + encodeURIComponent(article.slug),
      context: joinText('Production case', article.company),
      badge: 'Case',
      tags: article.tags,
      body: joinText(article.excerpt, flattenText(overview), flattenText(article.guide)),
      article,
      weight: 10
    });
  }

  for (const article of caseStudies.articles || []) {
    // The architecture category is presented as production evidence in System
    // Design; indexing it twice would offer the reader two doors to one room.
    if (article.category === PRODUCTION_CATEGORY) continue;
    push({
      key: 'case:' + article.slug,
      surface: 'case-studies',
      kind: 'case',
      title: article.title || '',
      href: '#/case-studies/' + encodeURIComponent(article.slug),
      context: joinText(article.category_label, article.company),
      badge: 'Case ' + pad2(article.n),
      tags: article.tags,
      body: joinText(article.excerpt, flattenText(article.guide)),
      article,
      weight: 10
    });
  }

  return entries;
}

/** Ranked matches, best first. `limit` caps the list, not the count. */
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
      ...hit,
      titleHtml: markText(hit.entry.title, parsed.terms, { folded: hit.entry.titleFold }),
      snippet: buildSnippet(hit.entry, parsed.terms)
    }))
  };
}

/* ---------------------------------------------------------------------
   Lifecycle

   Built once per language and thrown away when the header switch flips —
   `Content.topics` is rebuilt there, so every cached string would be stale.
--------------------------------------------------------------------- */

export const SearchIndex = {
  entries: [],
  lang: null,
  ready: false,
  /** True once the archived case-study articles have been folded in. */
  enriched: false,
  _building: null,
  _enriching: null,

  /** Loads whatever is missing, then returns the entries for `lang`. */
  async ensure(lang = null) {
    const want = lang || Content.lang;
    if (this.ready && this.lang === want) return this.entries;
    if (this._building && this.lang === want) return this._building;

    this.lang = want;
    this.ready = false;
    this.enriched = false;
    this._enriching = null;
    this._building = (async () => {
      // A library that will not load must not take the whole search with it:
      // the Study Track is already in memory and is most of the material.
      try {
        await SystemDesign.load(want);
      } catch (error) {}
      try {
        this.entries = buildEntries();
        this.ready = true;
      } finally {
        // Cleared either way, so a failed build can be retried rather than
        // handing every later caller the same rejected promise.
        this._building = null;
      }
      return this.entries;
    })();
    return this._building;
  },

  /**
   * Second pass: the archived case-study articles, ~200KB per language.
   *
   * Deliberately not part of `ensure()` — waiting on eleven HTML files before
   * showing the first result would make every search feel broken. Callers
   * re-run their query when this resolves.
   */
  async enrich() {
    if (this.enriched) return this.entries;
    if (this._enriching) return this._enriching;
    this._enriching = (async () => {
      await Promise.all(this.entries.filter(entry => entry.article).map(async entry => {
        try {
          extendBody(entry, plainText(await CaseStudies.body(entry.article)));
        } catch (error) {}
      }));
      this.enriched = true;
      this._enriching = null;
      return this.entries;
    })();
    return this._enriching;
  },

  invalidate() {
    this.ready = false;
    this.enriched = false;
    this._building = null;
    this._enriching = null;
    this.entries = [];
  },

  search(query, options) {
    return searchEntries(this.entries, query, options);
  }
};

/* ---------------------------------------------------------------------
   Routes
--------------------------------------------------------------------- */

/** `#/search/<query>` — the full-results panel for one query. */
export function searchHash(query) {
  const trimmed = String(query == null ? '' : query).trim();
  return trimmed ? '#/search/' + encodeURIComponent(trimmed) : '#/search';
}

/** The query carried by a `#/search/…` route; '' when there is none. */
export function queryFromRoute(routeParts) {
  if (!Array.isArray(routeParts) || !routeParts.length) return '';
  try {
    return decodeURIComponent(routeParts.join('/')).trim();
  } catch (error) {
    return '';
  }
}
