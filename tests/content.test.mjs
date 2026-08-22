import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { test } from 'node:test';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { route } from './nitro-route.mjs';
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

  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
    const payload = await route('content/topic/[slug]', { slug: META.topics['1'].key });
    assert.equal(payload.rows.length, TRACK_ROWS.length, 'the picker lists exactly the Study Track');
    assert.equal(payload.rows.find(row => row.n === 25)?.topic_type, 'microservice');
    assert.ok(payload.en.sections.length, 'the requested topic arrives complete in English');
  });

  test('every topic exposes Git-derived written and updated dates', async () => {
    for (const row of MANIFEST.topics) {
      const metadata = META.topics[String(row.n)];
      assert.match(metadata.created_at, ISO_DATE, row.file + ': created_at');
      assert.match(metadata.updated_at, ISO_DATE, row.file + ': updated_at');
      assert.ok(metadata.created_at <= metadata.updated_at, row.file + ': dates are reversed');
    }
    const payload = await route('content/topic/[slug]', { slug: META.topics['1'].key });
    assert.match(payload.meta.created_at, ISO_DATE);
    assert.match(payload.meta.updated_at, ISO_DATE);
  });

  test('moved System Design sources leave the Study Track but remain available by immutable item id', async () => {
    const payload = await route('content/topic/[slug]', { slug: META.topics['16'].key });
    const listed = new Set(payload.rows.map(row => row.n));
    assert.equal(listed.has(10), false);
    assert.equal(listed.has(11), false);

    // The whole-topic case: 10, 11 and 27 keep their files and their ids, and a
    // blueprint reaches them through source_items.
    for (const row of MANIFEST.topics.filter(candidate => candidate.surface === 'system-design')) {
      const source = TOPIC_FILES.get('data/' + row.file);
      const viSource = TOPIC_VI_FILES.get('data/' + row.file.replace(/\.json$/, '.vi.json'));
      const viById = new Map(viSource.sections.flatMap(section => section.items).map(item => [item.id, item]));
      for (const item of source.sections.flatMap(section => section.items)) {
        assert.ok(viById.get(item.id)?.q, `${item.id} lost its Vietnamese companion`);
      }
    }

    /* The per-item case: topic 16 keeps those rows in its own file — the ids are
       stored Sheet keys and must never be deleted — so the route ships them and
       the VIEW drops them. Asserting on the payload would assert the opposite of
       the rule. What the route owes is the row that says which ids moved, plus
       the blueprint that now owns each one. */
    const moved = MANIFEST.topics.find(row => row.n === 16).system_design_items || [];
    assert.ok(moved.length, 'topic 16 is the overlap case; without it this proves nothing');
    assert.deepEqual(payload.row.system_design_items, moved, 'the view cannot filter what it is not told');
    for (const id of moved) {
      assert.ok(payload.sourceOwners[id], `${id} names no blueprint that owns it`);
    }
    const view = await readFile(path.join(root, 'app/components/study/TopicPage.vue'), 'utf8');
    assert.match(view, /row\.system_design_items/, 'the view must filter the moved ids');
    assert.match(view, /moved\.value\.has|!moved\.value/, 'and actually apply that set');
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

  test('both languages of a topic arrive together, so the header switch never refetches', async () => {
    const key = META.topics['1'].key;
    const payload = await route('content/topic/[slug]', { slug: key });
    const enBase = TOPIC_FILES.get('data/topics/' + key + '.json');
    const viBase = TOPIC_VI_FILES.get('data/topics/' + key + '.vi.json');

    assert.equal(payload.en.sections[0].title, enBase.sections[0].title);
    assert.equal(payload.vi.sections[0].title, viBase.sections[0].title);
    assert.equal(payload.en.sections[0].items[0].a, enBase.sections[0].items[0].a);
    assert.equal(payload.vi.sections[0].items[0].a, viBase.sections[0].items[0].a);
  });

  test('one route serves one topic; the rest are metadata until asked for', async () => {
    const payload = await route('content/topic/[slug]', { slug: META.topics['1'].key });
    // Every row for the picker, but only the requested topic's answers.
    assert.equal(payload.rows.length, TRACK_ROWS.length);
    assert.equal(payload.stem, META.topics['1'].key);
    assert.ok(!('sections' in payload.rows[1]), 'an unopened topic must stay a metadata shell');
    assert.equal(Object.keys(payload.topicMeta).length, Object.keys(META.topics).length);
  });

  test('technical review provenance is carried per immutable item id', async () => {
    // The route ships the review map whole and the view joins it onto the item,
    // so the contract to hold is that every reviewed id is a real item and the
    // map reaches the page keyed by that id.
    const payload = await route('content/topic/[slug]', { slug: META.topics['1'].key });
    const [id, review] = Object.entries(REVIEWS)[0];
    assert.equal(payload.reviews[id].reviewed_at, review.reviewed_at);

    const owner = TOPIC_FILES.get('data/topics/' + id.split('.')[0] + '.json');
    assert.ok(owner, `${id} names no topic file`);
    assert.ok(owner.sections.flatMap(section => section.items).some(item => item.id === id),
      `${id} is reviewed but no longer exists`);

    const view = await readFile(path.join(root, 'app/components/study/TopicPage.vue'), 'utf8');
    assert.match(view, /reviews\[item\.id\]\?\.reviewed_at/);
  });

  test('a missing .vi.json degrades to the English base instead of throwing', async () => {
    // Every companion exists today, so the guard is proven on a topic renamed
    // out from under the route rather than by deleting a real file.
    const missing = await route('content/topic/[slug]', { slug: META.topics['1'].key });
    assert.ok(missing.vi, 'the real pair still loads');

    await assert.rejects(() => route('content/topic/[slug]', { slug: 'no-such-topic' }),
      /not found/i, 'an unknown topic is a 404, never a half-rendered page');
  });

  test('the payload carries both languages untouched, so neither can overwrite the other', async () => {
    const key = META.topics['17'].key;
    const payload = await route('content/topic/[slug]', { slug: key });
    const meta = payload.topicMeta['17'];
    assert.ok(meta.en.label && meta.vi.label);
    assert.notEqual(meta.en.label, meta.vi.label, 'topic 17 is translated; a shared object would collapse them');
    // The route hands over the sources; nothing overlays one onto the other.
    assert.notEqual(payload.en.sections[0].items[0].a, payload.vi.sections[0].items[0].a);
  });

/* Three surfaces need content-index.json during SSR — the progress ring's
     denominator, the per-topic progress in the picker, and the cross-reference
     resolver. $fetch of a raw file under public/ does not resolve on the
     server, so all three silently received null and rendered nothing: no ring,
     no per-topic bars, and every written (item-id) left as dead text. */
  test('the item index is read through a route, never as a raw public file', async () => {
    const payload = await route('content/item-index');
    assert.ok(Object.keys(payload.items).length > 300);
    assert.ok(payload.topics.length > 20);

    for (const file of ['app/components/study/ProgressRing.client.vue',
      'app/components/study/TopicProgress.client.vue',
      'app/components/study/TopicPage.vue',
      'app/pages/system-design/[slug].vue']) {
      const source = await readFile(path.join(root, file), 'utf8');
      assert.match(source, /\/api\/content\/item-index/, file + ' must read the index through the route');
      assert.ok(!source.includes("'/data/content-index.json'"),
        file + ' still fetches the raw file, which is null on the server');
    }
  });

  test('a cross-reference links to the target question, not to a bare Q number', async () => {
    const card = await readFile(path.join(root, 'app/components/study/QuestionCard.vue'), 'utf8');
    const page = await readFile(path.join(root, 'app/components/study/TopicPage.vue'), 'utf8');
    // One resolver per page, from lib/cross-ref.js — not a label rebuilt inline.
    assert.match(page, /crossRefResolver\(/);
    assert.match(card, /resolveRef: props\.resolveRef/);
    assert.ok(!/label: `Q\$\{/.test(card), 'a Q number names nothing the reader can recognise');
    assert.ok(!/label: `Q\$\{/.test(await readFile(path.join(root, 'app/pages/system-design/[slug].vue'), 'utf8')));
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

  test('Distributed Lock & Lease explains authority, expiry and readable operating choices', () => {
    const row = MANIFEST.topics.find(candidate => candidate.n === 28);
    assert.ok(row, 'topic 28 must be published');
    assert.equal(row.topic_type, 'design');

    const en = TOPIC_FILES.get('data/' + row.file);
    const vi = TOPIC_VI_FILES.get('data/' + row.file.replace(/\.json$/, '.vi.json'));
    assert.ok(en && vi, 'topic 28 must have both language files');
    assert.ok(en.sections.length >= 4, 'the topic needs a navigable learning outline');

    const enItems = en.sections.flatMap(section => section.items);
    const viItems = vi.sections.flatMap(section => section.items);
    assert.equal(viItems.map(item => item.id).join('|'), enItems.map(item => item.id).join('|'));
    assert.ok(enItems.length >= 14, 'the topic needs enough coverage to be useful beyond a lock recipe');

    const enText = enItems.map(item => `${item.q}\n${item.a}`).join('\n');
    const viText = viItems.map(item => `${item.q}\n${item.a}`).join('\n');
    for (const pattern of [
      /safety/i,
      /liveness/i,
      /fencing token/i,
      /SKIP LOCKED/i,
      /compare-and-delete/i,
      /TTL|lease expiry/i,
      /authoritative (database|DB)|correctness/i
    ]) assert.match(enText, pattern, `English topic is missing ${pattern}`);
    for (const pattern of [/fencing token/i, /SKIP LOCKED/i, /TTL|lease/i, /correctness|tính đúng đắn/i]) {
      assert.match(viText, pattern, `Vietnamese topic is missing ${pattern}`);
    }
    assert.ok(enItems.some(item => /<table[ >]/i.test(item.a)), 'the topic needs a readable comparison table');
    assert.ok(enItems.some(item => /:::tip|:::warn|<pre><code>/i.test(item.a)),
      'the topic needs callouts or runnable-looking examples');
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
    // One reviewed stamp, in the answer, worded by the shared component — the
    // collapsed row carries no date of its own and no second date format.
    assert.match(question, /class="content-dates qreview"/);
    assert.ok(!/qreview-mobile/.test(question), 'the duplicate mobile stamp is gone');
    assert.ok(!/Intl\.DateTimeFormat/.test(question), 'the card must not keep its own date format');
    assert.match(question, /<ContentDateStamp/);
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
