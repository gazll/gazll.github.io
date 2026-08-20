import { readFile } from 'node:fs/promises';
import path from 'node:path';

const COLLECTIONS: Record<string, string> = {
  'case-studies': 'case-studies',
  photography: 'photography',
  homelab: 'homelab'
};
const read = (file: string) => readFile(path.join(process.cwd(), 'public', file), 'utf8');
const json = async (file: string) => JSON.parse(await read(file));

export default defineEventHandler(async event => {
  const collection = getRouterParam(event, 'collection') || '';
  const slug = getRouterParam(event, 'slug') || 'index';
  const base = COLLECTIONS[collection];
  if (!base) throw createError({ statusCode: 404, statusMessage: 'Collection not found' });

  const [manifest, meta] = await Promise.all([
    json(`data/${base}/manifest.json`),
    json(`data/${base}/meta.json`)
  ]);
  const rows = manifest.articles || [];
  const articles = rows.map((row: { n: number }) => ({ ...row, metadata: meta.articles[String(row.n)] }));
  if (slug === 'index') return { collection, library: meta.library, categories: meta.categories, articles };

  const row = articles.find((candidate: { slug: string }) => candidate.slug === slug);
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Article not found' });
  const sourcePath = `data/${row.file}`;
  const viPath = sourcePath.replace(/\.json$/, '.vi.json');
  const en = await json(sourcePath);
  let vi = null;
  try { vi = await json(viPath); } catch (error) {}
  const enBody = await read(en.body_file);
  let viBody = enBody;
  if (vi?.body_file) {
    try { viBody = await read(vi.body_file); } catch (error) {}
  }
  return { collection, library: meta.library, categories: meta.categories, row, en, vi, enBody, viBody };
});
