import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');

test('FShare parser accepts proxy links as well as native folder links', async () => {
  const api = await import(`${pathToFileURL(path.join(root, 'public/fshare-tool/lib/api.js')).href}?parser-test=1`);

  assert.equal(api.extractLinkcode('https://fshare.annnekkk.com/R9QLIGGPYCICTVL'), 'R9QLIGGPYCICTVL');
  assert.equal(api.extractLinkcode('https://fshare.annnekkk.com/folder/R9QLIGGPYCICTVL'), 'R9QLIGGPYCICTVL');
  assert.equal(api.extractLinkcode('https://fshare.annnekkk.com/api/folder?linkcode=R9QLIGGPYCICTVL'), null);
  assert.deepEqual(api.extractAllLinkcodes(
    'https://fshare.annnekkk.com/R9QLIGGPYCICTVL\nhttps://www.fshare.vn/folder/ABCDEFGH12345678'
  ), ['R9QLIGGPYCICTVL', 'ABCDEFGH12345678']);
});

test('FShare transport requests the current folder API shape', async () => {
  const api = await import(`${pathToFileURL(path.join(root, 'public/fshare-tool/lib/api.js')).href}?transport-test=1`);
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return {
      ok: true,
      json: async () => ({
        items: [{ linkcode: 'FILECODE', name: 'episode.mkv', type: 1 }],
        current: { linkcode: 'R9QLIGGPYCICTVL' },
        _links: { last: '/v3/files/folder?page=1' }
      })
    };
  };

  try {
    const result = await api.apiFolder('R9QLIGGPYCICTVL', 1, 'type,name');
    assert.equal(result.items[0].linkcode, 'FILECODE');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url,
      'https://fshare.annnekkk.com/api/folder?linkcode=R9QLIGGPYCICTVL&sort=type%2Cname&page=1');
    assert.equal(calls[0].options.cache, 'no-store');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('tool bootstrap keeps FShare allowed after route navigation and exposes failures', async () => {
  const [config, surface] = await Promise.all([
    readFile(path.join(root, 'nuxt.config.ts'), 'utf8'),
    readFile(path.join(root, 'app/components/StaticToolSurface.client.vue'), 'utf8')
  ]);

  assert.match(config, /connect-src 'self' https:\/\/fshare\.annnekkk\.com/);
  assert.match(surface, /Loading tool/);
  assert.match(surface, /Could not mount the tool surface/);
  assert.match(surface, /finally \{/);

  const page = await readFile(path.join(root, 'app/pages/fshare-tool.vue'), 'utf8');
  assert.match(page, /<ClientOnly>/);
  assert.match(page, /Loading Fshare tool/);
});
