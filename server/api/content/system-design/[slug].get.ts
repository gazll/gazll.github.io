import { readFile } from 'node:fs/promises';
import path from 'node:path';

const json = async (file: string) => JSON.parse(await readFile(path.join(process.cwd(), 'public', file), 'utf8'));

export default defineEventHandler(async event => {
  const slug = getRouterParam(event, 'slug') || 'index';
  const catalog = await json('data/system-design/catalog.json');
  if (slug === 'index') {
    const [manifest, metadata] = await Promise.all([
      json('data/case-studies/manifest.json'),
      json('data/case-studies/meta.json')
    ]);
    const cases = (manifest.articles || []).filter((row: { slug: string }) => catalog.case_overviews?.[row.slug]).map((row: { n: number; slug: string }) => ({
      ...row,
      metadata: metadata.articles[String(row.n)],
      overview: catalog.case_overviews[row.slug]
    }));
    return { ...catalog, cases };
  }
  const design = catalog.designs.find((row: { slug: string }) => row.slug === slug);
  if (!design) throw createError({ statusCode: 404, statusMessage: 'System design not found' });
  return { library: catalog.library, categories: catalog.categories, design };
});
