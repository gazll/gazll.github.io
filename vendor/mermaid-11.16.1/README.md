# Mermaid 11.16.1 — vendored flowchart runtime

This directory contains the official Mermaid 11.16.1 ESM entry point and the
static chunks required by its `flowchart` renderer. The files were copied from
the npm package `mermaid@11.16.1`; `LICENSE` is the upstream MIT license.

The System Design catalog intentionally validates every diagram as a Mermaid
flowchart. If another diagram family is introduced, regenerate this vendor set
from the same pinned package and add its lazy diagram module plus transitive
static imports.

## Why vendored at all

`index.html` sets `script-src 'self'`, so a CDN was never an option. These
files are committed unmodified and must stay that way: `tools/check.mjs` skips
every path containing `vendor/`, so nothing here is syntax-checked or covered
by the console-logging ban (`public/lib/mermaid.js` sets `logLevel: 'fatal'`
instead of us editing upstream output).

## Upgrading

The version is part of the directory name, and that name is the cache key —
`tools/stamp-assets.mjs` deliberately leaves `.mjs` imports unstamped because
of it. So an upgrade is a **new directory**, never an edit to this one:

    npm pack mermaid@<version>          # in a scratch directory
    # copy dist/mermaid.esm.min.mjs, dist/chunks/mermaid.esm.min/ and LICENSE
    # into public/vendor/mermaid-<version>/

Then point `MERMAID_MODULE` in `public/lib/mermaid.js` at the new directory,
update the path in `tests/system-design.test.mjs` (it walks the import graph
to prove no chunk is missing), run `node tools/check.mjs`, and delete the old
directory in the same commit.

Only the chunks the flowchart renderer actually reaches are vendored, which is
why this is ~890K rather than the full package.

## Determining the file set

Do not derive it by reading static imports: `dagre`, the default flowchart
layout engine, is reached through `await import("./dagre-K64A6Z3X.mjs")` inside
a lazily-registered loader. An earlier vendor set followed only static `from`
specifiers and shipped without it — the module loaded, then every diagram
failed at render time with `Failed to fetch dynamically imported module`.

The reliable method is to serve the complete upstream `dist/`, render every
diagram in `data/system-design/catalog.json` in a real browser, and record
which `.mjs` files are actually requested. That produced this set of 27.
