import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { PROMPT_ORIGINS, PUBLISHER_ORIGINS, REFERENCE_ORIGINS } from '../public/lib/constants.js';

const root = path.resolve(import.meta.dirname, '..');
const publicRoot = path.join(root, 'public');
const dataRoot = path.join(publicRoot, 'data');

const catalog = JSON.parse(await readFile(path.join(dataRoot, 'system-design/catalog.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(dataRoot, 'manifest.json'), 'utf8'));
const caseManifest = JSON.parse(await readFile(path.join(dataRoot, 'case-studies/manifest.json'), 'utf8'));
const movedRows = manifest.topics.filter(row => row.surface === 'system-design');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function movedSourceIds() {
  const ids = [];
  for (const row of manifest.topics) {
    if (row.surface !== 'system-design' && !row.system_design_items?.length) continue;
    const source = JSON.parse(await readFile(path.join(dataRoot, row.file), 'utf8'));
    const available = source.sections.flatMap(section => section.items.map(item => item.id));
    ids.push(...(row.surface === 'system-design' ? available : row.system_design_items));
  }
  return ids;
}

test('the catalog is a complete bilingual System Design library', () => {
  assert.equal(catalog.version, 1);
  // Numbering is contiguous from 1, not a fixed count: adding a blueprint is
  // routine and must not require editing this test.
  assert.ok(catalog.designs.length > 0);
  assert.deepEqual(
    catalog.designs.map(design => design.n),
    Array.from({ length: catalog.designs.length }, (_, index) => index + 1));

  const categoryIds = catalog.categories.map(category => category.id);
  const slugs = catalog.designs.map(design => design.slug);
  assert.equal(new Set(categoryIds).size, categoryIds.length);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(catalog.library.en.title && catalog.library.vi.title);
  assert.ok(catalog.production.en.label && catalog.production.vi.label);

  for (const category of catalog.categories) {
    assert.match(category.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const lang of ['en', 'vi']) {
      assert.ok(category[lang].label && category[lang].description, `${category.id}: incomplete ${lang}`);
    }
  }

  const scalarFields = ['title', 'excerpt', 'scope', 'diagram_title'];
  const listFields = ['functional', 'quality', 'capacity', 'data_model', 'stack', 'tradeoffs', 'tags'];
  for (const design of catalog.designs) {
    assert.match(design.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(categoryIds.includes(design.category), `${design.slug}: unknown category`);
    assert.ok(design.effort);
    assert.match(design.created_at, ISO_DATE, `${design.slug}: created_at`);
    assert.match(design.updated_at, ISO_DATE, `${design.slug}: updated_at`);
    assert.ok(design.created_at <= design.updated_at, `${design.slug}: dates are reversed`);
    if (design.reviewed_at) assert.match(design.reviewed_at, /^\d{4}-\d{2}-\d{2}$/, `${design.slug}: reviewed_at`);
    assert.match(design.diagram, /^flowchart\s+(?:LR|RL|TB|BT|TD)\n/);
    assert.doesNotMatch(design.diagram, /<svg|<script/i);
    // source_items is optional: a design migrated from the Study Track carries
    // them, one written directly for this library has none. validate-content
    // checks the ids themselves when they are present.
    assert.ok(Array.isArray(design.source_items), `${design.slug}: source_items must be an array`);
    if (design.reference_image) {
      assert.match(design.reference_image.src,
        /^assets\/system-design\/[a-z0-9][a-z0-9._/-]*\.(?:avif|jpe?g|png|webp)$/i);
      assert.ok(Number.isInteger(design.reference_image.width) && design.reference_image.width > 0);
      assert.ok(Number.isInteger(design.reference_image.height) && design.reference_image.height > 0);
      for (const lang of ['en', 'vi']) {
        assert.ok(design.reference_image[lang]?.alt?.trim(), `${design.slug}: missing ${lang} image alt`);
        assert.ok(design.reference_image[lang]?.caption?.trim(), `${design.slug}: missing ${lang} image caption`);
      }
    }
    for (const lang of ['en', 'vi']) {
      for (const field of scalarFields) assert.ok(design[lang][field]?.trim(), `${design.slug}: empty ${lang}.${field}`);
      for (const field of listFields) {
        assert.ok(Array.isArray(design[lang][field]) && design[lang][field].length > 0,
          `${design.slug}: empty ${lang}.${field}`);
        assert.ok(design[lang][field].every(value => String(value).trim()), `${design.slug}: blank ${lang}.${field} row`);
      }
      for (const field of ['data_model', 'stack', 'tradeoffs']) {
        assert.ok(design[lang][field].length >= 3, `${design.slug}: ${lang}.${field} needs comparable alternatives`);
      }
      const decisionDepth = ['data_model', 'stack', 'tradeoffs']
        .flatMap(field => design[lang][field]).reduce((total, value) => total + value.length, 0);
      assert.ok(decisionDepth >= 700, `${design.slug}: ${lang} decision sections are too shallow`);
    }
  }
});

test('every blueprint can answer the shared failure-review lenses', async () => {
  const view = await readFile(path.join(root, 'app/pages/system-design/[slug].vue'), 'utf8');
  assert.match(view, /const failureReview/);
  assert.match(view, /class="sd-failure-review"/);
  assert.match(view, /copy\.quality/);
  assert.match(view, /copy\.capacity/);
  assert.match(view, /copy\.data_model/);
});

test('RabbitMQ tenant fairness separates routing from scheduling', async () => {
  const design = catalog.designs.find(row => row.slug === 'multi-tenant-rabbitmq-fairness');
  assert.ok(design);
  assert.equal(design.source_url, 'https://voz.vn/t/hoi-dap-xin-tu-van-kien-truc-rabbitmq-giai-quyet-bai-toan-load-balancing-tenant-fairness-tranh-tinh-trang-1-user-spam-lam-tac-nghen-user-khac.1263215/');
  for (const lang of ['en', 'vi']) {
    const body = design[lang];
    assert.match(body.scope, /routing (?:is not|không phải) scheduling/i);
    assert.ok(body.stack.some(row => /Deficit Round Robin/.test(row)), `${lang}: no cost-aware scheduler`);
    assert.ok(body.capacity.some(row => /prefetch/i.test(row)), `${lang}: prefetch boundary missing`);
    assert.ok(body.tradeoffs.some(row => /Queue per tenant/i.test(row)), `${lang}: queue topology trade-off missing`);
    assert.equal(body.failure_review?.length, 5, `${lang}: five answered failure-review prompts required`);
  }

  assert.ok(PROMPT_ORIGINS.includes('https://voz.vn'), 'the discussion prompt origin must be approved');
  assert.ok(REFERENCE_ORIGINS.includes('https://www.rabbitmq.com'), 'the primary RabbitMQ docs must be citable');
  const article = await readFile(path.join(root, 'app/pages/system-design/[slug].vue'), 'utf8');
  assert.match(article, /promptHref|PROMPT_ORIGINS|source_url/,
    'a blueprint keeps prompt attribution in the native article contract');
  // A prompt thread is the question, not a credit: it must never pass as one.
  assert.ok(!PUBLISHER_ORIGINS.some(origin => PROMPT_ORIGINS.includes(origin)),
    'prompt origins must stay out of the publisher allowlist');
});

test('Topic 18 keeps the durable flash-sale lifecycle and scale-in guidance', () => {
  const design = catalog.designs.find(row => row.slug === 'flash-sale-booking-inventory-bottleneck');
  assert.ok(design);
  assert.match(design.diagram, /^flowchart TB\n/);
  for (const marker of ['Edge waiting room', 'MQ hold-created', 'MQ payment-result', 'MQ confirm or release']) {
    assert.match(design.diagram, new RegExp(marker));
  }
  for (const lang of ['en', 'vi']) {
    const body = design[lang];
    assert.ok(body.functional.some(row => /outbox|Outbox/.test(row)), `${lang}: durable payment handoff missing`);
    assert.ok(body.capacity.some(row => /scale-in|Scale-in|scale-in|Gate scale-in/.test(row)), `${lang}: scale-in gate missing`);
    assert.ok(body.stack.some(row => /pre-warm|Pre-warm/.test(row)), `${lang}: pre-warm policy missing`);
    assert.ok(body.tradeoffs.some(row => /Scale.to.zero|Scale-to-zero/.test(row)), `${lang}: low-traffic trade-off missing`);
    assert.equal(body.failure_review?.length, 5, `${lang}: five answered failure-review prompts required`);
    assert.ok(body.failure_review.every(row => row.question && row.answer), `${lang}: failure review answer missing`);
    assert.ok(body.functional.some(row => /backpressure/i.test(row)), `${lang}: backpressure contract missing`);
    assert.ok(body.quality.some(row => /backpressure/i.test(row)), `${lang}: backpressure safety missing`);
    assert.ok(body.capacity.some(row => /backpressure/i.test(row)), `${lang}: backpressure capacity check missing`);
    assert.ok(body.stack.some(row => /backpressure/i.test(row)), `${lang}: backpressure valve missing`);
    assert.ok(body.tradeoffs.some(row => /backpressure/i.test(row)), `${lang}: backpressure trade-off missing`);
  }
});

test('Blueprint 16 ships the supplied e-commerce reference architecture with a critical-path model', async () => {
  const design = catalog.designs.find(row => row.slug === 'scaling-1m-to-10m-requests');
  assert.ok(design?.reference_image);
  await access(path.join(publicRoot, design.reference_image.src));
  for (const marker of ['Checkout Saga', 'Order DB and outbox', 'Inventory DB and outbox',
    'Payment DB and outbox', 'Retry and DLQ']) {
    assert.match(design.diagram, new RegExp(marker));
  }
  for (const lang of ['en', 'vi']) {
    const body = design[lang];
    assert.match(body.scope, /1M DAU/);
    assert.ok(body.capacity.some(row => /DAU.*(?:not|không phải).*requests?\/day/i.test(row)),
      `${lang}: DAU/request unit guard missing`);
    assert.ok(body.data_model.some(row => /outbox/i.test(row)), `${lang}: outbox model missing`);
    assert.ok(body.stack.some(row => /at.least.once/i.test(row)), `${lang}: delivery semantics missing`);
    assert.equal(body.failure_review?.length, 5, `${lang}: explicit failure review required`);
  }

  assert.equal(design.en.stack.length, 18, 'each e-commerce technology needs its own decision row');
  assert.equal(design.vi.stack.length, design.en.stack.length, 'technology decisions must stay bilingual');
  const technologyNames = design.en.stack.map(row => row.split(' — ')[0]);
  for (const technology of [
    'Image CDN', 'API Gateway', 'Service discovery with Kubernetes Service/DNS',
    'Search Service plus Elasticsearch/OpenSearch', 'Product Redis cache', 'Cart DB plus Cart Redis',
    'Checkout Saga plus Checkout DB', 'Idempotency store', 'Order Service plus relational Order DB',
    'Inventory Service plus relational Inventory DB', 'Payment Service plus relational Payment DB',
    'Transactional Outbox, relay and consumer Inbox', 'Kafka event log', 'RabbitMQ work queues',
    'Bounded retry plus DLQ', 'After-payment workers and After Payment DB',
    'Observability and reconciliation workers', 'Shards and cells'
  ]) {
    assert.ok(technologyNames.includes(technology), `technology decision missing: ${technology}`);
  }
  assert.ok(design.en.stack.every(row => /Problem solved:.*Flow position:.*Failure \/ cost:.*Tier verdict:/.test(row)),
    'English technology rows need purpose, flow, failure/cost and a tier verdict');
  assert.ok(design.vi.stack.every(row => /Vấn đề giải quyết:.*Vị trí trong flow:.*Failure \/ cái giá:.*Phán quyết theo tier:/.test(row)),
    'Vietnamese technology rows need purpose, flow, failure/cost and a tier verdict');
  assert.ok(design.en.stack.every(row => /not needed|worth it|mandatory|needs its own scaling story/.test(row)),
    'English technology rows must use the shared tier vocabulary');
  assert.ok(design.vi.stack.every(row => /không cần|nên có|bắt buộc|cần scale riêng/.test(row)),
    'Vietnamese technology rows must use the shared tier vocabulary');
});

test('Topic 10–11, Topic 27 and the OTA/whiteboard overlap are moved once, with every immutable id covered', async () => {
  assert.deepEqual(movedRows.map(row => row.n), [10, 11, 27]);
  assert.equal(manifest.topics.find(row => row.n === 16).system_design_items.length, 6);
  const expected = await movedSourceIds();
  const actual = catalog.designs.flatMap(design => design.source_items);

  assert.equal(expected.length, 59);
  assert.equal(actual.length, expected.length);
  assert.equal(new Set(actual).size, actual.length, 'one source question was assigned to two blueprints');
  assert.deepEqual([...actual].sort(), [...expected].sort());
});

/* The reader is told where a blueprint's migrated notes came from. The view's
   fallback sentence names topics 10–11 and 16, so any design fed from another
   topic has to carry its own — in the catalog, bilingually. This existed once
   as a slug branch inside the view, which is the shape to keep out. */
test('a design fed from another topic states its own provenance, in both languages', () => {
  const FALLBACK_TOPICS = new Set(['10', '11', '16']);
  for (const design of catalog.designs) {
    const sourceTopics = new Set(design.source_items.map(id => id.slice(0, 2)));
    const needsOwnNote = [...sourceTopics].some(topic => !FALLBACK_TOPICS.has(topic));
    if (!needsOwnNote) continue;
    for (const lang of ['en', 'vi']) {
      assert.ok(String(design[lang].migrated_note || '').trim(),
        `${design.slug}: ${lang}.migrated_note missing — the view would claim these notes came from topics 10–11/16`);
    }
  }
});

test('all Systems & Architecture at Scale cases moved into System Design with Mermaid lenses', () => {
  const expected = caseManifest.articles
    .filter(article => article.category === 'systems-architecture')
    .map(article => article.slug)
    .sort();
  const actual = Object.keys(catalog.case_overviews).sort();

  assert.equal(expected.length, 6);
  assert.deepEqual(actual, expected);
  for (const [slug, overview] of Object.entries(catalog.case_overviews)) {
    assert.match(overview.diagram, /^flowchart\s+(?:LR|RL|TB|BT|TD)\n/, slug);
    assert.doesNotMatch(overview.diagram, /<svg|<script/i);
    for (const lang of ['en', 'vi']) {
      assert.ok(overview[lang].title?.trim(), `${slug}: no ${lang} title`);
      assert.ok(overview[lang].lens?.trim(), `${slug}: no ${lang} architecture lens`);
    }
  }
});

test('every blueprint has bilingual research lenses backed by primary sources', async () => {
  const { SYSTEM_DESIGN_RESEARCH: research } = await import(pathToFileURL(
    path.join(dataRoot, 'system-design/research.js')).href);
  const allowedOrigins = new Set([
    'https://sre.google', 'https://docs.aws.amazon.com', 'https://developers.cloudflare.com',
    'https://redis.io', 'https://docs.stripe.com', 'https://www.postgresql.org',
    'https://kafka.apache.org', 'https://www.rabbitmq.com', 'https://learn.microsoft.com', 'https://www.elastic.co',
    'https://opentelemetry.io', 'https://www.rfc-editor.org', 'https://docs.spring.io',
    'https://openid.net', 'https://resilience4j.readme.io', 'https://www.openpolicyagent.org'
  ]);

  assert.deepEqual(Object.keys(research.assignments).sort(), catalog.designs.map(row => row.slug).sort());
  for (const design of catalog.designs) {
    const packIds = research.assignments[design.slug];
    assert.ok(packIds.length >= 2, `${design.slug}: needs at least two research lenses`);
    for (const id of packIds) assert.ok(research.packs[id], `${design.slug}: unknown research pack ${id}`);
  }
  for (const [id, pack] of Object.entries(research.packs)) {
    assert.ok(pack.sources.length >= 2, `${id}: needs primary sources`);
    for (const [, href] of pack.sources) assert.ok(allowedOrigins.has(new URL(href).origin), `${id}: untrusted source`);
    for (const lang of ['en', 'vi']) {
      assert.ok(pack[lang].title && pack[lang].intro, `${id}: incomplete ${lang}`);
      assert.equal(pack[lang].sections.length, 3, `${id}: expected three deep-dive sections`);
      assert.ok(pack[lang].sections.every(section => section.title && section.items.length >= 2),
        `${id}: shallow ${lang} section`);
    }
  }
});

/* Which chunks a flowchart needs cannot be derived by reading imports. Static
   ones understate it — dagre, the default layout engine, arrives through a
   dynamic import() inside a lazily-registered loader, and an earlier vendor set
   shipped without it: the module loaded, then every diagram failed at render
   time. Following dynamic ones too overstates it, pulling in katex and other
   families that only load conditionally.

   So the set is pinned to what a real browser actually requested while
   rendering every diagram in the catalog (see the vendored README). This test
   guards that list; regenerate it the same way when upgrading Mermaid. */
const FLOWCHART_RUNTIME = [
  'mermaid.esm.min.mjs',
  'chunks/mermaid.esm.min/flowDiagram-BWE6NHOH.mjs',
  'chunks/mermaid.esm.min/dagre-K64A6Z3X.mjs',
  ...['2AEHWXPW', '2SREHG4O', '5IMINLNL', '5VCL7Z4A', '6BELYETK', '6L755F7B', '7CWYLC5S',
    '7FYTHRHK', 'A7VWPJGB', 'AQ6EADP3', 'AZZRMDJM', 'KRXBNO2N', 'LIEV3EAG', 'NLANEA3F',
    'PE7DX7ZZ', 'Q67WD55A', 'STOV2HOB', 'SZD42YQK', 'TGVD4F4B', 'UAT7B5JY', 'VE5CLXGZ',
    'VY5UBI4V', 'W44A43WB', 'WJBAP47W'].map(id => `chunks/mermaid.esm.min/chunk-${id}.mjs`)
];

test('the vendored Mermaid flowchart runtime is complete', async () => {
  const vendorRoot = path.join(publicRoot, 'vendor/mermaid-11.16.1');
  for (const relative of FLOWCHART_RUNTIME) {
    await access(path.join(vendorRoot, relative));
  }
  assert.equal(FLOWCHART_RUNTIME.length, 27);
});

test('the shared loader resolves migrated notes and switches the whole collection in memory', async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key)
  };
  const fetched = [];
  globalThis.fetch = async url => {
    const clean = String(url).replace(/^\.?\//, '').split('?')[0];
    fetched.push(clean);
    try {
      const body = await readFile(path.join(publicRoot, clean), 'utf8');
      return {
        ok: true,
        json: async () => JSON.parse(body),
        text: async () => body
      };
    } catch (error) {
      return { ok: false, status: 404 };
    }
  };

  try {
    const { Content } = await import(pathToFileURL(path.join(publicRoot, 'lib/content.js')).href);
    const { SystemDesign } = await import(pathToFileURL(path.join(publicRoot, 'lib/system-design.js')).href);
    await Content.load();
    await SystemDesign.load('en');

    assert.equal(Content.topics.length, manifest.topics.length - movedRows.length);
    assert.equal(SystemDesign.designs.length, catalog.designs.length);
    // effort must survive apply(): the view falls back to a hardcoded "45 min",
    // so a dropped field shows a plausible wrong number rather than nothing.
    for (const design of SystemDesign.designs) {
      const source = catalog.designs.find(row => row.slug === design.slug);
      assert.equal(design.effort, source.effort, `${design.slug}: effort lost in apply()`);
      if (source.reference_image) {
        assert.equal(design.reference_image?.src, source.reference_image.src,
          `${design.slug}: reference image lost in apply()`);
        assert.equal(design.reference_image?.alt, source.reference_image.en.alt,
          `${design.slug}: localized image metadata lost in apply()`);
      }
    }
    assert.equal(SystemDesign.cases.length, 6);
    assert.equal(SystemDesign.designs.flatMap(design => design.sourceNotes).length, 59);
    const itemId = catalog.designs[4].source_items[0];
    assert.equal(SystemDesign.designForSourceItem(itemId).slug, 'payment-ledger');
    assert.equal(SystemDesign.designForSourceItem('missing.q1'), null);
    const englishTitle = SystemDesign.design('payment-ledger').title;
    const eagerFetches = fetched.length;

    await SystemDesign.load('vi');
    assert.equal(fetched.length, eagerFetches, 'bilingual sources should already be cached');
    assert.equal(SystemDesign.design('payment-ledger').title, catalog.designs[4].vi.title);
    assert.notEqual(SystemDesign.design('payment-ledger').title, englishTitle);
    const illustrated = catalog.designs.find(row => row.reference_image);
    assert.equal(SystemDesign.design(illustrated.slug).reference_image.alt, illustrated.reference_image.vi.alt,
      'VI image metadata did not switch with the article');
    assert.ok(SystemDesign.design('payment-ledger').sourceNotes.every(note => note.q && note.a));
  } finally {
    delete globalThis.fetch;
    delete globalThis.localStorage;
  }
});

test('native System Design and Case Studies keep the migrated reader contracts', async () => {
  const [designIndex, designArticle, caseIndex, mermaid, styles] = await Promise.all([
    readFile(path.join(root, 'app/pages/system-design/index.vue'), 'utf8'),
    readFile(path.join(root, 'app/pages/system-design/[slug].vue'), 'utf8'),
    readFile(path.join(root, 'app/pages/case-studies/index.vue'), 'utf8'),
    readFile(path.join(publicRoot, 'lib/mermaid.js'), 'utf8'),
    readFile(path.join(publicRoot, 'styles.css'), 'utf8')
  ]);

  assert.match(designIndex, /system-design:index/);
  assert.match(designIndex, /designRoute/);
  assert.match(designArticle, /failureReview/);
  assert.match(designArticle, /copyNoteLink/);
  assert.match(designArticle, /ContentMermaidDiagram/);
  assert.match(designArticle, /safeDecodeURIComponent/);
  assert.match(caseIndex, /ContentCollectionIndex collection="case-studies"/);
  assert.match(mermaid, /vendor\/mermaid-11\.16\.1\/mermaid\.esm\.min\.mjs/);
  assert.match(mermaid, /securityLevel: 'strict'/);
  assert.match(mermaid, /startOnLoad: false/);
  assert.match(mermaid, /logLevel: 'fatal'/);
  assert.doesNotMatch(mermaid, /https?:\/\//);
  assert.match(styles, /\.sd-diagram/);
  assert.match(styles, /\.sd-failure-review/);
  await readFile(path.join(publicRoot, 'vendor/mermaid-11.16.1/LICENSE'), 'utf8');
});

test('native question cards keep controls outside the heading button', async () => {
  const source = await readFile(path.join(root, 'app/components/study/QuestionCard.vue'), 'utf8');
  const headStart = source.indexOf('<button class="qhead"');
  const headEnd = source.indexOf('</button>', headStart);
  assert.ok(headStart > 0 && headEnd > headStart);
  const head = source.slice(headStart, headEnd);
  assert.doesNotMatch(head, /qcopy|qlangbtn/);
  assert.match(source, /<\/button>\s*<div class="qmeta">/);
  assert.match(source, /class="qcopy"/);
  assert.match(source, /class="langswitch qlangbtn"/);
});
