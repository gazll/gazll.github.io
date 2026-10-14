import { readFile } from 'node:fs/promises';
import path from 'node:path';

const readJson = async (file: string) => JSON.parse(await readFile(path.join(process.cwd(), 'public/data', file), 'utf8'));

// A change's `target` is a topic's filename stem. The page needs its label and
// type to name and colour the link, and meta.json is the one place both live.
export default defineEventHandler(async () => {
  const [notes, meta] = await Promise.all([readJson('release-notes.json'), readJson('meta.json')]);
  const topics: Record<string, { n: number; topic_type: string; en: string; vi: string }> = {};
  for (const [n, topic] of Object.entries<any>(meta.topics || {})) {
    topics[topic.key] = { n: Number(n), topic_type: topic.topic_type, en: topic.en?.label || topic.key, vi: topic.vi?.label || topic.en?.label || topic.key };
  }
  return { ...notes, topics };
});
