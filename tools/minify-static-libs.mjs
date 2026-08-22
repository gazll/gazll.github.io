import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

const CODE_EXTENSIONS = new Set(['.js', '.mjs']);

async function findLibFiles(root) {
  const files = [];

  async function visit(directory, insideLib) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath, insideLib || entry.name === 'lib');
      } else if (insideLib && CODE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(entryPath);
      }
    }
  }

  await visit(root, false);
  return files.sort();
}

export async function minifyStaticLibs(publicRoot) {
  const files = await findLibFiles(publicRoot);
  let beforeBytes = 0;
  let afterBytes = 0;

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const result = await minify(source, {
      module: true,
      compress: true,
      mangle: true,
      format: { comments: false }
    });
    if (!result.code) throw new Error(`Terser produced no code for ${file}`);
    await writeFile(file, result.code);
    beforeBytes += Buffer.byteLength(source);
    afterBytes += Buffer.byteLength(result.code);
  }

  return { files: files.length, beforeBytes, afterBytes };
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const publicRoot = path.resolve(process.argv[2] || '.output/public');
  const summary = await minifyStaticLibs(publicRoot);
  const savedBytes = summary.beforeBytes - summary.afterBytes;
  const savedPercent = summary.beforeBytes
    ? Math.round((savedBytes / summary.beforeBytes) * 100)
    : 0;
  console.log(`Minified ${summary.files} static lib files: ${summary.beforeBytes} -> ${summary.afterBytes} bytes (${savedPercent}% smaller).`);
}
