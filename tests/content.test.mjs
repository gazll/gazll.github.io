import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { test, beforeEach } from 'node:test';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { contentDateFacts, formatContentDate } from '../public/lib/content-dates.js';
import { spawnSync } from 'node:child_process';
import { closeSync, openSync, readFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

/* The content model: the VI/EN contract every topic pair must satisfy,
   the date stamps rendered beside it, and the two authoring tools that write
   into it.

   Merged from: content.i18n, content-dates, content.audit, content.edit-tool.
   Each block keeps its own scope so fixtures and helpers cannot collide. */

// ---- from content.i18n.test.mjs ----
{
  /* The VI/EN language switch in lib/content.js.

     data/manifest.json + data/meta.json + per-topic data/topics/NN-slug.json
     are complete English sources and always load — including the Microservices
     track, filed as topic_type "microservice" like any other topic (n=25).
     Every topic's complete Vietnamese companion lives alongside it as
     data/topics/NN-slug.vi.json. The active pair loads on demand; the generated
     title index keeps global navigation stable without downloading every full
     answer. Applying a language must not mutate the other language's source. */






  const root = path.resolve(import.meta.dirname, '..');
  const pub = path.join(root, 'public');

  const MANIFEST = JSON.parse(await readFile(path.join(pub, 'data/manifest.json'), 'utf8'));
  const META = JSON.parse(await readFile(path.join(pub, 'data/meta.json'), 'utf8'));
  const REVIEWS = JSON.parse(await readFile(path.join(pub, 'data/content-reviews.json'), 'utf8'));
  const INDEX = JSON.parse(await readFile(path.join(pub, 'data/content-index.json'), 'utf8'));
  const TRACK_ROWS = MANIFEST.topics.filter(row => !row.surface || row.surface === 'track');
  const PARTIAL_SYSTEM_DESIGN_IDS = MANIFEST.topics.flatMap(row => row.system_design_items || []);
  const TOPIC_FILES = new Map();
  const TOPIC_VI_FILES = new Map();
  for (const row of MANIFEST.topics) {
    TOPIC_FILES.set('data/' + row.file, JSON.parse(await readFile(path.join(pub, 'data', row.file), 'utf8')));
    const viPath = 'data/' + row.file.replace(/\.json$/, '.vi.json');
    TOPIC_VI_FILES.set(viPath, JSON.parse(await readFile(path.join(pub, viPath), 'utf8')));
  }

  /** A fresh Content module with stubbed fetch + localStorage, serving the real data/ tree. */
  async function load({ lang, metaOverride, topicOverrides, dropVi } = {}) {
    const store = new Map();
    if (lang) store.set('gazl.contentLang', lang);
    globalThis.localStorage = {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    };
    const fetched = [];
    globalThis.fetch = async (url) => {
      fetched.push(url);
      if (url === 'data/manifest.json') return { ok: true, json: async () => structuredClone(MANIFEST) };
      if (url === 'data/meta.json') return { ok: true, json: async () => structuredClone(metaOverride || META) };
      if (url === 'data/content-reviews.json') return { ok: true, json: async () => structuredClone(REVIEWS) };
      if (url === 'data/content-index.json') return { ok: true, json: async () => structuredClone(INDEX) };
      if (topicOverrides && topicOverrides[url]) return { ok: true, json: async () => structuredClone(topicOverrides[url]) };
      if (TOPIC_FILES.has(url)) return { ok: true, json: async () => structuredClone(TOPIC_FILES.get(url)) };
      if (!dropVi && TOPIC_VI_FILES.has(url)) return { ok: true, json: async () => structuredClone(TOPIC_VI_FILES.get(url)) };
      return { ok: false, status: 404 };
    };
    // Cache-bust so every test gets its own module instance.
    const url = pathToFileURL(path.join(pub, 'lib/content.js')).href + '?t=' + Math.random();
    const { Content } = await import(url);
    return { Content, fetched, store };
  }

  const topic = (Content, n) => Content.topics.find(t => t.n === n);
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  beforeEach(() => { delete globalThis.fetch; });

  test('the lightweight index exactly mirrors authored questions and track visibility', () => {
    assert.equal(INDEX.version, 1);
    const indexedTopics = new Map(INDEX.topics.map(topic => [topic.n, topic]));
    const expectedIds = [];
    for (const row of MANIFEST.topics) {
      const items = TOPIC_FILES.get('data/' + row.file).sections.flatMap(section => section.items);
      const viItems = TOPIC_VI_FILES.get('data/' + row.file.replace(/\.json$/, '.vi.json'))
        .sections.flatMap(section => section.items);
      const viById = new Map(viItems.map(item => [item.id, item]));
      const ids = items.map(item => item.id);
      const moved = new Set(row.system_design_items || []);
      expectedIds.push(...ids);
      assert.deepEqual(indexedTopics.get(row.n)?.item_ids, ids, `${row.file}: indexed item ids drifted`);
      assert.deepEqual(indexedTopics.get(row.n)?.track_item_ids,
        row.surface && row.surface !== 'track' ? [] : ids.filter(id => !moved.has(id)),
        `${row.file}: indexed Track visibility drifted`);
      for (const item of items) {
        assert.deepEqual(INDEX.items[item.id], { en: item.q, vi: viById.get(item.id)?.q || '' },
          `${item.id}: indexed question drifted`);
      }
    }
    assert.deepEqual(Object.keys(INDEX.items).sort(), expectedIds.sort());
  });

  test('English is the default language and every Study Track topic loads, including microservice', async () => {
    const { Content } = await load();
    assert.equal(Content.lang, 'en');
    await Content.load();
    assert.equal(Content.topics.length, TRACK_ROWS.length);
    assert.equal(topic(Content, 25).topic_type, 'microservice');
  });

  test('every topic exposes Git-derived written and updated dates', async () => {
    const { Content } = await load();
    await Content.load();
    for (const row of MANIFEST.topics) {
      const metadata = META.topics[String(row.n)];
      assert.match(metadata.created_at, ISO_DATE, row.file + ': created_at');
      assert.match(metadata.updated_at, ISO_DATE, row.file + ': updated_at');
      assert.ok(metadata.created_at <= metadata.updated_at, row.file + ': dates are reversed');
    }
    assert.match(Content.topics[0].created_at, ISO_DATE);
    assert.match(Content.topics[0].updated_at, ISO_DATE);
  });

  test('moved System Design sources leave the Study Track but remain available by immutable item id', async () => {
    const { Content } = await load();
    await Content.load();

    assert.equal(topic(Content, 10), undefined);
    assert.equal(topic(Content, 11), undefined);
    for (const row of MANIFEST.topics.filter(candidate => candidate.surface === 'system-design')) {
      const source = TOPIC_FILES.get('data/' + row.file);
      for (const item of source.sections.flatMap(section => section.items)) {
        const pair = Content.itemPair(item.id);
        assert.equal(pair.en.q, item.q, item.id);
        assert.ok(pair.vi?.q, `${item.id} lost its Vietnamese companion`);
      }
    }
    const visibleTopic16Ids = topic(Content, 16).sections.flatMap(section => section.items.map(item => item.id));
    for (const id of PARTIAL_SYSTEM_DESIGN_IDS) {
      assert.equal(visibleTopic16Ids.includes(id), false, `${id} still appears in Study Track`);
      assert.ok(Content.itemPair(id)?.en?.q, `${id} is no longer addressable by immutable id`);
      assert.ok(Content.itemPair(id)?.vi?.q, `${id} lost its Vietnamese companion`);
    }
  });

  test('every bilingual item uses the final four-key schema', () => {
    for (const files of [TOPIC_FILES, TOPIC_VI_FILES]) {
      for (const [file, content] of files) {
        for (const section of content.sections) {
          for (const item of section.items) {
            assert.deepEqual(Object.keys(item).sort(), ['a', 'difficulty', 'id', 'q'], `${file}: ${item.id}`);
          }
        }
      }
    }
  });

  test('switching to Vietnamese shows the complete source, and back again needs no refetch', async () => {
    const { Content, fetched } = await load();
    await Content.load();

    await Content.setLang('vi');
    const viItem = topic(Content, 1).sections[0].items[0];
    const viBase = TOPIC_VI_FILES.get('data/' + MANIFEST.topics[0].file.replace(/\.json$/, '.vi.json'));
    assert.equal(topic(Content, 1).sections[0].title, viBase.sections[0].title);
    assert.equal(viItem.q, viBase.sections[0].items[0].q);
    assert.equal(viItem.a, viBase.sections[0].items[0].a);

    const before = fetched.length;
    await Content.setLang('en');
    assert.equal(fetched.length, before, 'both languages are already in memory');
    const enBase = TOPIC_FILES.get('data/' + MANIFEST.topics[0].file);
    const enItem = topic(Content, 1).sections[0].items[0];
    assert.equal(enItem.q, enBase.sections[0].items[0].q);
    assert.equal(enItem.a, enBase.sections[0].items[0].a);
  });

  test('a stored language choice is honoured, and only the active bilingual topic is fetched upfront', async () => {
    const { Content, fetched } = await load({ lang: 'vi' });
    assert.equal(Content.lang, 'vi');
    await Content.load();

    const first = MANIFEST.topics.find(row => !row.surface || row.surface === 'track');
    const expected = ['data/manifest.json', 'data/meta.json', 'data/content-reviews.json', 'data/content-index.json',
      'data/' + first.file, 'data/' + first.file.replace(/\.json$/, '.vi.json')];
    assert.deepEqual([...fetched].sort(), [...expected].sort());
  });

  test('another topic loads on demand and loadAll pays for the corpus only when requested', async () => {
    const { Content, fetched } = await load();
    await Content.load();
    assert.equal(topic(Content, 2).sections.length, 0, 'an unopened topic should remain a metadata shell');

    await Content.ensureTopic(2);
    assert.ok(topic(Content, 2).sections.length > 0);
    assert.equal(fetched.filter(url => /topics\/02-/.test(url)).length, 2, 'EN and VI should each load once');

    await Content.loadAll();
    assert.ok(Content.topics.every(row => row.sections.length > 0));
    const after = fetched.length;
    await Content.loadAll();
    assert.equal(fetched.length, after, 'the complete corpus should be cached');
    assert.equal(Content.totalTopicItems, TRACK_ROWS.reduce((sum, row) => {
      const indexRow = INDEX.topics.find(candidate => candidate.n === row.n);
      return sum + indexRow.track_item_ids.length;
    }, 0));
  });

  test('technical review provenance is attached to the exact immutable item', async () => {
    const { Content } = await load();
    await Content.load();
    const [id, review] = Object.entries(REVIEWS)[0];
    const item = Content.topics.flatMap(row => row.sections).flatMap(section => section.items)
      .find(candidate => candidate.id === id);
    assert.equal(item?.reviewed_at, review.reviewed_at);
  });

  test('a missing .vi.json degrades to the English base instead of throwing', async () => {
    const { Content } = await load({ dropVi: true });
    await Content.load();
    assert.equal(Content.topics.length, TRACK_ROWS.length);

    await Content.setLang('vi');
    // No VI file fetched successfully, so VI uses the complete English base.
    const item = topic(Content, 1).sections[0].items[0];
    assert.match(item.a, /JMM/);
  });

  test('applying a language never mutates the other language source', async () => {
    const { Content } = await load();
    await Content.load();
    const enLabel = topic(Content, 17).label;

    await Content.setLang('vi');
    const viLabel = topic(Content, 17).label;
    await Content.setLang('en');
    assert.equal(topic(Content, 17).label, enLabel);
    await Content.setLang('vi');
    assert.equal(topic(Content, 17).label, viLabel);
  });

  test('every meta.json topic points at a real manifest entry, and key matches the file', async () => {
    const byN = new Map(MANIFEST.topics.map(r => [String(r.n), r]));
    for (const [n, m] of Object.entries(META.topics)) {
      const row = byN.get(n);
      assert.ok(row, `meta topic ${n} does not exist in manifest`);
      assert.equal('topics/' + m.key + '.json', row.file, `meta topic ${n} key does not match its manifest file`);
      assert.equal(m.topic_type, row.topic_type, `meta topic ${n} topic_type does not match manifest`);
    }
  });

  test('every Vietnamese companion has the base file item IDs in order', () => {
    for (const row of MANIFEST.topics) {
      const basePath = 'data/' + row.file;
      const viPath = basePath.replace(/\.json$/, '.vi.json');
      const baseIds = TOPIC_FILES.get(basePath).sections.flatMap(section => section.items.map(item => item.id));
      const viIds = TOPIC_VI_FILES.get(viPath).sections.flatMap(section => section.items.map(item => item.id));
      assert.deepEqual(viIds, baseIds, `${viPath}: item IDs must match ${basePath} in order`);
    }
  });

  test('every item id encodes its own topic key', async () => {
    for (const row of MANIFEST.topics) {
      const key = row.file.replace(/^topics\//, '').replace(/\.json$/, '');
      const content = TOPIC_FILES.get('data/' + row.file);
      for (const sec of content.sections) {
        for (const it of sec.items) {
          assert.ok(it.id.startsWith(key + '.'), `item ${it.id} does not start with topic key ${key}`);
        }
      }
    }
  });

  test('content review metadata is keyed by real immutable item ids', async () => {
    const reviewPath = path.join(pub, 'data/content-reviews.json');
    const raw = await readFile(reviewPath, 'utf8').catch(() => null);
    assert.ok(raw, 'public/data/content-reviews.json must exist');

    const reviews = JSON.parse(raw);
    const ids = new Set(
      [...TOPIC_FILES.values()].flatMap(content =>
        content.sections.flatMap(section => section.items.map(item => item.id)))
    );
    const entries = Object.entries(reviews);
    assert.ok(entries.length >= 10, 'the high-risk refresh needs provenance for more than a token sample');

    for (const [id, review] of entries) {
      assert.ok(ids.has(id), `${id}: review metadata points at no English item`);
      assert.match(review.reviewed_at, /^\d{4}-\d{2}-\d{2}$/, `${id}: reviewed_at must be YYYY-MM-DD`);
      assert.ok(
        ['normative', 'heuristic', 'example'].includes(review.claim_type),
        `${id}: unsupported claim_type ${review.claim_type}`
      );
      assert.ok(Array.isArray(review.target_versions) && review.target_versions.length > 0,
        `${id}: target_versions must be a non-empty array`);
      assert.ok(review.target_versions.every(version => typeof version === 'string' && version.length > 0),
        `${id}: target_versions must contain non-empty strings`);
      assert.ok(Array.isArray(review.sources) && review.sources.length > 0,
        `${id}: sources must be a non-empty array`);
      assert.ok(review.sources.every(source => /^https:\/\//.test(source)),
        `${id}: every source must be an HTTPS URL`);
    }
  });

  test('cache eviction deep dive separates admission from replacement and corrects implementation myths', () => {
    const id = '25-microservice.05-caching-pitfalls.q10';
    const en = [...TOPIC_FILES.values()].flatMap(content => content.sections)
      .flatMap(section => section.items).find(item => item.id === id);
    const vi = [...TOPIC_VI_FILES.values()].flatMap(content => content.sections)
      .flatMap(section => section.items).find(item => item.id === id);

    assert.ok(en && vi, 'the complete bilingual deep dive must exist');
    assert.equal(en.difficulty, 'advanced');
    assert.match(en.a, /Admission asks whether a new candidate deserves residency/);
    assert.match(en.a, /W-TinyLFU combines a chance for new keys/);
    assert.match(en.a, /SLRU is segmented replacement, not an admission gate/);
    assert.match(en.a, /B1 hit grows the recency target p/);
    assert.match(en.a, /Linux should not be summarized as “also CLOCK”/);
    assert.match(vi.a, /Có hai cánh cửa riêng/);
    assert.equal((en.a.match(/<svg\b/g) || []).length, 4);
    assert.equal((vi.a.match(/<svg\b/g) || []).length, 4);
    assert.ok(REVIEWS[id]?.sources.length >= 7, 'version-bound engine claims need primary provenance');
  });

  test('cache series covers layered hit economics without adding incompatible hit ratios', () => {
    const id = '25-microservice.05-caching-pitfalls.q11';
    const en = [...TOPIC_FILES.values()].flatMap(content => content.sections)
      .flatMap(section => section.items).find(item => item.id === id);
    const vi = [...TOPIC_VI_FILES.values()].flatMap(content => content.sections)
      .flatMap(section => section.items).find(item => item.id === id);

    assert.ok(en && vi, 'the cache-stack item must be bilingual');
    assert.match(en.a, /E\[T\] = L_c \+ \(1 - h\)/);
    assert.match(en.a, /conditional hit rate at each stop/);
    assert.match(vi.a, /Cộng các global hit rate với nhau là sai toán học/);
    assert.equal((en.a.match(/<svg\b/g) || []).length, 1);
    assert.equal((vi.a.match(/<svg\b/g) || []).length, 1);
  });

  test('cache expiration guide separates clocks, cleanup, and bounded TTL policy', () => {
    const id = '25-microservice.05-caching-pitfalls.q12';
    const en = [...TOPIC_FILES.values()].flatMap(content => content.sections)
      .flatMap(section => section.items).find(item => item.id === id);
    const vi = [...TOPIC_VI_FILES.values()].flatMap(content => content.sections)
      .flatMap(section => section.items).find(item => item.id === id);

    assert.ok(en && vi, 'the expiration guide must be bilingual');
    assert.equal(en.difficulty, 'advanced');
    assert.match(en.a, /Logical expiry and physical removal are separate moments/);
    assert.match(en.a, /effective deadline = min\(absolute cap, last access \+ idle timeout\)/);
    assert.match(en.a, /A relative value over 30 days is interpreted as an absolute Unix timestamp/);
    assert.match(vi.a, /Jitter phải có freshness boundary/);
    assert.equal((en.a.match(/<svg\b/g) || []).length, 3);
    assert.equal((vi.a.match(/<svg\b/g) || []).length, 3);
    assert.ok(REVIEWS[id]?.sources.length >= 6, 'engine-specific TTL claims need primary provenance');
  });

  test('browser token storage guide chooses architecture before storage API', () => {
    const id = '13-security-oauth2.jwt-tokens.q4';
    const en = [...TOPIC_FILES.values()].flatMap(content => content.sections)
      .flatMap(section => section.items).find(item => item.id === id);
    const vi = [...TOPIC_VI_FILES.values()].flatMap(content => content.sections)
      .flatMap(section => section.items).find(item => item.id === id);

    assert.ok(en && vi, 'the browser token-storage guide must be bilingual');
    assert.equal(en.difficulty, 'advanced');
    assert.match(en.a, /The default answer is none of those places for the JWT itself/);
    assert.match(en.a, /BFF \+ HttpOnly cookie/);
    assert.match(en.a, /sessionStorage is a bounded compromise/);
    assert.match(en.a, /CORS does not replace CSRF protection/);
    assert.match(vi.a, /không nơi nào trong ba chỗ đó cho chính JWT/);
    assert.equal((en.a.match(/<svg\b/g) || []).length, 1);
    assert.equal((vi.a.match(/<svg\b/g) || []).length, 1);
    // "OAuth 2.0 for Browser-Based Applications" is still an Internet-Draft in the
    // RFC Editor queue. It had been cited here as "RFC 10017", a number that does
    // not exist — so pin the draft, and pin that no rfc-editor.org URL claims it.
    assert.ok(REVIEWS[id]?.sources.includes('https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/'),
      'the browser-apps BCP must be cited as the draft it currently is');
    assert.ok(REVIEWS[id].target_versions.some(version => /draft-ietf-oauth-browser-based-apps/.test(version)),
      'the provenance record must name the draft, not an unassigned RFC number');
    for (const source of REVIEWS[id].sources) {
      const rfc = source.match(/rfc-editor\.org\/rfc\/rfc(\d+)/);
      assert.ok(!rfc || Number(rfc[1]) <= 9999,
        `${source}: RFC numbers above 9999 are not published — verify before citing`);
    }
  });

  test('every provenance record cites a source that could exist', () => {
    // content-reviews.json is what separates a checked claim from an inherited
    // one, so a citation that cannot be read is worse than no entry at all. The
    // highest published RFC is in the 9xxx range; a five-digit number is either a
    // typo or invented, which is exactly how "RFC 10017" got shipped once.
    const HIGHEST_PLAUSIBLE_RFC = 9999;
    for (const [id, review] of Object.entries(REVIEWS)) {
      assert.ok(Array.isArray(review.sources) && review.sources.length,
        `${id}: a reviewed claim needs at least one source`);
      for (const source of review.sources) {
        assert.ok(source.startsWith('https://'), `${id}: "${source}" must be https`);
        const rfc = source.match(/rfc-editor\.org\/(?:rfc\/rfc|info\/rfc)(\d+)/);
        assert.ok(!rfc || Number(rfc[1]) <= HIGHEST_PLAUSIBLE_RFC,
          `${id}: RFC ${rfc?.[1]} is not a published number — cite the draft instead`);
      }
      for (const version of review.target_versions || []) {
        const rfc = String(version).match(/\bRFC\s+(\d+)/);
        assert.ok(!rfc || Number(rfc[1]) <= HIGHEST_PLAUSIBLE_RFC,
          `${id}: target_versions names RFC ${rfc?.[1]}, which is not published`);
      }
    }
  });

  test('JVM memory guide separates specification areas, HotSpot accounting, and RSS', () => {
    const id = '01-java-core-jvm.memory-execution-model.q6';
    const en = [...TOPIC_FILES.values()].flatMap(content => content.sections)
      .flatMap(section => section.items).find(item => item.id === id);
    const vi = [...TOPIC_VI_FILES.values()].flatMap(content => content.sections)
      .flatMap(section => section.items).find(item => item.id === id);

    assert.ok(en && vi, 'the JVM process-memory item must be bilingual');
    assert.match(en.a, /-Xmx` caps the Java heap, not every byte/);
    assert.match(en.a, /NMT tracks HotSpot\/JVM native allocations/);
    assert.match(vi.a, /stack của virtual thread là stack-chunk object/);
    assert.ok(REVIEWS[id]?.sources.includes('https://openjdk.org/jeps/444'));
  });
}

// ---- from content-dates.test.mjs ----
{
  test('content dates are localized and keep machine-readable ISO values', () => {
    const row = { published_at: '2020-11-12', created_at: '2026-08-05', updated_at: '2026-08-11' };
    const en = contentDateFacts(row, 'en', { includePublished: true });
    const vi = contentDateFacts(row, 'vi', { includePublished: true });

    assert.deepEqual(en.map(fact => fact.kind), ['published', 'created', 'updated']);
    assert.deepEqual(en.map(fact => fact.value), ['2020-11-12', '2026-08-05', '2026-08-11']);
    assert.equal(en[0].label, 'Source published');
    assert.equal(vi[1].label, 'Đưa lên Gazl');
    assert.notEqual(en[2].formatted, vi[2].formatted);
  });

  test('an unchanged article shows one date, and it is the Updated one', () => {
    // Still one stamp, never two identical ones — but "Updated" is the fact a
    // reader is checking for, and a head that only ever says "Added to Gazl"
    // reads as if the freshness stamp went missing.
    const facts = contentDateFacts({ created_at: '2026-08-19', updated_at: '2026-08-19' }, 'vi');
    assert.deepEqual(facts.map(fact => fact.kind), ['updated']);
    assert.equal(facts[0].label, 'Cập nhật');
  });

  test('relative wording answers "is this current", and gives up past a year', async () => {
    const { relativeContentDate } = await import('../public/lib/content-dates.js');
    const now = Date.parse('2026-08-20T09:00:00Z');

    assert.equal(relativeContentDate('2026-08-20', 'en', now), 'today');
    assert.equal(relativeContentDate('2026-08-19', 'en', now), 'yesterday');
    assert.equal(relativeContentDate('2026-08-06', 'en', now), '2 weeks ago');
    // Past a year the date itself is more useful than "6 years ago".
    assert.equal(relativeContentDate('2020-11-12', 'en', now), formatContentDate('2020-11-12', 'en'));
    assert.equal(relativeContentDate('not-a-date', 'en', now), '');
  });

  test('technical review stays distinct from a file update and drives recent activity', async () => {
    const { contentActivityDate } = await import('../public/lib/content-dates.js');
    const row = { created_at: '2026-08-10', updated_at: '2026-08-12', reviewed_at: '2026-08-18' };
    assert.deepEqual(contentDateFacts(row, 'en').map(fact => fact.kind), ['created', 'updated', 'reviewed']);
    assert.equal(contentActivityDate(row), '2026-08-18');
  });

  test('invalid dates are omitted rather than rendered as misleading text', () => {
    assert.equal(formatContentDate('yesterday', 'en'), '');
    assert.deepEqual(contentDateFacts({ created_at: 'not-a-date' }, 'vi'), []);
  });

  test('native authored-content surfaces render dates and article structured data', async () => {
    const [question, collectionIndex, collectionArticle, designIndex, designArticle, project, gazl] = await Promise.all([
      readFile(new URL('../app/components/study/QuestionCard.vue', import.meta.url), 'utf8'),
      readFile(new URL('../app/components/content/CollectionIndex.vue', import.meta.url), 'utf8'),
      readFile(new URL('../app/components/content/CollectionArticle.vue', import.meta.url), 'utf8'),
      readFile(new URL('../app/pages/system-design/index.vue', import.meta.url), 'utf8'),
      readFile(new URL('../app/pages/system-design/[slug].vue', import.meta.url), 'utf8'),
      readFile(new URL('../app/pages/project.vue', import.meta.url), 'utf8'),
      readFile(new URL('../app/components/gazl/GazlJournal.client.vue', import.meta.url), 'utf8')
    ]);

    assert.match(question, /reviewed_at/);
    assert.match(question, /class="qreview"/);
    assert.match(question, /class="qreview-mobile"/);
    assert.match(collectionIndex, /contentDateFacts/);
    assert.match(collectionIndex, /class="content-sort"/);
    assert.match(collectionArticle, /contentDateFacts/);
    assert.match(collectionArticle, /datePublished:/);
    assert.match(collectionArticle, /dateModified:/);
    assert.match(designIndex, /contentDateFacts/);
    assert.match(designArticle, /datePublished:/);
    assert.match(designArticle, /dateModified:/);
    assert.match(project, /datePublished:/);
    assert.match(project, /dateModified:/);
    assert.match(gazl, /class="content-dates iv-content-dates"/);
  });
}

// ---- from content.audit.test.mjs ----
{
  const root = path.resolve(import.meta.dirname, '..');
  const audit = path.join(root, 'tools', 'audit-content.mjs');
  const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;

  function runAudit(flag) {
    const outputPath = path.join(os.tmpdir(), `content-audit-${randomUUID()}.log`);
    const output = openSync(outputPath, 'w');
    try {
      const result = spawnSync(process.execPath, [audit, flag], {
        cwd: root,
        env: childEnv,
        stdio: ['ignore', output, output]
      });
      closeSync(output);
      const text = readFileSync(outputPath, 'utf8');
      assert.equal(result.status, 0, text || `audit exited ${result.status}`);
      return text;
    } finally {
      try { closeSync(output); } catch {}
      unlinkSync(outputPath);
    }
  }

  test('--gaps treats tables and figures as explanatory evidence', () => {
    const output = runAudit('--gaps');
    assert.doesNotMatch(
      output,
      /15-network-i-o-models\.threading-network-programming\.q6/,
      'the HTTP lifecycle already has a detailed figure and must not be ranked as an unillustrated gap'
    );
  });

  test('--stale recognizes high-change standards and tools beyond the original product list', () => {
    const output = runAudit('--stale');
    assert.match(
      output,
      /13-security-oauth2\.oauth2-oidc\.q2[\s\S]*?OAuth 2\.1/,
      'OAuth 2.1 must be reviewable even though it is not Java/Spring/database software'
    );
    assert.match(
      output,
      /21-linux-production-debug\.jvm-network-deep-dive-on-prod\.q3[\s\S]*?async-profiler/i,
      'async-profiler guidance changes independently of the Java version mentioned in the same item'
    );
  });

  test('--refs always reports whether unvalidated chapter aliases remain', () => {
    const output = runAudit('--refs');
    assert.match(output, /non-canonical chapter references/i);
    assert.match(output, /non-canonical chapter references[\s\S]*?\nnone\n/i);
    assert.doesNotMatch(output, /\bch\.\d+\b/i);
  });
}

// ---- from content.edit-tool.test.mjs ----
{
  const root = path.resolve(import.meta.dirname, '..');
  const tool = path.join(root, 'tools', 'add-content.mjs');
  const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;

  function runTool(patchPath, directory) {
    const outputPath = path.join(directory, 'output.log');
    const output = openSync(outputPath, 'w');
    const result = spawnSync(process.execPath, [tool, patchPath, '--dry-run'], {
      cwd: root,
      env: childEnv,
      stdio: ['ignore', output, output]
    });
    closeSync(output);
    return { ...result, output: readFileSync(outputPath, 'utf8') };
  }

  test('content patch tool can replace a whole answer and question in dry-run mode', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'content-patch-'));
    const patchPath = path.join(dir, 'replace.patch');
    await writeFile(patchPath, [
      '@@ answer 01-java-core-jvm.concurrency.q1 en',
      'Replacement answer used only in memory.',
      '',
      '@@ question 01-java-core-jvm.concurrency.q1 vi',
      'Câu hỏi thay thế chỉ dùng trong bộ nhớ.',
      ''
    ].join('\n'), 'utf8');

    try {
      const result = runTool(patchPath, dir);
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /mode=answer/);
      assert.match(result.output, /mode=question/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('content patch tool can append a bilingual item in dry-run mode', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'content-item-patch-'));
    const patchPath = path.join(dir, 'item.patch');
    const id = '03-spring-boot-deep-build.auto-configuration-build.q99';
    await writeFile(patchPath, [
      `@@ item ${id} en extra`,
      '? Which baseline should a new Spring application target?',
      'Target a supported generation and record the compatibility matrix.',
      '',
      `@@ item ${id} vi extra`,
      '? Ứng dụng Spring mới nên chọn baseline nào?',
      'Chọn một thế hệ còn được hỗ trợ và ghi lại compatibility matrix.',
      ''
    ].join('\n'), 'utf8');

    try {
      const result = runTool(patchPath, dir);
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /mode=item/);
      assert.match(result.output, /2 would apply/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('content patch tool can replace one exact answer fragment in dry-run mode', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'content-fragment-patch-'));
    const patchPath = path.join(dir, 'fragment.patch');
    const topic = JSON.parse(await readFile(
      path.join(root, 'public', 'data', 'topics', '01-java-core-jvm.json'),
      'utf8'
    ));
    const item = topic.sections
      .flatMap(section => section.items)
      .find(candidate => candidate.id === '01-java-core-jvm.memory-execution-model.q1');
    const currentFirstLine = item.a.split('\n')[0];
    await writeFile(patchPath, [
      '@@ replace 01-java-core-jvm.memory-execution-model.q1 en',
      currentFirstLine,
      '=>',
      `${currentFirstLine} [dry-run replacement]`,
      ''
    ].join('\n'), 'utf8');

    try {
      const result = runTool(patchPath, dir);
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /mode=replace/);
      assert.match(result.output, /1 would apply/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}
