/* Site-wide search: the index model and the recent-search history.

   Three things here are load-bearing and silent when they break:

   1. `fold()` must preserve length. It is the only reason a match found in the
      folded copy can be highlighted in the original — a drifting offset does
      not throw, it just slices `<mark>` through the middle of a word.
   2. An entry's href must be the route the item actually lives on. Study Track
      items route by stored item id; deep dives migrated into a blueprint route
      into that blueprint, never back onto the track.
   3. History belongs to whoever made it: `sessionStorage` while signed out,
      the account bucket once signed in, carried across exactly once. */
import assert from 'node:assert/strict';
import { test, before, after, beforeEach } from 'node:test';
import { mkdtempSync, cpSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const publicRoot = path.join(root, 'public');
const dataRoot = path.join(publicRoot, 'data');

const {
  fold, plainText, parseQuery, markText, buildSnippet, buildEntries,
  searchEntries, searchHash, queryFromRoute, SURFACES
} = await import(pathToFileURL(path.join(publicRoot, 'lib/search.js')).href);

/* ---------------------------------------------------------------------
   Fixtures
--------------------------------------------------------------------- */

const ITEM = '05-db-core-index-lock.indexes.q1';

const content = {
  lang: 'en',
  topics: [{
    n: 5,
    key: '05-db-core-index-lock',
    topic_type: 'data',
    label: 'Database Core',
    title: 'Database core, indexes and locking',
    intro: 'How B-trees, index selectivity and row locks decide a query plan.',
    tags: ['Index', 'Locking'],
    sections: [{
      title: 'Indexes &amp; plans',
      items: [
        {
          id: ITEM,
          difficulty: 'core',
          q: 'What is a **covering index**?',
          a: 'An index that answers the query from the index alone.\n\n<svg><text>btree</text></svg>\n\n'
            + 'Run `EXPLAIN` and look for `Using index`. Watch out for a wide `SELECT *`, which drops the covering property.'
        },
        {
          id: '05-db-core-index-lock.indexes.q2',
          difficulty: 'advanced',
          q: 'Khi nào cần đồng bộ dữ liệu sang read replica?',
          a: 'Khi độ trễ replication vượt quá ngưỡng nghiệp vụ cho phép.'
        }
      ]
    }]
  }]
};

const systemDesign = {
  categories: [{ id: 'scaling', label: 'Scaling' }],
  designs: [{
    n: 1,
    slug: 'scaling-1m-to-10m-requests',
    category: 'scaling',
    title: 'Scaling 1M to 10M requests',
    excerpt: 'From one box to cells.',
    scope: 'Framing the growth from 250 rps peak to 2,500 rps peak.',
    functional: ['Serve reads from a cache tier.'],
    quality: [], capacity: [], data_model: [], stack: [], tradeoffs: [],
    tags: ['Capacity'],
    sourceNotes: [{ id: '10-deep.dive.q1', q: 'How do you size a cache tier?', a: 'Start from the working set.' }]
  }],
  cases: [{
    n: 1, slug: 'arcturus-inventory-processing-system', title: 'Arcturus', company: 'Tiki Engineering',
    excerpt: 'Ordered command queue for inventory.', tags: ['Inventory'],
    category: 'systems-architecture', guide: { problem: 'Overselling under peak load.' }
  }],
  caseOverview: () => ({ title: 'Arcturus lens', lens: 'Single-writer state machine.' })
};

const caseStudies = {
  articles: [
    systemDesign.cases[0],
    {
      n: 2, slug: 'a-b-testing-in-tiki-search', title: 'A/B testing in search', company: 'Tiki Engineering',
      category: 'data-ml-experimentation', category_label: 'Data & ML', excerpt: 'Bucketing users for search ranking.',
      tags: ['Experimentation'], guide: { core_idea: 'Deterministic hashing keeps a user in one bucket.' }
    }
  ]
};

const index = buildEntries({ content, systemDesign, caseStudies });
const find = (entries, key) => entries.find(entry => entry.key === key);

/* ---------------------------------------------------------------------
   Text preparation
--------------------------------------------------------------------- */

test('folding is diacritic-insensitive and never changes length', () => {
  assert.equal(fold('Đồng bộ dữ liệu'), 'dong bo du lieu');
  assert.equal(fold('CIRCUIT Breaker'), 'circuit breaker');
  for (const sample of ['Đồng bộ dữ liệu', 'Kiểm tra ràng buộc', 'plain ascii', 'ĐẶNG', 'á']) {
    assert.equal(fold(sample).length, sample.length, `length drifted for "${sample}"`);
  }
});

test('plain text drops diagrams and markup but keeps the words a reader searches', () => {
  const flat = plainText(index.find(entry => entry.key === ITEM).body);
  assert.ok(!/btree/.test(flat), 'SVG labels are noise, not prose');
  assert.ok(!/[<>]/.test(flat.replace(/SELECT \*/, '')), 'no tags survive');
  assert.match(flat, /EXPLAIN/);
  assert.match(flat, /covering property/);
});

test('escaped angle brackets come back as the text the author wrote', () => {
  // Answers write `&lt;pid&gt;` because renderMarkdown never escapes; a reader
  // searching "jcmd" must still see the literal placeholder in the snippet.
  assert.equal(plainText('Run `jcmd &lt;pid&gt; Thread.print`.'), 'Run jcmd <pid> Thread.print.');
});

test('callout markers and colour spans do not leak into the index', () => {
  assert.equal(plainText(':::tip Rule\nUse [[g:idempotency]] keys.\n:::'), 'Rule Use idempotency keys.');
});

/* ---------------------------------------------------------------------
   Query and ranking
--------------------------------------------------------------------- */

test('a query is folded, split and de-duplicated; one-letter terms survive alone', () => {
  const parsed = parseQuery('  Circuit   BREAKER circuit ');
  assert.deepEqual(parsed.terms, ['circuit', 'breaker']);
  // The phrase stays as typed (minus spacing): it scores word order, so it is
  // not de-duplicated the way the term set is.
  assert.equal(parsed.phrase, 'circuit breaker circuit');
  assert.equal(parseQuery(' Circuit Breaker ').phrase, 'circuit breaker');
  assert.deepEqual(parseQuery('a').terms, ['a']);
  assert.deepEqual(parseQuery('đồng bộ').terms, ['dong', 'bo']);
});

test('every term must appear — search is AND, not OR', () => {
  assert.equal(searchEntries(index, 'covering index').total, 1);
  assert.equal(searchEntries(index, 'covering zebra').total, 0);
  assert.equal(searchEntries(index, '').total, 0);
});

test('a title match outranks a body match', () => {
  const pair = buildEntries({
    content: {
      topics: [{
        n: 1, key: 't', topic_type: 'core', label: 'T', title: 'T', intro: '', tags: [],
        sections: [{
          title: 'S',
          items: [
            { id: 't.s.q1', q: 'How do you warm a cache?', a: 'Replay the busiest sharding keys first.' },
            { id: 't.s.q2', q: 'What are sharding strategies?', a: 'Hash, range and directory.' }
          ]
        }]
      }]
    },
    systemDesign: {}, caseStudies: {}
  });
  assert.deepEqual(searchEntries(pair, 'sharding').results.map(hit => hit.entry.key), ['t.s.q2', 't.s.q1']);
});

test('a broad term surfaces the topic that owns it, above the questions inside', () => {
  // Deliberate: the first thing a reader wants from a one-word query is which
  // topic to open. The per-kind weight in buildEntries is what does this.
  const results = searchEntries(index, 'index').results;
  assert.equal(results[0].entry.key, 'topic:05-db-core-index-lock');
  assert.ok(results.length > 1, 'the questions inside it still match');
  // Naming the question itself puts the question back on top.
  assert.equal(searchEntries(index, 'covering index').results[0].entry.key, ITEM);
});

test('Vietnamese content is reachable without typing the accents', () => {
  const results = searchEntries(index, 'dong bo du lieu').results;
  assert.equal(results[0].entry.key, '05-db-core-index-lock.indexes.q2');
  assert.match(results[0].titleHtml, /<mark>/);
});

/* The views group results by surface and derive the group order from this
   sequence, so a result list that is not strictly ranked buries the best hit
   under a whole group of weaker ones — and since the first row is the one
   Enter opens, it opens the wrong thing. */
test('results come back strictly ranked, which is what the grouped views rely on', () => {
  for (const query of ['index', 'circuit breaker', 'inventory', 'sharding']) {
    const scores = searchEntries(index, query).results.map(hit => hit.score);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a), `"${query}" came back out of order`);
  }
  // The top hit for a blueprint-only term must be the blueprint, not whichever
  // surface happens to sort first.
  assert.equal(searchEntries(index, 'cells framing growth').results[0].entry.surface, 'system-design');
});

test('results carry the counts per surface, so the panel can offer filters', () => {
  const found = searchEntries(index, 'index');
  const surfaces = new Set(found.results.map(hit => hit.entry.surface));
  for (const surface of surfaces) assert.ok(found.counts[surface] > 0);
  assert.deepEqual(SURFACES.map(row => row.id), ['track', 'system-design', 'case-studies']);
});

test('a surface filter narrows the list but not the counts', () => {
  const all = searchEntries(index, 'inventory');
  const filtered = searchEntries(index, 'inventory', { surface: 'case-studies' });
  assert.ok(all.total >= 1);
  assert.equal(filtered.results.length, 0, 'the Arcturus case is production evidence, not a case-study row');
  assert.deepEqual(filtered.counts, all.counts, 'counts describe the whole result set');
});

/* ---------------------------------------------------------------------
   Highlighting
--------------------------------------------------------------------- */

test('highlighting escapes first and marks second', () => {
  const html = markText('a <b> c', ['b']);
  assert.equal(html, 'a &lt;<mark>b</mark>&gt; c');
  assert.ok(!/<b>/.test(html), 'content can never become markup');
});

test('a marked accented word keeps its accents', () => {
  assert.equal(markText('Đồng bộ', ['dong']), '<mark>Đồng</mark> bộ');
});

test('a snippet is a window around the match, with ellipses only where it cuts', () => {
  const entry = { body: 'x'.repeat(400) + ' needle ' + 'y'.repeat(400), id: '' };
  entry.bodyFold = fold(entry.body);
  const snippet = buildSnippet(entry, ['needle']);
  assert.match(snippet, /^… /);
  assert.match(snippet, / …$/);
  assert.match(snippet, /<mark>needle<\/mark>/);
  assert.ok(snippet.length < 400);
});

/* ---------------------------------------------------------------------
   The index
--------------------------------------------------------------------- */

test('every entry routes to the surface that actually owns it', () => {
  assert.equal(find(index, ITEM).href, '#/track/' + encodeURIComponent(ITEM));
  assert.equal(find(index, 'design:scaling-1m-to-10m-requests').href, '#/system-design/scaling-1m-to-10m-requests');
  assert.equal(find(index, 'case:a-b-testing-in-tiki-search').href, '#/case-studies/a-b-testing-in-tiki-search');
  assert.equal(find(index, 'production:arcturus-inventory-processing-system').href,
    '#/system-design/case/arcturus-inventory-processing-system');
  // A migrated deep dive is off the track, so it must never route back to it.
  assert.equal(find(index, '10-deep.dive.q1').href, '#/system-design/scaling-1m-to-10m-requests/10-deep.dive.q1');
});

test('a topic opens at its first card, which is what selects the topic', () => {
  const topic = find(index, 'topic:05-db-core-index-lock');
  assert.equal(topic.href, '#/track/' + encodeURIComponent(ITEM));
  assert.match(topic.context, /Topic 05/);
});

test('an item names the topic it belongs to', () => {
  const entry = find(index, ITEM);
  assert.match(entry.context, /Database Core/);
  assert.match(entry.context, /Indexes & plans/, 'the section title is decoded, not raw HTML');
  assert.equal(entry.badge, 'Q1');
  assert.equal(entry.topicType, 'data');
});

test('the architecture cases are indexed once, as production evidence', () => {
  const arcturus = index.filter(entry => /arcturus/.test(entry.key));
  assert.equal(arcturus.length, 1);
  assert.equal(arcturus[0].surface, 'system-design');
});

test('an item id finds its own card', () => {
  const found = searchEntries(index, ITEM);
  assert.equal(found.results[0].entry.key, ITEM);
});

test('the real content builds an index whose every row is reachable', async () => {
  const manifest = JSON.parse(readFileSync(path.join(dataRoot, 'manifest.json'), 'utf8'));
  const meta = JSON.parse(readFileSync(path.join(dataRoot, 'meta.json'), 'utf8'));
  const rows = manifest.topics.filter(row => !row.surface || row.surface === 'track');
  const topics = rows.map(row => {
    const source = JSON.parse(readFileSync(path.join(dataRoot, row.file), 'utf8'));
    const moved = new Set(row.system_design_items || []);
    const entry = meta.topics[String(row.n)];
    return {
      n: row.n, key: entry.key, topic_type: row.topic_type,
      label: entry.en.label, title: entry.en.title, intro: entry.en.intro, tags: entry.en.tags,
      sections: source.sections.map(section => ({
        title: section.title,
        items: section.items.filter(item => !moved.has(item.id))
      })).filter(section => section.items.length)
    };
  });

  const real = buildEntries({ content: { topics }, systemDesign: {}, caseStudies: {} });
  assert.ok(real.length > 300, 'the whole track is indexed');
  for (const entry of real) {
    assert.ok(entry.title, `${entry.key} has no title`);
    assert.match(entry.href, /^#\/track\//);
    assert.equal(entry.titleFold.length, entry.title.length);
  }

  // A question every reader meets, found by a phrase from its own answer.
  const items = real.filter(entry => entry.kind === 'item');
  const sample = items[0];
  const words = sample.body.split(' ').slice(4, 8).join(' ');
  const hit = searchEntries(real, words).results[0];
  assert.ok(hit, `nothing matched "${words}"`);
});

/* ---------------------------------------------------------------------
   Routes
--------------------------------------------------------------------- */

test('a search is a shareable route, slashes and accents included', () => {
  assert.equal(searchHash('circuit breaker'), '#/search/circuit%20breaker');
  assert.equal(searchHash('  '), '#/search');
  assert.equal(queryFromRoute(['circuit%20breaker']), 'circuit breaker');
  assert.equal(queryFromRoute([encodeURIComponent('a/b')]), 'a/b');
  assert.equal(queryFromRoute(['%E1%BB%9F']), 'ở');
  assert.equal(queryFromRoute([]), '');
  assert.equal(queryFromRoute(['%ZZ']), '', 'a malformed hash is not an exception');
});

/* ---------------------------------------------------------------------
   History
--------------------------------------------------------------------- */

const SCRIPT_URL = 'https://script.example.test/exec';
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const SESSION_KEY = 'gazl.search.session';

let dir, SearchHistory, mergeHistory;

function fakeStorage() {
  const map = new Map();
  return {
    map,
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    clear: () => map.clear()
  };
}

function fakeAuth() {
  const fns = new Set();
  return {
    session: null,
    token: null,
    enabled: true,
    onChange(fn) { fns.add(fn); return () => fns.delete(fn); },
    signIn(sub) { this.session = { sub }; this.token = 'tok'; for (const fn of fns) fn(this); },
    signOut() { this.session = null; this.token = null; for (const fn of fns) fn(this); }
  };
}

/** Records every action sent to Apps Script and answers from `remote`. */
function stubFetch({ remote = [], fail = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), SCRIPT_URL);
    const body = JSON.parse(options.body);
    calls.push(body);
    if (fail) throw new Error('backend down');
    const data = body.action === 'search.pull' ? { history: remote } : { ok: 1 };
    return { ok: true, text: async () => JSON.stringify({ ok: true, data }) };
  };
  return calls;
}

const stored = (storage, key) => JSON.parse(storage.getItem(key) || 'null');

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'search-'));
  cpSync(PUBLIC + 'lib', join(dir, 'lib'), { recursive: true });
  writeFileSync(join(dir, 'config.js'),
    `export const GOOGLE_CLIENT_ID = 'cid';\nexport const SCRIPT_URL = '${SCRIPT_URL}';\n`);
  ({ SearchHistory, mergeHistory } = await import(pathToFileURL(join(dir, 'lib/search-history.js')).href));
});

after(() => rmSync(dir, { recursive: true, force: true }));

let auth;
beforeEach(() => {
  globalThis.localStorage = fakeStorage();
  globalThis.sessionStorage = fakeStorage();
  auth = fakeAuth();
  Object.assign(SearchHistory, { entries: [], bucket: 'anon', loaded: false });
  SearchHistory._pending.clear();
  stubFetch();
});

test('merging keeps one row per query, newest spelling, newest first', () => {
  const merged = mergeHistory(
    [{ q: 'Kafka', at: '2026-01-01T00:00:00Z', hits: 3 }],
    [{ q: 'kafka', at: '2026-02-01T00:00:00Z', hits: 1 }, { q: 'đồng bộ', at: '2026-03-01T00:00:00Z', hits: 1 }]
  );
  assert.deepEqual(merged.map(row => row.q), ['đồng bộ', 'kafka']);
  // Max, not sum: the same rows come back from the Sheet on every sign-in.
  assert.equal(merged.find(row => row.q === 'kafka').hits, 3);
});

test('merging caps the list and drops blanks', () => {
  const many = Array.from({ length: 60 }, (_, i) => ({ q: 'q' + i, at: '2026-01-01T00:00:' + String(i % 60).padStart(2, '0') + 'Z' }));
  const merged = mergeHistory(many, [{ q: '   ' }, { q: '' }]);
  assert.equal(merged.length, 40);
});

test('signed out, history lives in the session and never touches localStorage', () => {
  SearchHistory.attachAuth(auth);
  SearchHistory.record('circuit breaker');

  assert.deepEqual(SearchHistory.entries.map(row => row.q), ['circuit breaker']);
  assert.deepEqual(stored(globalThis.sessionStorage, SESSION_KEY).map(row => row.q), ['circuit breaker']);
  assert.equal(globalThis.localStorage.map.size, 0);
  assert.equal(SearchHistory.signedIn, false);
});

test('the same query typed twice is one row with a bumped count', () => {
  SearchHistory.attachAuth(auth);
  SearchHistory.record('Kafka');
  SearchHistory.record('index');
  SearchHistory.record('kafka');

  assert.deepEqual(SearchHistory.entries.map(row => row.q), ['kafka', 'index']);
  assert.equal(SearchHistory.entries[0].hits, 2);
});

test('a one-character query is not worth remembering', () => {
  SearchHistory.attachAuth(auth);
  assert.equal(SearchHistory.record('k'), null);
  assert.equal(SearchHistory.record('   '), null);
  assert.equal(SearchHistory.entries.length, 0);
});

test('signing in carries the session history into the account, exactly once', async () => {
  SearchHistory.attachAuth(auth);
  SearchHistory.record('circuit breaker');
  auth.signIn('user-1');

  assert.equal(SearchHistory.bucket, 'user-1');
  assert.deepEqual(SearchHistory.entries.map(row => row.q), ['circuit breaker']);
  assert.deepEqual(stored(globalThis.localStorage, 'gazl.search.user-1').map(row => row.q), ['circuit breaker']);
  // Cleared, so a second account signed in from this tab does not inherit it.
  assert.equal(globalThis.sessionStorage.getItem(SESSION_KEY), null);

  auth.signOut();
  assert.equal(SearchHistory.bucket, 'anon');
  assert.deepEqual(SearchHistory.entries, []);
});

test('two accounts on one browser keep separate history', () => {
  globalThis.localStorage.setItem('gazl.search.user-2', JSON.stringify([{ q: 'kafka', at: '2026-01-01T00:00:00Z', hits: 1 }]));
  SearchHistory.attachAuth(auth);
  auth.signIn('user-1');
  SearchHistory.record('index');
  auth.signOut();
  auth.signIn('user-2');

  assert.deepEqual(SearchHistory.entries.map(row => row.q), ['kafka']);
  assert.deepEqual(stored(globalThis.localStorage, 'gazl.search.user-1').map(row => row.q), ['index']);
});

test('signed in, a search is sent to the Sheet as an upsert', async () => {
  const calls = stubFetch();
  SearchHistory.attachAuth(auth);
  auth.signIn('user-1');
  SearchHistory.record('circuit breaker');
  await SearchHistory._flush();

  const push = calls.find(call => call.action === 'search.push');
  assert.ok(push, 'search.push was sent');
  assert.deepEqual(push.payload.history.map(row => row.q), ['circuit breaker']);
  assert.equal(push.idToken, 'tok');
  assert.equal(SearchHistory._pending.size, 0);
});

test('pulling merges the account rows and sends up what the Sheet is missing', async () => {
  const calls = stubFetch({ remote: [{ q: 'kafka', at: '2026-02-01T00:00:00Z', hits: 4 }] });
  SearchHistory.attachAuth(auth);
  auth.signIn('user-1');
  SearchHistory.record('index');
  await SearchHistory.pull();

  assert.deepEqual(SearchHistory.entries.map(row => row.q).sort(), ['index', 'kafka']);
  const push = calls.find(call => call.action === 'search.push');
  assert.deepEqual(push.payload.history.map(row => row.q), ['index']);
});

test('removing one row and clearing all reach the backend too', async () => {
  const calls = stubFetch();
  SearchHistory.attachAuth(auth);
  auth.signIn('user-1');
  SearchHistory.record('kafka');
  SearchHistory.record('index');

  SearchHistory.remove('KAFKA');   // same query, different case
  assert.deepEqual(SearchHistory.entries.map(row => row.q), ['index']);
  await new Promise(resolve => setImmediate(resolve));
  const deleted = calls.find(call => call.action === 'search.delete');
  assert.deepEqual(deleted.payload.queries, ['KAFKA']);

  SearchHistory.clear();
  assert.deepEqual(SearchHistory.entries, []);
  assert.deepEqual(stored(globalThis.localStorage, 'gazl.search.user-1'), []);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(calls.some(call => call.action === 'search.delete' && call.payload.all === true));
});

test('an older deployment or a dead network costs the reader nothing', async () => {
  stubFetch({ fail: true });
  SearchHistory.attachAuth(auth);
  auth.signIn('user-1');
  SearchHistory.record('circuit breaker');
  await SearchHistory.pull();
  await SearchHistory._flush();

  assert.deepEqual(SearchHistory.entries.map(row => row.q), ['circuit breaker']);
  // Still queued: the next successful call sends it.
  assert.equal(SearchHistory._pending.size, 1);
});
