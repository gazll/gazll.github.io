import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { plainText } from '~~/public/lib/search-text.js';

const json = async (file: string) => JSON.parse(await readFile(path.join(process.cwd(), 'public', file), 'utf8'));

export default defineEventHandler(async (event: any) => {
  const lang = getRouterParam(event, 'lang') === 'vi' ? 'vi' : 'en';
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
  /* A topic row of its own, weighted above the questions inside it: the first
     thing a one-word query wants answered is which topic to open, and without
     these rows "Java Core" returns a dozen questions and never the topic. */
  for (const [n, topic] of Object.entries<any>(meta.topics)) {
    const onTrack = entries.some(entry => entry.id.startsWith(`${topic.key}.`));
    if (!onTrack) continue;
    entries.push({
      id: `topic:${topic.key}`, surface: 'track', weight: 40,
      en: topic.en.title, vi: topic.vi?.title || topic.en.title,
      bodyEn: [topic.en.intro, (topic.en.tags || []).join(' ')].filter(Boolean).join(' '),
      bodyVi: [topic.vi?.intro, (topic.vi?.tags || []).join(' ')].filter(Boolean).join(' '),
      contextEn: `Topic ${n} · ${topic.en.label}`, contextVi: `Chủ đề ${n} · ${topic.vi?.label || topic.en.label}`,
      href: `/topics/${topic.key}`
    });
  }

  /* A blueprint's substance is its decision rows, not its title: a reader looks
     for "token bucket" or "301 versus 302", and until this carried a body the
     largest prose corpus on the site was searchable by title and excerpt alone.
     Raw `code` is deliberately excluded — it is the one field where a term match
     is usually noise — while each sample's title and note are prose and stay. */
  const DESIGN_PROSE = ['scope', 'functional', 'quality', 'capacity', 'data_model', 'stack', 'tradeoffs'];
  const designBody = (copy: any) => {
    if (!copy) return '';
    const parts = DESIGN_PROSE.map(field => {
      const value = copy[field];
      return Array.isArray(value) ? value.join(' ') : String(value || '');
    });
    parts.push((copy.tags || []).join(' '));
    parts.push((copy.failure_review || []).map((row: any) => `${row.question} ${row.answer}`).join(' '));
    parts.push((copy.code_samples || []).map((row: any) => `${row.title || ''} ${row.note || ''}`).join(' '));
    return plainText(parts.filter(Boolean).join(' '));
  };
  for (const design of systemDesign.designs) {
    const bodyEn = designBody(design.en);
    entries.push({
      id: `system-design:${design.slug}`, surface: 'system-design',
      en: design.en.title, vi: design.vi?.title || design.en.title,
      bodyEn, bodyVi: designBody(design.vi) || bodyEn,
      contextEn: design.en.excerpt, contextVi: design.vi?.excerpt || design.en.excerpt,
      href: `/system-design/${design.slug}`
    });
  }

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

  /* One language per file. Rows are built bilingual because that is how the
     sources read, then projected down to the one this route serves: a reader
     folds one language and the other half was 425KB of gzip they never touched.
     lib/search.js needs no change — `finalize` already reads `vi || en`, so the
     absent half simply never resolves. The corollary is that a view must fetch
     the file matching the language it renders with, never the other one. */
  const vi = lang === 'vi';
  return entries.map((entry: any) => ({
    id: entry.id,
    surface: entry.surface,
    ...(entry.weight ? { weight: entry.weight } : {}),
    ...(vi
      ? {
        vi: entry.vi || entry.en,
        bodyVi: entry.bodyVi || entry.bodyEn,
        contextVi: entry.contextVi || entry.contextEn
      }
      : { en: entry.en, bodyEn: entry.bodyEn, contextEn: entry.contextEn }),
    href: entry.href
  }));
});
