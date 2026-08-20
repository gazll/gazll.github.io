/* The loading chrome. Three separate promises, and each one has already been
   broken once by a page that simply sat there:

   1. the shell's progress bar, which is the only feedback for a wait that
      changes nothing on screen (a topic pair still in flight, an async mount);
   2. the placeholder a view paints while its body is missing — four surfaces
      had a spinner and four had bare text;
   3. search, which printed "No match" for a query whose index was still
      building. That reads as an answer, and it is the wrong one. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const PUBLIC = new URL('../public/', import.meta.url);
const read = name => readFile(new URL(name, PUBLIC), 'utf8');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Enough of a DOM for lib/loading.js: the bar, and the shell's live region. */
function fakeBar() {
  const classes = new Set();
  const bar = {
    classList: {
      toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }
    },
    get active() { return classes.has('is-active'); }
  };
  const live = { textContent: '' };
  globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
  globalThis.document = {
    getElementById: id => (id === 'routeProgress' ? bar : id === 'liveStatus' ? live : null)
  };
  return { bar, live };
}

test('the shell carries the one progress bar, and the first paint is not blank', async () => {
  const html = await read('index.html');

  assert.match(html, /id="routeProgress"/, 'index.html must carry the bar lib/loading.js writes to');
  assert.match(html, /class="route-progress"/);
  // Decorative: the reader hears the view's own role="status", not the bar.
  assert.match(html, /<div class="route-progress" id="routeProgress" aria-hidden="true">/);

  // The track panel used to be empty markup, so the shell showed a header, a
  // pager and a hole through the version fetch, the module graph and the first
  // topic pair. The skeleton has to be static HTML: no module has parsed yet.
  const panel = html.slice(html.indexOf('<div id="panel"'));
  assert.match(panel.slice(0, 1200), /class="boot-skel"/,
    'the track panel must ship a first-paint skeleton, not an empty div');
  assert.ok(panel.indexOf('boot-skel-card') < panel.indexOf('</main>'),
    'the skeleton belongs inside the track panel');
});

test('the progress bar is delayed, ref-counted, and held once it is up', async () => {
  const { bar, live } = fakeBar();
  const { beginLoading, endLoading, trackLoading } = await import('../public/lib/loading.js');

  // A cached topic settles in a few milliseconds. A bar that appears and
  // vanishes inside one frame reads as a glitch, so it must never appear.
  beginLoading();
  await sleep(40);
  endLoading();
  await sleep(200);
  assert.equal(bar.active, false, 'a wait shorter than the delay must not flash the bar');

  // Two overlapping waits: the first to finish must not clear the second.
  beginLoading();
  beginLoading();
  await sleep(220);
  assert.equal(bar.active, true, 'a wait past the delay shows the bar');
  endLoading();
  await sleep(60);
  assert.equal(bar.active, true, 'one of two waits finishing keeps the bar up');
  endLoading();
  assert.equal(bar.active, true, 'the bar serves a minimum visible time');
  // Only a wait long enough to show the bar is announced, and only through the
  // shell's one live region.
  await sleep(20);
  assert.equal(live.textContent, 'Loading…', 'a slow wait is announced to a screen reader');
  await sleep(420);
  assert.equal(bar.active, false, 'the bar clears once the last wait is done');

  // trackLoading hands the same promise back, so callers can still await it.
  const promise = Promise.resolve('body');
  assert.equal(trackLoading(promise), promise);
  assert.equal(await promise, 'body');

  // A rejection stops the bar and is still reported to the caller.
  const failing = Promise.reject(new Error('offline'));
  await assert.rejects(() => trackLoading(failing), /offline/);
  await sleep(400);
  assert.equal(bar.active, false, 'a failed wait must not leave the bar running');

  delete globalThis.document;
  delete globalThis.requestAnimationFrame;
});

test('lib/loading.js is the only writer of the progress bar', async () => {
  const files = ['app.js', 'boot.js', 'views/search.js', 'views/system-design.js',
    'views/case-studies.js', 'views/knowledge.js', 'views/project.js',
    'views/stats.js', 'views/admin.js', 'views/interviews.js', 'views/release-notes.js'];
  for (const file of files) {
    assert.doesNotMatch(await read(file), /routeProgress/,
      file + ' must go through lib/loading.js rather than touching the bar');
  }
  assert.match(await read('lib/loading.js'), /getElementById\('routeProgress'\)/);
});

test('no view ships a bare Loading… paragraph any more', async () => {
  const views = ['stats.js', 'admin.js', 'interviews.js', 'release-notes.js', 'search.js',
    'case-studies.js', 'knowledge.js', 'project.js', 'system-design.js'];
  for (const name of views) {
    const source = await read('views/' + name);
    assert.doesNotMatch(source, /<p class="intro">Loading/,
      'views/' + name + ' must use loadingBlock(), not a bare paragraph');
    assert.match(source, /loadingBlock\(/, 'views/' + name + ' must paint a loading block');
  }

  // A live region created together with its own text is not reliably read, so
  // the block carries none — #liveStatus in the shell says it instead.
  const loading = await read('lib/loading.js');
  assert.doesNotMatch(loading, /role="status"/, 'the block must not register its own live region');
  assert.match(loading, /announce\('Loading…'\)/, 'the shell live region carries the message');
});

test('search says it is still loading rather than reporting no match', async () => {
  const source = await read('views/search.js');

  // Both surfaces — the overlay body and the full-results panel — resolve the
  // empty case through one helper, so they cannot drift apart again.
  assert.equal((source.match(/No match for/g) || []).length, 1,
    'the empty-result sentence must have exactly one owner');
  assert.match(source, /function emptyResult\(query\) \{[\s\S]*?if \(!SearchIndex\.ready\) return loadingBlock/,
    'an index that is still building must not print "No match"');
  assert.equal((source.match(/emptyResult\(query\)/g) || []).length, 3,
    'the overlay and the panel must both call the helper');
});

test('the loading chrome degrades rather than disappearing under reduced motion', async () => {
  const css = await read('styles.css');

  assert.match(css, /\.route-progress\.is-active\{opacity:1\}/);
  // The global `*{animation:none!important}` kills the sweep, which would park
  // the bar off-screen at translateX(-100%) and report nothing at all.
  const reduced = css.slice(css.indexOf('@keyframes routeSlide'));
  assert.match(reduced.slice(0, 400), /prefers-reduced-motion:reduce\)\{\s*\.route-progress span\{width:100%;transform:none/,
    'reduced motion needs a static bar, not an off-screen one');
  assert.ok(css.indexOf('@media (prefers-reduced-motion:reduce){*{animation:none!important')
    < css.indexOf('.route-progress span{width:100%'),
    'the static fallback must come after the global reduce rule to win the cascade');

  // The per-surface copies this replaced are gone, not merely unused.
  for (const dead of ['.cs-loading', '.pj-loading', '.rn-loading', 'csSpin']) {
    assert.ok(!css.includes(dead), dead + ' was replaced by the shared loading block');
  }
});
