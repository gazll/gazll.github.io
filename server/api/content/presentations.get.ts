import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'public/data/presentations');

// The board says which topics exist; a talk file existing is what makes one readable.
export default defineEventHandler(async () => {
  const board = JSON.parse(await readFile(path.join(ROOT, 'board.json'), 'utf8'));
  const written = new Set((await readdir(path.join(ROOT, 'talks'))).filter(file => file.endsWith('.md')).map(file => file.slice(0, -3)));
  return { topics: board.topics.map((topic: any) => ({ ...topic, written: written.has(topic.slug) })) };
});
