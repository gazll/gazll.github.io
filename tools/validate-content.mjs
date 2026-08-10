#!/usr/bin/env node
/* Structural checks for public/data/*.

   The renderer in lib/markdown.js never escapes and never validates, so a
   malformed item does not throw — it renders as broken markup that only shows
   up by eye. These are the rules that have actually bitten, each one a bug
   that reached the page at least once:

     node tools/validate-content.mjs            # check
     node tools/validate-content.mjs --stats    # check + content report

   It also covers data/system-design/catalog.json, because that file names
   Study Track items by id: a typo there renders zero migrated notes silently
   rather than throwing.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOPIC_TYPES, DIFFICULTIES } from '../public/lib/constants.js';

// fileURLToPath, not .pathname — on Windows the latter yields "/D:/…", which
// node then resolves against the current drive as "D:\D:\…".
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = ROOT + 'public/data/';
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readOptionalJson = (p) => { try { return readJson(p); } catch (e) { if (e.code !== 'ENOENT') throw e; return null; } };

const manifest = readJson(DATA + 'manifest.json');
const meta = readJson(DATA + 'meta.json');
const TOPIC_TYPE_KEYS = new Set(TOPIC_TYPES.map(t => t.key));
const DIFFICULTY_KEYS = new Set(DIFFICULTIES.map(d => d.key));
const RAW = 'pre|table|figure';
// Tags the renderer is expected to emit; anything else means a stray '<'.
const KNOWN = 'pre|table|figure|code|span|thead|tbody|tr|th|td|a|b|br|svg|defs|marker|path|rect|text|line|polygon|polyline|circle|g|small|em|i';
// item id: {topic-key}.{section-slug}.q{n} — topic-key/section-slug are
// slugs (lowercase, hyphenated), the item index is always numeric.
const ID_RE = /^([a-z0-9-]+)\.([a-z0-9-]+)\.q(\d+)$/;
// A manifest row is either browsed in the Study Track or presented on a
// purpose-built Experience surface. Either way its items keep their ids,
// because those ids are stored Sheet keys.
const SURFACES = new Set(['track', 'system-design']);

const errs = [];
const items = [];
const markers = new Map();
const err = (id, msg) => errs.push(`${id}: ${msg}`);

// Load every topic's content file + its meta entry, keeping the manifest's
// declared order (that order is the browse order the track view walks).
const topics = manifest.topics.map(row => ({
  row,
  content: readJson(DATA + row.file),
  meta: meta.topics[String(row.n)]
}));

for (const { row, content, meta: m } of topics) {
  const t = `topic ${row.n}`;
  if (!TOPIC_TYPE_KEYS.has(row.topic_type)) err(t, `unknown topic_type "${row.topic_type}"`);
  if (row.surface !== undefined && !SURFACES.has(row.surface)) {
    err(t, `unknown surface "${row.surface}" — expected one of ${[...SURFACES].join(', ')}`);
  }
  if (row.system_design_items !== undefined && !Array.isArray(row.system_design_items)) {
    err(t, 'system_design_items must be an array of item ids');
  }
  // Moving a whole topic off the track and also listing individual items from
  // it is contradictory: the per-item filter would never run.
  if (row.surface === 'system-design' && row.system_design_items?.length) {
    err(t, 'a system-design surface topic cannot also list system_design_items');
  }
  if (!m) { err(t, 'missing meta.json entry'); continue; }
  for (const k of ['label', 'title', 'intro', 'tags']) {
    if (m.vi?.[k] === undefined) err(t, `meta.json missing vi.${k}`);
  }
  if (!Array.isArray(m.vi?.tags) || !m.vi.tags.length) err(t, 'vi.tags must be a non-empty array');
  const topicKey = row.file.replace(/^topics\//, '').replace(/\.json$/, '');

  for (const sec of content.sections || []) {
    if (!sec.title) err(t, 'a section has no title');
    for (const it of sec.items || []) {
      items.push({ ...it, n: row.n, topic_type: row.topic_type, label: m.vi?.label });
      const id = it.id;

      if (JSON.stringify(Object.keys(it).sort()) !== '["a","difficulty","id","q"]') {
        err(id, `unexpected keys ${Object.keys(it).sort().join(',')}`);
      }
      if (!DIFFICULTY_KEYS.has(it.difficulty)) err(id, `bad difficulty "${it.difficulty}"`);

      const match = String(id).match(ID_RE);
      if (!match) err(id, `id does not match {topic-key}.{section-slug}.q{n}`);
      else if (match[1] !== topicKey) err(id, `id's topic key "${match[1]}" does not match its file's key "${topicKey}"`);

      const a = String(it.a || '');

      // colour spans: [[r: [[g: [[o: [[b:
      for (const m2 of a.matchAll(/\[\[([a-z]+):/g)) {
        if (!'rgob'.includes(m2[1])) err(id, `bad colour span [[${m2[1]}:`);
      }
      if ((a.match(/\[\[/g) || []).length !== (a.match(/\]\]/g) || []).length) {
        err(id, 'unbalanced [[ ]]');
      }

      // ::: callouts
      const open = (a.match(/^:::(deep|tip|warn)/gm) || []).length;
      const close = (a.match(/^:::\s*$/gm) || []).length;
      if (open !== close) err(id, `${open} callout opens vs ${close} closes`);

      // A raw-HTML block ends at the first blank line, so a blank line inside
      // <pre>/<table>/<figure> truncates it and dumps the rest as text.
      for (const tag of RAW.split('|')) {
        const re = new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`, 'g');
        for (const blk of a.match(re) || []) {
          if (blk.includes('\n\n')) err(id, `blank line inside <${tag}> — truncates the block`);
        }
        const o = (a.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
        const c = (a.match(new RegExp(`</${tag}>`, 'g')) || []).length;
        if (o !== c) err(id, `unbalanced <${tag}> (${o} open, ${c} close)`);
      }

      // SVG marker ids share one DOM once several cards are open.
      for (const m2 of a.matchAll(/<marker id=['"]([^'"]+)['"]/g)) {
        if (!markers.has(m2[1])) markers.set(m2[1], []);
        markers.get(m2[1]).push(id);
      }

      // '<' only starts a tag when a letter or '/' follows; '< ' stays text.
      const outside = a.replace(new RegExp(`<(${RAW})[\\s\\S]*?</\\1>`, 'g'), '');
      for (const m2 of outside.matchAll(new RegExp(`<(?=[a-zA-Z/])(?!/?(?:${KNOWN})\\b)`, 'g'))) {
        err(id, `bare "<" at line ${outside.slice(0, m2.index).split('\n').length} — write &lt;`);
      }
    }
  }
}

const seen = new Map();
for (const it of items) {
  if (seen.has(it.id)) err(it.id, 'duplicate item id');
  seen.set(it.id, it);
}
for (const [mid, where] of markers) {
  if (where.length > 1) errs.push(`SVG marker id "${mid}" reused by ${where.join(', ')} — must be unique file-wide`);
}

// Cross-references written as "(topic-key.section-slug.qN)" must point at a real item.
const REF_RE = /\(([a-z0-9-]+\.[a-z0-9-]+\.q\d+)\)/g;
for (const it of items) {
  for (const m of String(it.a).matchAll(REF_RE)) {
    const target = m[1];
    if (!seen.has(target)) err(it.id, `cross-ref (${target}) points at no item`);
  }
}

/* ---------- data/meta.json + topics/NN-slug.vi.json ----------

   Each English base file has a complete Vietnamese companion. Both item
   sequences use the same four-key schema and IDs in the same order.
   meta.json's `en`/`vi` keys must actually hold the language they claim. */
for (const [n, m] of Object.entries(meta.topics)) {
  const row = manifest.topics.find(r => String(r.n) === n);
  if (!row) { errs.push(`meta.json: topic "${n}" does not exist in manifest`); continue; }
  if (!TOPIC_TYPE_KEYS.has(m.topic_type)) errs.push(`meta.json: topic ${n} has unknown topic_type "${m.topic_type}"`);
  if (m.topic_type !== row.topic_type) errs.push(`meta.json: topic ${n} topic_type does not match manifest`);
  for (const k of ['label', 'title', 'intro', 'tags']) {
    if (m.en?.[k] === undefined) errs.push(`meta.json: topic ${n} missing en.${k}`);
  }
  if (!m.key) errs.push(`meta.json: topic ${n} missing key`);
  else if (`topics/${m.key}.json` !== row.file) {
    errs.push(`meta.json: topic ${n} key "${m.key}" does not match manifest file "${row.file}"`);
  }
}

for (const { row, content } of topics) {
  const viFile = readOptionalJson(DATA + row.file.replace(/\.json$/, '.vi.json'));
  if (!viFile) { errs.push(`topic ${row.n}: missing ${row.file.replace(/\.json$/, '.vi.json')}`); continue; }
  if (!Array.isArray(viFile.sections) || viFile.sections.length !== content.sections.length) {
    errs.push(`topic ${row.n}.vi.json: ${(viFile.sections || []).length} sections for ${content.sections.length} in the base file`);
  }
  for (const [sectionIndex, sec] of (viFile.sections || []).entries()) {
    const baseItems = content.sections[sectionIndex]?.items || [];
    const viItems = sec.items || [];
    if (viItems.length !== baseItems.length) {
      errs.push(`topic ${row.n}.vi.json: section ${sectionIndex + 1} has ${viItems.length} items for ${baseItems.length} in the base file`);
    }
    for (const [itemIndex, it] of viItems.entries()) {
      if (JSON.stringify(Object.keys(it).sort()) !== '["a","difficulty","id","q"]') {
        errs.push(`topic ${row.n}.vi.json: item "${it.id}" unexpected keys ${Object.keys(it).sort().join(',')}`);
      }
      const baseItem = baseItems[itemIndex];
      if (baseItem && it.id !== baseItem.id) {
        errs.push(`topic ${row.n}.vi.json: section ${sectionIndex + 1} item ${itemIndex + 1} id "${it.id}" does not match base item "${baseItem.id}"`);
      }
    }
  }
}

/* ---------- data/system-design/catalog.json ----------

   The catalog is the only file that names Study Track items from outside the
   topics tree. A mistyped source_items id does not throw — the design article
   simply renders without that migrated note — so it is checked here, next to
   the ids it points at. Every design is fully bilingual for the same reason
   topics are: the header switch selects an already-loaded language. */
const catalog = readOptionalJson(DATA + 'system-design/catalog.json');
// Items no longer browsable in the Study Track — the progress ring's
// denominator is `items.length` minus this set, so it is reported below.
const offTrack = new Set();
// Must match PRODUCTION_CATEGORY in public/lib/system-design.js and
// MOVED_TO_SYSTEM_DESIGN in public/views/case-studies.js.
const PRODUCTION_CATEGORY = 'systems-architecture';
const DESIGN_LANG_KEYS = ['title', 'excerpt', 'scope', 'diagram_title'];
const DESIGN_LANG_LISTS = ['functional', 'quality', 'capacity', 'data_model', 'stack', 'tradeoffs', 'tags'];

if (!catalog) {
  errs.push('system-design/catalog.json: missing');
} else {
  const sd = (id, msg) => errs.push(`system-design ${id}: ${msg}`);
  const bilingual = (id, node, keys, lists = []) => {
    for (const lang of ['en', 'vi']) {
      if (!node?.[lang]) { sd(id, `missing ${lang} block`); continue; }
      for (const k of keys) {
        if (!String(node[lang][k] ?? '').trim()) sd(id, `empty ${lang}.${k}`);
      }
      for (const k of lists) {
        const list = node[lang][k];
        if (!Array.isArray(list) || !list.length) { sd(id, `${lang}.${k} must be a non-empty array`); continue; }
        if (list.some(entry => !String(entry ?? '').trim())) sd(id, `${lang}.${k} has an empty entry`);
      }
    }
  };

  bilingual('library', catalog.library, ['eyebrow', 'title', 'intro']);
  bilingual('production', catalog.production, ['label', 'description']);

  const categoryIds = new Set();
  for (const category of catalog.categories || []) {
    if (!category.id) { sd('categories', 'a category has no id'); continue; }
    if (categoryIds.has(category.id)) sd(`category "${category.id}"`, 'duplicate id');
    categoryIds.add(category.id);
    bilingual(`category "${category.id}"`, category, ['label', 'description']);
  }

  // Every id the catalog claims to have migrated must exist, must be claimed
  // once, and must actually be hidden from the track — otherwise the reader
  // sees the same question in two places.
  const designSlugs = new Set();
  const designNumbers = new Set();
  const claimed = new Map();

  for (const design of catalog.designs || []) {
    const id = `design ${design.n} "${design.slug}"`;
    if (!design.slug) sd(`design ${design.n}`, 'missing slug');
    else if (designSlugs.has(design.slug)) sd(id, 'duplicate slug');
    designSlugs.add(design.slug);

    if (!Number.isInteger(design.n)) sd(id, 'n must be an integer');
    else if (designNumbers.has(design.n)) sd(id, 'duplicate n');
    designNumbers.add(design.n);

    if (!categoryIds.has(design.category)) sd(id, `unknown category "${design.category}"`);
    if (!String(design.diagram || '').trim()) sd(id, 'missing Mermaid diagram');
    bilingual(id, design, DESIGN_LANG_KEYS, DESIGN_LANG_LISTS);

    for (const itemId of design.source_items || []) {
      if (!seen.has(itemId)) { sd(id, `source_items "${itemId}" points at no item`); continue; }
      if (claimed.has(itemId)) sd(id, `source_items "${itemId}" is already claimed by ${claimed.get(itemId)}`);
      else claimed.set(itemId, design.slug);
    }
  }

  // The two ways an item leaves the track: its whole topic moved (surface), or
  // it was named individually (system_design_items).
  for (const { row, content } of topics) {
    const named = new Set(row.system_design_items || []);
    for (const sec of content.sections || []) {
      for (const it of sec.items || []) {
        if (row.surface === 'system-design' || named.has(it.id)) offTrack.add(it.id);
      }
    }
    for (const itemId of named) {
      if (!seen.has(itemId)) err(`topic ${row.n}`, `system_design_items "${itemId}" points at no item`);
    }
  }

  for (const [itemId, slug] of claimed) {
    if (!offTrack.has(itemId)) {
      sd(`design "${slug}"`, `source_items "${itemId}" is still browsable in the Study Track — it would appear twice`);
    }
  }

  // Production cases are the architecture rows the Case Studies library hands
  // over; each needs its own Mermaid lens, and none may be left behind.
  const caseManifest = readOptionalJson(DATA + 'case-studies/manifest.json');
  const architectureRows = (caseManifest?.articles || [])
    .filter(article => article.category === PRODUCTION_CATEGORY);
  const architectureCases = architectureRows.map(article => article.slug);

  // The reader's only attribution is the publication URL, and the view refuses
  // to render a link off that host — so a wrong one silently loses the credit.
  for (const article of architectureRows) {
    if (!/^https:\/\/engineering\.tiki\.vn\/.+/.test(article.source_url || '')) {
      sd(`case "${article.slug}"`, `source_url is not an engineering.tiki.vn article URL: "${article.source_url}"`);
    }
  }

  for (const overviewSlug of Object.keys(catalog.case_overviews || {})) {
    const overview = catalog.case_overviews[overviewSlug];
    bilingual(`case overview "${overviewSlug}"`, overview, ['title', 'lens']);
    if (!String(overview.diagram || '').trim()) {
      sd(`case overview "${overviewSlug}"`, 'missing Mermaid diagram');
    }
    if (caseManifest && !architectureCases.includes(overviewSlug)) {
      sd(`case overview "${overviewSlug}"`, `no "${PRODUCTION_CATEGORY}" case study has this slug`);
    }
  }
  for (const slug of architectureCases) {
    if (!catalog.case_overviews?.[slug]) {
      sd('case_overviews', `"${slug}" is presented here but has no architecture lens`);
    }
  }
}

if (errs.length) {
  console.error(`\ncontent FAILED — ${errs.length} problem(s):\n`);
  for (const e of errs) console.error('  - ' + e);
  process.exit(1);
}

// The track total is printed separately because it is the progress ring's
// denominator: moving items to another surface changes every reader's ring.
console.log(`content OK — ${topics.length} topics, ${items.length} items `
  + `(${items.length - offTrack.size} on the Study Track, ${offTrack.size} in System Design), `
  + `${(catalog?.designs || []).length} blueprints, ${markers.size} SVG markers`);

if (process.argv.includes('--stats')) {
  const by = (fn) => items.reduce((m, i) => (m[fn(i)] = (m[fn(i)] || 0) + 1, m), {});
  const refs = items.reduce((n, i) => n + [...String(i.a).matchAll(REF_RE)]
    .filter(m => seen.has(m[1])).length, 0);
  const thin = items.filter(i => i.a.length < 800);
  const lens = items.map(i => i.a.length).sort((x, y) => x - y);

  console.log('\ntopics per type  :', by(i => i.topic_type));
  console.log('items per diff.  :', by(i => i.difficulty));
  console.log('answer length    : median', lens[lens.length >> 1], '· min', lens[0], '· max', lens.at(-1));
  console.log('cross-references :', refs, `(${(refs / items.length).toFixed(2)} per item)`);
  console.log('thin items <800  :', thin.length, '→', thin.map(i => i.id).join(' '));
  console.log('items with code  :', items.filter(i => i.a.includes('<pre>')).length);
  console.log('items with table :', items.filter(i => i.a.includes('<table')).length);
  console.log('items with SVG   :', items.filter(i => i.a.includes('<svg')).length);
}
