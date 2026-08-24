import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('study question chrome keeps the prompt readable and qmeta compact', async () => {
  const root = new URL('../', import.meta.url);
  const [component, styles] = await Promise.all([
    readFile(new URL('app/components/study/QuestionCard.vue', root), 'utf8'),
    readFile(new URL('public/styles.css', root), 'utf8')
  ]);
  assert.match(component, /:id="`question-\$\{item\.id\}-toggle`"/);
  assert.match(styles, /\.view-track \.qcard\[data-qid\] \.qmeta\{display:flex;flex-direction:row/);
  assert.match(styles, /\.view-track \.qcard\[data-qid\] \.qprompt\{grid-column:2;grid-row:1;display:block/);
  assert.match(styles, /manual-review-short/);
});
