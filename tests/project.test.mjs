import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const publicRoot = path.join(root, 'public');
const projectRoot = path.join(publicRoot, 'data/projects/calebzone');
const manifest = JSON.parse(await readFile(path.join(projectRoot, 'manifest.json'), 'utf8'));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

test('CalebZone Project manifest exposes an SRS, source documents and implementation samples', async () => {
  assert.equal(manifest.version, 1);
  assert.equal(manifest.slug, 'calebzone');
  assert.equal(manifest.modules.length, 5);
  assert.ok(manifest.requirements.length >= 5);
  assert.ok(manifest.architecture.diagram.startsWith('flowchart TB\n'));
  assert.equal(new Set(manifest.documents.map(row => row.id)).size, manifest.documents.length);
  assert.equal(new Set(manifest.samples.map(row => row.id)).size, manifest.samples.length);
  assert.match(manifest.created_at, ISO_DATE);
  assert.match(manifest.updated_at, ISO_DATE);

  for (const row of [...manifest.documents, ...manifest.samples]) {
    assert.match(row.file, /^projects\/calebzone\/(?:docs|samples)\/[a-z0-9-]+\.(?:md|java|xml|yml)$/);
    await access(path.join(publicRoot, 'data', row.file));
    assert.match(row.created_at, ISO_DATE, row.id + ': created_at');
    assert.match(row.updated_at, ISO_DATE, row.id + ': updated_at');
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
  assert.match(app, /id: 'project', sec: 'knowledge'/);
  assert.match(app, /renderProject, mountProject/);
  assert.match(view, /ProjectDocs\.load\(\)/);
  assert.match(view, /renderSamples\(/);
  assert.match(view, /renderDocuments\(/);
  assert.match(loader, /data\/projects\/calebzone\/manifest\.json/);
});

test('Markdown project documents render headings, tables and escaped fenced code', async () => {
  const { renderMarkdown } = await import(pathToFileURL(path.join(publicRoot, 'lib/markdown.js')).href);
  const html = renderMarkdown('# Gateway\n\n| Path | Service |\n| --- | --- |\n| `/air` | Air |\n\n```java\n<script>alert(1)</script>\n```');
  assert.match(html, /<h1 id="gateway"><a class="md-heading-anchor"[^>]*>Gateway<\/a><\/h1>/);
  assert.match(html, /<table class="md-table">/);
  assert.match(html, /<pre><code class="language-java">&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/code><\/pre>/);
  assert.doesNotMatch(html, /<script>/);
});

test('Project has a Vietnamese SRS source and headings expose shareable anchors', async () => {
  assert.ok(manifest.locales?.vi?.project?.title);
  assert.equal(manifest.locales.vi.modules.length, manifest.modules.length);
  assert.equal(manifest.locales.vi.requirements.length, manifest.requirements.length);

  const { renderMarkdown } = await import(pathToFileURL(path.join(publicRoot, 'lib/markdown.js')).href + '?anchors=' + Math.random());
  const html = renderMarkdown('## Identity boundary', {
    headingPrefix: 'doc-gateway', headingRoute: '/project/calebzone', headingLinkLabel: 'Liên kết đến mục này'
  });
  assert.match(html, /id="doc-gateway-identity-boundary"/);
  assert.match(html, /data-anchor-route="\/project\/calebzone"/);
  assert.match(html, /href="#\/project\/calebzone#doc-gateway-identity-boundary"/);
});
