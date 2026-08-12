/* Cross-references are the mechanism behind the "one owner, many pointers"
   rule: a mechanism is explained in one item and cited everywhere else. These
   pin the two halves — the renderer only links when a resolver says it can,
   and the resolver routes by the surface the target actually lives on. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const publicRoot = path.join(root, 'public');
const dataRoot = path.join(publicRoot, 'data');

const { renderMarkdown } = await import(pathToFileURL(path.join(publicRoot, 'lib/markdown.js')).href);
const { crossRefResolver } = await import(pathToFileURL(path.join(publicRoot, 'lib/cross-ref.js')).href);

const REF = '25-microservice.01-cascading-failure-retry-storm.q3';
const resolver = () => ({ href: '#/track/' + REF, label: 'Circuit breakers' });

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
  assert.equal(withDesigns(REF).href, '#/track/' + REF);
  assert.equal(withDesigns('11-system-design-cases.the-big-prompts.q1').href,
    '#/system-design/payment-ledger/11-system-design-cases.the-big-prompts.q1');
  assert.equal(withDesigns('nope.nope.q9'), null);

  // System Design loads lazily: before it does, an off-track target has no
  // route yet, and no link is better than a broken one.
  const notLoaded = crossRefResolver({ content, systemDesign: { designForSourceItem: () => null } });
  assert.equal(notLoaded('11-system-design-cases.the-big-prompts.q1'), null);
  assert.equal(notLoaded(REF).href, '#/track/' + REF);

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
