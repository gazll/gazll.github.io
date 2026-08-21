#!/usr/bin/env node
/* Two image costs the site kept paying, both invisible in a diff:

     1. Animated GIF. Palette-based and already compressed, so gzip does nothing
        and the server does not even try. Five chart GIFs were 8.7MB on one
        case-study page. Lossless animated WebP is pixel-identical and ~93%
        smaller — smaller than any lossy setting, because flat-colour charts are
        exactly what lossless WebP is good at.
     2. Full-resolution card art. A library card renders its cover at 112px
        (96px on System Design) while the file behind it ran to 2784px wide.

   Both are fixed here rather than at request time: the site is prerendered onto
   GitHub Pages, so there is no image service to resize on the fly.

     node tools/optimize-images.mjs           # convert and write
     node tools/optimize-images.mjs --check   # report only, non-zero if stale

   Needs the `sharp` devDependency. CI never runs this — the outputs are
   committed, so a deploy needs no native image toolchain.
*/
import sharp from 'sharp';
import { readFile, writeFile, readdir, mkdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const CHECK = process.argv.includes('--check');

/* 112px card, 96px on System Design, doubled for retina and rounded up. Card
   art is decorative and cropped, so lossy is right here — unlike the charts. */
const THUMB_WIDTH = 320;
const THUMB_QUALITY = 78;
const COLLECTIONS = ['case-studies', 'photography', 'homelab'];

const kb = n => `${(n / 1024).toFixed(0)}KB`;
const walk = async dir => {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
};

const stale = [];
let saved = 0;

/* ---------- 1. animated GIF -> lossless animated WebP ---------- */

const gifCanvas = buf => [buf.readUInt16LE(6), buf.readUInt16LE(8)];
const webpCanvas = buf => buf.slice(12, 16).toString() === 'VP8X'
  ? [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)]
  : null;

const gifs = (await walk(path.join(PUBLIC, 'assets'))).filter(file => file.endsWith('.gif'));
for (const gif of gifs) {
  const rel = path.relative(PUBLIC, gif).split(path.sep).join('/');
  if (CHECK) { stale.push(`gif: ${rel}`); continue; }

  // read into a buffer first: sharp holds the input file open, and libvips
  // lazy-loading means the handle outlives the encode and blocks the unlink.
  const source = await readFile(gif);
  const out = await sharp(source, { animated: true }).webp({ lossless: true, effort: 6 }).toBuffer();

  // A re-encode that changes the canvas or drops the animation is not a re-encode.
  const from = gifCanvas(source);
  const to = webpCanvas(out);
  if (!to || from[0] !== to[0] || from[1] !== to[1]) {
    throw new Error(`${rel}: canvas drifted ${from.join('x')} -> ${to ? to.join('x') : 'none'}`);
  }
  if ((out[20] & 0x02) === 0) throw new Error(`${rel}: the WebP lost its animation`);

  await writeFile(gif.replace(/\.gif$/, '.webp'), out);
  saved += source.length - out.length;
  console.log(`gif   ${rel}  ${kb(source.length)} -> ${kb(out.length)}  -${(100 - 100 * out.length / source.length).toFixed(0)}%`);
}

if (!CHECK && gifs.length) {
  // Article bodies are the only place a figure is referenced, and both languages
  // must move together or tests/libraries.test.mjs sees the figures drift apart.
  for (const collection of COLLECTIONS) {
    const dir = path.join(PUBLIC, 'data', collection, 'articles');
    if (!existsSync(dir)) continue;
    for (const file of await walk(dir)) {
      if (!file.endsWith('.html')) continue;
      const before = await readFile(file, 'utf8');
      let after = before;
      for (const gif of gifs) after = after.split(path.basename(gif)).join(path.basename(gif).replace(/\.gif$/, '.webp'));
      if (after !== before) {
        await writeFile(file, after);
        console.log(`      repointed ${path.relative(ROOT, file).split(path.sep).join('/')}`);
      }
    }
  }
  for (const gif of gifs) await rm(gif);
}

/* ---------- 2. card thumbnails ---------- */

for (const collection of COLLECTIONS) {
  const manifestPath = path.join(PUBLIC, 'data', collection, 'manifest.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const outDir = path.join(PUBLIC, 'assets', 'covers', collection);
  let changed = false;

  for (const article of manifest.articles) {
    const cover = article.cover_image;
    // SVG scales to any card size for a few kilobytes; rasterising it would cost more.
    if (!cover || cover.endsWith('.svg')) continue;
    const source = path.join(PUBLIC, cover.replace(/\.gif$/, '.webp'));
    if (!existsSync(source)) continue;

    const key = `${String(article.n).padStart(2, '0')}-${article.slug}`;
    const rel = `assets/covers/${collection}/${key}.webp`;
    const dest = path.join(PUBLIC, rel);
    const original = (await stat(source)).size;

    if (CHECK) {
      if (article.cover_thumb !== rel || !existsSync(dest)) stale.push(`thumb: ${rel}`);
      continue;
    }

    await mkdir(outDir, { recursive: true });
    const out = await sharp(await readFile(source))
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY, effort: 6 })
      .toBuffer();
    await writeFile(dest, out);
    saved += original - out.length;
    console.log(`thumb ${rel}  ${kb(original)} -> ${kb(out.length)}  -${(100 - 100 * out.length / original).toFixed(0)}%`);

    if (article.cover_thumb !== rel) { article.cover_thumb = rel; changed = true; }
    // the GIF this row pointed at no longer exists
    if (cover.endsWith('.gif')) { article.cover_image = cover.replace(/\.gif$/, '.webp'); changed = true; }
  }

  if (changed) {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`      updated data/${collection}/manifest.json`);
  }
}

if (CHECK) {
  if (stale.length) {
    console.error(`Images are not optimized. Run node tools/optimize-images.mjs:\n- ${stale.join('\n- ')}`);
    process.exit(1);
  }
  console.log('Images are optimized.');
} else {
  console.log(`\nsaved ${(saved / 1048576).toFixed(2)}MB`);
}
