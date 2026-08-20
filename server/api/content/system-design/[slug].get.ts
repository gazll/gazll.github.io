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

  const topicKeys = [...new Set((design.source_items || []).map((id: string) => id.split('.')[0]))];
  const topicPairs = await Promise.all(topicKeys.map(async (topicKey: string) => {
    const en = await json(`data/topics/${topicKey}.json`);
    let vi = null;
    try { vi = await json(`data/topics/${topicKey}.vi.json`); } catch {}
    return [topicKey, { en, vi }] as const;
  }));
  const topics = new Map(topicPairs);
  const findItem = (source: any, id: string) => source?.sections
    ?.flatMap((section: any) => section.items || [])
    .find((item: any) => item.id === id) || null;
  const sourceNotes = (design.source_items || []).map((id: string) => {
    const pair = topics.get(id.split('.')[0]);
    return { id, en: findItem(pair?.en, id), vi: findItem(pair?.vi, id) };
  }).filter((row: any) => row.en || row.vi);
  const researchSource = await readFile(path.join(process.cwd(), 'public/data/system-design/research.js'), 'utf8');
  const researchModule = await import(`data:text/javascript;base64,${Buffer.from(researchSource).toString('base64')}`);
  const researchCatalog = researchModule.SYSTEM_DESIGN_RESEARCH;
  const researchIds = researchCatalog.assignments[slug] || [];
  const research = researchIds.map((id: string) => ({ id, ...researchCatalog.packs[id] })).filter(Boolean);
  const sourceOwners = Object.fromEntries(catalog.designs.flatMap((row: any) =>
    (row.source_items || []).map((id: string) => [id, row.slug])));

  return { library: catalog.library, categories: catalog.categories, design, sourceNotes, research, sourceOwners };
});
