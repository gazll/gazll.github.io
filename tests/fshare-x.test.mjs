import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  applyValidationReport, buildXCatalog, projectXCatalog
} from '../tools/fshare-x.mjs';
import { normalizeXDatabase, searchXLinks } from '../public/fshare-tool/lib/x-db.js';

const NOW = '2026-09-12T00:00:00.000Z';

test('X catalog is independent, searchable, and carries root-check results', () => {
  const catalog = buildXCatalog([{
    file: 'x.csv',
    text: [
      'Folder,https://www.fshare.vn/folder/XFOLDER01',
      'A 2007,https://www.fshare.vn/file/XFILE001',
      'Another,https://www.fshare.vn/file/XFILE002'
    ].join('\n'),
    updatedAt: NOW
  }], {}, null, NOW);

  assert.equal(catalog.kind, 'fshare-x-catalog');
  assert.equal(catalog.links.length, 3);
  assert.ok(catalog.links.every((row) => row.status === 'raw'));
  applyValidationReport(catalog, {
    kind: 'fshare-x-validation-report',
    completedAt: NOW,
    policy: { scope: 'Root links only; no folder traversal and no child probing.' },
    results: [
      { kind: 'folder', code: 'XFOLDER01', status: 'live', checkedAt: NOW },
      { kind: 'file', code: 'XFILE001', status: 'dead', checkedAt: NOW, error: 'Not found' }
    ]
  });

  assert.deepEqual(catalog.validation, {
    ok: false,
    total: 3,
    folders: 1,
    files: 2,
    raw: 1,
    live: 1,
    dead: 1,
    unknown: 0,
    lastRunAt: NOW,
    scope: 'Root links only; no folder traversal and no child probing.'
  });
  const projection = projectXCatalog(catalog, NOW);
  assert.equal(projection.kind, 'fshare-x-db');
  assert.equal(projection.catalogType, 'x');
  assert.equal(projection.validated, false);
  assert.equal(projection.links.length, 3);
  assert.equal(normalizeXDatabase(projection).links.find((row) => row.code === 'XFILE001').status, 'dead');
  assert.deepEqual(searchXLinks(normalizeXDatabase(projection).links, '2007').map((row) => row.code), ['XFILE001']);
});

test('Movie shell exposes X as a separate dataset instead of merging catalogs', async () => {
  const shell = await readFile(path.resolve('public/shells/fshare-tool.html'), 'utf8');
  const xDb = await readFile(path.resolve('public/fshare-tool/lib/x-db.js'), 'utf8');
  const movieView = await readFile(path.resolve('public/fshare-tool/views/movie.js'), 'utf8');
  assert.match(shell, /data-movie-type="movie"/);
  assert.match(shell, /data-movie-type="x"/);
  assert.match(xDb, /\/data\/fshare-x\/catalog\.enc\.json/);
  assert.match(movieView, /normalizeXDatabase/);
  assert.match(movieView, /searchXLinks/);
  assert.match(movieView, /movie\.databases/);
});
