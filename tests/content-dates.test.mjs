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
