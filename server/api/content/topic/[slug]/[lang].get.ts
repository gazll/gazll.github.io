import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { progressIndex, referencedIds, slimQuestions } from '../../../../utils/content-index.js';

const publicFile = (file: string) => path.join(process.cwd(), 'public', file);
const json = async (file: string) => JSON.parse(await readFile(publicFile(file), 'utf8'));

/* One language per response. Both used to ride in every page payload, so an
   English reader downloaded the whole Vietnamese topic too (~36KB gzipped);
   the page now fetches the other one only when a switch asks for it. */
export default defineEventHandler(async event => {
  const requested = getRouterParam(event, 'slug') || 'first';
  const lang = getRouterParam(event, 'lang');
  if (lang !== 'en' && lang !== 'vi') throw createError({ statusCode: 404, statusMessage: 'Unknown language' });
  const [manifest, meta, reviews, systemDesign, contentIndex] = await Promise.all([
    json('data/manifest.json'),
    json('data/meta.json'),
    json('data/content-reviews.json'),
    json('data/system-design/catalog.json'),
    json('data/content-index.json')
  ]);
  const rows = manifest.topics.filter((row: { surface?: string }) => !row.surface || row.surface === 'track');
  const row = requested === 'first'
    ? rows[0]
    : rows.find((candidate: { file: string }) => candidate.file.endsWith(`/${requested}.json`));
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Topic not found' });

  const stem = row.file.replace(/^topics\//, '').replace(/\.json$/, '');
  let vi = null;
  try { vi = await json(`data/topics/${stem}.vi.json`); } catch (error) {}
  // A missing companion shows the English base in VI mode rather than failing.
  const body = lang === 'vi' && vi ? vi : await json(`data/topics/${stem}.json`);

  const sourceOwners = Object.fromEntries(systemDesign.designs.flatMap((design: any) =>
    (design.source_items || []).map((id: string) => [id, design.slug])));
  // The picker needs every topic's label, not its intro and tags.
  const topicMeta = Object.fromEntries(Object.entries(meta.topics).map(([n, entry]: [string, any]) =>
    [n, { en: { label: entry.en?.label }, vi: { label: entry.vi?.label } }]));
  // Only this topic's review dates, not the whole provenance file.
  const reviewedAt = Object.fromEntries(Object.entries(reviews)
    .filter(([id]) => id.startsWith(`${stem}.`))
    .map(([id, review]: [string, any]) => [id, review.reviewed_at || '']));
  return {
    rows, row, meta: meta.topics[String(row.n)], topicMeta, reviewedAt, lang, body, hasVi: Boolean(vi), stem,
    sourceOwners, crossRefs: slimQuestions(contentIndex, referencedIds(body)), progressIndex: progressIndex(contentIndex)
  };
});
