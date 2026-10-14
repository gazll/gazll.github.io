#!/usr/bin/env node
/* Self-hosted Roboto Flex + Roboto Mono, copied out of @fontsource-variable.

     node tools/fonts.mjs           copy the files and rewrite the @font-face block
     node tools/fonts.mjs --check   fail if public/fonts or the block is stale

   Only the wght axis and only latin, latin-ext and vietnamese: the corpus is
   English and Vietnamese, and the full Roboto Flex axes are ~250KB per subset.
   Each subset carries its unicode-range, so a page downloads only the files
   its text needs. Fonts were on fonts.googleapis.com before; self-hosting took
   two third-party origins out of the CSP and the request chain. */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public/fonts');
const STYLES = path.join(ROOT, 'public/styles.css');
const SUBSETS = ['latin', 'latin-ext', 'vietnamese'];
const FAMILIES = ['@fontsource-variable/roboto-flex', '@fontsource-variable/roboto-mono'];
const START = '/* fonts:generated:start — tools/fonts.mjs writes this block; never edit it by hand */';
const END = '/* fonts:generated:end */';

async function faces() {
  const files = [];
  const blocks = [];
  for (const pkg of FAMILIES) {
    const dir = path.dirname(require.resolve(`${pkg}/package.json`));
    const css = await readFile(path.join(dir, 'wght.css'), 'utf8');
    for (const [, name, body] of css.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face\s*\{([^}]*)\}/g)) {
      if (!SUBSETS.some(subset => name.endsWith(`-${subset}-wght-normal`))) continue;
      const file = body.match(/url\(\.\/files\/([^)]+)\)/)[1];
      files.push([path.join(dir, 'files', file), file]);
      const declarations = body.trim().split(/;\s*/).filter(Boolean)
        .map(line => line.trim().replace(/url\(\.\/files\//, 'url(/fonts/'));
      blocks.push(`  @font-face{${declarations.join(';')}}`);
    }
  }
  return { files, block: [START, ...blocks, END].join('\n') };
}

async function main() {
  const { files, block } = await faces();
  const css = await readFile(STYLES, 'utf8');
  const start = css.indexOf(START);
  const end = css.indexOf(END);
  if (process.argv.includes('--check')) {
    const stale = start < 0 || css.slice(start, end + END.length) !== block;
    let missing = 0;
    for (const [, name] of files) await readFile(path.join(OUT, name)).catch(() => { missing += 1; });
    if (stale || missing) {
      process.stderr.write('public/fonts or the @font-face block is stale — run node tools/fonts.mjs\n');
      process.exitCode = 1;
    }
    return;
  }
  await mkdir(OUT, { recursive: true });
  for (const [from, name] of files) await copyFile(from, path.join(OUT, name));
  // The faces go first: a font-face block below rules that name the family
  // still works, but reading top-down should meet the fonts before their use.
  const updated = start >= 0 ? css.slice(0, start) + block + css.slice(end + END.length) : `${block}\n${css}`;
  await writeFile(STYLES, updated);
  process.stdout.write(`Copied ${files.length} font files and wrote the @font-face block.\n`);
}

await main();
