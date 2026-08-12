import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const publicRoot = path.join(root, 'public');
const projectRoot = path.join(publicRoot, 'data/projects/calebzone');
const manifest = JSON.parse(await readFile(path.join(projectRoot, 'manifest.json'), 'utf8'));

test('CalebZone Project manifest exposes an SRS, source documents and implementation samples', async () => {
  assert.equal(manifest.version, 1);
  assert.equal(manifest.slug, 'calebzone');
  assert.equal(manifest.modules.length, 5);
  assert.ok(manifest.requirements.length >= 5);
  assert.ok(manifest.architecture.diagram.startsWith('flowchart TB\n'));
  assert.equal(new Set(manifest.documents.map(row => row.id)).size, manifest.documents.length);
  assert.equal(new Set(manifest.samples.map(row => row.id)).size, manifest.samples.length);

  for (const row of [...manifest.documents, ...manifest.samples]) {
    assert.match(row.file, /^projects\/calebzone\/(?:docs|samples)\/[a-z0-9-]+\.(?:md|java|xml|yml)$/);
    await access(path.join(publicRoot, 'data', row.file));
  }
});

test('published CalebZone samples do not contain the source JWT secret', async () => {
  const samples = await Promise.all(manifest.samples.map(row => readFile(path.join(publicRoot, 'data', row.file), 'utf8')));
  const all = samples.join('\n');
  assert.doesNotMatch(all, /tE0FaSVdbAa2FfFet9q9\+4Ct\+SSM6231/i);
});

test('Project menu and renderer are wired as a hash-routable view', async () => {
  const app = await readFile(path.join(publicRoot, 'app.js'), 'utf8');
  const view = await readFile(path.join(publicRoot, 'views/project.js'), 'utf8');
  const loader = await readFile(path.join(publicRoot, 'lib/project.js'), 'utf8');
  assert.match(app, /id: 'project', sec: 'experience'/);
  assert.match(app, /renderProject, mountProject/);
  assert.match(view, /ProjectDocs\.load\(\)/);
  assert.match(view, /renderSamples\(/);
  assert.match(view, /renderDocuments\(/);
  assert.match(loader, /data\/projects\/calebzone\/manifest\.json/);
});

test('Markdown project documents render headings, tables and escaped fenced code', async () => {
  const { renderMarkdown } = await import(pathToFileURL(path.join(publicRoot, 'lib/markdown.js')).href);
  const html = renderMarkdown('# Gateway\n\n| Path | Service |\n| --- | --- |\n| `/air` | Air |\n\n```java\n<script>alert(1)</script>\n```');
  assert.match(html, /<h1 id="gateway">Gateway<\/h1>/);
  assert.match(html, /<table class="md-table">/);
  assert.match(html, /<pre><code class="language-java">&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/code><\/pre>/);
  assert.doesNotMatch(html, /<script>/);
});
