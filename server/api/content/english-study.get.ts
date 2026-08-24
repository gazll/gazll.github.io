import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PLAN_FILE = path.join(process.cwd(), 'docs', 'english-speaking-os-complete-2026.md');

export default defineEventHandler(async () => ({
  markdown: await readFile(PLAN_FILE, 'utf8'),
  source: 'english-speaking-os-complete-2026.md'
}));
