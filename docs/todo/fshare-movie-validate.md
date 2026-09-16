# Fshare movie catalog — recursive validation after the Thuviencine harvest

Status: **OPEN**
Started: **2026-09-16**

## Why this exists

The 2026-09-16 Thuviencine run successfully harvested the whole site's movie
and download pages, but it did not finish the second, separate operation: a
recursive crawl of each Fshare folder and validation of the file leaves. The
result was built into the master catalog and sealed because every row had a
non-pending root answer. That validated: true state is insufficient for a
folder catalog: it says nothing about whether children and parents were
populated.

The exact Frieren case is representative:

```text
WS2MN7OLPEOW
root status: live
via: probe
children: null
alias: Frieren Beyond Journeys End Season 1 (2023)
```

It is a valid responding folder, but it has not yet gone through the required
recursive folder flow. Do not call this source fully validated until this TODO
is closed.

## Snapshot from the current master catalog

Source: `thuviencine-2026-09-16` (`src-f07235bb3e`)
Catalog: **93,032** rows (**24,320** folders + **68,712** files)

| Scope | Total | Current state |
|---|---:|---|
| Thuviencine source links | 10,641 | 7,130 live · 3,511 dead · 0 pending · 0 unknown |
| Thuviencine folder links | 6,143 | 6,014 live · 129 dead |
| Folder links without `children` | **5,881** | root probe only; recursive crawl definitely missing |
| Folder links with `children` | 262 | crawl state exists, but audit this source run before declaring complete |
| Thuviencine file links | 4,498 | 1,116 live · 3,382 dead |
| Source files without a `parents` link | **4,493** | not reconciled to a crawled folder |

The full next-pass scope is therefore **10,641 Thuviencine source links**:

- **6,143 folders** must be covered by the recursive crawl; **5,881** are
  definitely untouched by that flow.
- **4,498 files** must be reconciled and validated; **4,493** currently have no
  parent association. The final number of discovered child folders/files is
  unknown until the walk runs.

`pending: 0` and `unknown: 0` are not evidence that this scope is complete.
The current root statuses were produced mostly by `via: probe`: 5,881 of the
source folders and 4,491 of the source files were checked that way.

## Fixes required

1. Build a real recursive runner for the source roots. The existing
   `tools/fshare-movie-shard.mjs` only probes one row at a time; its `--kind
   all` mode does not call `crawlMovieFolder` and must not be used as proof of
   folder completeness.
2. Partition unique root folders into disjoint crawl shards, keep one listing
   cache per worker, checkpoint each shard, and merge only after verifying the
   same catalog snapshot hash and disjoint result IDs. Keep concurrency bounded
   and retry `unknown`; do not turn timeouts/429s into `dead`.
3. Propagate the root's `sourceIds` to newly discovered child folders/files,
   while retaining all `parents`, so a later report can say exactly which
   Thuviencine root produced each child.
4. Make completeness explicit in the data model. `children: null` means not
   crawled; `{folders: 0, files: 0, ...}` means crawled and empty. The seal
   gate must require no pending/unknown rows **and** no uncrawled designated
   folders. A plain root `live` probe must not produce a public
   `validated: true` catalog.
5. Add a source-level audit command/report with at least: root folders,
   uncrawled folders, discovered folders/files, files without parents,
   pending/unknown/dead/live by `via`, and duplicate/shared-parent counts.
   Make the pre-seal check fail when the report is incomplete.
6. Keep the UI search fix already deployed in commit `78baf13`: a query must
   show both folder and file rows, and sort the returned rows by size ascending.
   The UI fix does not replace recursive validation.

## Next-session runbook

1. Snapshot the current catalog and record its SHA-256. Do not run `build`,
   `validate`, `merge`, or another ingest while crawl workers are running.
2. Smoke-test a few roots first, including `WS2MN7OLPEOW`, and confirm the
   result distinguishes a successful empty listing from an unattempted folder.
3. Run the recursive crawler over all **6,143** Thuviencine roots (or all
   unique roots after deduplication), not the probe-only shard command.
4. Merge shard results once; then direct-probe standalone/orphan file links and
   resolve every `unknown`/proxy-`dead` result with the existing second opinion.
5. Require: zero uncrawled source folders, zero files without a parent unless
   they are intentional direct links, zero pending/unknown, and a written
   report before sealing.
6. Seal, run `node tools/fshare-movie.mjs --check`, run the normal repository
   checks, commit only the public ciphertext/code changes, push, and verify
   `version.json` on the live site.

## Performance notes

- Separate site harvesting from Fshare recursive crawling; they have different
  URLs, failure modes, and completeness criteria.
- Reuse a per-process listing cache and fetch pages in small bounded batches.
  More processes are useful only while the proxy remains below its timeout and
  rate-limit threshold; otherwise they create `unknown` work that must be
  repeated.
- Keep shard outputs unique and resumable. A failed shard should be rerun from
  the same snapshot, not merged partially and not mixed with a rebuilt catalog.
- Do not use `AbortSignal.timeout()` as the only lifetime mechanism in a
  long-running Node shard: the earlier probe runner could exit with an
  unsettled top-level await. Use an explicit `AbortController` plus a referenced
  timer and preserve `unknown` on timeout.
