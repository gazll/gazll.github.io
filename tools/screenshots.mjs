#!/usr/bin/env node
/* Screenshots + an axe pass over a generated site, for reviewing UI changes.

     node tools/screenshots.mjs <.output/public | https://…> <out-dir> [--axe] [--routes /a,/b]

   A directory is served by a tiny static server here, so the tool needs no
   other process. Each route is shot at three widths in light and dark, cut at
   SHOT_MAX_HEIGHT so a 60-card topic page stays a reviewable image. This is a
   review aid, not a test: it never fails on a difference, only on a page that
   does not load. `--axe` adds a summary of axe-core violations per route. */
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const WIDTHS = [390, 1024, 1440];
const THEMES = ['light', 'dark'];
const SHOT_MAX_HEIGHT = 3200;
export const DEFAULT_ROUTES = [
  '/',
  '/topics/01-java-core-jvm',
  '/topics/19-dsa-leetcode',
  '/system-design',
  '/system-design/traffic-caching-building-blocks',
  '/case-studies',
  '/case-studies/arcturus-inventory-processing-system',
  '/release-notes',
  '/search?q=kafka',
  '/calendar',
  '/gazl-try',
  '/no-such-page'
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };

async function serve(root) {
  const exists = async file => { try { return (await stat(file)).isFile(); } catch { return false; } };
  const server = createServer(async (req, res) => {
    const clean = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const base = path.join(root, path.normalize(clean).replace(/^(\.\.[/\\])+/, ''));
    const candidates = [base, path.join(base, 'index.html'), `${base}.html`];
    for (const file of candidates) {
      if (await exists(file)) {
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(await readFile(file));
        return;
      }
    }
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    res.end(await readFile(path.join(root, '404.html')).catch(() => 'not found'));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

const slug = route => (route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home');

async function main() {
  const [target, outDir = 'screenshots', ...rest] = process.argv.slice(2);
  if (!target) throw new Error('usage: screenshots.mjs <dir|url> <out-dir> [--axe] [--routes /a,/b]');
  const withAxe = rest.includes('--axe');
  const routeArg = rest[rest.indexOf('--routes') + 1];
  const routes = rest.includes('--routes') && routeArg ? routeArg.split(',') : DEFAULT_ROUTES;
  const { chromium } = await import('playwright');
  const server = /^https?:/.test(target) ? { url: target.replace(/\/$/, ''), close() {} } : await serve(path.resolve(target));
  const axeSource = withAxe ? await readFile(require.resolve('axe-core/axe.min.js'), 'utf8') : '';
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const report = {};
  let failed = 0;
  try {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
        for (const route of routes) {
          const name = `${slug(route)}--${width}-${theme}`;
          // A tab per route: one renderer crash must not take the rest down.
          const page = await context.newPage();
          try {
            await page.goto(server.url + route, { waitUntil: 'networkidle', timeout: 45_000 });
            await page.evaluate(() => document.fonts?.ready);
            const height = Math.min(SHOT_MAX_HEIGHT, await page.evaluate(() => document.documentElement.scrollHeight));
            await page.screenshot({ path: path.join(outDir, `${name}.png`), clip: { x: 0, y: 0, width, height }, fullPage: true });
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            if (overflow > 1) (report[route] ||= {}).overflow = { ...(report[route]?.overflow || {}), [width]: overflow };
            if (withAxe && width === 1440) {
              await page.evaluate(axeSource);
              const result = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
              (report[route] ||= {})[`axe-${theme}`] = result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
            }
          } catch (error) {
            failed += 1;
            (report[route] ||= {}).error = String(error.message || error).split('\n')[0];
          } finally {
            await page.close().catch(() => {});
          }
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  await writeFile(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  for (const [route, row] of Object.entries(report)) {
    const axe = Object.entries(row).filter(([key]) => key.startsWith('axe-'))
      .map(([key, list]) => `${key.slice(4)}: ${list.map(v => `${v.id}(${v.impact},${v.nodes})`).join(' ') || 'clean'}`);
    process.stdout.write(`${route}${row.error ? ` ERROR ${row.error}` : ''}${row.overflow ? ` overflow ${JSON.stringify(row.overflow)}` : ''}${axe.length ? `\n  ${axe.join('\n  ')}` : ''}\n`);
  }
  process.exitCode = failed ? 1 : 0;
}

await main();
