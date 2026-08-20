import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/* The Nuxt application surfaces: the shared header and navigation, the
   native readers, the loading and empty states, and the reading chrome that
   lives in CSS but is driven from JavaScript. Also pins what the retired
   hash-router stack left behind - the removals that must stay removed, and the
   one redirect that must not.

   Merged from: nuxt-shell, native-regressions, loading, legacy-removal.
   Each block keeps its own scope so fixtures and helpers cannot collide. */

// ---- from nuxt-shell.test.mjs ----
{
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
      read('app/components/content/MermaidDiagram.vue'),
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
    /* Server-rendered, so the escaped source ships inside the <pre> and the
       diagram degrades to readable, copyable Mermaid when the renderer never
       loads. As a .client component Nuxt emitted a placeholder instead and
       leaked the diagram source as a stray HTML attribute. */
    assert.ok(!existsSync(new URL('../app/components/content/MermaidDiagram.client.vue', import.meta.url)),
      'the Mermaid diagram must not be client-only');
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

  test('the native project route keeps the old CalebZone alias redirect', async () => {
    const config = await read('nuxt.config.ts');
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
}

// ---- from native-regressions.test.mjs ----
{
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

  /* Reading chrome that lives in CSS but is driven from JS: if nothing sets the
     class or the custom property, the rule silently falls back and the loss is
     invisible in a diff. Each of these shipped broken after the Nuxt migration. */
  test('the header publishes --hdr-h and hides on scroll', async () => {
    const [headroom, header, styles] = await Promise.all([
      read('app/composables/useHeadroom.client.ts'),
      read('app/components/content/ContentHeader.vue'),
      read('public/styles.css')
    ]);

    assert.ok(header.includes('useHeadroom()'), 'the shared header must run headroom');
    assert.match(headroom, /setProperty\('--hdr-h'/, '--hdr-h must be published');
    assert.match(headroom, /classList\.add\('hidden'\)/, 'the header must hide on scroll-down');
    // Every sticky offset is measured against it, so the fallback is not enough.
    assert.ok(styles.includes('header.top.hidden{transform:translateY(-100%)}'));
    assert.ok((styles.match(/var\(--hdr-h/g) || []).length >= 5,
      'sticky rules still depend on --hdr-h');
    // The drawer and topic panel own the header while open.
    for (const state of ['nav-open', 'topic-open']) assert.ok(headroom.includes(state));
  });

  test('pinned library group headers shed their description', async () => {
    const [sticky, library, collection, styles] = await Promise.all([
      read('app/composables/useStickyGroupHeads.client.ts'),
      read('app/pages/system-design/index.vue'),
      read('app/components/content/CollectionIndex.vue'),
      read('public/styles.css')
    ]);

    assert.match(sticky, /stickyGroupHeads/, 'the observer stays in lib/reading-position.js');
    assert.ok(library.includes("useStickyGroupHeads(libraryRoot, '.sd-group>header')"));
    assert.ok(collection.includes("useStickyGroupHeads(libraryRoot, '.cs-category-head')"));
    // Re-sorting replaces the observed nodes.
    assert.match(collection, /watch\(sortMode, \(\) => sticky\.rebind\(\)\)/);
    assert.match(styles, /\.sd-group>header\.is-stuck.*\{/);
  });

  /* copyText keeps an execCommand fallback that a local HTTP preview needs;
     navigator.clipboard is undefined there, so a bare call silently does nothing. */
  test('every copy control goes through lib/clipboard.js', async () => {
    const files = [
      'app/components/study/QuestionCard.vue',
      'app/pages/system-design/[slug].vue',
      'app/components/content/MermaidDiagram.vue'
    ];
    for (const file of files) {
      const source = await read(file);
      assert.ok(source.includes('copyText'), `${file} must copy through copyText`);
      assert.doesNotMatch(source, /await navigator\.clipboard\.writeText/,
        `${file} must not reimplement the clipboard`);
    }
  });

  /* A DSA animation is mounted into markup, so every path that replaces a card's
     markup must stop the player first and remount after — otherwise the
     setInterval keeps stepping a detached <figure>. The per-card language switch
     replaces the answer without reopening the card, so it needs its own handler:
     it was the one path the migration left unwired. */
  test('DSA players are remounted when a card switches language', async () => {
    const card = await read('app/components/study/QuestionCard.vue');

    const watcher = card.slice(card.indexOf('watch(localLang'), card.indexOf('watch(() => props.forceToken'));
    assert.ok(watcher.includes('stopDsaPlayers'), 'the running player must be stopped first');
    assert.ok(watcher.includes('mountDsaPlayers'), 'the new markup must be remounted');
    assert.ok(watcher.indexOf('stopDsaPlayers') < watcher.indexOf('mountDsaPlayers'),
      'stop must come before mount');
    // The per-card switch must not move the global content language.
    assert.match(watcher, /mountDsaPlayers\(card\.value, language\)/,
      'the language is passed explicitly, never read from Content.lang');
    // Unmounting still stops the interval.
    assert.match(card, /onBeforeUnmount\([\s\S]*?stopDsaPlayers/);
  });
}

// ---- from loading.test.mjs ----
{
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
}

// ---- from legacy-removal.test.mjs ----
{
  const root = path.resolve(import.meta.dirname, '..');
  const removed = [
    'public/app.js',
    'public/shells/main.html',
    'public/views',
    'public/lib/loading.js',
    'public/lib/ui.js',
    'public/lib/page-metadata.js',
    'public/lib/structured-data.js',
    'app/components/LegacySurface.client.vue'
  ];

  test('the old main application stack is gone', async () => {
    for (const file of removed) {
      await assert.rejects(access(path.join(root, file)), file + ' must stay removed');
    }
  });

  /* The router is retired; the bookmarks it minted are not. */
  test('retired hash URLs still resolve to their filesystem route', async () => {
    const middleware = await readFile(path.join(root, 'app/middleware/legacy-hash.global.client.ts'), 'utf8');
    assert.match(middleware, /defineNuxtRouteMiddleware/);
    for (const shape of ['track', 'system-design', 'case-studies', 'project']) {
      assert.ok(middleware.includes(shape), `#/${shape} must keep a mapping`);
    }
    assert.match(middleware, /question-\$\{encodeURIComponent\(questionId\)\}/,
      'a deep-linked item id must survive the rewrite');
    assert.match(middleware, /replace: true/, 'the rewrite must not add a history entry');
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
}
