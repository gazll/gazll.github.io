import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { plainText } from '~~/public/lib/search-text.js';

const json = async (file: string) => JSON.parse(await readFile(path.join(process.cwd(), 'public', file), 'utf8'));

export default defineEventHandler(async () => {
  const [index, meta, systemDesign, caseManifest, caseMeta, photoManifest, photoMeta, homeManifest, homeMeta] = await Promise.all([
    json('data/content-index.json'), json('data/meta.json'), json('data/system-design/catalog.json'),
    json('data/case-studies/manifest.json'), json('data/case-studies/meta.json'),
    json('data/photography/manifest.json'), json('data/photography/meta.json'),
    json('data/homelab/manifest.json'), json('data/homelab/meta.json')
  ]);

  const topicByKey = new Map(Object.values(meta.topics).map((row: any) => [row.key, row]));

  /* Answers are the reason search is worth using: a reader looks for the term
     they remember from a card body, not for the wording of its question. The
     topic files are read once here so the shipped index carries that text. */
  const topicFiles = await Promise.all([...topicByKey.keys()].map(async (key: any) => {
    const read = async (file: string) => {
      try { return await json(file); } catch { return null; }
    };
    const [en, vi] = await Promise.all([read(`data/topics/${key}.json`), read(`data/topics/${key}.vi.json`)]);
    return [key, { en, vi }] as const;
  }));
  const answersFor = (source: any) => new Map((source?.sections || [])
    .flatMap((section: any) => (section.items || []).map((item: any) => [item.id, plainText(item.a || '')])));
  const bodies = new Map(topicFiles.map(([key, pair]) => [key, {
    en: answersFor(pair.en), vi: answersFor(pair.vi)
  }]));
  const sourceOwners = new Map(systemDesign.designs.flatMap((design: any) =>
    (design.source_items || []).map((id: string) => [id, design.slug])));
  const entries = Object.entries(index.items).map(([id, text]: [string, any]) => {
    const topicKey = id.split('.')[0];
    const topic: any = topicByKey.get(topicKey);
    const body = bodies.get(topicKey);
    const bodyEn = body?.en.get(id) || '';
    return {
      id, surface: 'track', en: text.en, vi: text.vi || text.en,
      bodyEn, bodyVi: body?.vi.get(id) || bodyEn,
      contextEn: topic?.en?.title || '', contextVi: topic?.vi?.title || topic?.en?.title || '',
      href: sourceOwners.has(id)
        ? `/system-design/${sourceOwners.get(id)}#question-${encodeURIComponent(id)}`
        : `/topics/${topicKey}#question-${encodeURIComponent(id)}`
    };
  });
  for (const design of systemDesign.designs) entries.push({
    id: `system-design:${design.slug}`, surface: 'system-design',
    en: design.en.title, vi: design.vi?.title || design.en.title,
    contextEn: design.en.excerpt, contextVi: design.vi?.excerpt || design.en.excerpt,
    href: `/system-design/${design.slug}`
  });

  /* The article bodies are the searchable substance of a library row; the old
     client index folded them in through a second `enrich()` pass. Prerendering
     happens once, so they are read straight into the shipped index instead. */
  const articleBody = async (surface: string, file: string) => {
    try { return plainText(await readFile(path.join(process.cwd(), 'public/data', surface, 'articles', file), 'utf8')); }
    catch { return ''; }
  };
  const addCollection = async (surface: string, manifest: any, metadata: any, dir = surface) => {
    for (const article of manifest.articles) {
      const copy = metadata.articles[String(article.n)];
      const stem = article.file
        ? String(article.file).split('/').pop()!.replace(/\.json$/, '')
        : `${String(article.n).padStart(2, '0')}-${article.slug}`;
      const [bodyEn, bodyVi] = await Promise.all([
        articleBody(dir, `${stem}.html`), articleBody(dir, `${stem}.vi.html`)
      ]);
      entries.push({
        id: `${surface}:${article.slug}`, surface,
        en: copy.en.title, vi: copy.vi?.title || copy.en.title,
        bodyEn, bodyVi: bodyVi || bodyEn,
        contextEn: copy.en.excerpt, contextVi: copy.vi?.excerpt || copy.en.excerpt,
        href: `/${surface}/${article.slug}`
      });
    }
  };
  await addCollection('case-studies', caseManifest, caseMeta);
  await addCollection('photography', photoManifest, photoMeta);
  await addCollection('homelab', homeManifest, homeMeta);
  return entries;
});
