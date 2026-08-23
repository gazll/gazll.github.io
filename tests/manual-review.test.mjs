import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const read = file => readFile(path.join(root, file), 'utf8');

test('opening a Study Track question does not mark it reviewed', async () => {
  const card = await read('app/components/study/QuestionCard.vue');
  const openHandler = card.slice(card.indexOf('async function setOpen'), card.indexOf('function revealHash'));

  assert.doesNotMatch(openHandler, /markReviewed/);
  assert.match(card, /<StudyManualReviewButton :review-id="item\.id" :lang="localLang" \/>/);
  assert.match(card, /<div class="qmeta">[\s\S]*?<StudyManualReviewButton/);
});

test('System Design and Case Study review prompts get separate manual markers', async () => {
  const [design, article, helper] = await Promise.all([
    read('app/pages/system-design/[slug].vue'),
    read('app/components/content/CollectionArticle.vue'),
    import(pathToFileURL(path.join(root, 'public/lib/manual-review.js')).href)
  ]);

  assert.match(design, /failure-review\.q\$\{index \+ 1\}/);
  assert.match(design, /data-manual-review-id/);
  assert.match(article, /decorateReviewQuestions/);
  assert.match(article, /case-studies\.\$\{props\.slug\}\.\$\{headingId\}\.q\$\{questionNumber\}/);

  const marker = helper.manualReviewMarkup('case-studies.example.questions.q1');
  assert.match(marker, /data-manual-review-id="case-studies\.example\.questions\.q1"/);
  assert.match(marker, /aria-pressed="false"/);
  assert.match(marker, /Mark reviewed/);
});

test('manual review markers can be toggled off and synced as a deletion', async () => {
  const [button, progress, store, backend] = await Promise.all([
    read('app/components/study/ManualReviewButton.vue'),
    read('app/composables/useStudyProgress.client.ts'),
    read('public/lib/store.js'),
    read('apps-script/Code.gs')
  ]);

  assert.match(button, /toggleReviewed/);
  assert.match(button, /isReviewed \? labels\.done : labels\.pending/);
  assert.match(progress, /function toggleReviewed/);
  assert.match(store, /unmarkReviewed\(id\)/);
  assert.match(store, /progress_remove/);
  assert.match(backend, /progressRemove = asArray\(p\.progress_remove\)/);
  assert.match(backend, /table\('progress'\)\.deleteWhere/);
});
