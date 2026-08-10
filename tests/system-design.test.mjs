import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const publicRoot = path.join(root, 'public');
const dataRoot = path.join(publicRoot, 'data');

const catalog = JSON.parse(await readFile(path.join(dataRoot, 'system-design/catalog.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(dataRoot, 'manifest.json'), 'utf8'));
const caseManifest = JSON.parse(await readFile(path.join(dataRoot, 'case-studies/manifest.json'), 'utf8'));
const movedRows = manifest.topics.filter(row => row.surface === 'system-design');

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
    assert.match(design.diagram, /^flowchart\s+(?:LR|RL|TB|BT|TD)\n/);
    assert.doesNotMatch(design.diagram, /<svg|<script/i);
    // source_items is optional: a design migrated from the Study Track carries
    // them, one written directly for this library has none. validate-content
    // checks the ids themselves when they are present.
    assert.ok(Array.isArray(design.source_items), `${design.slug}: source_items must be an array`);
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

test('Topic 10–11 and the OTA/whiteboard overlap are moved once, with every immutable id covered', async () => {
  assert.deepEqual(movedRows.map(row => row.n), [10, 11]);
  assert.equal(manifest.topics.find(row => row.n === 16).system_design_items.length, 6);
  const expected = await movedSourceIds();
  const actual = catalog.designs.flatMap(design => design.source_items);

  assert.equal(expected.length, 33);
  assert.equal(actual.length, expected.length);
  assert.equal(new Set(actual).size, actual.length, 'one source question was assigned to two blueprints');
  assert.deepEqual([...actual].sort(), [...expected].sort());
});

test('all Systems & Architecture at Scale cases moved into System Design with Mermaid lenses', () => {
  const expected = caseManifest.articles
    .filter(article => article.category === 'systems-architecture')
    .map(article => article.slug)
    .sort();
  const actual = Object.keys(catalog.case_overviews).sort();

  assert.equal(expected.length, 4);
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
    'https://kafka.apache.org', 'https://learn.microsoft.com', 'https://www.elastic.co',
    'https://opentelemetry.io'
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
    }
    assert.equal(SystemDesign.cases.length, 4);
    assert.equal(SystemDesign.designs.flatMap(design => design.sourceNotes).length, 33);
    const itemId = catalog.designs[4].source_items[0];
    assert.equal(SystemDesign.designForSourceItem(itemId).slug, 'payment-ledger');
    assert.equal(SystemDesign.designForSourceItem('missing.q1'), null);
    const englishTitle = SystemDesign.design('payment-ledger').title;
    const eagerFetches = fetched.length;

    await SystemDesign.load('vi');
    assert.equal(fetched.length, eagerFetches, 'bilingual sources should already be cached');
    assert.equal(SystemDesign.design('payment-ledger').title, catalog.designs[4].vi.title);
    assert.notEqual(SystemDesign.design('payment-ledger').title, englishTitle);
    assert.ok(SystemDesign.design('payment-ledger').sourceNotes.every(note => note.q && note.a));
  } finally {
    delete globalThis.fetch;
    delete globalThis.localStorage;
  }
});

test('Experience routing, Case Studies migration and Mermaid security are wired together', async () => {
  const [app, systemView, caseView, mermaid, index, styles] = await Promise.all([
    readFile(path.join(publicRoot, 'app.js'), 'utf8'),
    readFile(path.join(publicRoot, 'views/system-design.js'), 'utf8'),
    readFile(path.join(publicRoot, 'views/case-studies.js'), 'utf8'),
    readFile(path.join(publicRoot, 'lib/mermaid.js'), 'utf8'),
    readFile(path.join(publicRoot, 'index.html'), 'utf8'),
    readFile(path.join(publicRoot, 'styles.css'), 'utf8')
  ]);

  assert.match(app, /id: 'system-design', sec: 'experience'/);
  assert.match(app, /redirectMovedQuestion\(routeParts\)/);
  assert.match(systemView, /SystemDesign\.load\(Content\.lang\)/);
  assert.match(systemView, /data-copy-mermaid/);
  assert.match(systemView, /data-copy-sd-question/);
  assert.match(systemView, /revealLinkedSource/);
  assert.match(systemView, /comparisonTable\(rows, labels/);
  assert.match(systemView, /tradeoffSection\(design\.tradeoffs\)/);
  assert.match(systemView, /renderResearch\(design\)/);
  assert.match(systemView, /closest\('\.sd-toc-mobile'\)\?\.removeAttribute\('open'\)/);
  assert.match(caseView, /MOVED_TO_SYSTEM_DESIGN = 'systems-architecture'/);
  assert.match(caseView, /filter\(article => article\.category !== MOVED_TO_SYSTEM_DESIGN\)/);
  assert.match(mermaid, /vendor\/mermaid-11\.16\.1\/mermaid\.esm\.min\.mjs/);
  assert.match(mermaid, /securityLevel: 'strict'/);
  assert.match(mermaid, /startOnLoad: false/);
  assert.match(mermaid, /logLevel: 'fatal'/);
  assert.doesNotMatch(mermaid, /https?:\/\//);
  assert.doesNotMatch(index, /cdn\.jsdelivr\.net/);
  assert.match(index, /script-src 'self' https:\/\/accounts\.google\.com\/gsi\/client;/);
  await readFile(path.join(publicRoot, 'vendor/mermaid-11.16.1/LICENSE'), 'utf8');
  assert.match(styles, /\.sd-diagram/);
  assert.match(styles, /\.sd-notes details\.link-target/);
  assert.match(styles, /\.sd-comparison-wrap/);
  assert.match(styles, /\.sd-toc-mobile:not\(\[open\]\)>nav\{display:none\}/);
});

/* Two ways emphasis corrupts text silently rather than failing the build: the
   numeric pattern eating an earlier pattern's sentinel digits, and it reading
   the "39" of &#39; as a quantity. */
test('the three-tone emphasis never corrupts the text it highlights', async () => {
  const source = await readFile(path.join(publicRoot, 'views/system-design.js'), 'utf8');
  const block = source.slice(source.indexOf('/* Three tones'), source.indexOf('function splitDecision'));
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const emphasize = new Function('escapeHtml', block + '\nreturn emphasize;')(escapeHtml);

  assert.equal(emphasize("it's 1M"), "it&#39;s <b class=\"sd-num\">1M</b>");
  assert.equal(emphasize('&'), '&amp;');

  let spans = 0;
  let rows = 0;
  for (const design of catalog.designs) {
    for (const lang of ['en', 'vi']) {
      for (const field of ['data_model', 'stack', 'tradeoffs', 'capacity', 'functional', 'quality']) {
        for (const row of design[lang][field]) {
          const out = emphasize(row);
          const label = `${design.slug}.${lang}.${field}`;
          assert.doesNotMatch(out, /[\uE000-\uE01F]/, `${label}: sentinel leaked into the output`);
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
  const source = await readFile(path.join(publicRoot, 'views/system-design.js'), 'utf8');
  const block = source.slice(source.indexOf('/* Three tones'), source.indexOf('function splitDecision'));
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const { renderScope, listRow } = new Function('escapeHtml',
    block + '\nreturn { renderScope, listRow };')(escapeHtml);
  const bare = html => html.replace(/<[^>]+>/g, '').replace(/\s+/g, '');

  let broken = 0;
  let labelled = 0;
  let listRows = 0;
  for (const design of catalog.designs) {
    for (const lang of ['en', 'vi']) {
      const scope = renderScope(design[lang].scope);
      assert.equal(bare(scope), bare(escapeHtml(design[lang].scope)),
        `${design.slug}.${lang}: renderScope changed the text`);
      // one <p> per break, and the thesis is always last when present
      assert.match(scope, /^<p/, `${design.slug}.${lang}: scope must start with a paragraph`);
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
          listRows++;
        }
      }
    }
  }
  // Short scopes must stay a single paragraph — breaking a two-sentence intro
  // into a lead and a pull-quote reads as noise.
  assert.ok(broken > 0 && broken < catalog.designs.length * 2, `thesis extraction fired ${broken} times`);
  assert.ok(labelled > 0 && labelled < listRows / 2,
    `label promotion should stay the exception: ${labelled}/${listRows}`);
});

/* The controls that sit beside a question must not be nested inside .qhead:
   a <button> inside a <button> makes the browser close the outer one early and
   silently reparent the answer. Both are real buttons now, so the guarantee is
   purely structural — .qmeta is a sibling of .qhead inside .qtop. */
test('question-card buttons stay outside the .qhead button', async () => {
  const app = await readFile(path.join(publicRoot, 'app.js'), 'utf8');
  const markup = app.slice(app.indexOf('function qcard('), app.indexOf('function showCopyFeedback('));

  // Search forward from .qhead: langBtn is declared earlier in the function and
  // closes its own </button>, so indexOf from zero finds the wrong one.
  const headStart = markup.indexOf('<button class="qhead"');
  assert.ok(headStart > 0, 'the .qhead button markup moved');
  const head = markup.slice(headStart, markup.indexOf('</button>', headStart));
  assert.ok(head.length > 0, 'could not isolate the .qhead button');
  assert.ok(!head.includes('copyBtn'), '.qcopy must not be inside .qhead');
  assert.ok(!head.includes('langBtn'), '.qlangbtn must not be inside .qhead');

  // …and they must still be present, in the sibling .qmeta row.
  assert.match(markup, /<\/button><div class="qmeta">/);
  assert.match(markup, /class="qcopy"/);
  assert.match(markup, /class="langswitch qlangbtn"/);
});
