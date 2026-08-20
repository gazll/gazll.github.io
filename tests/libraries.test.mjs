import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { access, readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PROMPT_ORIGINS, PUBLISHER_ORIGINS, REFERENCE_ORIGINS } from '../public/lib/constants.js';

/* The three bilingual article collections and the blueprint library
   built over them: manifest contracts, source-kind rules, the settled reading
   format and the cross-references that tie them to the Study Track.

   Merged from: system-design, case-studies, knowledge, cross-ref.
   Each block keeps its own scope so fixtures and helpers cannot collide. */

// ---- from system-design.test.mjs ----
{
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
    // The lenses fall back to the design's own prose pools when a blueprint
    // ships no explicit failure_review.
    for (const pool of ['quality', 'capacity', 'stack', 'data_model', 'tradeoffs']) {
      assert.ok(view.includes(`copy.value.${pool}`), `the failure-review fallback must read ${pool}`);
    }
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

  /* The blueprint reading format is settled (CLAUDE.md): decision rows stack,
     a `:` or `—` is a structural break, three tones stay rare, and prose the
     author wrote as a list prints as one. It was rendered raw once during the
     Nuxt migration — 350 of 588 rows lost their name/detail split and the
     longest ran 914 characters as one block — so it is pinned here.

     Two ways emphasis corrupts text silently rather than failing the build: the
     numeric pattern eating an earlier pattern's sentinel digits, and it reading
     the "39" of &#39; as a quantity. */
  test('the three-tone emphasis never corrupts the text it highlights', async () => {
    const { emphasize } = await import(pathToFileURL(path.join(root, 'app/utils/design-prose.js')).href);
    const { escapeHtml } = await import(pathToFileURL(path.join(publicRoot, 'lib/markdown.js')).href);

    // lib/markdown.js's escapeHtml leaves ' alone, so the apostrophe stays literal.
    assert.equal(emphasize("it's 1M"), "it's <b class=\"sd-num\">1M</b>");
    assert.equal(emphasize('&'), '&amp;');
    // escapeHtml only emits &amp; &lt; &gt; &quot;, none of which carry digits,
    // so no catalog text can present a numeric entity to QUANTITY.
    assert.equal(emphasize('x > 1'), 'x &gt; <b class="sd-num">1</b>');

    let spans = 0;
    let rows = 0;
    for (const design of catalog.designs) {
      for (const lang of ['en', 'vi']) {
        for (const field of ['data_model', 'stack', 'tradeoffs', 'capacity', 'functional', 'quality']) {
          for (const row of design[lang][field]) {
            const out = emphasize(row);
            const label = `${design.slug}.${lang}.${field}`;
            assert.doesNotMatch(out, /[-]/, `${label}: sentinel leaked into the output`);
            assert.doesNotMatch(out, /<b[^>]*><b/, `${label}: nested emphasis`);
            assert.doesNotMatch(out, /&#?\w*<b/, `${label}: an entity was split by a tag`);
            assert.equal(out.replace(/<\/?b(?: class="sd-(?:crit|note|num)")?>/g, ''), escapeHtml(row),
              `${label}: emphasis changed the text`);
            spans += (out.match(/<b /g) || []).length;
            rows++;
          }
        }
      }
    }
    // Emphasis only works if it stays rare; a keyword-list pattern pushed this
    // past 3 and every paragraph turned into a ransom note.
    assert.ok(spans / rows < 1, `emphasis is too dense: ${(spans / rows).toFixed(2)} spans per row`);
  });

  /* renderScope and listRow restructure prose for readability, which means they
     are the two places a rewrite can silently swallow a sentence or a colon.
     Compared whitespace-insensitively: the transforms legitimately move text
     across block boundaries, but must never drop or invent a character. */
  test('breaking prose into paragraphs and labels never loses text', async () => {
    const { comparisonTable, listRow, renderScope } = await import(
      pathToFileURL(path.join(root, 'app/utils/design-prose.js')).href);
    const { escapeHtml } = await import(pathToFileURL(path.join(publicRoot, 'lib/markdown.js')).href);
    // A semicolon that became a bullet is the one character a transform may
    // consume, so it is normalised on both sides; everything else must survive.
    const bare = html => html.replace(/<[^>]+>/g, '').replace(/[\s;]+/g, '');

    let broken = 0;
    let labelled = 0;
    let listed = 0;
    let listRows = 0;
    for (const design of catalog.designs) {
      for (const lang of ['en', 'vi']) {
        const scope = renderScope(design[lang].scope);
        assert.equal(bare(scope), bare(escapeHtml(design[lang].scope)),
          `${design.slug}.${lang}: renderScope changed the text`);
        assert.match(scope, /^<p/, `${design.slug}.${lang}: scope must start with a paragraph`);
        // bullets always follow the line that introduces them
        if (scope.includes('sd-clause-list')) {
          assert.match(scope, /<\/p><ul class="sd-clause-list">/, `${design.slug}.${lang}: bullets without a lead`);
        }
        if (scope.includes('sd-thesis')) {
          assert.match(scope, /<p class="sd-thesis">[\s\S]*<\/p>$/, `${design.slug}: thesis must close the scope`);
          broken++;
        }
        for (const field of ['functional', 'quality', 'capacity']) {
          for (const row of design[lang][field]) {
            const out = listRow(row);
            assert.equal(bare(out), bare(escapeHtml(row)), `${design.slug}.${field}: listRow changed the text`);
            assert.match(out, /^<li/);
            if (out.includes('sd-row-label')) {
              // the colon rides with the label rather than being deleted
              assert.match(out, /<b class="sd-row-label">[^<]*:<\/b>|:<\/b>/, `${design.slug}: label lost its colon`);
              labelled++;
            }
            if (out.includes('sd-clause-list')) listed++;
            listRows++;
          }
        }

        // A decision row stacks its name over the detail; it is never a table,
        // and .sd-comparison-wrap stays the outer class.
        for (const field of ['data_model', 'stack']) {
          const rows = design[lang][field];
          const html = comparisonTable(rows, ['Name', 'Detail'], `sd-${field}-table`);
          assert.match(html, /^<div class="sd-comparison-wrap /, `${design.slug}.${field}: wrapper class changed`);
          assert.doesNotMatch(html, /<table/, `${design.slug}.${field}: decision rows must not be a table`);
          assert.equal((html.match(/class="sd-decision-row"/g) || []).length, rows.length,
            `${design.slug}.${field}: one stacked row per decision`);
          // Every row keeps its own name line, so a long detail can never swallow
          // the name the way the raw-string render did.
          assert.equal((html.match(/class="sd-decision-name"/g) || []).length, rows.length);
          /* The name/detail separator is the one character this transform
             consumes — the split is the whole point — so it is normalised away
             along with the bullet semicolons before comparing. */
          const consumed = value => bare(value).replace(/[—–:]/g, '');
          const rendered = consumed(html.replace(/<div class="sd-decision-legend">[\s\S]*?<\/div>/, '')
            .replace(/<span>\d\d<\/span>/g, ''));
          for (const row of rows) {
            assert.ok(rendered.includes(consumed(escapeHtml(row))),
              `${design.slug}.${field}: a decision row lost text`);
          }
        }
      }
    }
    // Short scopes must stay a single paragraph — breaking a two-sentence intro
    // into a lead and a pull-quote reads as noise.
    assert.ok(broken > 0 && broken < catalog.designs.length * 2, `thesis extraction fired ${broken} times`);
    assert.ok(labelled > 0 && labelled < listRows / 2,
      `label promotion should stay the exception: ${labelled}/${listRows}`);
    // Same rule for bullets: a row is listified because the author enumerated,
    // not because a splitter could find a separator.
    assert.ok(listed < listRows / 3, `list promotion should stay the exception: ${listed}/${listRows}`);
  });

  /* The native page must call the pipeline, not print the strings: rendering a
     decision row with {{ row }} is what produced the 914-character wall. */
  test('the System Design page renders decisions through the prose pipeline', async () => {
    const view = await readFile(path.join(root, 'app/pages/system-design/[slug].vue'), 'utf8');
    for (const helper of ['comparisonTable', 'tradeoffCards', 'failureCards', 'renderScope', 'list']) {
      assert.ok(view.includes(helper), `the page must render through ${helper}`);
    }
    assert.doesNotMatch(view, /v-for="\(row, index\) in copy\.(?:data_model|stack)"/,
      'decision rows must not be printed as raw strings');
    // Outbound links keep their one allowlist owner.
    assert.match(view, /originGuard\(PROMPT_ORIGINS/);
    assert.match(view, /originGuard\(REFERENCE_ORIGINS/);
    assert.doesNotMatch(view, /:href="design\.source_url"/, 'the raw source_url must not be an href');
  });
}

// ---- from case-studies.test.mjs ----
{
  const root = path.resolve(import.meta.dirname, '..');
  const publicRoot = path.join(root, 'public');
  const dataRoot = path.join(publicRoot, 'data');
  const manifest = JSON.parse(await readFile(path.join(dataRoot, 'case-studies/manifest.json'), 'utf8'));
  const meta = JSON.parse(await readFile(path.join(dataRoot, 'case-studies/meta.json'), 'utf8'));
  const contentFiles = new Map();
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  // Hiring funnels a preserved article shipped with. Add a host when one appears.
  const RECRUITMENT = /tuyendung\.|apply\.workable\.com|\/careers?\b|\/jobs?\b|greenhouse\.io|lever\.co/i;

  for (const article of manifest.articles) {
    for (const lang of ['en', 'vi']) {
      const file = article.file.replace(/\.json$/, lang === 'vi' ? '.vi.json' : '.json');
      contentFiles.set('data/' + file, JSON.parse(await readFile(path.join(dataRoot, file), 'utf8')));
    }
  }

  const pairFor = article => ({
    en: contentFiles.get('data/' + article.file),
    vi: contentFiles.get('data/' + article.file.replace(/\.json$/, '.vi.json'))
  });

  async function filesBelow(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => {
      const fullPath = path.join(directory, entry.name);
      return entry.isDirectory() ? filesBelow(fullPath) : [fullPath];
    }))).flat();
  }

  test('case studies use stable Topic-style numbering and separate localized metadata', async () => {
    assert.equal(manifest.version, 2);
    assert.equal(meta.version, 1);
    assert.ok(manifest.categories.length > 0);
    assert.ok(manifest.articles.length > 0);
    assert.deepEqual(manifest.articles.map(article => article.n),
      manifest.articles.map((_, index) => index + 1), 'case numbers must remain contiguous and append-only');

    const categoryIds = manifest.categories.map(category => category.id);
    const slugs = manifest.articles.map(article => article.slug);
    assert.equal(new Set(categoryIds).size, categoryIds.length);
    assert.equal(new Set(slugs).size, slugs.length);
    assert.ok(categoryIds.every(id => manifest.articles.some(article => article.category === id)),
      'empty categories should not be published');

    assert.deepEqual(Object.keys(meta.categories).sort(), [...categoryIds].sort());
    assert.ok(meta.library.en.title && meta.library.vi.title);
    for (const category of manifest.categories) {
      assert.ok(meta.categories[category.id].en.label);
      assert.ok(meta.categories[category.id].vi.label);
    }

    for (const article of manifest.articles) {
      const key = String(article.n).padStart(2, '0') + '-' + article.slug;
      assert.equal(article.file, 'case-studies/' + key + '.json');
      assert.equal(meta.articles[String(article.n)].key, key);
      assert.match(article.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.ok(categoryIds.includes(article.category), `${article.slug}: unknown category`);
      assert.ok(['en', 'vi'].includes(article.original_language));
      // Archived rows credit an external publisher. First-party and editorial
      // rows are locally authored and deliberately carry no external source.
      if (article.first_party === true || article.editorial === true) {
        assert.equal('company' in article, false,
          `${article.slug}: a locally authored case study has no publisher to credit`);
        assert.equal('source_url' in article, false,
          `${article.slug}: a locally authored case study has no external source to link`);
      } else {
        // Read the allowlist rather than restating it: a fourth spelling of this
        // list is how the validator ended up allowing less than the views did.
        assert.ok(PUBLISHER_ORIGINS.some(origin => article.source_url.startsWith(origin + '/')),
          `${article.slug}: public source must stay on an approved publisher`);
        assert.ok(article.company);
      }
      assert.equal('author' in article, false, `${article.slug}: author attribution must not be stored`);
      assert.match(article.cover_image,
        new RegExp(`^assets/case-studies/${key}/[A-Za-z0-9._-]+\\.(?:png|jpe?g|gif|webp|svg)$`),
        `${article.slug}: card cover must reuse an image from its own article`);
      assert.ok(['cover', 'contain'].includes(article.cover_fit), `${article.slug}: invalid cover fit`);
      await access(path.join(publicRoot, article.cover_image));
      assert.ok(Number.isInteger(article.read_minutes) && article.read_minutes > 0);
      assert.match(article.created_at, ISO_DATE, `${article.slug}: created_at`);
      assert.match(article.updated_at, ISO_DATE, `${article.slug}: updated_at`);
      assert.ok(article.created_at <= article.updated_at, `${article.slug}: dates are reversed`);
      if (article.reviewed_at) assert.match(article.reviewed_at, /^\d{4}-\d{2}-\d{2}$/, `${article.slug}: reviewed_at`);
      for (const lang of ['en', 'vi']) {
        const localized = meta.articles[String(article.n)][lang];
        assert.ok(localized.title && localized.excerpt, `${key}: incomplete ${lang} metadata`);
        assert.ok(Array.isArray(localized.tags) && localized.tags.length > 0);
      }
    }
  });

  test('every numbered case JSON has a complete EN/VI body and editorial guide', () => {
    for (const article of manifest.articles) {
      const key = meta.articles[String(article.n)].key;
      const pair = pairFor(article);
      assert.equal(pair.en.body_file, `data/case-studies/articles/${key}.html`);
      assert.equal(pair.vi.body_file, `data/case-studies/articles/${key}.vi.html`);

      for (const [lang, content] of Object.entries(pair)) {
        assert.deepEqual(Object.keys(content).sort(), ['body_file', 'guide']);
        const guide = content.guide;
        assert.ok(guide.title.length >= 40, `${key}: ${lang} guide needs a useful thesis`);
        for (const field of ['problem', 'core_idea', 'outcome']) {
          assert.ok(guide[field].length >= 120, `${key}: ${lang} ${field} is too thin`);
        }
        assert.equal(guide.takeaways.length, 5, `${key}: ${lang} needs five takeaways`);
        assert.equal(guide.review_lenses.length, 4, `${key}: ${lang} needs four review lenses`);
        assert.ok(guide.takeaways.every(item => item.length >= 80));
        assert.ok(guide.review_lenses.every(item => item.length >= 60));
      }
    }
  });

  test('paired long-form bodies preserve structure, code and all local figures', async () => {
    const referencedAssets = new Set();
    let englishImages = 0;
    let vietnameseImages = 0;

    for (const article of manifest.articles) {
      const key = meta.articles[String(article.n)].key;
      const pair = pairFor(article);
      const bodies = {};
      for (const [lang, content] of Object.entries(pair)) {
        const body = await readFile(path.join(publicRoot, content.body_file), 'utf8');
        bodies[lang] = body;
        assert.ok(body.length >= 4_000, `${key}: ${lang} body is unexpectedly short`);
        assert.doesNotMatch(body, /<script\b|\son[a-z]+\s*=/i, `${key}: active HTML is not allowed`);
        assert.doesNotMatch(body, /<(?:img|source)\b[^>]+\bsrc(?:set)?="https?:\/\//i,
          `${key}: body must not hotlink assets`);
        assert.doesNotMatch(body, /medium\.com|__GAZLSEG/i,
          `${key}: body contains a publisher mirror or translation artifact`);
        assert.doesNotMatch(body, /\bcontributors?\b|người đóng góp/i,
          `${key}: contributor attribution must not appear in the archived body`);

        const headings = [...body.matchAll(/<h[23][^>]*\sid="([^"]+)"/g)].map(match => match[1]);
        assert.ok(headings.length >= 1, `${key}: long-form TOC needs section headings`);
        assert.equal(new Set(headings).size, headings.length, `${key}: heading ids must be unique`);

        const images = [...body.matchAll(/<img\s+([^>]+)>/g)].map(match => match[1]);
        assert.ok(images.length >= 1, `${key}: article should preserve its figures`);
        if (lang === 'en') englishImages += images.length;
        else vietnameseImages += images.length;
        for (const attrs of images) {
          const src = /\bsrc="([^"]+)"/.exec(attrs)?.[1];
          const alt = /\balt="([^"]+)"/.exec(attrs)?.[1];
          assert.ok(src?.startsWith(`assets/case-studies/${key}/`), `${key}: image folder must match its number`);
          assert.match(src, /\.(?:webp|gif|svg)$/,
            `${key}: static figures must use the optimized WebP derivative`);
          assert.ok(alt?.trim(), `${key}: ${lang} image needs descriptive alt text`);
          assert.match(attrs, /\bwidth="\d+"/);
          assert.match(attrs, /\bheight="\d+"/);
          assert.match(attrs, /\bloading="lazy"/);
          assert.ok(!/\bPhoto by\b/i.test(alt), `${key}: alt text must describe the figure, not credit a person`);
          referencedAssets.add(src);
          await access(path.join(publicRoot, src));
        }

        // Body anchors were the one class of outbound link nothing checked: images
        // could not hotlink, but <a href> was free. That is how four articles kept
        // a publisher's 2020 recruitment CTA and three kept unreachable http:// hosts.
        for (const href of [...body.matchAll(/<a\s+[^>]*\bhref="([^"]+)"/g)].map(match => match[1])) {
          if (href.startsWith('#') || href.startsWith('assets/')) continue;
          assert.ok(href.startsWith('https://'),
            `${key}: ${lang} links "${href}" — an archived body may only link https`);
          assert.ok(!RECRUITMENT.test(href),
            `${key}: ${lang} still carries a recruitment link ("${href}"); the archive is not a job board`);
        }
      }

      const ids = body => [...body.matchAll(/<h[23][^>]*\sid="([^"]+)"/g)].map(match => match[1]);
      const sources = body => [...body.matchAll(/<img\s+[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]);
      const codeBlocks = body => [...body.matchAll(/<pre\b[\s\S]*?<\/pre>/g)].map(match => match[0]);
      assert.deepEqual(ids(bodies.vi), ids(bodies.en), `${key}: translated TOC structure drifted`);
      assert.deepEqual(sources(bodies.vi), sources(bodies.en), `${key}: translated figures drifted`);
      assert.deepEqual(codeBlocks(bodies.vi), codeBlocks(bodies.en), `${key}: code blocks must never be translated`);
    }

    assert.equal(englishImages, vietnameseImages, 'both languages should preserve the same number of figures');
    const physicalAssets = (await filesBelow(path.join(publicRoot, 'assets/case-studies')))
      .map(file => path.relative(publicRoot, file).split(path.sep).join('/'));
    assert.equal(physicalAssets.length, englishImages, 'every physical figure should be referenced once per language');
    assert.deepEqual([...physicalAssets].sort(), [...referencedAssets].sort(), 'there should be no orphaned figures');
  });

  test('SSH hardening case separates exposure controls from identity and incident recovery', async () => {
    const article = manifest.articles.find(entry => entry.slug === 'ssh-server-hardening-lessons');
    assert.ok(article, 'the SSH hardening case must be published');
    assert.equal(article.editorial, true);
    assert.equal('source_url' in article, false);

    const pair = pairFor(article);
    const en = await readFile(path.join(publicRoot, pair.en.body_file), 'utf8');
    const vi = await readFile(path.join(publicRoot, pair.vi.body_file), 'utf8');
    assert.match(en, /No forensic evidence was supplied/);
    assert.match(en, /The bastion is a chokepoint, not a trust anchor/);
    assert.match(en, /rebuild from a known-good image/);
    assert.match(vi, /Kết luận trung thực là unknown/);
    assert.match(vi, /network location tự nó không được tạo implicit trust/);
    assert.match(en, /NIST SP 800-61 Rev\. 3/);
    assert.match(en, /CISA bastion-host guidance/);
  });

  test('the shared bilingual loader switches case-study JSON in memory and caches article bodies', async () => {
    const fetched = [];
    globalThis.fetch = async url => {
      fetched.push(url);
      if (url === 'data/case-studies/manifest.json') return { ok: true, json: async () => structuredClone(manifest) };
      if (url === 'data/case-studies/meta.json') return { ok: true, json: async () => structuredClone(meta) };
      if (contentFiles.has(url)) return { ok: true, json: async () => structuredClone(contentFiles.get(url)) };
      if (/^data\/case-studies\/articles\//.test(url)) {
        return { ok: true, text: async () => readFile(path.join(publicRoot, url), 'utf8') };
      }
      return { ok: false, status: 404 };
    };

    const moduleUrl = pathToFileURL(path.join(publicRoot, 'lib/case-studies.js')).href + '?t=' + Math.random();
    const { CaseStudies } = await import(moduleUrl);
    await CaseStudies.load('en');
    assert.equal(CaseStudies.articles.length, manifest.articles.length);
    assert.equal(CaseStudies.articles[0].title, meta.articles['1'].en.title);
    assert.equal(CaseStudies.articles[0].body_file, pairFor(manifest.articles[0]).en.body_file);
    assert.equal(CaseStudies.articles[2].is_translation, true);

    const eagerFetches = fetched.length;
    await CaseStudies.load('vi');
    assert.equal(fetched.length, eagerFetches, 'both localized JSON sources should already be in memory');
    assert.equal(CaseStudies.articles[0].title, meta.articles['1'].vi.title);
    assert.equal(CaseStudies.articles[0].body_file, pairFor(manifest.articles[0]).vi.body_file);
    assert.equal(CaseStudies.articles[0].is_translation, true);
    assert.equal(CaseStudies.articles[2].is_translation, false);

    const article = CaseStudies.articles[0];
    await CaseStudies.body(article);
    const afterBody = fetched.length;
    await CaseStudies.body(article);
    assert.equal(fetched.length, afterBody, 'an opened localized body should be cached');
    delete globalThis.fetch;
  });

  test('Case Studies uses the native bilingual collection routes', async () => {
    const [index, article, styles, topicManifest, casesRoute] = await Promise.all([
      readFile(path.join(root, 'app/components/content/CollectionIndex.vue'), 'utf8'),
      readFile(path.join(root, 'app/components/content/CollectionArticle.vue'), 'utf8'),
      readFile(path.join(publicRoot, 'styles.css'), 'utf8'),
      readFile(path.join(dataRoot, 'manifest.json'), 'utf8'),
      readFile(path.join(root, 'app/pages/case-studies/index.vue'), 'utf8')
    ]);

    assert.match(index, /collection === 'case-studies'/);
    assert.match(index, /sortMode/);
    assert.match(article, /route\.query\.lang === 'vi'/);
    // The credit link goes through the one allowlist owner, never straight from
    // the row: an unguarded href would let a catalog edit link anywhere.
    assert.match(article, /originGuard\(PUBLISHER_ORIGINS\)/);
    assert.match(article, /creditHref/);
    assert.doesNotMatch(article, /:href="data\.row\.source_url"/,
      'the raw source_url must not be rendered as an href');
    // A rewritten external body is labelled as synthesis, never as the original.
    assert.match(article, /content_kind === 'synthesis'/);
    assert.match(article, /decoratedBody/);
    assert.match(styles, /\.cs-toc-mobile:not\(\[open\]\)>nav\{display:none\}/);
    assert.doesNotMatch(topicManifest, /case-stud/i,
      'case studies must not change Study Track topics or its progress denominator');
    assert.match(casesRoute, /ContentCollectionIndex collection="case-studies"/);
  });
}

// ---- from knowledge.test.mjs ----
{
  const root = path.resolve(import.meta.dirname, '..');
  const publicRoot = path.join(root, 'public');
  const dataRoot = path.join(publicRoot, 'data');

  const COLLECTIONS = ['photography', 'homelab'];
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  const read = async file => JSON.parse(await readFile(path.join(dataRoot, file), 'utf8'));
  const exists = async file => {
    await access(path.join(publicRoot, file));
    return true;
  };

  test('every Other Knowledge collection is complete and bilingual', async () => {
    for (const id of COLLECTIONS) {
      const manifest = await read(id + '/manifest.json');
      const meta = await read(id + '/meta.json');

      assert.equal(manifest.version, 1, id + ': manifest version');
      assert.ok(manifest.articles.length > 0, id + ': no articles');
      assert.deepEqual(
        manifest.articles.map(row => row.n),
        manifest.articles.map((_, index) => index + 1),
        id + ': numbering must be contiguous from 1');

      const categoryIds = manifest.categories.map(row => row.id);
      assert.equal(new Set(categoryIds).size, categoryIds.length, id + ': duplicate category');
      for (const category of categoryIds) {
        for (const lang of ['en', 'vi']) {
          assert.ok(meta.categories?.[category]?.[lang]?.label, id + '/' + category + ': no ' + lang + ' label');
          assert.ok(meta.categories?.[category]?.[lang]?.description, id + '/' + category + ': no ' + lang + ' description');
        }
      }
      for (const lang of ['en', 'vi']) {
        for (const field of ['eyebrow', 'title', 'intro']) {
          assert.ok(meta.library?.[lang]?.[field]?.trim(), id + ': library.' + lang + '.' + field);
        }
      }

      const slugs = manifest.articles.map(row => row.slug);
      assert.equal(new Set(slugs).size, slugs.length, id + ': duplicate slug');

      for (const row of manifest.articles) {
        const label = id + '/' + row.slug;
        assert.match(row.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, label + ': slug');
        assert.ok(categoryIds.includes(row.category), label + ': unknown category');
        assert.ok(['core', 'advanced', 'extra'].includes(row.level), label + ': level');
        assert.ok(Number.isInteger(row.read_minutes) && row.read_minutes > 0, label + ': read_minutes');
        assert.match(row.created_at, ISO_DATE, label + ': created_at');
        assert.match(row.updated_at, ISO_DATE, label + ': updated_at');
        assert.ok(row.created_at <= row.updated_at, label + ': dates are reversed');
        assert.equal(row.first_party, true, label + ': knowledge articles are first-party');
        assert.ok(!('company' in row), label + ': first-party rows carry no company');
        assert.ok(!('source_url' in row), label + ': first-party rows carry no source_url');
        assert.ok(['cover', 'contain'].includes(row.cover_fit), label + ': cover_fit');
        assert.match(row.cover_image, /^assets\/[a-z0-9][a-z0-9._/-]*\.(?:avif|jpe?g|png|svg|webp)$/i,
          label + ': cover_image must be a local asset');
        await exists(row.cover_image);

        const base = await read(id + '/' + row.file.split('/').slice(1).join('/'));
        const viFile = row.file.replace(/\.json$/, '.vi.json');
        const vi = await read(id + '/' + viFile.split('/').slice(1).join('/'));
        for (const [lang, guideFile] of [['en', base], ['vi', vi]]) {
          assert.ok(guideFile.body_file, label + ': ' + lang + ' has no body_file');
          await exists(guideFile.body_file.replace(/^data\//, 'data/'));
          assert.ok(guideFile.guide?.title?.trim(), label + ': ' + lang + ' guide title');
          assert.ok(guideFile.guide?.summary?.trim(), label + ': ' + lang + ' guide summary');
          assert.ok(Array.isArray(guideFile.guide?.points) && guideFile.guide.points.length >= 3,
            label + ': ' + lang + ' needs at least three points');
        }

        const metadata = meta.articles?.[String(row.n)];
        assert.ok(metadata, label + ': no meta row');
        for (const lang of ['en', 'vi']) {
          assert.ok(metadata[lang]?.title?.trim(), label + ': ' + lang + ' title');
          assert.ok(metadata[lang]?.excerpt?.trim(), label + ': ' + lang + ' excerpt');
          assert.ok(metadata[lang]?.tags?.length, label + ': ' + lang + ' tags');
        }
      }
    }
  });

  test('knowledge article bodies stay inert and reachable', async () => {
    for (const id of COLLECTIONS) {
      const manifest = await read(id + '/manifest.json');
      for (const row of manifest.articles) {
        for (const lang of ['', '.vi']) {
          const file = id + '/articles/' + String(row.n).padStart(2, '0') + '-' + row.slug + lang + '.html';
          const body = await readFile(path.join(dataRoot, file), 'utf8');
          assert.doesNotMatch(body, /<script\b|\son[a-z]+\s*=/i, file + ': inline script or handler');
          assert.doesNotMatch(body, /src=["']https?:/i, file + ': hotlinked asset');
          for (const [, href] of body.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
            assert.doesNotMatch(href, /^http:\/\//i, file + ': upgrade-insecure-requests breaks ' + href);
          }
          for (const [, tag, attrs] of body.matchAll(/<(h[23])\b([^>]*)>/gi)) {
            assert.match(attrs, /\bid="/, file + ': <' + tag + '> without an id');
          }
        }
      }
    }
  });

  test('Other Knowledge is wired through the native collection reader', async () => {
    const [index, article, header, endpoint, photoRoute, labRoute] = await Promise.all([
      readFile(path.join(root, 'app/components/content/CollectionIndex.vue'), 'utf8'),
      readFile(path.join(root, 'app/components/content/CollectionArticle.vue'), 'utf8'),
      readFile(path.join(root, 'app/components/content/ContentHeader.vue'), 'utf8'),
      readFile(path.join(root, 'server/api/content/collection/[collection]/[slug].get.ts'), 'utf8'),
      readFile(path.join(root, 'app/pages/photography/index.vue'), 'utf8'),
      readFile(path.join(root, 'app/pages/homelab/index.vue'), 'utf8')
    ]);

    assert.match(index, /ContentHeader/);
    assert.match(index, /useAsyncData/);
    assert.match(index, /props\.collection/);
    assert.match(index, /articleRoute/);
    assert.match(index, /collection !== 'case-studies'/);
    assert.match(article, /decoratedBody/);
    assert.match(article, /contentDateFacts/);
    assert.match(article, /datePublished:/);
    assert.match(header, /Knowledge Base/);
    assert.match(endpoint, /photography: 'photography'/);
    assert.match(endpoint, /homelab: 'homelab'/);
    assert.match(endpoint, /slug === 'index'/);
    assert.match(photoRoute, /ContentCollectionIndex collection="photography"/);
    assert.match(labRoute, /ContentCollectionIndex collection="homelab"/);
  });

  test('knowledge articles reach the native search index model', async () => {
    const { buildEntries, searchEntries, SURFACES } = await import('../public/lib/search.js');
    assert.ok(SURFACES.some(row => row.id === 'knowledge'), 'knowledge must be a search surface');

    const manifest = await read('photography/manifest.json');
    const meta = await read('photography/meta.json');
    const row = manifest.articles[0];
    const article = {
      ...row,
      ...meta.articles[String(row.n)].en,
      category_label: 'Fundamentals',
      guide: { title: 'Guide title', summary: 'aperture and diffraction', points: ['stop is the shared unit'] }
    };

    const entries = buildEntries({
      content: { topics: [] },
      systemDesign: { designs: [], cases: [], caseOverviews: new Map() },
      caseStudies: { articles: [] },
      knowledge: { photography: { library: { title: 'Photography' }, articles: [article] } }
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0].surface, 'knowledge');
    assert.match(entries[0].href, /photography\/exposure-three-controls/);

    const found = searchEntries(entries, 'diffraction');
    assert.equal(found.results.length, 1, 'guide text must be searchable');
    assert.equal(found.counts.knowledge, 1);
  });
}

// ---- from cross-ref.test.mjs ----
{
  /* Cross-references are the mechanism behind the "one owner, many pointers"
     rule: a mechanism is explained in one item and cited everywhere else. These
     pin the two halves — the renderer only links when a resolver says it can,
     and the resolver routes by the surface the target actually lives on. */






  const root = path.resolve(import.meta.dirname, '..');
  const publicRoot = path.join(root, 'public');
  const dataRoot = path.join(publicRoot, 'data');

  const { renderMarkdown } = await import(pathToFileURL(path.join(publicRoot, 'lib/markdown.js')).href);
  const { crossRefResolver } = await import(pathToFileURL(path.join(publicRoot, 'lib/cross-ref.js')).href);

  const REF = '25-microservice.01-cascading-failure-retry-storm.q3';
  const resolver = () => ({ href: '#/track/' + REF + '?lang=en', label: 'Circuit breakers' });

  test('without a resolver the id renders exactly as it always has', () => {
    const html = renderMarkdown(`Bound the call (${REF}).`);
    assert.match(html, new RegExp('\\(' + REF.replace(/\./g, '\\.') + '\\)'));
    assert.doesNotMatch(html, /<a /);
  });

  test('with a resolver the reference becomes a link, parentheses kept', () => {
    const html = renderMarkdown(`Bound the call (${REF}).`, { resolveRef: resolver });
    assert.match(html, /\(<a class="xref" href="#\/track\/25-microservice/);
    assert.match(html, /&#8594; Circuit breakers<\/a>\)/);
    // The id stays reachable for anyone reading the markup or hovering.
    assert.match(html, new RegExp('title="' + REF.replace(/\./g, '\\.') + '"'));
  });

  test('a resolver that declines leaves the text alone', () => {
    const html = renderMarkdown(`See (${REF}).`, { resolveRef: () => null });
    assert.doesNotMatch(html, /<a /);
  });

  test('an id inside a code span is being shown, not cited', () => {
    const html = renderMarkdown(`The key is \`(${REF})\`.`, { resolveRef: resolver });
    assert.doesNotMatch(html, /<a /);
    assert.match(html, /<code>/);
  });

  test('callouts and deep dives resolve too — options must survive recursion', () => {
    const deep = renderMarkdown(`:::deep\nSee (${REF}).\n:::`, { resolveRef: resolver });
    assert.match(deep, /class="xref"/);
    const tip = renderMarkdown(`:::tip Rule\nSee (${REF}).\n:::`, { resolveRef: resolver });
    assert.match(tip, /class="xref"/);
  });

  test('tip and warn callouts preserve paragraph and list structure', () => {
    const tip = renderMarkdown(':::tip Trade-off\nLead.\n\n- benefit\n- cost\n:::');
    assert.match(tip, /<div class="takeaway"><b>Trade-off:<\/b> <p>Lead\.<\/p><ul><li>benefit<\/li><li>cost<\/li><\/ul><\/div>/);

    const warn = renderMarkdown(':::warn Boundary\nFirst paragraph.\n\nSecond paragraph.\n:::');
    assert.match(warn, /<div class="warn"><b>Boundary:<\/b> <p>First paragraph\.<\/p><p>Second paragraph\.<\/p><\/div>/);
  });

  test('table cells link, but <pre> and <svg> keep the id as text', () => {
    const table = renderMarkdown(`<table><tr><td>See (${REF})</td></tr></table>`, { resolveRef: resolver });
    assert.match(table, /class="xref"/);
    const pre = renderMarkdown(`<pre><code>id = (${REF})</code></pre>`, { resolveRef: resolver });
    assert.doesNotMatch(pre, /<a /);
    const svg = renderMarkdown(`<svg><text>(${REF})</text></svg>`, { resolveRef: resolver });
    assert.doesNotMatch(svg, /<a /);
  });

  /* The label is spliced in before inline processing runs, so anything that
     looks like markup in the target's question would become markup here. */
  test('a label never turns into markup or runs off the line', () => {
    const long = 'Why can one slow downstream service take down every upstream service even when CPU stays flat?';
    const content = {
      lang: 'en',
      itemPair: () => ({ en: { q: '`Circuit` **breakers**: ' + long }, vi: null }),
      topicItemIds: new Set([REF])
    };
    const resolve = crossRefResolver({ content, systemDesign: {} });
    const { label } = resolve(REF);
    assert.doesNotMatch(label, /[`*]/);
    assert.ok(label.length <= 61, `label is ${label.length} characters`);
    assert.match(label, /…$/);
    const html = renderMarkdown(`See (${REF}).`, { resolveRef: resolve });
    assert.doesNotMatch(html, /<strong>|<code>/);
  });

  test('the resolver routes by surface, and declines what it cannot place', () => {
    const pairs = new Map([
      [REF, { en: { q: 'Circuit breakers' }, vi: { q: 'Circuit breaker: ba trạng thái' } }],
      ['11-system-design-cases.the-big-prompts.q1', { en: { q: 'Design a wallet' }, vi: null }]
    ]);
    const content = {
      lang: 'en',
      itemPair: id => pairs.get(id) || null,
      topicItemIds: new Set([REF])
    };
    const loaded = { designForSourceItem: () => ({ slug: 'payment-ledger' }) };

    const withDesigns = crossRefResolver({ content, systemDesign: loaded });
    assert.equal(withDesigns(REF).href, '#/track/' + REF + '?lang=en');
    assert.equal(withDesigns('11-system-design-cases.the-big-prompts.q1').href,
      '#/system-design/payment-ledger/11-system-design-cases.the-big-prompts.q1?lang=en');
    assert.equal(withDesigns('nope.nope.q9'), null);

    // System Design loads lazily: before it does, an off-track target has no
    // route yet, and no link is better than a broken one.
    const notLoaded = crossRefResolver({ content, systemDesign: { designForSourceItem: () => null } });
    assert.equal(notLoaded('11-system-design-cases.the-big-prompts.q1'), null);
    assert.equal(notLoaded(REF).href, '#/track/' + REF + '?lang=en');

    content.lang = 'vi';
    assert.equal(crossRefResolver({ content, systemDesign: loaded })(REF).label, 'Circuit breaker: ba trạng thái');
  });

  /* Every reference in the material must be resolvable on one of the two
     surfaces — that is what makes the pointer trustworthy enough to replace a
     second copy of the explanation. */
  test('every written cross-reference in data/ can be routed', async () => {
    const manifest = JSON.parse(await readFile(path.join(dataRoot, 'manifest.json'), 'utf8'));
    const catalog = JSON.parse(await readFile(path.join(dataRoot, 'system-design/catalog.json'), 'utf8'));
    const claimed = new Set(catalog.designs.flatMap(design => design.source_items));

    const pairs = new Map();
    const onTrack = new Set();
    for (const row of manifest.topics) {
      const content = JSON.parse(await readFile(path.join(dataRoot, row.file), 'utf8'));
      const named = new Set(row.system_design_items || []);
      for (const section of content.sections) {
        for (const item of section.items) {
          pairs.set(item.id, { en: { q: item.q }, vi: null });
          if (row.surface !== 'system-design' && !named.has(item.id)) onTrack.add(item.id);
        }
      }
    }

    const resolve = crossRefResolver({
      content: { lang: 'en', itemPair: id => pairs.get(id) || null, topicItemIds: onTrack },
      systemDesign: { designForSourceItem: id => (claimed.has(id) ? { slug: 'x' } : null) }
    });

    const pattern = /\(([a-z0-9-]+\.[a-z0-9-]+\.q\d+)\)/g;
    let total = 0;
    for (const row of manifest.topics) {
      for (const file of [row.file, row.file.replace(/\.json$/, '.vi.json')]) {
        const content = JSON.parse(await readFile(path.join(dataRoot, file), 'utf8'));
        for (const section of content.sections) {
          for (const item of section.items) {
            for (const [, id] of String(item.a).matchAll(pattern)) {
              assert.ok(resolve(id), `${item.id} cites ${id}, which resolves to no surface`);
              total++;
            }
          }
        }
      }
    }
    assert.ok(total > 500, `expected the material to be densely cross-referenced, found ${total}`);
  });
}
