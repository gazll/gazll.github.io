import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const removed = [
  'public/app.js',
  'public/shells/main.html',
  'public/views',
  'public/lib/loading.js',
  'public/lib/ui.js',
  'public/lib/page-metadata.js',
  'public/lib/structured-data.js',
  'app/middleware/legacy-hash.global.client.ts',
  'app/components/LegacySurface.client.vue'
];

test('the old main application stack is gone', async () => {
  for (const file of removed) {
    await assert.rejects(access(path.join(root, file)), file + ' must stay removed');
  }
});

test('native DSA cards load the retained runtime adapter', async () => {
  const [question, player] = await Promise.all([
    readFile(path.join(root, 'app/components/study/QuestionCard.vue'), 'utf8'),
    readFile(path.join(root, 'public/lib/dsa-player.js'), 'utf8')
  ]);
  assert.ok(question.includes("new URL('/lib/dsa-player.js'"));
  assert.doesNotMatch(question, /\/views\//);
  assert.ok(player.includes("from './dsa-anim.js'"));
  assert.ok(player.includes("from './i18n.js'"));
  assert.ok(player.includes("from './content.js'"));
});
