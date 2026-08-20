import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (file: string) => readFile(path.join(process.cwd(), 'public/data', file), 'utf8');
export default defineEventHandler(async () => {
  const manifest = JSON.parse(await read('projects/calebzone/manifest.json'));
  const documents = await Promise.all(manifest.documents.map(async (row: any) => ({ ...row, body: await read(row.file) })));
  const samples = await Promise.all(manifest.samples.map(async (row: any) => ({ ...row, body: await read(row.file) })));
  return { ...manifest, documents, samples };
});
