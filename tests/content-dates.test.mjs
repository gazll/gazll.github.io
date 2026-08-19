import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { contentDateFacts, formatContentDate } from '../public/lib/content-dates.js';

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

test('an unchanged article shows one Gazl date instead of duplicate dates', () => {
  const facts = contentDateFacts({ created_at: '2026-08-19', updated_at: '2026-08-19' }, 'vi');
  assert.deepEqual(facts.map(fact => fact.kind), ['created']);
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

test('all authored-content surfaces render dates and article structured data', async () => {
  const [app, cases, designs, project, interviews, index, metadata] = await Promise.all([
    readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/views/case-studies.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/views/system-design.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/views/project.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/views/interviews.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/lib/page-metadata.js', import.meta.url), 'utf8')
  ]);
  assert.match(app, /topicDates\(t\)/);
  assert.match(app, /class="qreview"/);
  assert.match(app, /class="qreview-mobile"/);
  assert.match(cases, /contentDateFacts\(article, Content\.lang\)/);
  assert.match(cases, /dateMarkup\(article, hasExternalSource\(article\)\)/);
  assert.match(cases, /data-content-sort="recent"/);
  assert.match(cases, /contentActivityDate\(b\)/);
  assert.match(cases, /\.focus\(\)/);
  assert.match(designs, /updatedDate\(design\)/);
  assert.match(designs, /dateBlock\(design\)/);
  assert.match(designs, /dateBlock\(article, true\)/);
  assert.match(designs, /data-content-sort="recent"/);
  assert.match(designs, /recentRows/);
  assert.match(designs, /\.focus\(\)/);
  assert.match(project, /dateFacts\(manifest\)/);
  assert.match(project, /updatedBadge\(documentMeta\)/);
  assert.match(interviews, /interviewDates\(c\)/);
  // The social card and the canonical URL are static, because the crawlers that
  // read them never run JavaScript and every route shares one document anyway.
  assert.match(index, /<meta name="description"/);
  assert.match(index, /<link rel="canonical"/);
  assert.match(index, /property="og:title"/);
  assert.match(index, /name="twitter:card"/);
  // So the runtime helper must not pretend to update them per route.
  assert.match(metadata, /document\.title = /);
  assert.match(metadata, /meta\[name="description"\]/);
  // Comments stripped: the file explains at length why it does not write these,
  // and matching the explanation would defeat the check.
  const metadataCode = metadata.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  for (const inert of ['og:', 'twitter:', 'canonical']) {
    assert.ok(!metadataCode.includes(inert),
      `page-metadata must not write ${inert}: a JS-set tag reaches no unfurler`);
  }
  for (const source of [app, cases, designs, project]) assert.match(source, /setArticleStructuredData/);

  // Sorting replaces the library markup, so the announcer must live outside it.
  // A live region recreated together with its own message is not reliably read.
  assert.match(index, /id="liveStatus"[^>]*aria-live="polite"/,
    'one persistent live region belongs in the shell');
  for (const [name, source] of [['case studies', cases], ['system design', designs]]) {
    assert.match(source, /announce\(librarySort === 'recent'/, name + ': sort must announce');
    assert.ok(!source.includes('content-sort-status'),
      name + ': the status node must not be re-rendered with the list it describes');
  }
});

test('structured data publishes machine-readable authored and modified dates', async () => {
  const nodes = new Map();
  globalThis.window = { location: { href: 'https://gazll.github.io/#/case-studies/example' } };
  const find = selector => [...nodes.values()].find(node => node.selector === selector) || null;
  globalThis.document = {
    baseURI: 'https://gazll.github.io/',
    head: {
      appendChild(node) { nodes.set(node.id || node.selector || String(nodes.size), node); },
      querySelector: find
    },
    createElement(tag) {
      return {
        id: '', type: '', textContent: '', tagName: tag,
        setAttribute(name, value) {
          this[name] = value;
          if (name === 'name') this.selector = `meta[name="${value}"]`;
          if (name === 'property') this.selector = `meta[property="${value}"]`;
        },
        remove() { for (const [key, value] of nodes) if (value === this) nodes.delete(key); }
      };
    },
    getElementById(id) { return nodes.get(id) || null; }
  };
  const { setArticleStructuredData } = await import('../public/lib/structured-data.js?' + Math.random());
  setArticleStructuredData({ created_at: '2026-08-18', updated_at: '2026-08-19' }, {
    headline: 'A production race condition', description: 'Why one booking became two.', lang: 'en'
  });
  const data = JSON.parse(nodes.get('gazl-article-structured-data').textContent);
  assert.equal(data['@type'], 'TechArticle');
  assert.equal(data.datePublished, '2026-08-18');
  assert.equal(data.dateModified, '2026-08-19');
  assert.equal(globalThis.document.title, 'A production race condition · Backend Engineering');
  assert.equal(find('meta[name="description"]').content, 'Why one booking became two.');
  delete globalThis.document;
  delete globalThis.window;
});
