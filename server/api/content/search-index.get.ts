import { readFile } from 'node:fs/promises';
import path from 'node:path';

const json = async (file: string) => JSON.parse(await readFile(path.join(process.cwd(), 'public', file), 'utf8'));

export default defineEventHandler(async () => {
  const [index, meta, systemDesign, caseManifest, caseMeta, photoManifest, photoMeta, homeManifest, homeMeta] = await Promise.all([
    json('data/content-index.json'), json('data/meta.json'), json('data/system-design/catalog.json'),
    json('data/case-studies/manifest.json'), json('data/case-studies/meta.json'),
    json('data/photography/manifest.json'), json('data/photography/meta.json'),
    json('data/homelab/manifest.json'), json('data/homelab/meta.json')
  ]);

  const topicByKey = new Map(Object.values(meta.topics).map((row: any) => [row.key, row]));
  const entries = Object.entries(index.items).map(([id, text]: [string, any]) => {
    const topicKey = id.split('.')[0];
    const topic: any = topicByKey.get(topicKey);
    return {
      id, surface: 'track', en: text.en, vi: text.vi || text.en,
      contextEn: topic?.en?.title || '', contextVi: topic?.vi?.title || topic?.en?.title || '',
      href: `/topics/${topicKey}#question-${encodeURIComponent(id)}`
    };
  });
  for (const design of systemDesign.designs) entries.push({
    id: `system-design:${design.slug}`, surface: 'system-design',
    en: design.en.title, vi: design.vi?.title || design.en.title,
    contextEn: design.en.excerpt, contextVi: design.vi?.excerpt || design.en.excerpt,
    href: `/system-design/${design.slug}`
  });

  const addCollection = (surface: string, manifest: any, metadata: any) => {
    for (const article of manifest.articles) {
      const copy = metadata.articles[String(article.n)];
      entries.push({
        id: `${surface}:${article.slug}`, surface,
        en: copy.en.title, vi: copy.vi?.title || copy.en.title,
        contextEn: copy.en.excerpt, contextVi: copy.vi?.excerpt || copy.en.excerpt,
        href: `/${surface}/${article.slug}`
      });
    }
  };
  addCollection('case-studies', caseManifest, caseMeta);
  addCollection('photography', photoManifest, photoMeta);
  addCollection('homelab', homeManifest, homeMeta);
  return entries;
});
