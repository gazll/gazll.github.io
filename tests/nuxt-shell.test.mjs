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

test('collection indexes keep the card layout contract after the Nuxt migration', async () => {
  const [collection, systemDesign] = await Promise.all([
    read('app/components/content/CollectionIndex.vue'),
    read('app/pages/system-design/index.vue')
  ]);

  for (const cssClass of ['cs-library', 'cs-category-head', 'cs-card-grid', 'cs-card-art', 'cs-card-content', 'cs-card-excerpt', 'cs-card-meta', 'cs-card-arrow']) {
    assert.ok(collection.includes(cssClass), `collection index is missing ${cssClass}`);
  }
  assert.match(collection, /article\.category !== 'systems-architecture'/);
  for (const cssClass of ['sd-library', 'sd-hero', 'sd-group', 'sd-list', 'sd-card-num', 'sd-card-main', 'sd-case-card']) {
    assert.ok(systemDesign.includes(cssClass), `system design index is missing ${cssClass}`);
  }
});

test('native article shells preserve responsive images, TOC, lightbox and Mermaid hooks', async () => {
  const [article, endpoint, mermaid, design, styles] = await Promise.all([
    read('app/components/content/CollectionArticle.vue'),
    read('server/api/content/collection/[collection]/[slug].get.ts'),
    read('app/components/content/MermaidDiagram.client.vue'),
    read('app/pages/system-design/[slug].vue'),
    read('public/styles.css')
  ]);

  for (const cssClass of ['cs-backbar', 'cs-guide', 'cs-toc-mobile', 'cs-article-grid', 'cs-toc', 'cs-article-body', 'cs-lightbox']) {
    assert.ok(article.includes(cssClass), `collection article is missing ${cssClass}`);
  }
  assert.match(endpoint, /normalizeBodyHtml/);
  assert.match(endpoint, /assets\\\//);
  assert.match(endpoint, /class=\"cs-figure\"/);
  assert.match(styles, /\.cs-article-body img\{display:block;max-width:100%;height:auto\}/);
  assert.match(mermaid, /data-mermaid-diagram/);
  assert.match(mermaid, /data-diagram-frame/);
  assert.match(design, /class="sd-article-grid"/);
  assert.match(design, /class="sd-article-body"/);
});

test('topic and navigation rows retain visible spacing and separators', async () => {
  const styles = await read('public/styles.css');

  assert.match(styles, /\.tm-row\+\.tm-row/);
  assert.match(styles, /\.navlink\+\.navlink/);
  assert.match(styles, /\.nv-sec\+\.nv-sec/);
});

test('migrated System Design questions remain readable and searchable at their new owner', async () => {
  const [endpoint, search, page, topic] = await Promise.all([
    read('server/api/content/system-design/[slug].get.ts'),
    read('server/api/content/search-index.get.ts'),
    read('app/pages/system-design/[slug].vue'),
    read('app/components/study/TopicPage.vue')
  ]);

  assert.match(endpoint, /sourceNotes/);
  assert.match(endpoint, /researchCatalog/);
  assert.match(search, /sourceOwners\.has\(id\)/);
  for (const contract of ['code_samples', 'failureReview', 'engineering-deep-dives', 'migrated-notes', 'copyNoteLink']) {
    assert.ok(page.includes(contract), `System Design reader is missing ${contract}`);
  }
  assert.match(topic, /:source-owners="data!\.sourceOwners"/);
});

test('study cards preserve bilingual controls, bulk expansion, review dates and deep links', async () => {
  const [topic, card] = await Promise.all([
    read('app/components/study/TopicPage.vue'),
    read('app/components/study/QuestionCard.vue')
  ]);

  assert.match(topic, /Expand all/);
  assert.match(topic, /Collapse all/);
  assert.match(card, /qlangbtn/);
  assert.match(card, /reviewedLabel/);
  assert.match(card, /revealHash/);
  assert.match(card, /resolveRef/);
  assert.match(card, /Copied/);
});

test('Gazl is a native Vue journal with CRUD, import, sync and Mermaid review', async () => {
  const [page, journal] = await Promise.all([
    read('app/pages/gazl.vue'),
    read('app/components/gazl/GazlJournal.client.vue')
  ]);

  assert.match(page, /GazlJournal/);
  for (const contract of ['interviews.list', 'interviews.save', 'interviews.delete', 'Save to my journal', 'ContentMermaidDiagram', 'Add company']) {
    assert.ok(journal.includes(contract), `Gazl journal is missing ${contract}`);
  }
});

test('legacy bookmarks and the CalebZone route survive the route migration', async () => {
  const [middleware, config] = await Promise.all([
    read('app/middleware/legacy-hash.global.client.ts'),
    read('nuxt.config.ts')
  ]);

  for (const route of ['track', 'system-design', 'case-studies', 'project']) assert.ok(middleware.includes(route));
  assert.match(config, /'\/project\/calebzone'/);
  assert.match(config, /statusCode: 301/);
});

test('project, release notes, search and collection readers retain their richer controls', async () => {
  const [project, releases, search, overlay, collection, article] = await Promise.all([
    read('app/pages/project.vue'), read('app/pages/release-notes.vue'), read('app/pages/search.vue'),
    read('app/components/search/SearchOverlay.client.vue'), read('app/components/content/CollectionIndex.vue'),
    read('app/components/content/CollectionArticle.vue')
  ]);

  for (const contract of ['pj-toc', 'ContentMermaidDiagram', 'pj-requirement-list', 'pj-sample-list', 'pj-doc-group']) assert.ok(project.includes(contract));
  assert.match(releases, /group.*Map|const groups = new Map/);
  assert.match(search, /searchHistory/);
  assert.match(overlay, /Recent searches/);
  assert.match(collection, /Recently updated/);
  assert.match(article, /is-toc-collapsed/);
  assert.match(article, /md-heading-anchor/);
});
