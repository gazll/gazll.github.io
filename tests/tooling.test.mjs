import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import os from 'node:os';
import { readFile, readdir, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { stampAssets } from '../tools/stamp-assets.mjs';

const execFileAsync = promisify(execFile);

/* The build and release path: what CI runs, what a deploy stamps, and
   the generated Pages artifact it uploads.

   Merged from: tooling, assets.version.
   Each block keeps its own scope so fixtures and helpers cannot collide. */

// ---- from tooling.test.mjs ----
{
  const root = path.resolve(import.meta.dirname, '..');

  /* CI used to enumerate test files by hand in deploy.yml, and two of them were
     never run because the list drifted. check.mjs discovers them from disk; this
     pins that the workflow keeps delegating rather than re-growing a list. */
  test('CI delegates to tools/check.mjs instead of enumerating test files', async () => {
    const workflow = await readFile(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
    const testFiles = (await readdir(path.join(root, 'tests'))).filter(name => name.endsWith('.test.mjs'));

    assert.ok(testFiles.length > 0);
    assert.match(workflow, /node tools\/check\.mjs/);
    assert.match(workflow, /fetch-depth: 0/);
    assert.match(workflow, /stamp-content-dates\.mjs --check/);
    assert.match(workflow, /build-content-index\.mjs --check/);
    for (const name of testFiles) {
      assert.ok(!workflow.includes(name),
        `deploy.yml names ${name} directly — let check.mjs discover it instead`);
    }
  });

  test('every check stage remains reachable and CI generates Nuxt after checks', async () => {
    const source = await readFile(path.join(root, 'tools/check.mjs'), 'utf8');
    const workflow = await readFile(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
    const names = [...source.matchAll(/\{ name: '([a-z]+)'/g)].map(match => match[1]);

    assert.deepEqual(names, ['content', 'diagrams', 'syntax', 'console', 'tests']);
    assert.match(source, /flag\('--only'\)/);
    assert.match(workflow, /node tools\/check\.mjs[\s\S]+npm run generate/);
  });

  test('CI validates the generated Pages artifact after stamping and before upload', async () => {
    const workflow = await readFile(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
    const verifier = await readFile(path.join(root, 'tools/verify-static-artifact.mjs'), 'utf8');
    const stampAt = workflow.indexOf('- name: Stamp deploy version');
    const verifyAt = workflow.indexOf('- name: Verify deploy artifact');
    const uploadAt = workflow.indexOf('- uses: actions/upload-pages-artifact@v5');

    assert.ok(stampAt < verifyAt && verifyAt < uploadAt);
    assert.match(workflow, /node tools\/verify-static-artifact\.mjs \.output\/public/);
    for (const required of ['index.html', '404.html', '_nuxt', 'version.json']) {
      assert.match(verifier, new RegExp(required.replace('.', '\\.')));
    }
    assert.match(verifier, /isSymbolicLink/);
    assert.match(verifier, /--check/);
  });

  /* Vendored code is upstream output pinned by directory name: linting it proves
     nothing, and the console-logging ban would trip on its own debug output. */
  test('checks skip vendored third-party code', async () => {
    const source = await readFile(path.join(root, 'tools/check.mjs'), 'utf8');
    const occurrences = source.match(/vendor/g) || [];
    assert.ok(occurrences.length >= 2, 'both the syntax and console stages must skip vendor/');
  });

  test('content date stamping covers metadata, new files and check-only CI mode', async () => {
    const source = await readFile(path.join(root, 'tools/stamp-content-dates.mjs'), 'utf8');
    assert.match(source, /process\.argv\.includes\('--check'\)/);
    assert.match(source, /if \(!commits\.length\) return \{ created_at: today, updated_at: today \}/);
    assert.match(source, /topicMetaHistory = jsonRowsHistory/);
    assert.match(source, /caseMetaHistory = jsonRowsHistory/);
    assert.match(source, /projectHistory = jsonRowsHistory/);
    assert.match(source, /documentHistory = jsonRowsHistory/);
    assert.match(source, /interviewHistory = jsonRowsHistory/);
  });

  test('production generation minifies static lib modules without touching other assets', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'gazl-minify-libs-'));
    const publicRoot = path.join(directory, 'public');
    const libRoot = path.join(publicRoot, 'lib');
    const toolLibRoot = path.join(publicRoot, 'fshare-tool', 'lib');
    const vendorRoot = path.join(publicRoot, 'vendor');
    await mkdir(libRoot, { recursive: true });
    await mkdir(toolLibRoot, { recursive: true });
    await mkdir(vendorRoot, { recursive: true });
    await writeFile(path.join(libRoot, 'value.js'), '/* remove me */\nexport const value = 1;\n');
    await writeFile(path.join(toolLibRoot, 'tool.js'), 'export function tool() { return 2; }\n');
    const vendorSource = '/* keep vendored file untouched */\nexport const vendor = 3;\n';
    await writeFile(path.join(vendorRoot, 'vendor.js'), vendorSource);

    try {
      await execFileAsync(process.execPath, [
        path.join(root, 'tools/minify-static-libs.mjs'),
        publicRoot
      ], { cwd: root });
      const lib = await readFile(path.join(libRoot, 'value.js'), 'utf8');
      const toolLib = await readFile(path.join(toolLibRoot, 'tool.js'), 'utf8');
      const vendor = await readFile(path.join(vendorRoot, 'vendor.js'), 'utf8');
      assert.doesNotMatch(lib, /\/\*|\n/);
      assert.doesNotMatch(toolLib, /\/\*|\n/);
      assert.equal(vendor, vendorSource);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

// ---- from assets.version.test.mjs ----
{
  test('a deploy stamps HTML, the complete local module graph and version metadata with one commit id', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'gazl-assets-'));
    const publicRoot = path.join(directory, 'public');
    await mkdir(path.join(publicRoot, 'lib'), { recursive: true });
    await writeFile(path.join(publicRoot, 'index.html'),
      '<link rel="stylesheet" href="styles.css"><script type="module" src="boot.js"></script>');
    await writeFile(path.join(publicRoot, 'boot.js'), "import('./app.js');\n");
    await writeFile(path.join(publicRoot, 'app.js'),
      "import { value } from './lib/value.js';\nimport('./lazy.js');\nimport('https://example.com/remote.js');\n");
    await writeFile(path.join(publicRoot, 'lib/value.js'), "export const value = 1;\n");
    await writeFile(path.join(publicRoot, 'lazy.js'), "export default 1;\n");

    try {
      const revision = '1234567890abcdef1234567890abcdef12345678';
      const deployedAt = '2026-08-05T10:00:00.000Z';
      const version = await stampAssets({ publicRoot, revision, deployedAt });
      assert.equal(version, '1234567890ab');

      const html = await readFile(path.join(publicRoot, 'index.html'), 'utf8');
      const boot = await readFile(path.join(publicRoot, 'boot.js'), 'utf8');
      const app = await readFile(path.join(publicRoot, 'app.js'), 'utf8');
      const release = JSON.parse(await readFile(path.join(publicRoot, 'version.json'), 'utf8'));
      assert.match(html, /styles\.css\?v=1234567890ab/);
      assert.match(html, /boot\.js\?v=1234567890ab/);
      assert.match(boot, /app\.js\?v=1234567890ab/);
      assert.match(app, /\.\/lib\/value\.js\?v=1234567890ab/);
      assert.match(app, /\.\/lazy\.js\?v=1234567890ab/);
      assert.match(app, /https:\/\/example\.com\/remote\.js/);
      assert.doesNotMatch(app, /example\.com\/remote\.js\?v=/);
      assert.deepEqual(release, { version, revision, deployed_at: deployedAt });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('the static-tool surface resolves release metadata before loading its controller', async () => {
    const root = path.resolve(import.meta.dirname, '..');
    const bridge = await readFile(path.join(root, 'app/components/StaticToolSurface.client.vue'), 'utf8');
    const config = await readFile(path.join(root, 'nuxt.config.ts'), 'utf8');
    const workflow = await readFile(path.join(root, '.github/workflows/deploy.yml'), 'utf8');

    assert.match(bridge, /version\.json/);
    assert.match(bridge, /cache:\s*'no-store'/);
    assert.match(bridge, /controller\.searchParams\.set\('v'/);
    assert.match(config, /prerender/);
    assert.match(workflow, /npm run generate/);
    assert.match(workflow, /node tools\/stamp-assets\.mjs "\$GAZL_DEPLOY_SHA" \.output\/public/);
    assert.match(workflow, /path: \.output\/public/);

    const testsAt = workflow.indexOf('- name: Run checks');
    const generateAt = workflow.indexOf('- name: Generate Nuxt static site');
    const stampAt = workflow.indexOf('- name: Stamp deploy version');
    const uploadAt = workflow.indexOf('- uses: actions/upload-pages-artifact@v5');
    assert.ok(testsAt < generateAt, 'Nuxt generation must follow source regression tests');
    assert.ok(generateAt < stampAt, 'only the generated artifact should be stamped');
    assert.ok(stampAt < uploadAt, 'deploy assets must be stamped before the Pages upload');
  });
}
