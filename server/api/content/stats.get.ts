import { readFile } from 'node:fs/promises';
import path from 'node:path';
const json = async (file: string) => JSON.parse(await readFile(path.join(process.cwd(), 'public', file), 'utf8'));
export default defineEventHandler(async () => {
  const [index, meta] = await Promise.all([json('data/content-index.json'), json('data/meta.json')]);
  const topics = index.topics
    .filter((topic: any) => topic.track_item_ids?.length)
    .map((topic: any) => ({
      n: topic.n,
      ids: topic.track_item_ids,
      en: meta.topics[String(topic.n)]?.en?.label || '',
      vi: meta.topics[String(topic.n)]?.vi?.label || meta.topics[String(topic.n)]?.en?.label || ''
    }));
  return { topics, total: new Set(topics.flatMap((topic: any) => topic.ids)).size };
});
