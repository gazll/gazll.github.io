import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dataRoot = path.join(root, 'public/data');
const target = path.join(dataRoot, 'content-index.json');
const checkOnly = process.argv.includes('--check');
const manifest = JSON.parse(readFileSync(path.join(dataRoot, 'manifest.json'), 'utf8'));
const index = { version: 1, topics: [], items: {} };

for (const row of manifest.topics || []) {
  const en = JSON.parse(readFileSync(path.join(dataRoot, row.file), 'utf8'));
  const viPath = path.join(dataRoot, row.file.replace(/\.json$/, '.vi.json'));
  const vi = JSON.parse(readFileSync(viPath, 'utf8'));
  const enItems = (en.sections || []).flatMap(section => section.items || []);
  const viItems = (vi.sections || []).flatMap(section => section.items || []);
  const viById = new Map(viItems.map(item => [item.id, item]));
  const moved = new Set(row.system_design_items || []);
  const itemIds = enItems.map(item => item.id);
  index.topics.push({
    n: row.n,
    item_ids: itemIds,
    track_item_ids: row.surface && row.surface !== 'track' ? [] : itemIds.filter(id => !moved.has(id))
  });
  for (const item of enItems) {
    index.items[item.id] = { en: item.q, vi: viById.get(item.id)?.q || '' };
  }
}

const expected = JSON.stringify(index, null, 2) + '\n';
if (checkOnly) {
  if (readFileSync(target, 'utf8') !== expected) {
    throw new Error('content-index.json is stale. Run node tools/build-content-index.mjs');
  }
  process.stdout.write('Verified lightweight index for ' + Object.keys(index.items).length + ' items.\n');
} else {
  writeFileSync(target, expected);
  process.stdout.write('Built lightweight index for ' + Object.keys(index.items).length + ' items.\n');
}
