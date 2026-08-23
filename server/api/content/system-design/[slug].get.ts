import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { referencedIds, slimQuestions } from '../../../utils/content-index.js';

const json = async (file: string) => JSON.parse(await readFile(path.join(process.cwd(), 'public', file), 'utf8'));

export default defineEventHandler(async event => {
  const slug = getRouterParam(event, 'slug') || 'index';
  const [catalog, contentIndex] = await Promise.all([
    json('data/system-design/catalog.json'),
    json('data/content-index.json')
  ]);
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
    /* The catalog's 20 full blueprints include diagrams, code and research
       notes that the library cards never render. Project card fields here so
       the library route does not ship half a megabyte before its first click. */
    const designs = (catalog.designs || []).map((design: any) => ({
      n: design.n,
      slug: design.slug,
      category: design.category,
      effort: design.effort,
      level: design.level,
      featured: Boolean(design.featured),
      created_at: design.created_at,
      updated_at: design.updated_at,
      en: { title: design.en?.title, excerpt: design.en?.excerpt, tags: design.en?.tags || [] },
      vi: { title: design.vi?.title, excerpt: design.vi?.excerpt, tags: design.vi?.tags || [] }
    }));
    return { library: catalog.library, production: catalog.production, categories: catalog.categories, designs, cases };
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

  const crossRefs = slimQuestions(contentIndex, referencedIds(sourceNotes));
  return { library: catalog.library, categories: catalog.categories, design, sourceNotes, research, sourceOwners, crossRefs };
});
