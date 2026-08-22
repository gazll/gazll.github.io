/* Release notes are bilingual data, not study items. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pub = path.join(root, 'public');
const NOTES = JSON.parse(await readFile(path.join(pub, 'data/release-notes.json'), 'utf8'));
const META = JSON.parse(await readFile(path.join(pub, 'data/meta.json'), 'utf8'));
const MANIFEST = JSON.parse(await readFile(path.join(pub, 'data/manifest.json'), 'utf8'));
const releases = NOTES.releases || [];
const changes = releases.flatMap(r => (r.changes || []).map(c => ({ release: r, change: c })));
const LANGS = ['en', 'vi'];
const NON_TOPIC_TARGETS = new Set([
  'case-studies', 'system-design', 'interviews', 'boot', 'language', 'all-topics', 'release-notes', 'search',
  'calendar'
]);

test('there is at least one release, and every release is dated ISO yyyy-mm-dd', () => {
  assert.ok(releases.length > 0);
  for (const release of releases) {
    assert.match(String(release.date), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(release.date + 'T00:00:00Z').toISOString().slice(0, 10), release.date);
  }
});

test('releases are ordered newest first and same-day releases stay adjacent', () => {
  const dates = releases.map(r => r.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
  const seen = new Set();
  let previous = null;
  for (const release of releases) {
    if (release.date !== previous) {
      assert.equal(seen.has(release.date), false, release.date + ' appears in a second group');
      seen.add(release.date);
      previous = release.date;
    }
  }
});

test('every release and every change carries both languages', () => {
  for (const release of releases) {
    for (const lang of LANGS) {
      assert.ok(release[lang], 'release ' + release.date + ' is missing ' + lang);
      assert.ok(String(release[lang].title || '').trim());
    }
  }
  for (const { release, change } of changes) {
    for (const lang of LANGS) {
      assert.ok(change[lang], release.date + '/' + change.target + ': no ' + lang + ' block');
      assert.ok(String(change[lang].text || '').trim());
    }
  }
});

test('release change summaries stay concise and state the change', () => {
  for (const { release, change } of changes) {
    for (const lang of LANGS) {
      const text = String(change[lang].text || '');
      assert.ok(text.length <= 260,
        release.date + '/' + change.target + '/' + lang + ': release summary is too long');
      assert.equal(text.includes('\n'), false,
        release.date + '/' + change.target + '/' + lang + ': release summary has multiple lines');
    }
  }
});

test('a change naming a topic names one that exists by immutable key', () => {
  const keys = new Set(Object.values(META.topics).map(topic => topic.key));
  const stems = new Set(MANIFEST.topics.map(row => path.basename(row.file, '.json')));
  for (const { release, change } of changes) {
    const target = String(change.target || '');
    assert.ok(target, release.date + ': a change has no target');
    if (NON_TOPIC_TARGETS.has(target)) continue;
    assert.ok(keys.has(target), release.date + ': unknown meta target ' + target);
    assert.ok(stems.has(target), release.date + ': missing topic file ' + target);
  }
});

test('counts are positive integers and release totals match topic changes', () => {
  for (const { release, change } of changes) {
    if (change.count === undefined) continue;
    assert.ok(Number.isInteger(change.count) && change.count > 0,
      release.date + '/' + change.target + ': invalid count');
  }
  for (const release of releases) {
    if (release.items_added === undefined) continue;
    const sum = (release.changes || [])
      .filter(change => change.kind === 'topic')
      .reduce((total, change) => total + (change.count || 0), 0);
    assert.equal(release.items_added, sum, release.date + ': item total mismatch');
  }
});

test('a section named by a change exists in that topic and language', async () => {
  for (const { release, change } of changes) {
    if (NON_TOPIC_TARGETS.has(String(change.target))) continue;
    for (const lang of LANGS) {
      const section = change[lang]?.section;
      if (!section) continue;
      const file = 'data/topics/' + change.target + (lang === 'vi' ? '.vi' : '') + '.json';
      const topic = JSON.parse(await readFile(path.join(pub, file), 'utf8'));
      assert.ok(topic.sections.some(row => row.title === section),
        release.date + ': ' + file + ' has no section ' + section);
    }
  }
});

test('release notes are not study items', () => {
  for (const { change } of changes) {
    assert.equal(change.id, undefined);
    assert.equal(change.difficulty, undefined);
  }
  assert.equal(/"[0-9]{2}-[a-z0-9-]+\.[a-z0-9-]+\.q\d+"/.test(JSON.stringify(NOTES)), false);
});

test('the Gazl Try playbook release records its named company context', () => {
  const release = releases.find(row => row.changes?.some(change => change.target === 'interviews'));
  assert.ok(release);
  const text = release.changes.flatMap(change => [change.en?.text, change.vi?.text]).join('\n');
  for (const company of ['OCB', 'MoMo', 'FPT', '7‑Eleven', 'Pizza Hut', 'GHN', 'Abbott']) {
    assert.match(text, new RegExp(company));
  }
  assert.match(text, /11 (?:thẻ|card)/i);
});

test('release notes are rendered by the native bilingual page', async () => {
  const source = await readFile(path.join(root, 'app/pages/release-notes.vue'), 'utf8');
  const endpoint = await readFile(path.join(root, 'server/api/content/releases.get.ts'), 'utf8');
  assert.match(source, /useAsyncData\('release-notes'/);
  assert.match(source, /new Map/);
  assert.match(source, /dateLabel/);
  assert.match(source, /release\[lang\]\?\.title \|\| release\.en\.title/);
  assert.match(source, /change\[lang\]\?\.text \|\| change\.en\.text/);
  assert.match(endpoint, /release-notes\.json/);
});
