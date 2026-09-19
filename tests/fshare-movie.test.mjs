import assert from 'node:assert/strict';
import test from 'node:test';

import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  auditCatalog, buildCatalog, createListingFetcher, markEmptyFolders, parseCsv, parseRawSource, probeFile, probeFileOnWeb,
  probeFolderOnWeb, mergeShardResults, projectCatalog, readCatalogSnapshot, recountChildren, selectEntries, shardFile, shardOf,
  sourceId, isUnverifiedDead, writeCatalogFile, EMPTY_LISTING, SHARDS
} from '../tools/fshare-movie.mjs';
import { parseArgs, probeRow, selectRows } from '../tools/fshare-movie-shard.mjs';
import {
  buildSearchIndex, categoryOf, extractFshareLinks, folderChain, groupByFolder, indexById, isAdultContent, keywordTokens, matchMovieLinks,
  matchRanges, movieHaystack, narrowsSearch, normalizeMovieDatabase, rankFolderGroups, searchMovieLinks, sortMovieRows, titleKey
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

test('categoryOf trusts the extension first, falls back to name markers, and never trusts a bare genre word', () => {
  assert.equal(categoryOf('Dune.2021.2160p.mkv'), 'movie');
  assert.equal(categoryOf('01. Track One.flac'), 'music');
  assert.equal(categoryOf('Adobe.Photoshop.2024.apk'), 'software');
  assert.equal(categoryOf('Adobe Photoshop CS6 Multilingual.rar'), 'software');
  assert.equal(categoryOf('Star.Wars.Jedi.Fallen.Order-CODEX.iso'), 'software');
  assert.equal(categoryOf('Crack.rar'), 'software');
  assert.equal(categoryOf('Vết Nứt Ám Hồn Trong Tranh - Cracked 2022'), 'movie', 'a real film — "cracked" must not match "crack"');
  assert.equal(categoryOf('01 - Track One - Some Artist FLAC.rar'), 'music');
  assert.equal(categoryOf('LVCD 339 - Lien Khuc Xuan - CD1.zip'), 'music');
  // Real catalog names that a naive keyword scan mis-bucketed during tuning:
  // generic English words in the title collide with generic software/game
  // markers once a row has no video extension to short-circuit the scan.
  assert.equal(categoryOf('Taxi Driver (1976)'), 'movie');
  assert.equal(categoryOf('Missing in Action (1984)'), 'movie');
  assert.equal(categoryOf('The Portable Door 2023'), 'movie');
  assert.equal(categoryOf('The.Office.U.S.S06E13.1080p.mkv'), 'movie');
  // "remastered" alone is dropped as a marker (movies, games and music all
  // use it), so an unrecognised release-group tag with no other signal
  // defaults to movie — a missed software row, never a stolen movie one.
  assert.equal(categoryOf('Marvels.Spider-Man.Remastered-FPC.iso'), 'software', '-FPC is a Vietnamese game-repack tag');
  // Underscores are word characters: without folding them these two never
  // reached their markers. The Revit house is a design work file (document);
  // the Anhdv boot USB is a tool (software).
  assert.equal(categoryOf('1_Revit_NHA PHO_2tang_4.7x15m_tailieukientruc.net.rar'), 'document');
  assert.equal(categoryOf('1_Click_Anhdv_Boot1.1.7z'), 'software');
  assert.equal(categoryOf('.Office.Pro.Plus.2019.0.11929.20300.32BIT.ISO'), 'software');
  assert.equal(categoryOf('Corner Office - Corner Office 2023'), 'movie', 'a TV series — only Microsoft Office versions count');
  assert.equal(categoryOf('0. Dossier Vimectin Chewable PDF.rar'), 'document');
  assert.equal(categoryOf('Ronaldinho The One and Only S01 2026 - phim Tài Liệu 3 tập SV'), 'movie', '"phim tài liệu" is a documentary');
  assert.equal(categoryOf('2.Foxit PDF Editor Pro 12.0.1.12430.rar'), 'software', 'a PDF editor is not a PDF');
  // The archive tier: the same bare words are music inside a .rar/.zip and
  // titles when the name stands alone.
  assert.equal(categoryOf('00 - Rock Viet.zip'), 'music');
  assert.equal(categoryOf('Mariya Takeuchi - Morning Glory (1990 RCA-Japan)(1).rar'), 'music');
  assert.equal(categoryOf('The Rock (1996)'), 'movie');
  assert.equal(categoryOf('Guardians of the Galaxy Vol 3 (2023)'), 'movie');
  assert.equal(categoryOf('Kill.Bill.Vol.1.2003.UHD.BluRay.2160p.HEVC.DTS-HD.MA5.1-CHDBits.iso'), 'movie', 'release tags win before the archive tier');
  assert.equal(categoryOf('Quỷ Lùn Tinh Nghịch 3 Đồng Tâm Hiệp Nhạc - Trolls Band Together 2023'), 'movie', 'bare "nhạc" sits in many film titles');
  assert.equal(categoryOf('25 CD Nhạc Xuân'), 'music');
  assert.equal(categoryOf('60 - Larry Young - Unity 1966 .rar'), 'music', '"Unity" the album, not the engine');
});

test('isAdultContent trusts studio/site names and explicit acts, never a bare provocative word', () => {
  assert.equal(isAdultContent('blacked.24.01.13.emma.rosie.training.day.4k.mp4'), true);
  assert.equal(isAdultContent('[Tushy.2023.08.27] Eliza Ibarra - Anal Obsessed.mp4'), true);
  assert.equal(isAdultContent('Elvis XXX A Porn Parody.mp4'), true);
  assert.equal(isAdultContent('The Gangbang Girl 20 (Erica Bella Mercedesz).mp4'), true);
  assert.equal(isAdultContent('Vixen.2026.04.17 Eve Sweet - Super Hot Wedding Guest.mp4'), true);
  // Real titles that collide with adult vocabulary once a name-only scan has
  // no video-extension short-circuit to lean on — each found by checking
  // real hits in the 2026-09-18 catalog, not guessed:
  assert.equal(isAdultContent('Stepmom (1998)'), false);
  assert.equal(isAdultContent('Hardcore Henry (2015)'), false);
  assert.equal(isAdultContent('My.Royal.Nemesis.S01E01.The.Vixen.and.the.Beast.1080p.mkv'), false, 'a K-drama episode, not the Vixen studio');
  assert.equal(isAdultContent('Tìm Lại Chính Mình - Threesome - S01E01 S01E02 - Jade Thr33s0m3 2018 ViE PPhim.mkv'), false, 'literally titled Threesome — episode numbering guards it');
  assert.equal(isAdultContent('xXx.Return.of.Xander.Cage.2017.MULTI.COMPLETE.UHD.BLURAY-EXTREME.iso'), false);
  assert.equal(isAdultContent('Orgasm Inc The Story of OneTaste (2022)'), false, 'an HBO documentary');
  assert.equal(isAdultContent('The Year I Started Masturbating (2022)'), false, 'a Cannes-selected Swedish documentary');
  assert.equal(isAdultContent("Dont.Fuck.in.the.Woods.2016.Remux.1080i.USA.Blu-ray.MPEG-2.LPCM.2.0.m2ts"), false, 'a real horror franchise');
  assert.equal(isAdultContent('A Woman Who Swallowed the Sun (2025)'), false);
  assert.equal(isAdultContent('The End of the Fucking World S02'), false, 'the Netflix show — S02 alone has no episode number for SERIES_GUARD to catch');
  // A folder cascades onto everything under it (move-to-x), so a folder's
  // bare "XXX" — found for real holding nothing but Paris By Night discs —
  // must not be enough on its own to drag real content down with it.
  assert.equal(isAdultContent('- - Paris by night Clollection 001 - XXX Update', { strict: true }), false);
  assert.equal(isAdultContent('- - Paris by night Clollection 001 - XXX Update'), true, 'the same name is fine for a file, which has no children to drag down');
  assert.equal(isAdultContent('Marc Dorcel - Russian Institute', { strict: true }), true, 'a real studio name still counts strict');
  // JAV codes, Japanese/Chinese studios and Vietnamese explicit tags — the
  // bulk of what the first pass missed (~1,600 rows), plus the underscore
  // fold that hid "1pondo" in "Momota_1pondo_sh".
  assert.equal(isAdultContent('SSNI-757_HAY.mp4'), true);
  assert.equal(isAdultContent('JUQ-915_NOI DUNG HAY_CHI NHAN VIEN DAM LOAN CAC NHAN VIEN.mp4'), true);
  assert.equal(isAdultContent('230ORECO-903 HAY CHICH EM GAI NHAN VIEN CONG SO.mp4'), true);
  assert.equal(isAdultContent('1-010520_955_Emiri_Momota_1pondo_sh.mp4'), true);
  assert.equal(isAdultContent('Seduce_My_Tutor_MD-0134__色诱我的家教老师_-_Model_Media_Asia.mp4'), true);
  assert.equal(isAdultContent('pornworld.23.05.07.hazel.moore.4k.mp4'), true, 'site.YY.MM.DD.performer');
  assert.equal(isAdultContent('DV-1387.mp4'), true, 'a two-letter code is enough when the code is the whole name');
  assert.equal(isAdultContent('Dit Nhau Trong Toilet.mp4'), true);
  assert.equal(isAdultContent('MB-2019.zip'), false, 'two letters, an archive: a real software dump');
  assert.equal(isAdultContent('Star.Trek.Deep.Space.Nine.S07E08.The.Siege.of.AR-558.NF.WEB-DL.mkv'), false);
  assert.equal(isAdultContent('DSD-512 Rhapsody In Blue 1924.dsf'), false, 'a music catalogue number');
  assert.equal(isAdultContent('Outer Banks lồn tiếng từ netflix'), false, 'a typo of "lồng tiếng" (dubbed)');
  assert.equal(isAdultContent('Bad.Luck.Banging.or.Loony.Porn.2021 18+'), false, 'a Berlinale winner');
  assert.equal(isAdultContent('Porno 2013 1080p HC WEB-DL AAC2 0 x264-RSG_Engsub.LK.mkv'), false, 'release tags beside a weak word mean a film');
  assert.equal(isAdultContent('Nữ Chủ Nhà Dâm Đãng - Paupahan 2023', { strict: true }), false, 'a Vivamax feature — weak words never cascade a folder');
  assert.equal(isAdultContent('Co Vo Dam Dang HD.mp4'), true);
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
  catalog.links[1].category = 'software';
  let projection = projectCatalog(catalog, NOW);
  assert.equal(projection.validated, false, 'one row is still pending');
  assert.deepEqual(projection.links.map((row) => row.status), ['dead', 'live']);
  // The envelope carries what the tab renders and nothing it can rebuild:
  // remote snapshots, paths and keywords were 39MB of a 70MB projection.
  for (const field of ['remote', 'path', 'keywords', 'id', 'titleKey', 'error', 'firstSeenAt']) {
    assert.ok(!(field in projection.links[0]), `${field} stays in the catalog`);
  }
  assert.equal(projection.links[0].category, 'software', 'a non-default category rides along');
  assert.ok(!('category' in projection.links[1]), 'a default movie category is not shipped — it costs bytes on almost every row');
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
  // A crawled folder that lists nothing is dead by its own listing — and
  // that answer came from the API, so it needs no fshare.vn second opinion.
  const sub = catalog.links.find((row) => row.code === 'SUB1');
  sub.children = { crawledAt: NOW, folders: 0, files: 0 };
  assert.equal(markEmptyFolders(catalog, NOW), 1);
  assert.deepEqual([sub.status, sub.via, sub.error, sub.deadSince], ['dead', 'listing', EMPTY_LISTING, NOW]);
  assert.equal(root.status, 'pending', 'a folder with children is untouched');
  assert.equal(isUnverifiedDead(sub), false);
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
  // A clean 404/410 is conclusive on its own — fshare.vn's router refusing the
  // code outright (e.g. a malformed code a raw source had fused to title text).
  assert.equal((await probeFileOnWeb('X', web('Not Found', { status: 404 }))).status, 'dead');
  assert.equal((await probeFileOnWeb('X', web('Gone', { status: 410 }))).status, 'dead');
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
      { id: 'fshare-file-E', kind: 'file', code: 'E', name: 'Standalone.Dune.mkv', status: 'live' },
      { id: 'fshare-file-F', kind: 'file', code: 'F', name: 'Adobe Photoshop CS6.rar', category: 'software', status: 'live' }
    ]
  });
  const byId = indexById(db.links);
  assert.deepEqual(folderChain(byId.get('fshare-file-D'), byId), ['KHO PHIM', 'Dune (1984)']);
  // A file named for its release group is found through its folder's name.
  const hits = searchMovieLinks(db.links, 'dune 1984', { kind: 'file', byId });
  assert.deepEqual(hits.map((r) => r.code), ['D']);
  assert.equal(searchMovieLinks(db.links, 'dune', { kind: 'file' }).length, 3, 'without the map only file names match');
  assert.equal(searchMovieLinks(db.links, 'dune', { kind: 'file', byId }).length, 4);
  assert.deepEqual(searchMovieLinks(db.links, 'dune', { kind: 'file', byId }).map((r) => r.code), ['B2', 'B', 'D', 'E'], 'search results are in name order, numeric-aware');
  // Search is files only: a folder is the head its files sit under, never a
  // result — every folder was crawled, so a folder row would only be a click
  // to find out what it held. A file with no name match still surfaces
  // through the alias of a folder above it.
  assert.deepEqual(searchMovieLinks(db.links, 'dune 2021', { kind: 'file', byId }).map((r) => r.code), ['B2', 'B']);
  assert.deepEqual(searchMovieLinks(db.links, 'xu cat', { kind: 'file', byId }).map((r) => r.code), ['D'], 'a folder alias reaches its files');
  assert.ok(!('keywords' in db.links[0]), 'no keyword list on a row: the haystack already holds that text');
  // The Movie/Software/Music/Document tabs are one database filtered by `category`.
  assert.deepEqual(matchMovieLinks(db.links, '', { kind: 'file', category: 'software' }).map((r) => r.code), ['F']);
  assert.ok(!matchMovieLinks(db.links, '', { kind: 'file', category: 'movie' }).some((r) => r.code === 'F'));

  // The view matches without sorting and ranks GROUPS: a folder whose own
  // name carries every token first, then folders reached through a file's
  // name; a group's rows are sorted only when rendered.
  const ranking = buildSearchIndex(db.links, (row, above) => movieHaystack(row, byId, above));
  const matches = matchMovieLinks(db.links, 'dune', { kind: 'file', byId, index: ranking });
  assert.deepEqual(matches.map((r) => r.code), ['B', 'B2', 'D', 'E'], 'catalog order, unsorted');
  const ranked = rankFolderGroups(matches, 'dune', byId, ranking);
  assert.deepEqual(ranked.map((g) => [g.folder ? g.folder.name : '(direct)', g.score]), [
    ['Dune (1984)', 4], ['Dune (2021)', 5], ['(direct)', 1]
  ].sort((a, b) => b[1] - a[1]), 'folders named for the query outrank a standalone file that merely contains it');
  assert.equal(rankFolderGroups(matches, '', byId, ranking).every((g) => g.score === 0), true, 'no query, no ranking — name order');

  // Highlight offsets come from a length-preserving fold, so "phap su" lands
  // on "Pháp Sư" in the original and never mid-character.
  assert.deepEqual(matchRanges('Frieren Pháp Sư Tiễn Táng - Sousou no Frieren', ['frieren', 'phap su']), [[0, 7], [8, 15], [38, 45]]);
  assert.deepEqual(matchRanges('Đường về', ['duong']), [[0, 5]]);
  assert.deepEqual(matchRanges('abcabc', ['abc', 'bca']), [[0, 6]], 'overlapping tokens merge');

  const groups = groupByFolder(searchMovieLinks(db.links, 'dune', { kind: 'file', byId }), byId);
  assert.deepEqual(groups.map((g) => [g.chain.join(' › ') || '(standalone)', g.links.length]), [
    ['(standalone)', 1], ['KHO PHIM › Dune (1984)', 1], ['KHO PHIM › Dune (2021)', 2]
  ]);
  assert.deepEqual(groups[2].links.map((r) => r.code), ['B2', 'B'], 'files in a group read in name order: 1080p before 2160p');
  // An episode folder reads as the owner listed it, not by file size.
  const episodes = [
    { name: 'Tập 10.mkv', size: 1, code: 'T10' }, { name: 'Tập 2.mkv', size: 9, code: 'T2' }, { name: 'Tập 1.mkv', size: 5, code: 'T1' }
  ];
  assert.deepEqual(sortMovieRows(episodes).map((r) => r.code), ['T1', 'T2', 'T10']);
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

test('the catalog is sharded on disk, rotated in atomically, and a single-file catalog migrates', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'gazll-movie-'));
  const header = path.join(dir, 'catalog.json');
  const text = Array.from({ length: 40 }, (_, i) => `Film ${i} https://www.fshare.vn/file/ROW${String(i).padStart(4, '0')}`).join('\n');
  const catalog = buildCatalog([{ file: 'l.txt', text, updatedAt: NOW }], {}, null, NOW);
  catalog.links[0].keywords = ['legacy'];

  // The pre-2026-09-17 layout: one file carrying `links`. It loads as is.
  await writeFile(header, JSON.stringify(catalog), 'utf8');
  const legacy = await readCatalogSnapshot(header, { log: () => {} });
  assert.equal(legacy.catalog.links.length, 40);
  assert.ok(!('keywords' in legacy.catalog.links[0]), 'keywords is dropped on load');

  // The next save writes the header without rows and one file per shard.
  await writeCatalogFile(header, legacy.catalog);
  const written = JSON.parse(await readFile(header, 'utf8'));
  assert.ok(!('links' in written) && written.shards === SHARDS, 'the header names its shards and holds no rows');
  assert.ok((await readdir(path.dirname(shardFile(header, 0)))).filter((f) => /^links-\d\d\.json$/.test(f)).length === SHARDS);
  assert.ok(await readFile(`${header}.bak`, 'utf8'), 'the single file survives one save behind');
  const shard0 = JSON.parse(await readFile(shardFile(header, 0), 'utf8'));
  assert.ok(shard0.every((row) => shardOf(row.id) === 0), 'a row sits in the shard its id hashes to');

  const first = await readCatalogSnapshot(header, { log: () => {} });
  assert.deepEqual(first.catalog.links.map((r) => r.id).sort(), legacy.catalog.links.map((r) => r.id).sort(), 'every row round-trips');
  assert.notEqual(first.digest, legacy.digest, 'the digest covers what was read, so a save changes it');

  // A second save keeps the previous shard as .bak, and a truncated live
  // shard is read from it — a crash mid-checkpoint loses at most one save.
  first.catalog.links[0].status = 'live';
  await writeCatalogFile(header, first.catalog);
  const shard = shardFile(header, shardOf(first.catalog.links[0].id));
  assert.ok(await readFile(`${shard}.bak`, 'utf8'));
  await writeFile(shard, '[\n{"id":"fshare-file-', 'utf8');
  const warnings = [];
  const recovered = await readCatalogSnapshot(header, { log: (line) => warnings.push(line) });
  assert.equal(recovered.catalog.links.length, 40, 'the .bak shard fills in for the cut one');
  assert.match(warnings[0], /unreadable .* using .*\.bak/);
});
