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
why this is ~800K rather than the full package. The test above is what proves
the set is complete — if a chunk is missing, it fails there rather than as a
blank diagram in the browser.
