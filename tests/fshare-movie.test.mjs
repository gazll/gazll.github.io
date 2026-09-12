import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCatalog, createListingFetcher, parseCsv, parseRawSource, probeFile, probeFileOnWeb,
  projectCatalog, recountChildren, selectEntries, sourceId
} from '../tools/fshare-movie.mjs';
import {
  extractFshareLinks, groupByTitle, normalizeMovieDatabase, searchMovieLinks, titleKey
} from '../public/fshare-tool/lib/movie-db.js';
import { crawlMovieFolder } from '../public/fshare-tool/lib/movie-check.js';
import { seal, unseal } from '../public/lib/schedule-crypto.js';

const NOW = '2026-09-12T00:00:00.000Z';

const csv = [
  'Name,Link,Poster',
  '"Mother Android (2021)",https://www.fshare.vn/folder/EXMPL0000001,',
  '"Mother Android (2021)",https://www.fshare.vn/folder/ZZZZ1111,',
  '"Line with, comma\nand newline",fshare.vn/file/ABCD1234EFGH5678,',
  '- - Junk row without a link,,'
].join('\n');

test('raw parser reads quoted newlines, canonicalises codes and keeps the nearest title', () => {
  assert.equal(parseCsv(csv).length, 5);
  const records = parseRawSource('export.csv', csv);
  assert.deepEqual(records.map((r) => [r.kind, r.code, r.name]), [
    ['folder', 'EXMPL0000001', 'Mother Android (2021)'],
    ['folder', 'ZZZZ1111', 'Mother Android (2021)'],
    ['file', 'ABCD1234EFGH5678', 'Line with, comma and newline']
  ]);
  assert.deepEqual(parseRawSource('list.txt', 'Dune 2021 https://www.fshare.vn/folder/DUNE2021X\nhttps://www.fshare.vn/file/BARE0001').map((r) => r.name),
    ['Dune 2021', 'BARE0001']);
  assert.equal(extractFshareLinks('www.fshare.vn/file/abcd1234?token=1')[0].id, 'fshare-file-ABCD1234');
});

test('titleKey folds accents, list bullets and release punctuation but keeps the year', () => {
  assert.equal(titleKey('- - Tần Số Chết (2019)'), 'tan so chet 2019');
  assert.equal(titleKey('Suffering.of.Ninko.2016.1080p.mkv'), 'suffering of ninko 2016 1080p');
  assert.notEqual(titleKey('Dune (1984)'), titleKey('Dune (2021)'));
});

test('build gives one row per link, groups same-title links, and never drops a row', () => {
  const sources = [{ file: 'export.csv', text: csv, updatedAt: NOW }];
  const first = buildCatalog(sources, { defaultOriginUrl: 'https://sheet' }, null, NOW);
  assert.equal(first.links.length, 3);
  assert.ok(first.links.every((row) => row.status === 'pending' && row.firstSeenAt === NOW));
  assert.equal(first.sources[0].id, sourceId('export.csv'));
  assert.equal(first.sources[0].originUrl, 'https://sheet');
  assert.equal(first.validation.ok, false);

  const sameTitle = first.links.filter((row) => row.titleKey === 'mother android 2021');
  assert.equal(sameTitle.length, 2, 'two links, two rows — a title is not a key');
  assert.equal(first.links.indexOf(sameTitle[1]) - first.links.indexOf(sameTitle[0]), 1, 'sorted adjacent');

  // A second build with one raw file gone and one row already checked.
  const checked = first.links.find((row) => row.code === 'EXMPL0000001');
  checked.status = 'live';
  checked.checkedAt = NOW;
  const second = buildCatalog([{ file: 'more.txt', text: 'Alias Name https://www.fshare.vn/folder/EXMPL0000001', updatedAt: NOW }], {}, first, NOW);
  assert.equal(second.links.length, 3, 'nothing removed');
  const kept = second.links.find((row) => row.code === 'EXMPL0000001');
  assert.equal(kept.status, 'live', 'a check result survives a rebuild');
  assert.deepEqual(kept.aliases, ['Alias Name']);
  assert.deepEqual(kept.sourceIds, [sourceId('export.csv'), sourceId('more.txt')]);
  assert.equal(second.sources.length, 2, 'the source that vanished is still recorded');
});

test('the projection ships checked rows only and is validated only with nothing pending', () => {
  const catalog = buildCatalog([{ file: 'export.csv', text: csv, updatedAt: NOW }], {}, null, NOW);
  assert.equal(projectCatalog(catalog, NOW).links.length, 0);
  catalog.links.forEach((row, index) => {
    if (index === 0) return;
    row.status = index === 1 ? 'dead' : 'live';
    row.checkedAt = NOW;
  });
  let projection = projectCatalog(catalog, NOW);
  assert.equal(projection.validated, false, 'one row is still pending');
  assert.deepEqual(projection.links.map((row) => row.status), ['dead', 'live']);
  assert.ok(!('error' in projection.links[0]) && !('firstSeenAt' in projection.links[0]), 'trimmed');
  catalog.links[0].status = 'live';
  catalog.links[0].checkedAt = NOW;
  projection = projectCatalog(catalog, NOW);
  assert.equal(projection.validated, true);
  assert.equal(projection.counts.pending, 0);
  assert.equal(normalizeMovieDatabase(projection).links.length, 3);
});

test('folder children are counted from the rows that name the folder as parent', () => {
  const catalog = buildCatalog([{ file: 'l.txt', text: 'Root https://www.fshare.vn/folder/ROOT0001', updatedAt: NOW }], {}, null, NOW);
  catalog.links.push(
    { id: 'fshare-file-A1', kind: 'file', code: 'A1', name: 'a', aliases: [], titleKey: 'a', origin: 'crawl', sourceIds: [], parents: ['fshare-folder-ROOT0001'], status: 'live' },
    { id: 'fshare-file-B2', kind: 'file', code: 'B2', name: 'b', aliases: [], titleKey: 'b', origin: 'crawl', sourceIds: [], parents: ['fshare-folder-ROOT0001'], status: 'dead' },
    { id: 'fshare-folder-SUB1', kind: 'folder', code: 'SUB1', name: 's', aliases: [], titleKey: 's', origin: 'crawl', sourceIds: [], parents: ['fshare-folder-ROOT0001'], status: 'live', children: null }
  );
  recountChildren(catalog);
  const root = catalog.links.find((row) => row.code === 'ROOT0001');
  assert.deepEqual(root.children, { folders: 1, files: 2, live: 1, dead: 1, unknown: 0, pending: 0 });
});

test('a validation run takes folders first, never-checked before stale, and honours --limit', () => {
  const catalog = buildCatalog([{ file: 'l.txt', text: [
    'F https://www.fshare.vn/file/FILE0001', 'D https://www.fshare.vn/folder/DIR00001', 'G https://www.fshare.vn/file/FILE0002'
  ].join('\n'), updatedAt: NOW }], {}, null, NOW);
  const [f1, dir, f2] = ['FILE0001', 'DIR00001', 'FILE0002'].map((code) => catalog.links.find((row) => row.code === code));
  f1.status = 'live'; f1.checkedAt = '2026-01-01T00:00:00.000Z';
  f2.status = 'unknown'; f2.checkedAt = NOW;
  const now = Date.parse(NOW);
  assert.deepEqual(selectEntries(catalog, { now }).map((row) => row.code), ['DIR00001', 'FILE0002']);
  assert.deepEqual(selectEntries(catalog, { now, staleMs: 30 * 86400000 }).map((row) => row.code), ['DIR00001', 'FILE0002', 'FILE0001']);
  assert.deepEqual(selectEntries(catalog, { now, only: ['dead'] }).map((row) => row.code), []);
  assert.equal(selectEntries(catalog, { now, limit: 1 }).length, 1);
});

test('the listing cache fetches each folder once per run and follows every page', async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    const page = Number(new URL(url).searchParams.get('page'));
    return {
      ok: true,
      json: async () => ({
        current: { linkcode: 'ROOT0001', name: 'Root', type: 0 },
        items: page === 1 ? [{ linkcode: 'SUB00001', name: 'Sub', type: 0 }] : [{ linkcode: 'FILE0001', name: 'a.mkv', type: 1, size: 5 }],
        _links: { last: '/v3/files/folder?linkcode=ROOT0001&page=2' }
      })
    };
  };
  const fetchPages = createListingFetcher(fetcher);
  const [a, b] = await Promise.all([fetchPages('ROOT0001'), fetchPages('ROOT0001')]);
  assert.equal(a, b, 'concurrent callers share one in-flight listing');
  assert.equal(a.items.length, 2);
  assert.equal(calls.length, 2, 'two pages, one fetch each');

  const crawl = await crawlMovieFolder({ linkcode: 'ROOT0001', name: 'Root' }, { fetchPages });
  assert.equal(calls.length, 4, 'the sub-folder is fetched, the root is not fetched again');
  assert.deepEqual(crawl.folders.map((f) => [f.linkcode, f.parent, f.status]), [['ROOT0001', '', 'live'], ['SUB00001', 'ROOT0001', 'live']]);
  assert.deepEqual(crawl.files.map((f) => [f.linkcode, f.parent]), [['FILE0001', 'ROOT0001'], ['FILE0001', 'SUB00001']]);
});

test('a file probe says dead only on 404 and asks fshare.vn for the second opinion by title', async () => {
  const notFound = async () => ({ ok: false, status: 404 });
  assert.equal((await probeFile('DEAD0001', notFound)).status, 'dead');
  const flaky = async () => ({ ok: false, status: 503 });
  assert.equal((await probeFile('FLAKY001', flaky)).status, 'unknown', 'a 5xx is not an answer');
  const folder = async () => ({ ok: true, json: async () => ({ current: { linkcode: 'DIR00001', type: 0 }, items: [] }) });
  assert.equal((await probeFile('DIR00001', folder)).status, 'unknown');

  const web = (title) => async () => ({ status: 200, text: async () => `<html><head><title>${title}</title></head></html>` });
  assert.equal((await probeFileOnWeb('X', web('Không tìm thấy - Fshare'))).status, 'dead');
  const live = await probeFileOnWeb('X', web('Movie.2021.mkv - Fshare'));
  assert.equal(live.status, 'live');
  assert.equal(live.name, 'Movie.2021.mkv');
});

test('search and grouping put two copies of one film under one heading, dead rows included', () => {
  const links = normalizeMovieDatabase({
    version: 1,
    links: [
      { id: 'fshare-folder-A', kind: 'folder', code: 'A', name: 'Dune (2021)', status: 'live', titleKey: 'dune 2021' },
      { id: 'fshare-file-B', kind: 'file', code: 'B', name: 'Dune.2021.mkv', status: 'dead', titleKey: 'dune 2021' },
      { id: 'fshare-folder-C', kind: 'folder', code: 'C', name: 'Dune (1984)', status: 'live', titleKey: 'dune 1984', aliases: ['Xứ Cát'] }
    ]
  }).links;
  const groups = groupByTitle(searchMovieLinks(links, 'dune'));
  assert.deepEqual(groups.map((g) => [g.key, g.links.length]), [['dune 1984', 1], ['dune 2021', 2]]);
  assert.deepEqual(groups[1].links.map((row) => row.kind), ['folder', 'file'], 'folder before its file');
  assert.equal(searchMovieLinks(links, 'xu cat').length, 1, 'aliases and accents fold');
  assert.equal(searchMovieLinks(links, '', { status: 'dead' }).length, 1);
});

test('a gzip envelope round-trips and a plain one still opens', async () => {
  const large = { links: Array.from({ length: 2000 }, (_, i) => ({ id: `fshare-file-${i}`, name: `Film number ${i} (2021)`, status: 'live' })) };
  const zipped = await seal(large, 'pw', { compress: true });
  assert.equal(zipped.enc, 'gzip');
  assert.ok(zipped.ct.length < JSON.stringify(large).length / 4, 'compressed before encryption');
  assert.deepEqual(await unseal(zipped, 'pw'), large);
  const plain = await seal({ a: 1 }, 'pw');
  assert.equal('enc' in plain, false);
  assert.deepEqual(await unseal(plain, 'pw'), { a: 1 });
  await assert.rejects(() => unseal({ ...zipped, enc: 'brotli' }, 'pw'), /content encoding/);
});
