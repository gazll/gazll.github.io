import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

/* CI used to enumerate test files by hand in deploy.yml, and two of them were
   never run because the list drifted. check.mjs discovers them from disk; this
   pins that the workflow keeps delegating rather than re-growing a list. */
test('CI delegates to tools/check.mjs instead of enumerating test files', async () => {
  const workflow = await readFile(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
  const testFiles = (await readdir(path.join(root, 'tests'))).filter(name => name.endsWith('.test.mjs'));

  assert.ok(testFiles.length > 0);
  assert.match(workflow, /node tools\/check\.mjs/);
  for (const name of testFiles) {
    assert.ok(!workflow.includes(name),
      `deploy.yml names ${name} directly — let check.mjs discover it instead`);
  }
});

test('every check stage is reachable through --only', async () => {
  const source = await readFile(path.join(root, 'tools/check.mjs'), 'utf8');
  const workflow = await readFile(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
  const names = [...source.matchAll(/\{ name: '([a-z]+)'/g)].map(match => match[1]);

  assert.deepEqual(names, ['content', 'syntax', 'console', 'tests']);
  // The post-stamp re-parse depends on this exact stage name.
  const only = workflow.match(/check\.mjs --only ([a-z]+)/);
  assert.ok(only && names.includes(only[1]), 'deploy.yml runs an unknown --only stage');
});

/* Vendored code is upstream output pinned by directory name: linting it proves
   nothing, and the console-logging ban would trip on its own debug output. */
test('checks skip vendored third-party code', async () => {
  const source = await readFile(path.join(root, 'tools/check.mjs'), 'utf8');
  const occurrences = source.match(/vendor/g) || [];
  assert.ok(occurrences.length >= 2, 'both the syntax and console stages must skip vendor/');
});
