import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditCatalog, buildCatalog, createListingFetcher, parseCsv, parseRawSource, probeFile, probeFileOnWeb, probeFolderOnWeb,
  mergeShardResults, projectCatalog, recountChildren, selectEntries, sourceId
} from '../tools/fshare-movie.mjs';
import { parseArgs, probeRow, selectRows } from '../tools/fshare-movie-shard.mjs';
import {
  buildSearchIndex, extractFshareLinks, folderChain, groupByFolder, indexById, keywordTokens, movieHaystack, narrowsSearch,
  normalizeMovieDatabase, searchMovieLinks, titleKey
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

test('keywords keep years and extensions searchable after punctuation is removed', () => {
  assert.deepEqual(keywordTokens('Dune (2007).mkv'), ['dune', '2007', 'mkv']);
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
  catalog.links[1].remote = { id: 'remote-1', size: 1234, modified: 1779530685 };
  catalog.links[1].path = '/Movies/Dead';
  catalog.links[1].keywords = ['dead'];
  let projection = projectCatalog(catalog, NOW);
  assert.equal(projection.validated, false, 'one row is still pending');
  assert.deepEqual(projection.links.map((row) => row.status), ['dead', 'live']);
  // The envelope carries what the tab renders and nothing it can rebuild:
  // remote snapshots, paths and keywords were 39MB of a 70MB projection.
  for (const field of ['remote', 'path', 'keywords', 'id', 'titleKey', 'error', 'firstSeenAt']) {
    assert.ok(!(field in projection.links[0]), `${field} stays in the catalog`);
  }
  assert.equal(normalizeMovieDatabase(projection).links[0].id, 'fshare-folder-EXMPL0000001', 'id is rebuilt on load');
  catalog.links[0].status = 'live';
  catalog.links[0].checkedAt = NOW;
  projection = projectCatalog(catalog, NOW);
  // Nothing pending, but the live folder answered a probe and was never
  // listed, and the dead one is on the proxy's word alone: three gates, not one.
  assert.equal(projection.validated, false, 'a live folder with children: null is uncrawled');
  assert.deepEqual([projection.counts.pending, projection.counts.uncrawled, projection.counts.unverified], [0, 1, 1]);
  catalog.links.filter((row) => row.kind === 'folder').forEach((row) => { row.children = { folders: 0, files: 0, crawledAt: NOW }; });
  assert.equal(projectCatalog(catalog, NOW).validated, false, 'a dead row needs the fshare.vn second opinion');
  catalog.links[1].web = { status: 'unknown', error: 'fshare.vn answered HTTP 503' };
  assert.equal(projectCatalog(catalog, NOW).validated, false, 'proxy dead + web unknown is still one opinion');
  catalog.links[1].web = { status: 'dead', error: 'Không tìm thấy - Fshare' };
  projection = projectCatalog(catalog, NOW);
  assert.equal(projection.validated, true);
  assert.equal(projection.counts.pending, 0);
  assert.equal(normalizeMovieDatabase(projection).links.length, 3);
  const audit = auditCatalog(catalog);
  assert.equal(audit.ok, true);
  assert.equal(audit.sources[0].folders, 2);
  assert.equal(audit.sources[0].filesWithoutParent, 1, 'a standalone file link has no parent and that is not a gate');
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
  // --only uncrawled,unverified picks the completeness gaps, whatever the status says.
  dir.status = 'live'; dir.checkedAt = NOW; dir.via = 'probe';
  f1.status = 'dead'; f1.via = 'probe';
  assert.deepEqual(selectEntries(catalog, { now, only: ['uncrawled'] }).map((row) => row.code), ['DIR00001']);
  assert.deepEqual(selectEntries(catalog, { now, only: ['unverified'] }).map((row) => row.code), ['FILE0001']);
  dir.children = { crawledAt: NOW };
  f1.web = { status: 'dead' };
  assert.deepEqual(selectEntries(catalog, { now, only: ['uncrawled', 'unverified'] }), []);
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

  const crawl = await crawlMovieFolder({ linkcode: 'ROOT0001', name: 'Root' }, { fetchPages, concurrency: 2 });
  assert.equal(calls.length, 4, 'the sub-folder is fetched, the root is not fetched again');
  assert.deepEqual(crawl.folders.map((f) => [f.linkcode, f.parent, f.status]), [['ROOT0001', '', 'live'], ['SUB00001', 'ROOT0001', 'live']]);
  assert.deepEqual(crawl.files.map((f) => [f.linkcode, f.parent]), [['FILE0001', 'ROOT0001'], ['FILE0001', 'SUB00001']]);
  assert.equal(crawl.files[0].remote.size, 5, 'file size is retained in the remote snapshot');
  assert.equal(crawl.files[0].remote.type, 1, 'file type is retained in the remote snapshot');
});

test('a file probe says dead only on 404 and asks fshare.vn for the second opinion by title', async () => {
  const notFound = async () => ({ ok: false, status: 404 });
  assert.equal((await probeFile('DEAD0001', notFound)).status, 'dead');
  const flaky = async () => ({ ok: false, status: 503 });
  assert.equal((await probeFile('FLAKY001', flaky)).status, 'unknown', 'a 5xx is not an answer');
  const folder = async () => ({ ok: true, json: async () => ({ current: { linkcode: 'DIR00001', type: 0 }, items: [] }) });
  assert.equal((await probeFile('DIR00001', folder)).status, 'unknown');

  const web = (title, { status = 200, url = 'https://www.fshare.vn/file/X?token=1' } = {}) => async () =>
    ({ status, ok: status >= 200 && status < 300, url, text: async () => `<html><head><title>${title}</title></head></html>` });
  assert.equal((await probeFileOnWeb('X', web('Không tìm thấy - Fshare'))).status, 'dead');
  const live = await probeFileOnWeb('X', web('Movie.2021.mkv - Fshare'));
  assert.equal(live.status, 'live');
  assert.equal(live.name, 'Movie.2021.mkv');
  // An error page and the homepage carry a <title> too; neither vouches for the file.
  assert.equal((await probeFileOnWeb('X', web('503 Service Temporarily Unavailable', { status: 503 }))).status, 'unknown');
  assert.equal((await probeFileOnWeb('X', web('Đã có lỗi xảy ra'))).status, 'unknown');
  assert.equal((await probeFileOnWeb('X', web('Dịch vụ lưu trữ và chia sẻ trực tuyến', { url: 'https://www.fshare.vn/' }))).status, 'unknown');
  // A forwarded file lands on another code's page with a real name: not this link.
  assert.equal((await probeFileOnWeb('X', web('Other.mkv - Fshare', { url: 'https://www.fshare.vn/file/Y?token=1' }))).status, 'unknown');

  // A folder keeps its own URL either way; the slogan there is the dead answer.
  const folderPage = (title, status = 200) => web(title, { status, url: 'https://www.fshare.vn/folder/F?token=1' });
  assert.equal((await probeFolderOnWeb('F', folderPage('Dịch vụ lưu trữ và chia sẻ trực tuyến'))).status, 'dead');
  const liveFolder = await probeFolderOnWeb('F', folderPage('Fshare - My Sole Desire 2023 - Fshare'));
  assert.deepEqual([liveFolder.status, liveFolder.name], ['live', 'My Sole Desire 2023']);
  assert.equal((await probeFolderOnWeb('F', folderPage('503 Service Temporarily Unavailable', 503))).status, 'unknown');
});

test('search finds a file by the folders above it, and results group under the holding folder', () => {
  const db = normalizeMovieDatabase({
    version: 1,
    links: [
      { id: 'fshare-folder-ROOT', kind: 'folder', code: 'ROOT', name: 'KHO PHIM', status: 'live' },
      { id: 'fshare-folder-A', kind: 'folder', code: 'A', name: 'Dune (2021)', status: 'live', parents: ['fshare-folder-ROOT'], children: { files: 3 } },
      { id: 'fshare-file-B', kind: 'file', code: 'B', name: 'Dune.2021.2160p.mkv', size: 100, status: 'live', parents: ['fshare-folder-A'] },
      { id: 'fshare-file-B2', kind: 'file', code: 'B2', name: 'Dune.2021.1080p.mkv', size: 200, status: 'dead', parents: ['fshare-folder-A'] },
      { id: 'fshare-folder-C', kind: 'folder', code: 'C', name: 'Dune (1984)', status: 'live', aliases: ['Xứ Cát'], parents: ['fshare-folder-ROOT'] },
      { id: 'fshare-file-D', kind: 'file', code: 'D', name: 'Some.Release.Group.mkv', status: 'live', parents: ['fshare-folder-C'] },
      { id: 'fshare-file-E', kind: 'file', code: 'E', name: 'Standalone.Dune.mkv', status: 'live' }
    ]
  });
  const byId = indexById(db.links);
  assert.deepEqual(folderChain(byId.get('fshare-file-D'), byId), ['KHO PHIM', 'Dune (1984)']);
  // A file named for its release group is found through its folder's name.
  const hits = searchMovieLinks(db.links, 'dune 1984', { kind: 'file', byId });
  assert.deepEqual(hits.map((r) => r.code), ['D']);
  assert.equal(searchMovieLinks(db.links, 'dune', { kind: 'file' }).length, 3, 'without the map only file names match');
  assert.equal(searchMovieLinks(db.links, 'dune', { kind: 'file', byId }).length, 4);
  assert.deepEqual(searchMovieLinks(db.links, 'dune', { kind: 'file', byId }).map((r) => r.code), ['D', 'E', 'B', 'B2'], 'search results sort by size ascending');
  assert.deepEqual(searchMovieLinks(db.links, 'dune 2021', { kind: 'all', byId }).map((r) => [r.kind, r.code]), [
    ['folder', 'A'], ['file', 'B'], ['file', 'B2']
  ], 'a title search includes its folder and sorts all results by size ascending');

  const groups = groupByFolder(searchMovieLinks(db.links, 'dune', { kind: 'file', byId }), byId);
  assert.deepEqual(groups.map((g) => [g.chain.join(' › ') || '(standalone)', g.links.length]), [
    ['(standalone)', 1], ['KHO PHIM › Dune (1984)', 1], ['KHO PHIM › Dune (2021)', 2]
  ]);
  assert.deepEqual(groups[2].links.map((r) => r.code), ['B', 'B2'], 'files in a search group sort by size ascending');
  assert.equal(groups[2].folder.children.files, 3, 'the group carries its folder row');
  assert.equal(searchMovieLinks(db.links, '', { status: 'dead' }).length, 1);

  // The prebuilt index is a cache of the same haystack, never a different answer.
  const index = buildSearchIndex(db.links, (row) => movieHaystack(row, byId));
  for (const query of ['dune 1984', 'xu cat', 'release']) {
    assert.deepEqual(
      searchMovieLinks(db.links, query, { kind: 'file', byId, index }).map((r) => r.code),
      searchMovieLinks(db.links, query, { kind: 'file', byId }).map((r) => r.code), query);
  }
  assert.deepEqual(groupByFolder(hits, byId, index).map((g) => g.links.map((r) => r.code)), [['D']]);
  // Narrowing is only safe when the new matches are a subset of the old ones.
  assert.ok(narrowsSearch('dun', 'dune') && narrowsSearch('dune', 'dune 1984') && narrowsSearch('', 'x'));
  assert.ok(!narrowsSearch('dune', 'dun') && !narrowsSearch('dune 1984', 'dune'));
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

test('parallel shards are deterministic, disjoint, and preserve remote metadata', async () => {
  const catalog = {
    links: [
      { id: 'fshare-file-BBBB', kind: 'file', code: 'BBBB', name: 'B', status: 'pending' },
      { id: 'fshare-file-AAAA', kind: 'file', code: 'AAAA', name: 'A', status: 'pending' },
      { id: 'fshare-file-LIVE', kind: 'file', code: 'LIVE', name: 'already checked', status: 'live' },
      { id: 'fshare-folder-FOLD', kind: 'folder', code: 'FOLD', name: 'folder', status: 'pending' }
    ]
  };
  const first = selectRows(catalog, { kind: 'file', statuses: ['pending'], shardIndex: 0, shardCount: 2, limit: 10 });
  const second = selectRows(catalog, { kind: 'file', statuses: ['pending'], shardIndex: 1, shardCount: 2, limit: 10 });
  assert.deepEqual(first.shardRows.map((row) => row.code), ['AAAA']);
  assert.deepEqual(second.shardRows.map((row) => row.code), ['BBBB']);
  assert.throws(() => parseArgs(['--catalog', 'c.json', '--output', 'o.json', '--kind', 'all']), /folders are crawled/);
  assert.throws(() => parseArgs(['--catalog', 'c.json', '--output', 'o.json', '--kind', 'folder']), /folders are crawled/);

  const result = await probeRow(first.selected[0], {
    fetcher: async () => ({
      ok: true,
      json: async () => ({ current: {
        id: 'remote-aaaa', linkcode: 'AAAA', type: 1, name: 'A (2007).mkv', size: '5 MB', path: 'Movies/A'
      }, items: [] })
    })
  });
  assert.equal(result.status, 'live');
  assert.equal(result.size, 5 * 1024 * 1024);
  assert.equal(result.remote.id, 'remote-aaaa');
  assert.equal(result.probe.attempts, 1);

  // A proxy 404 asks fshare.vn before it is written as dead, and the answer rides along.
  const notFound = async () => ({ ok: false, status: 404 });
  const dead = await probeRow(second.selected[0], { fetcher: notFound, webProbe: async () => ({ status: 'dead', error: 'Không tìm thấy - Fshare', via: 'web' }) });
  assert.deepEqual([dead.status, dead.via, dead.web.status], ['dead', 'probe', 'dead']);
  const forwarded = await probeRow(second.selected[0], { fetcher: notFound, webProbe: async () => ({ status: 'live', name: 'B.mkv', via: 'web' }) });
  assert.deepEqual([forwarded.status, forwarded.via, forwarded.name], ['live', 'web', 'B.mkv']);
});

test('shard results merge by immutable id and cannot change a different row', () => {
  const catalog = buildCatalog([{ file: 'l.txt', text: 'A https://www.fshare.vn/file/AAAA0001', updatedAt: NOW }], {}, null, NOW);
  const row = catalog.links[0];
  const checkedAt = '2026-09-12T01:00:00.000Z';
  assert.deepEqual(mergeShardResults(catalog, {
    kind: 'fshare-movie-shard-results',
    rows: [{
      id: row.id,
      kind: row.kind,
      code: row.code,
      status: 'live',
      checkedAt,
      name: 'A (2007).mkv',
      size: 42,
      path: 'Movies/A',
      remote: { id: 'remote-a', size: 42 },
      probe: { attempts: 1 }
    }]
  }, checkedAt), { merged: 1 });
  assert.equal(row.status, 'live');
  assert.equal(row.size, 42);
  assert.equal(row.remote.id, 'remote-a');
  assert.equal(row.probe.attempts, 1);
  assert.throws(() => mergeShardResults(catalog, {
    kind: 'fshare-movie-shard-results',
    rows: [{ id: row.id, kind: row.kind, code: 'OTHER0001', status: 'live' }]
  }), /does not match catalog/);
  // Merge is where the two 2026-09-16 mistakes are refused: a probed folder
  // (live with nothing listed) and a dead row on the proxy's word alone.
  assert.throws(() => mergeShardResults(catalog, {
    kind: 'fshare-movie-shard-results',
    rows: [{ id: row.id, kind: row.kind, code: row.code, status: 'dead', via: 'probe', error: 'HTTP 404' }]
  }), /second opinion/);
  assert.equal(row.status, 'live', 'a refused shard changes nothing');
  const folders = buildCatalog([{ file: 'l.txt', text: 'D https://www.fshare.vn/folder/DIR00001', updatedAt: NOW }], {}, null, NOW);
  assert.throws(() => mergeShardResults(folders, {
    kind: 'fshare-movie-shard-results',
    rows: [{ id: folders.links[0].id, kind: 'folder', code: 'DIR00001', status: 'live', via: 'probe' }]
  }), /never probed/);
  assert.equal(mergeShardResults(catalog, {
    kind: 'fshare-movie-shard-results',
    rows: [{ id: row.id, kind: row.kind, code: row.code, status: 'dead', via: 'probe', error: 'HTTP 404', web: { status: 'unknown', error: 'HTTP 503' } }]
  }, checkedAt).merged, 1, 'web unknown is accepted and left for the next run');
  assert.deepEqual([row.status, row.web.status], ['dead', 'unknown']);
});
