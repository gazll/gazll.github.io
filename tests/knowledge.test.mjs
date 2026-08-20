import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const publicRoot = path.join(root, 'public');
const dataRoot = path.join(publicRoot, 'data');

const COLLECTIONS = ['photography', 'homelab'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const read = async file => JSON.parse(await readFile(path.join(dataRoot, file), 'utf8'));
const exists = async file => {
  await access(path.join(publicRoot, file));
  return true;
};

/* Other Knowledge is the Case Studies shape over a different directory. Every
   rule that made that collection safe applies here for the same reason: an
   absent companion silently drops a reader into the other language, and a
   missing body file is only visible once someone opens the card. */
test('every Other Knowledge collection is complete and bilingual', async () => {
  for (const id of COLLECTIONS) {
    const manifest = await read(id + '/manifest.json');
    const meta = await read(id + '/meta.json');

    assert.equal(manifest.version, 1, id + ': manifest version');
    assert.ok(manifest.articles.length > 0, id + ': no articles');
    assert.deepEqual(
      manifest.articles.map(row => row.n),
      manifest.articles.map((_, index) => index + 1),
      id + ': numbering must be contiguous from 1');

    const categoryIds = manifest.categories.map(row => row.id);
    assert.equal(new Set(categoryIds).size, categoryIds.length, id + ': duplicate category');
    for (const category of categoryIds) {
      for (const lang of ['en', 'vi']) {
        assert.ok(meta.categories?.[category]?.[lang]?.label, `${id}/${category}: no ${lang} label`);
        assert.ok(meta.categories?.[category]?.[lang]?.description, `${id}/${category}: no ${lang} description`);
      }
    }
    for (const lang of ['en', 'vi']) {
      for (const field of ['eyebrow', 'title', 'intro']) {
        assert.ok(meta.library?.[lang]?.[field]?.trim(), `${id}: library.${lang}.${field}`);
      }
    }

    const slugs = manifest.articles.map(row => row.slug);
    assert.equal(new Set(slugs).size, slugs.length, id + ': duplicate slug');

    for (const row of manifest.articles) {
      const label = `${id}/${row.slug}`;
      assert.match(row.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, label + ': slug');
      assert.ok(categoryIds.includes(row.category), label + ': unknown category');
      assert.ok(['core', 'advanced', 'extra'].includes(row.level), label + ': level');
      assert.ok(Number.isInteger(row.read_minutes) && row.read_minutes > 0, label + ': read_minutes');
      assert.match(row.created_at, ISO_DATE, label + ': created_at');
      assert.match(row.updated_at, ISO_DATE, label + ': updated_at');
      assert.ok(row.created_at <= row.updated_at, label + ': dates are reversed');

      // Locally authored, so the Case Studies source fields must be absent
      // rather than empty — an absent field is deliberate, a blank one is a bug.
      assert.equal(row.first_party, true, label + ': knowledge articles are first-party');
      assert.ok(!('company' in row), label + ': first-party rows carry no company');
      assert.ok(!('source_url' in row), label + ': first-party rows carry no source_url');

      assert.ok(['cover', 'contain'].includes(row.cover_fit), label + ': cover_fit');
      assert.match(row.cover_image, /^assets\/[a-z0-9][a-z0-9._/-]*\.(?:avif|jpe?g|png|svg|webp)$/i,
        label + ': cover_image must be a local asset');
      await exists(row.cover_image);

      // Both languages of the guide, and both bodies they point at.
      const base = await read(id + '/' + row.file.split('/').slice(1).join('/'));
      const viFile = row.file.replace(/\.json$/, '.vi.json');
      const vi = await read(id + '/' + viFile.split('/').slice(1).join('/'));
      for (const [lang, guideFile] of [['en', base], ['vi', vi]]) {
        assert.ok(guideFile.body_file, `${label}: ${lang} has no body_file`);
        await exists(guideFile.body_file.replace(/^data\//, 'data/'));
        assert.ok(guideFile.guide?.title?.trim(), `${label}: ${lang} guide title`);
        assert.ok(guideFile.guide?.summary?.trim(), `${label}: ${lang} guide summary`);
        assert.ok(Array.isArray(guideFile.guide?.points) && guideFile.guide.points.length >= 3,
          `${label}: ${lang} needs at least three points`);
      }

      const metadata = meta.articles?.[String(row.n)];
      assert.ok(metadata, label + ': no meta row');
      for (const lang of ['en', 'vi']) {
        assert.ok(metadata[lang]?.title?.trim(), `${label}: ${lang} title`);
        assert.ok(metadata[lang]?.excerpt?.trim(), `${label}: ${lang} excerpt`);
        assert.ok(metadata[lang]?.tags?.length, `${label}: ${lang} tags`);
      }
    }
  }
});

/* The bodies are trusted local HTML, exactly like the case-study archive, so
   they answer to the same two rules: no script, and no link that cannot load. */
test('knowledge article bodies stay inert and reachable', async () => {
  for (const id of COLLECTIONS) {
    const manifest = await read(id + '/manifest.json');
    for (const row of manifest.articles) {
      for (const lang of ['', '.vi']) {
        const file = `${id}/articles/${String(row.n).padStart(2, '0')}-${row.slug}${lang}.html`;
        const body = await readFile(path.join(dataRoot, file), 'utf8');
        assert.doesNotMatch(body, /<script\b|\son[a-z]+\s*=/i, file + ': inline script or handler');
        assert.doesNotMatch(body, /src=["']https?:/i, file + ': hotlinked asset');
        for (const [, href] of body.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
          assert.doesNotMatch(href, /^http:\/\//i, file + ': upgrade-insecure-requests breaks ' + href);
        }
        // Headings carry ids because the TOC and permalinks are built from them.
        for (const [, tag, attrs] of body.matchAll(/<(h[23])\b([^>]*)>/gi)) {
          assert.match(attrs, /\bid="/, `${file}: <${tag}> without an id`);
        }
      }
    }
  }
});

/* Two menus, one section, and one loader shared with Case Studies. */
test('Other Knowledge is wired into the panel and reuses the shared collection', async () => {
  const [app, view, loader, caseLoader] = await Promise.all([
    readFile(path.join(publicRoot, 'app.js'), 'utf8'),
    readFile(path.join(publicRoot, 'views/knowledge.js'), 'utf8'),
    readFile(path.join(publicRoot, 'lib/knowledge.js'), 'utf8'),
    readFile(path.join(publicRoot, 'lib/case-studies.js'), 'utf8')
  ]);

  assert.match(app, /\{ key: 'knowledge', label: 'Experience' \}/);
  assert.match(app, /id: 'photography', sec: 'knowledge'/);
  assert.match(app, /id: 'homelab', sec: 'knowledge'/);
  assert.match(app, /id: 'project', sec: 'knowledge'/);
  // The libraries moved into Technical and are grouped behind a rule.
  assert.match(app, /id: 'system-design', sec: 'technical', divider: true/);
  assert.match(app, /v\.divider \? '<hr class="nv-div">' : ''/);

  // Search and the changelog are controls in the panel header, still routable.
  assert.match(app, /id: 'search', sec: 'technical', head: true/);
  assert.match(app, /id: 'release-notes', sec: 'technical', head: true/);
  assert.match(app, /shown\.filter\(v => v\.head\)/);
  assert.match(app, /v\.sec === sec\.key && !v\.head/);
  // Tools opens on purpose, so the section defaults to collapsed.
  assert.match(app, /\{ key: 'tool', label: 'Tools', collapsible: true \}/);
  assert.match(app, /getItem\(NAV_SECTION_KEY \+ key\) !== '0'/);
  // Guide is gone, and its markdown left with it.
  assert.doesNotMatch(app, /GUIDE_MD/);
  assert.doesNotMatch(app, /id: 'guide'/);

  // One loader, two directories: a second copy would drift out of step.
  assert.match(caseLoader, /createCollection\('data\/case-studies\/'\)/);
  assert.match(loader, /createCollection\('data\/photography\/'\)/);
  assert.match(loader, /createCollection\('data\/homelab\/'\)/);

  // Same for the article chrome the two readers share.
  for (const helper of ['buildToc', 'wireLightbox', 'wireTocToggle']) {
    assert.match(view, new RegExp(helper), 'knowledge view must use the shared ' + helper);
  }
  const shared = await readFile(path.join(publicRoot, 'lib/article-reader.js'), 'utf8');
  for (const helper of ['buildToc', 'wireTocToggle', 'wireLightbox']) {
    assert.match(shared, new RegExp('export function ' + helper), 'article-reader must own ' + helper);
  }
});

/* The search index is built from the models, so a new surface is invisible to
   it until it is fed in — and an empty collection makes that failure silent. */
test('knowledge articles reach the search index', async () => {
  const { buildEntries, searchEntries, SURFACES } = await import('../public/lib/search.js');
  assert.ok(SURFACES.some(row => row.id === 'knowledge'), 'knowledge must be a search surface');

  const manifest = await read('photography/manifest.json');
  const meta = await read('photography/meta.json');
  const row = manifest.articles[0];
  const article = {
    ...row,
    ...meta.articles[String(row.n)].en,
    category_label: 'Fundamentals',
    guide: { title: 'Guide title', summary: 'aperture and diffraction', points: ['stop is the shared unit'] }
  };

  const entries = buildEntries({
    content: { topics: [] },
    systemDesign: { designs: [], cases: [], caseOverviews: new Map() },
    caseStudies: { articles: [] },
    knowledge: { photography: { library: { title: 'Photography' }, articles: [article] } }
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].surface, 'knowledge');
  assert.match(entries[0].href, /#\/photography\/exposure-three-controls/);

  const found = searchEntries(entries, 'diffraction');
  assert.equal(found.results.length, 1, 'guide text must be searchable');
  assert.equal(found.counts.knowledge, 1);
});
