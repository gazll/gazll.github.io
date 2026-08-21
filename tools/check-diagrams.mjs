#!/usr/bin/env node
/* Parse every shipped Mermaid diagram with the vendored renderer.

   `validate-content.mjs` only checks a diagram is non-empty, and a syntax error
   is not loud: lib/mermaid.js degrades to the escaped source, so a broken
   diagram ships as a readable code block and nobody notices it stopped being a
   picture. This runs mermaid.parse() against the same build the site loads.

     node tools/check-diagrams.mjs

   Needs the `jsdom` devDependency. CI does not run this — like the images, the
   diagrams are content and are checked when they change.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* Mermaid touches the DOM at import time, so the globals have to exist before
   the module is evaluated — not before parse() is called. */
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
for (const key of ['window', 'document', 'navigator', 'DOMPurify', 'Element', 'SVGElement',
  'HTMLElement', 'Node', 'NodeList', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame']) {
  if (key in globalThis) continue;
  const value = key === 'window' ? dom.window : dom.window[key];
  if (value !== undefined) globalThis[key] = value;
}

const mermaid = (await import(pathToFileURL(
  ROOT + 'public/vendor/mermaid-11.16.1/mermaid.esm.min.mjs').href)).default;
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false, logLevel: 'fatal' });

const catalog = JSON.parse(readFileSync(ROOT + 'public/data/system-design/catalog.json', 'utf8'));
const diagrams = [
  ...catalog.designs.map(d => [`design ${d.slug}`, d.diagram]),
  ...Object.entries(catalog.case_overviews || {}).map(([slug, o]) => [`case ${slug}`, o.diagram])
].filter(([, source]) => String(source || '').trim());

let failed = 0;
for (const [label, source] of diagrams) {
  try {
    await mermaid.parse(source);
  } catch (error) {
    failed += 1;
    const message = String(error?.message || error).split('\n').slice(0, 4).join('\n     ');
    console.error(`FAIL ${label}\n     ${message}`);
  }
}

console.log(`${diagrams.length - failed}/${diagrams.length} diagrams parse`);
if (failed) process.exit(1);
