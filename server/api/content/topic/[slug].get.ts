import { readFile } from 'node:fs/promises';
import path from 'node:path';

const publicFile = (file: string) => path.join(process.cwd(), 'public', file);
const json = async (file: string) => JSON.parse(await readFile(publicFile(file), 'utf8'));

export default defineEventHandler(async event => {
  const requested = getRouterParam(event, 'slug') || 'first';
  const [manifest, meta, reviews, systemDesign] = await Promise.all([
    json('data/manifest.json'),
    json('data/meta.json'),
    json('data/content-reviews.json'),
    json('data/system-design/catalog.json')
  ]);
  const rows = manifest.topics.filter((row: { surface?: string }) => !row.surface || row.surface === 'track');
  const row = requested === 'first'
    ? rows[0]
    : rows.find((candidate: { file: string }) => candidate.file.endsWith(`/${requested}.json`));
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Topic not found' });

  const stem = row.file.replace(/^topics\//, '').replace(/\.json$/, '');
  const en = await json(`data/topics/${stem}.json`);
  let vi = null;
  try { vi = await json(`data/topics/${stem}.vi.json`); } catch (error) {}

  const sourceOwners = Object.fromEntries(systemDesign.designs.flatMap((design: any) =>
    (design.source_items || []).map((id: string) => [id, design.slug])));
  return { rows, row, meta: meta.topics[String(row.n)], topicMeta: meta.topics, reviews, en, vi, stem, sourceOwners };
});
