import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');

test('the native Nuxt header keeps the complete navigation and language controls', async () => {
  const header = await read('app/components/content/ContentHeader.vue');

  assert.match(header, /class="navtoggle"/);
  assert.match(header, /class="navpanel"/);
  for (const label of ['Study Track', 'System Design', 'Case Studies', 'Photography', 'NAS / Home Server', 'Fshare Bulk Copy', 'Course Registration']) {
    assert.ok(header.includes(label), `navigation is missing the ${label} label`);
  }
  assert.match(header, /class="langswitch hdr-lang"/);
  assert.match(header, /class="lang-track"/);
  assert.match(header, /aria-checked="lang === 'vi'"/);
  assert.match(header, /<SearchOverlay/);
});

test('native search uses the established search UI contract and a static client index', async () => {
  const [page, overlay, config] = await Promise.all([
    read('app/pages/search.vue'),
    read('app/components/search/SearchOverlay.client.vue'),
    read('nuxt.config.ts')
  ]);

  for (const cssClass of ['gs-page', 'gs-page-box', 'gs-filters', 'gs-hit']) {
    assert.ok(page.includes(cssClass), `full search is missing ${cssClass}`);
  }
  assert.match(overlay, /ctrlKey \|\| event\.metaKey/);
  assert.match(overlay, /fetch\('\/api\/content\/search-index'\)/);
  assert.match(config, /'\/api\/content\/search-index'/);
});

test('topic pages feed the native header all picker labels and navigation rows', async () => {
  const [page, endpoint] = await Promise.all([
    read('app/components/study/TopicPage.vue'),
    read('server/api/content/topic/[slug].get.ts')
  ]);

  assert.match(page, /:topic="headerTopic"/);
  assert.match(page, /:topics="headerTopics"/);
  assert.match(endpoint, /topicMeta: meta\.topics/);
});
