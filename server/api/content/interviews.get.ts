import { readFile } from 'node:fs/promises';
import path from 'node:path';
export default defineEventHandler(async () => JSON.parse(await readFile(path.join(process.cwd(), 'public/data/interviews.json'), 'utf8')));
