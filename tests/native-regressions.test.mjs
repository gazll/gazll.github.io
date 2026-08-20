import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = name => readFile(path.join(root, name), 'utf8');

test('native readers keep their template and CSS contracts', async () => {
  const [release, styles, gazl, question, design, header, overlay, search] = await Promise.all([
    read('app/pages/release-notes.vue'), read('public/styles.css'), read('app/components/gazl/GazlJournal.client.vue'),
    read('app/components/study/QuestionCard.vue'), read('app/pages/system-design/[slug].vue'),
    read('app/components/content/ContentHeader.vue'),
    read('app/components/search/SearchOverlay.client.vue'), read('app/pages/search.vue')
  ]);

  for (const selector of ['class="rn-change"', 'class="rn-cmeta"', 'class="rn-text"']) {
    assert.ok(release.includes(selector), `release notes is missing ${selector}`);
  }
  assert.match(styles, /\.company-head h2/);
  assert.match(gazl, /empty-q/);
  assert.match(question, /new URL\('\/lib\/dsa-player\.js', window\.location\.origin\)/);
  assert.doesNotMatch(question, /\/views\/dsa-player\.js/);
  assert.match(question, /safeDecodeURIComponent/);
  assert.match(design, /safeDecodeURIComponent/);
  assert.match(header, /hash: route\.hash \|\| undefined/);
  assert.match(overlay, /function rememberQuery/);
  assert.match(search, /@submit\.prevent="submitSearch"/);
});

test('malformed hash segments degrade without throwing', async () => {
  const { safeDecodeURIComponent } = await import(pathToFileURL(path.join(root, 'app/utils/uri.js')).href);
  assert.equal(safeDecodeURIComponent('question-25%2Emicroservice'), 'question-25.microservice');
  assert.equal(safeDecodeURIComponent('%E0%A4%A'), '%E0%A4%A');
  assert.equal(safeDecodeURIComponent(''), '');
});
