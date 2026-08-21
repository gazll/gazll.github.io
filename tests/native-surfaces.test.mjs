import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { readFile, readdir, access } from 'node:fs/promises';
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
    // one index file per language: fetching the other one renders every row blank
    assert.match(overlay, /search-index\/\$\{props\.lang\}/);
    assert.match(config, /search-index\/en/);
    assert.match(config, /search-index\/vi/);
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
      read('server/api/content/search-index/[lang].get.ts'),
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
    assert.match(card, /reviewedFact/);
    assert.match(card, /revealHash/);
    assert.match(card, /resolveRef/);
    assert.match(card, /Copied/);
  });

  test('Gazl is a native Vue journal with CRUD, import, sync and Mermaid review', async () => {
    const [page, journal] = await Promise.all([
      read('app/pages/gazl-try.vue'),
      read('app/components/gazl/GazlJournal.client.vue')
    ]);

    assert.match(page, /GazlJournal/);
    for (const contract of ['interviews.list', 'interviews.save', 'interviews.delete', 'Save to my journal', 'ContentMermaidDiagram', 'Add company']) {
      assert.ok(journal.includes(contract), `Gazl journal is missing ${contract}`);
    }
  });

  test('the journal splits collected common ground from single-company entries', async () => {
    const journal = await read('app/components/gazl/GazlJournal.client.vue');

    // Common leads: a synthesised playbook is what a reader should study before
    // any one company's questions, so its group is built first.
    const groups = /const groups = computed\(\(\) => \[([\s\S]*?)\]\.filter/.exec(journal);
    assert.ok(groups, 'the journal no longer groups its entries');
    assert.ok(groups[1].indexOf("id: 'common'") < groups[1].indexOf("id: 'companies'"),
      'common ground must be built before the per-company group');
    assert.match(groups[1], /filter\(company => company\.kind\)/);
    assert.match(groups[1], /filter\(company => !company\.kind\)/);

    // Collapsed by default, or one 13-question entry buries every row under it.
    assert.match(journal, /openCompanies = ref\(new Set<string>\(\)\)/);
    assert.match(journal, /v-show="isOpen\(company\)"/);
    // The head is the toggle, so its controls may not be nested buttons — the
    // .qhead rule, same failure mode.
    const head = /<button class="iv-co-head"[\s\S]*?<\/button>/.exec(journal);
    assert.ok(head, 'the collapsible head is missing');
    assert.ok(!/<button/.test(head[0].slice(1)), 'nothing inside .iv-co-head may be a button');

    for (const field of ['company.jd', 'company.brief', 'roundList(company)']) {
      assert.ok(journal.includes(field), `the journal no longer renders ${field}`);
    }
  });

  test('the renamed journal route keeps the old /gazl link working', async () => {
    const config = await read('nuxt.config.ts');
    assert.match(config, /'\/gazl-try'/);
    assert.match(config, /'\/gazl': \{ redirect: \{ to: '\/gazl-try', statusCode: 301 \} \}/);
    assert.ok(!/'\/gazl',/.test(config), '/gazl must not still be prerendered as its own page');
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
    const [release, gazl, question, design, header, overlay, search] = await Promise.all([
      read('app/pages/release-notes.vue'), read('app/components/gazl/GazlJournal.client.vue'),
      read('app/components/study/QuestionCard.vue'), read('app/pages/system-design/[slug].vue'),
      read('app/components/content/ContentHeader.vue'),
      read('app/components/search/SearchOverlay.client.vue'), read('app/pages/search.vue')
    ]);

    for (const selector of ['class="rn-change"', 'class="rn-cmeta"', 'class="rn-text"']) {
      assert.ok(release.includes(selector), `release notes is missing ${selector}`);
    }
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

    /* The skip link only works if focus really moves. Without tabindex the next
       Tab continues from the link and walks back into the navigation it was
       skipping, and without the scroll margin the content lands under the
       sticky header — both of which read as "the skip link does nothing". */
    assert.match(styles, /#view-host,#view-track\{scroll-margin-top/,
      'the skip target must clear the sticky header');
    const vueFiles = async dir => {
      const out = [];
      for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) out.push(...await vueFiles(rel));
        else if (entry.name.endsWith('.vue')) out.push(rel);
      }
      return out;
    };
    const templates = (await Promise.all((await vueFiles('app')).map(async file => [file, await read(file)])))
      .filter(([, source]) => /id="view-(?:host|track)"/.test(source));
    assert.ok(templates.length >= 8, 'every reader surface should carry a skip target');
    for (const [file, source] of templates) {
      assert.doesNotMatch(source, /id="view-(?:host|track)"(?! tabindex="-1")/,
        `${file}: a skip target must be focusable`);
    }
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


  /* Nuxt drops a directory segment the filename already repeats, so
     `components/auth/AuthControl.vue` registers as `AuthControl`, not
     `AuthAuthControl`. Three components were written the long way and silently
     never rendered — the account control, the Admin body and the Stats body —
     because an unresolved component is a console warning, not a build error.

     The rule is derived here rather than hard-coded so it also covers whatever
     is added next. */
  test('every component is referenced by the name Nuxt actually registers', async () => {
    const componentsRoot = path.join(root, 'app/components');

    const walk = async dir => {
      const out = [];
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...await walk(full));
        else if (entry.name.endsWith('.vue')) out.push(full);
      }
      return out;
    };
    const files = await walk(componentsRoot);
    assert.ok(files.length > 5, 'no components found; the path is wrong');

    const registered = file => {
      const parts = path.relative(componentsRoot, file)
        .split(path.sep)
        .join('/')
        .replace(/\.(client|server)\.vue$|\.vue$/, '')
        .split('/')
        .map(part => part[0].toUpperCase() + part.slice(1));
      const name = [];
      for (const part of parts) {
        if (name.length && part.startsWith(name[name.length - 1])) name.pop();
        name.push(part);
      }
      return name.join('');
    };
    const names = new Set(files.map(registered));

    const templates = await Promise.all(
      [...files, ...(await walk(path.join(root, 'app/pages'))), path.join(root, 'app/app.vue')]
        .map(async file => [file, await readFile(file, 'utf8')]));

    for (const [file, source] of templates) {
      // Only tags that look like one of ours: PascalCase, and not a known
      // Nuxt built-in.
      const BUILTIN = new Set(['ClientOnly', 'NuxtLink', 'NuxtPage', 'NuxtLayout', 'Suspense',
        'Transition', 'KeepAlive', 'Teleport', 'Component', 'NuxtLoadingIndicator', 'NuxtRouteAnnouncer']);
      // Only the <template> block: a TS generic like useTemplateRef<HTMLDialogElement>
      // looks exactly like a tag to a regex.
      const template = source.slice(source.indexOf('<template>'));
      for (const [, tag] of template.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)) {
        if (BUILTIN.has(tag) || names.has(tag)) continue;
        assert.fail(`${path.relative(root, file)} renders <${tag}>, which no component registers as. `
          + `Did you mean one of: ${[...names].filter(n => n.includes(tag.slice(0, 6))).join(', ') || '(none)'}?`);
      }
    }
  });

  test('native Nuxt surfaces expose visible loading fallbacks', async () => {
    const [gazlPage, gazl, searchOverlay, topic, statsPage, adminPage] = await Promise.all([
      read('app/pages/gazl-try.vue'),
      read('app/components/gazl/GazlJournal.client.vue'),
      read('app/components/search/SearchOverlay.client.vue'),
      read('app/components/study/TopicPage.vue'),
      read('app/pages/stats.vue'),
      read('app/pages/admin.vue')
    ]);

    /* A page-level <ClientOnly> renders nothing until hydration, so a hero
       with a blank column under it is what the reader actually sees. Stats and
       Admin both shipped that way after the migration. */
    for (const [name, page] of [['gazl-try', gazlPage], ['stats', statsPage], ['admin', adminPage]]) {
      assert.match(page, /#fallback/, `${name} has no ClientOnly fallback`);
      assert.match(page, /loading-block/, `${name} fallback is not the shared loading block`);
    }
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
    // The player is loaded through a bare URL, so a broken import in it fails
    // at RUNTIME as "failed to fetch dynamically imported module" and every
    // card open throws. It must depend only on modules that still exist.
    assert.ok(!player.includes("from './content.js'"),
      'the browser content model is gone; the caller passes the language');
    assert.match(player, /const active = lang \|\| 'en'/);
  });
}
