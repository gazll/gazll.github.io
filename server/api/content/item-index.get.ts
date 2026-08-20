import { readFile } from 'node:fs/promises';
import path from 'node:path';

/* data/content-index.json, served as a route rather than read as a static file.

   Everything that needs it needs it during SSR — the progress ring's
   denominator, the per-topic progress in the picker, and the cross-reference
   resolver that turns a written (item-id) into a link. `$fetch` of a raw file
   under public/ does not resolve on the server, so those three all silently
   received null and rendered nothing at all. Going through /api/content/ is how
   every other data read here already works, and it prerenders to a static file
   like the rest.

   It carries every item id, both languages of each question, and each topic's
   item ids — see CLAUDE.md on why the ring counts this and never Content. */
export default defineEventHandler(async () =>
  JSON.parse(await readFile(path.join(process.cwd(), 'public/data/content-index.json'), 'utf8')));
