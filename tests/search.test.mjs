import assert from 'node:assert/strict';
import path from 'node:path';
import { test, before, after, beforeEach } from 'node:test';
import { mkdtempSync, cpSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

/* Site-wide search: the index model, the text primitives it folds
   with, and the recent-search history that follows an account.

   Merged from: search, search-history.
   Each block keeps its own scope so fixtures and helpers cannot collide. */

// ---- from search.test.mjs ----
{
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

  const root = path.resolve(import.meta.dirname, '..');
  const publicRoot = path.join(root, 'public');
  const dataRoot = path.join(publicRoot, 'data');

  const {
    fold, plainText, parseQuery, markText, buildSnippet,
    prepareEntries, searchEntries, SURFACES
  } = await import(pathToFileURL(path.join(publicRoot, 'lib/search.js')).href);

  /* ---------------------------------------------------------------------
     Fixtures

     Rows are written in the shape `server/api/content/search-index/[lang].get.ts`
     ships — both languages on every row, one real `href` — because that is the
     only shape the running site ever ranks. The fixture used to be built by a
     browser-side index builder that no longer exists; testing that shape again
     would be testing code nobody runs.
  --------------------------------------------------------------------- */

  const ITEM = '05-db-core-index-lock.indexes.q1';
  const TOPIC_TITLE = 'Database core, indexes and locking';
  const q = id => `#question-${encodeURIComponent(id)}`;

  const INDEX = [
    {
      id: ITEM, surface: 'track',
      en: 'What is a covering index?', vi: 'Covering index là gì?',
      bodyEn: 'An index that answers the query from the index alone. Run EXPLAIN and look for Using index. '
        + 'Watch out for a wide SELECT *, which drops the covering property.',
      bodyVi: 'Index trả lời truy vấn chỉ bằng chính nó.',
      contextEn: TOPIC_TITLE, contextVi: TOPIC_TITLE,
      href: `/topics/05-db-core-index-lock${q(ITEM)}`
    },
    {
      id: '05-db-core-index-lock.indexes.q2', surface: 'track',
      en: 'When do you sync data to a read replica?', vi: 'Khi nào cần đồng bộ dữ liệu sang read replica?',
      bodyEn: 'When replication lag passes what the business tolerates.',
      bodyVi: 'Khi độ trễ replication vượt quá ngưỡng nghiệp vụ cho phép.',
      contextEn: TOPIC_TITLE, contextVi: TOPIC_TITLE,
      href: `/topics/05-db-core-index-lock${q('05-db-core-index-lock.indexes.q2')}`
    },
    {
      id: 'topic:05-db-core-index-lock', surface: 'track', weight: 40,
      en: TOPIC_TITLE, vi: TOPIC_TITLE,
      bodyEn: 'How B-trees, index selectivity and row locks decide a query plan. Index Locking',
      bodyVi: 'B-tree, độ chọn lọc index và row lock quyết định query plan.',
      contextEn: 'Topic 5 · Database Core', contextVi: 'Chủ đề 5 · Database Core',
      href: '/topics/05-db-core-index-lock'
    },
    {
      // A migrated deep dive is off the track, so it must never route back to it.
      id: '10-deep.dive.q1', surface: 'track',
      en: 'How do you size a cache tier?', vi: 'How do you size a cache tier?',
      bodyEn: 'Start from the working set.', bodyVi: 'Start from the working set.',
      contextEn: 'Scaling 1M to 10M requests', contextVi: 'Scaling 1M to 10M requests',
      href: `/system-design/scaling-1m-to-10m-requests${q('10-deep.dive.q1')}`
    },
    {
      id: 'system-design:scaling-1m-to-10m-requests', surface: 'system-design',
      en: 'Scaling 1M to 10M requests', vi: 'Scaling 1M to 10M requests',
      bodyEn: 'Cells, shards and regional isolation once one box stops being enough.',
      bodyVi: 'Cell, shard và cô lập theo vùng khi một máy không còn đủ.',
      contextEn: 'Framing the growth from one box to cells.', contextVi: 'Framing the growth from one box to cells.',
      href: '/system-design/scaling-1m-to-10m-requests'
    },
    {
      id: 'case-studies:a-b-testing-in-tiki-search', surface: 'case-studies',
      en: 'A/B testing in search', vi: 'A/B testing trong search',
      bodyEn: 'Deterministic hashing keeps a user in one bucket.',
      bodyVi: 'Hashing tất định giữ user trong một bucket.',
      contextEn: 'Bucketing users for search ranking.', contextVi: 'Bucketing users for search ranking.',
      href: '/case-studies/a-b-testing-in-tiki-search'
    }
  ];

  const index = prepareEntries(INDEX, 'en');

  /* ---------------------------------------------------------------------
     Text preparation
  --------------------------------------------------------------------- */

  test('folding is diacritic-insensitive and never changes length', () => {
    for (const value of ['Đồng bộ dữ liệu', 'Straße', 'ẤY', 'plain ascii', '']) {
      assert.equal(fold(value).length, value.length, `fold() changed the length of "${value}"`);
    }
    assert.equal(fold('Đồng Bộ'), 'dong bo');
  });

  test('plain text drops diagrams and markup but keeps the words a reader searches', () => {
    const plain = plainText('Use a **covering index**.\n\n<svg><text>btree</text></svg>\n\n- `EXPLAIN` first');
    assert.match(plain, /covering index/);
    assert.match(plain, /EXPLAIN/);
    assert.ok(!/btree/.test(plain), 'diagram labels read as noise in a snippet');
    assert.ok(!/[*`]/.test(plain));
  });

  test('escaped angle brackets come back as the text the author wrote', () => {
    assert.match(plainText('run `jcmd &lt;pid&gt; Thread.print`'), /jcmd <pid> Thread\.print/);
  });

  test('callout markers and colour spans do not leak into the index', () => {
    assert.equal(plainText(':::tip\n[[b:bounded queue]] holds\n:::'), 'bounded queue holds');
  });

  /* ---------------------------------------------------------------------
     Query and ranking
  --------------------------------------------------------------------- */

  test('a query is folded, split and de-duplicated; one-letter terms survive alone', () => {
    const parsed = parseQuery('  Circuit   BREAKER circuit ');
    assert.deepEqual(parsed.terms, ['circuit', 'breaker']);
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
    const pair = prepareEntries([
      { id: 't.s.q1', surface: 'track', en: 'How do you warm a cache?', vi: '',
        bodyEn: 'Replay the busiest sharding keys first.', contextEn: 'T', href: '/topics/t' },
      { id: 't.s.q2', surface: 'track', en: 'What are sharding strategies?', vi: '',
        bodyEn: 'Hash, range and directory.', contextEn: 'T', href: '/topics/t' }
    ], 'en');
    assert.deepEqual(searchEntries(pair, 'sharding').results.map(hit => hit.id), ['t.s.q2', 't.s.q1']);
  });

  test('a broad term surfaces the topic that owns it, above the questions inside', () => {
    // Deliberate: the first thing a reader wants from a one-word query is which
    // topic to open. The `weight` the index builder puts on a topic row does it.
    const results = searchEntries(index, 'index').results;
    assert.equal(results[0].id, 'topic:05-db-core-index-lock');
    assert.ok(results.length > 1, 'the questions inside it still match');
    // Naming the question itself puts the question back on top.
    assert.equal(searchEntries(index, 'covering index').results[0].id, ITEM);
  });

  test('Vietnamese content is reachable without typing the accents', () => {
    const vi = prepareEntries(INDEX, 'vi');
    const results = searchEntries(vi, 'dong bo du lieu').results;
    assert.equal(results[0].id, '05-db-core-index-lock.indexes.q2');
    assert.match(results[0].titleHtml, /<mark>/);
  });

  /* The views group results by surface and derive the group order from this
     sequence, so a result list that is not strictly ranked buries the best hit
     under a whole group of weaker ones — and since the first row is the one
     Enter opens, it opens the wrong thing. */
  test('results come back strictly ranked, which is what the grouped views rely on', () => {
    for (const query of ['index', 'cache', 'bucket', 'sharding']) {
      const scores = searchEntries(index, query).results.map(hit => hit.score);
      assert.deepEqual(scores, [...scores].sort((a, b) => b - a), `"${query}" came back out of order`);
    }
    // The top hit for a blueprint-only term must be the blueprint, not whichever
    // surface happens to sort first.
    assert.equal(searchEntries(index, 'scaling 1m').results[0].surface, 'system-design');
  });

  test('results carry the counts per surface, so the panel can offer filters', () => {
    const found = searchEntries(index, 'index');
    const surfaces = new Set(found.results.map(hit => hit.surface));
    for (const surface of surfaces) assert.ok(found.counts[surface] > 0);
    assert.deepEqual(SURFACES.map(row => row.id),
      ['track', 'system-design', 'case-studies', 'photography', 'homelab']);
  });

  test('a surface filter narrows the list but not the counts', () => {
    const all = searchEntries(index, 'index');
    const filtered = searchEntries(index, 'index', { surface: 'case-studies' });
    assert.ok(all.total >= 1);
    assert.equal(filtered.results.length, 0, 'no case-study row matches this term');
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

  test('a result carries the marked title and the snippet the views render', () => {
    const hit = searchEntries(index, 'covering index').results[0];
    assert.match(hit.titleHtml, /<mark>covering<\/mark>/);
    assert.match(hit.snippet, /<mark>index<\/mark>/, 'the snippet is what says why a row matched');
    assert.equal(hit.href, `/topics/05-db-core-index-lock${q(ITEM)}`);
  });

  /* ---------------------------------------------------------------------
     The index
  --------------------------------------------------------------------- */

  test('preparing folds per language and keeps every offset aligned', () => {
    for (const lang of ['en', 'vi']) {
      for (const entry of prepareEntries(INDEX, lang)) {
        assert.ok(entry.title, `${entry.id} has no title`);
        assert.equal(entry.titleFold.length, entry.title.length);
        assert.equal(fold(entry.title), entry.titleFold);
      }
    }
  });

  test('entries are ordered by surface, which is the tie-break inside a score', () => {
    const rank = SURFACES.map(row => row.id);
    const seen = index.map(entry => rank.indexOf(entry.surface));
    assert.deepEqual(seen, [...seen].sort((a, b) => a - b), 'surfaces must not interleave');
  });

  test('an item id finds its own card', () => {
    assert.equal(searchEntries(index, ITEM).results[0].id, ITEM);
  });

  /* The hrefs themselves are the index builder's job, and getting one wrong
     sends a reader to a page that does not hold the answer. */
  test('the shipped index routes each surface to the page that owns it', async () => {
    const builder = await readFile(path.join(root, 'server/api/content/search-index/[lang].get.ts'), 'utf8');
    assert.match(builder, /system-design\/\$\{sourceOwners\.get\(id\)\}#question-/,
      'a migrated deep dive must route into its blueprint');
    assert.match(builder, /topics\/\$\{topicKey\}#question-/);
    assert.match(builder, /id: `topic:\$\{topic\.key\}`/, 'a topic needs a row of its own');
    assert.match(builder, /weight: 40/, 'and a weight, or it never outranks its own questions');
  });

  /* A row with no body is findable only by its own title, which is the failure
     that is invisible from the outside: search still works, it just silently
     cannot reach that surface's prose. Blueprints shipped that way — the
     largest corpus on the site was searchable by title and excerpt alone. */
  test('every content surface ships a body, not just a title', async () => {
    const builder = await readFile(path.join(root, 'server/api/content/search-index/[lang].get.ts'), 'utf8');
    /* Each entries.push writes one surface's rows. Reading them from the source
       rather than from the built index keeps this runnable without a build —
       the route imports through a Nuxt alias plain Node cannot resolve. */
    const pushes = builder.split('entries.push(').slice(1)
      .map(chunk => chunk.slice(0, chunk.indexOf('});') + 1));
    assert.ok(pushes.length >= 3, 'the index must reach system design and the collections, not only the track');
    for (const chunk of pushes) {
      const surface = chunk.match(/surface: '([a-z-]+)'/)?.[1] || 'collection';
      assert.match(chunk, /bodyEn/, `${surface}: rows without a body are findable by title alone`);
    }
    // the track's own rows are mapped rather than pushed, and owe the same body
    assert.match(builder, /surface: 'track', en: text\.en[\s\S]{0,200}bodyEn/,
      'track: an item row must carry its answer, not only its question');
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
}

// ---- search index delivery ----
{
  const root = path.resolve(import.meta.dirname, '..');

  /* The index carries every answer body, so it is measured in megabytes. Awaiting
     it through useAsyncData would inline it into the prerendered payload and make
     every visit to /search download the whole corpus before first paint — and the
     overlay would then fetch it again. Both surfaces load it in the browser. */
  test('the search index is fetched in the browser, never inlined into the payload', async () => {
    const [page, overlay] = await Promise.all([
      readFile(path.join(root, 'app/pages/search.vue'), 'utf8'),
      readFile(path.join(root, 'app/components/search/SearchOverlay.client.vue'), 'utf8')
    ]);

    for (const [name, source] of [['search page', page], ['overlay', overlay]]) {
      assert.doesNotMatch(source, /useAsyncData\([^)]*search-index/,
        `${name} must not resolve the index during prerender`);
      assert.match(source, /fetch\(`\/api\/content\/search-index\/\$\{/,
        `${name} must fetch the index at runtime`);
    }

    // A query typed before the index lands must not read as "no result".
    assert.match(page, /indexLoading/);
    assert.match(page, /indexFailed/);
    assert.ok(page.indexOf('indexLoading') < page.indexOf('!results.length'),
      'the loading state must be checked before the empty state');
  });
}
