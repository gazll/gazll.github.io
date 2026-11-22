import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { talkSections } from '~~/public/lib/talk.js';

const ROOT = path.join(process.cwd(), 'public/data/presentations');

export default defineEventHandler(async event => {
  const slug = getRouterParam(event, 'slug');
  const board = JSON.parse(await readFile(path.join(ROOT, 'board.json'), 'utf8'));
  const topic = board.topics.find((row: any) => row.slug === slug);
  if (!topic) throw createError({ statusCode: 404, statusMessage: 'Unknown presentation' });
  // A claimed topic without its file yet still has a page: the agenda is the outline.
  const markdown = await readFile(path.join(ROOT, 'talks', `${slug}.md`), 'utf8').catch(() => '');
  return { topic, written: !!markdown, sections: talkSections(markdown) };
});
