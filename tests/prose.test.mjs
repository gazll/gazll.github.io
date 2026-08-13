import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const publicRoot = path.join(root, 'public');
const { SENTENCE, bulletParts, labelledParts, sentences } = await import(pathToFileURL(
  path.join(publicRoot, 'lib/prose.js')).href);

test('sentences split on real boundaries, in both languages', () => {
  assert.deepEqual(sentences('One claim. Two claims.'), ['One claim.', 'Two claims.']);
  // an accented capital opens a sentence too, or VI prose never breaks
  assert.deepEqual(sentences('Câu đầu tiên. Đây là câu thứ hai.'),
    ['Câu đầu tiên.', 'Đây là câu thứ hai.']);
  // a decimal separator and an abbreviation inside a word are not boundaries
  assert.deepEqual(sentences('Khoảng 2.500 rps peak theo planning factor.').length, 1);
  assert.deepEqual(sentences(''), []);
  assert.ok(SENTENCE instanceof RegExp);
});

test('a labelled run needs two labels, and keeps every part in order', () => {
  const row = 'Problem solved: pull large reads off the origin. Flow position: the client fetches from the edge. '
    + 'Failure / cost: a bad cache key serves stale content. Tier verdict: 1M worth it; 10M mandatory.';
  const parts = labelledParts(row);
  assert.deepEqual(parts.map(part => part.label),
    ['Problem solved', 'Flow position', 'Failure / cost', 'Tier verdict']);
  assert.equal(parts[0].body, 'pull large reads off the origin.');
  assert.equal(parts.at(-1).body, '1M worth it; 10M mandatory.');

  // One label is the ordinary "label: rest" list row, not a labelled run.
  assert.equal(labelledParts('Stock invariant: available stock never goes negative.'), null);
  assert.equal(labelledParts('No label at all here.'), null);
  // A mid-sentence colon introduces a clause; a label never runs that long.
  assert.equal(labelledParts('Use the supplied diagram as the logical target for the promotion: CDN at the edge. '
    + 'The picture says 1M DAU while the yardstick is requests per day.'), null);
});

test('a labelled run survives a preamble before the first label', () => {
  const parts = labelledParts('Redis is a data-structure server. Problem solved: sub-millisecond reads. '
    + 'Tier verdict: 1M worth it.');
  assert.equal(parts.length, 3);
  assert.equal(parts[0].label, '');
  assert.equal(parts[0].body, 'Redis is a data-structure server.');
  assert.equal(parts[1].label, 'Problem solved');
});

test('bullets are for prose that enumerates, and nothing shorter', () => {
  // three sentences: the first introduces, the rest are the list
  const three = bulletParts('Redis is a data-structure server. It buys sorted sets and counters. It costs a failure domain.');
  assert.equal(three.lead, 'Redis is a data-structure server.');
  assert.equal(three.items.length, 2);

  // three clauses behind a lead
  const clauses = bulletParts('Use the diagram as the target: CDN at the edge; search isolated; each database owns an outbox.');
  assert.equal(clauses.lead, 'Use the diagram as the target:');
  assert.deepEqual(clauses.items, ['CDN at the edge', 'search isolated', 'each database owns an outbox.']);

  // two of either is a compound sentence, not a list
  assert.deepEqual(bulletParts('One claim. Its qualifier.').items, []);
  assert.deepEqual(bulletParts('One clause; its qualifier.').items, []);
  assert.equal(bulletParts('One claim. Its qualifier.').lead, 'One claim. Its qualifier.');
});

test('an enumeration with no lead is still returned, and callers decide', () => {
  // No colon: the caller (a labelled part) supplies the introduction, and a
  // caller with neither must keep the paragraph.
  const bare = bulletParts('1M worth it; 10M mandatory; 100M needs its own scaling story.');
  assert.equal(bare.lead, '');
  assert.equal(bare.items.length, 3);
});

test('structuring never loses a character of the source', async () => {
  const catalog = JSON.parse(await readFile(
    path.join(publicRoot, 'data/system-design/catalog.json'), 'utf8'));
  // Semicolons become list boundaries; nothing else may be consumed.
  const bare = value => String(value).replace(/[\s;]+/g, '');

  for (const design of catalog.designs) {
    for (const lang of ['en', 'vi']) {
      for (const field of ['scope', 'functional', 'quality', 'capacity', 'data_model', 'stack', 'tradeoffs']) {
        for (const row of [design[lang][field]].flat()) {
          const parts = labelledParts(row) || [{ label: '', body: row }];
          const rebuilt = parts.map(part => {
            const { lead, items } = bulletParts(part.body);
            return (part.label ? part.label + ':' : '') + (items.length ? lead + items.join('') : part.body);
          }).join('');
          assert.equal(bare(rebuilt), bare(row), `${design.slug}.${lang}.${field}: text changed`);
        }
      }
    }
  }
});
