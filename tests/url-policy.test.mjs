import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const roots = ['app', 'docs', 'public/data', 'public/lib', 'server', 'tools', 'tests'];
const textExtensions = new Set(['.html', '.js', '.json', '.md', '.mjs', '.ts', '.vue']);
const vietnamese = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/iu;
const patterns = [
  /https?:\/\/[^\s"'<>]+/gu,
  /(?:href|src)\s*=\s*["']([^"']+)["']/giu,
  /\[[^\]]+\]\((https?:\/\/[^)\s]+|\/[^)\s]+|#[^)\s]+)\)/gu,
  /\bid\s*=\s*["']([^"']+)["']/giu
];

async function filesBelow(relativePath) {
  const directory = path.join(root, relativePath);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(child));
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(child);
  }
  return files;
}

test('authored URLs and fragments stay free of Vietnamese characters', async () => {
  const files = (await Promise.all(roots.map(filesBelow))).flat();
  const offenders = [];
  for (const file of files) {
    const source = await readFile(path.join(root, file), 'utf8');
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source))) {
        const value = match[1] || match[0];
        let decoded = value;
        try { decoded = decodeURIComponent(value); } catch { /* keep the raw URL */ }
        if (vietnamese.test(decoded)) {
          const line = source.slice(0, match.index).split('\n').length;
          offenders.push(`${file}:${line}: ${value}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], `Vietnamese characters found in URLs or fragments:\n${offenders.join('\n')}`);
});
