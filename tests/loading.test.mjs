import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => readFile(path.join(root, file), 'utf8');

test('native Nuxt surfaces expose visible loading fallbacks', async () => {
  const [gazlPage, gazl, searchOverlay, topic] = await Promise.all([
    read('app/pages/gazl.vue'),
    read('app/components/gazl/GazlJournal.client.vue'),
    read('app/components/search/SearchOverlay.client.vue'),
    read('app/components/study/TopicPage.vue')
  ]);

  assert.match(gazlPage, /#fallback/);
  assert.match(gazlPage, /loading-block/);
  assert.match(gazl, /v-if="loading"/);
  assert.match(gazl, /class="loading-block"/);
  assert.match(searchOverlay, /v-if="loading"/);
  assert.match(searchOverlay, /labels\.loading/);
  assert.match(topic, /const \{ data, error \}/);
});

test('native search and study pages keep their empty/error states distinct', async () => {
  const [searchPage, overlay, topic] = await Promise.all([
    read('app/pages/search.vue'),
    read('app/components/search/SearchOverlay.client.vue'),
    read('app/components/study/TopicPage.vue')
  ]);
  assert.match(searchPage, /v-else-if="!query"/);
  assert.match(searchPage, /v-else-if="!results\.length"/);
  assert.match(overlay, /v-else-if="loadError"/);
  assert.match(overlay, /v-else-if="!query\.trim\(\)"/);
  assert.match(topic, /if \(error\.value\) throw error\.value/);
});

test('native loading fallbacks remain readable with reduced motion', async () => {
  const css = await read('public/styles.css');
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.loading-block/);
});
