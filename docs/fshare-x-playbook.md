# FShare X catalog — playbook

Every file under this directory is a separate FShare X link dataset. It must
never be placed in `secret/fshare-movie/raw/` or merged into the Movie catalog.

```text
secret/fshare-x/raw/*.csv|*.txt          raw inputs (GITIGNORED)
secret/fshare-x/sources.json              source manifest (GITIGNORED)
secret/fshare-x/catalog.json              X working database (GITIGNORED)
secret/fshare-x/validation-report.json    optional root-link checks (GITIGNORED)
public/data/fshare-x/catalog.enc.json    encrypted X projection (COMMIT)
```

## Import and publish

```bash
node tools/fshare-x.mjs build
node tools/fshare-x.mjs status
node tools/fshare-x.mjs seal
node tools/fshare-x.mjs --check
```

The build parses only the raw files under `secret/fshare-x/raw/`. If a matching
`validation-report.json` exists and its `source.path` and SHA-256 match one raw
file, the report's `live`, `dead`, and `unknown` results are carried into the X
catalog. This allows a later transfer file, such as
`moved-from-movie-YYYY-MM-DD.txt`, to be checked without changing `x.csv`.
That transfer file is exactly what `node tools/fshare-movie.mjs move-to-x
[--apply]` writes — adult content that surfaced mixed into a movie source
gets classified by `isAdultContent()` in `movie-db.js` and physically moved
here, never left in the movie catalog with a category flag. See
`docs/fshare-movie-playbook.md`'s "Nội dung 18+ lẫn vào" for the full command
and the false-positive guards it needed.
The current report checks each root link once; it does not crawl folder
children. Therefore the X envelope is never labelled fully validated.

The Movie pipeline remains independent:

```bash
node tools/fshare-movie.mjs build
```

That command cannot see `secret/fshare-x/raw/x.csv`.

## In the web tool

Open **Movie search**, then choose **Movie** or **X** in the Dataset switch.
Movie loads `/data/fshare-movie/catalog.enc.json` and keeps its file-only,
folder-grouped results. X loads `/data/fshare-x/catalog.enc.json` and searches
its own raw file and folder rows. Switching type clears the selection and
temporary re-check output so rows from one dataset cannot leak into the other.
