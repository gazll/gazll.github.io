# Fshare movie: parallel validation and metadata collection

`secret/fshare-movie/catalog.json` is the official working database. Raw CSV
files are inputs only. A normal run is:

```text
raw-link/CSV -> build -> catalog.json (pending)
                         -> validate -> catalog.json (live/dead/unknown)
                         -> seal -> public encrypted projection
```

## What the validator stores

Every successful API response keeps the file size in bytes, path, name and a
JSON snapshot under `remote`. The snapshot currently includes fields such as
`id`, `linkcode`, `type`, `mimetype`, `size`, `path`, `created`, `modified`,
`downloadcount`, ownership ids and access flags. Search also stores normalized
`keywords`, so `Dune (2007).mkv` can be found with `dune`, `2007`, or `mkv`.

The folder crawler still flattens the final result to file rows. Parent folder
names and paths remain on each file so a large folder is not lost as context.

## When to use a shard

The main validator writes the catalog in place and must have only one writer.
For parallel work, `tools/fshare-movie-shard.mjs` reads one stable catalog
snapshot, probes a deterministic disjoint subset, and writes results to a
separate JSON file. It never writes `catalog.json`.

Run a small smoke check first:

```powershell
node tools/fshare-movie-shard.mjs `
  --catalog secret/fshare-movie/catalog.json `
  --output secret/fshare-movie/shards/metadata-smoke.json `
  --kind file --status live --limit 20 --concurrency 4
```

For four parallel file shards, use separate output paths and keep the total
concurrency modest (for example, `2` per process):

```powershell
node tools/fshare-movie-shard.mjs --catalog secret/fshare-movie/catalog.json --output secret/fshare-movie/shards/files-0.json --kind file --status live --shard-index 0 --shard-count 4 --limit 500 --concurrency 2
node tools/fshare-movie-shard.mjs --catalog secret/fshare-movie/catalog.json --output secret/fshare-movie/shards/files-1.json --kind file --status live --shard-index 1 --shard-count 4 --limit 500 --concurrency 2
node tools/fshare-movie-shard.mjs --catalog secret/fshare-movie/catalog.json --output secret/fshare-movie/shards/files-2.json --kind file --status live --shard-index 2 --shard-count 4 --limit 500 --concurrency 2
node tools/fshare-movie-shard.mjs --catalog secret/fshare-movie/catalog.json --output secret/fshare-movie/shards/files-3.json --kind file --status live --shard-index 3 --shard-count 4 --limit 500 --concurrency 2
```

All shard commands must use the same catalog snapshot. Merge all result files
in one command after every process finishes, so the catalog is written once:

```powershell
node tools/fshare-movie.mjs merge `
  secret/fshare-movie/shards/files-0.json `
  secret/fshare-movie/shards/files-1.json `
  secret/fshare-movie/shards/files-2.json `
  secret/fshare-movie/shards/files-3.json
```

The merge command verifies that every file has the same SHA-256 snapshot hash,
checks immutable row id/code, rejects duplicate rows, and writes the catalog
once. If `build` or another validation run changed the catalog, merge stops and
the shards must be rerun. A shard result is never allowed to overwrite
`catalog.json` directly.

## Safe operating rules

- Do not run `build`, `validate`, or `merge` while another command writes the
  catalog.
- A timeout/retry ends as `unknown`; it is not silently called dead.
- `dead` from the normal validator still receives the direct web second opinion
  unless `--no-web` is supplied.
- Do not seal until the catalog status shows no pending rows. The encrypted
  projection intentionally contains checked rows only.
- Shard outputs and the official catalog stay under `secret/`; do not commit
  them.
