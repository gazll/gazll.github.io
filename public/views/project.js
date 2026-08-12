import { escapeHtml, renderMarkdown } from '../lib/markdown.js';
import { ProjectDocs } from '../lib/project.js';

let mountToken = 0;

const COPY = {
  eyebrow: 'Project · Software requirements specification',
  back: 'Project',
  sourceSnapshot: 'Source snapshot',
  status: 'Status',
  modules: 'modules',
  documents: 'documents',
  samples: 'implementation samples',
  scope: 'Scope and intent',
  architecture: 'Architecture and boundaries',
  requirements: 'System requirements',
  evidence: 'Implementation evidence',
  sourceDocs: 'Source documents',
  contents: 'On this page',
  loading: 'Loading project documentation…',
  unavailable: 'Could not load project documentation',
  retry: 'Try again',
  original: 'Original project document',
  sampleSource: 'Source',
  openSample: 'Open sample',
  sanitized: 'Secrets redacted for publication.'
};

const text = key => COPY[key] || key;

function renderList(items, className = '') {
  return '<ul' + (className ? ' class="' + className + '"' : '') + '>'
    + (items || []).map(item => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>';
}

function renderModules(modules) {
  return '<div class="pj-module-grid">' + (modules || []).map(module =>
    '<article class="pj-module"><code>' + escapeHtml(module.name) + '</code>'
    + '<p>' + escapeHtml(module.role) + '</p></article>').join('') + '</div>';
}

function renderSamples(samples, bodies) {
  return '<div class="pj-sample-list">' + (samples || []).map((sample, index) => {
    const body = bodies.get(sample.id) || '';
    return '<details class="pj-sample"' + (index < 3 ? ' open' : '') + ' id="sample-' + escapeHtml(sample.id) + '">'
      + '<summary><span><strong>' + escapeHtml(sample.title) + '</strong><small>'
      + escapeHtml(sample.focus) + '</small></span><code>' + escapeHtml(sample.language) + '</code></summary>'
      + '<div class="pj-sample-body"><div class="pj-source-line"><span>' + text('sampleSource') + '</span><code>'
      + escapeHtml(sample.source) + '</code>' + (sample.id === 'gateway-config' ? '<em>' + text('sanitized') + '</em>' : '') + '</div>'
      + '<pre><code class="language-' + escapeHtml(sample.language) + '">' + escapeHtml(body) + '</code></pre></div></details>';
  }).join('') + '</div>';
}

function renderDocuments(documents, bodies) {
  const groups = [];
  const byCategory = new Map();
  (documents || []).forEach(documentMeta => {
    if (!byCategory.has(documentMeta.category)) byCategory.set(documentMeta.category, []);
    byCategory.get(documentMeta.category).push(documentMeta);
  });
  byCategory.forEach((rows, category) => {
    groups.push('<section class="pj-doc-group"><h3>' + escapeHtml(category) + '</h3>'
      + rows.map((documentMeta, index) => {
        const body = bodies.get(documentMeta.id) || '';
        return '<details class="pj-doc"' + (groups.length === 0 && index === 0 ? ' open' : '')
          + ' id="doc-' + escapeHtml(documentMeta.id) + '"><summary><span><strong>'
          + escapeHtml(documentMeta.title) + '</strong><small>' + escapeHtml(documentMeta.source) + '</small></span>'
          + '<b>↘</b></summary><div class="pj-doc-body">' + renderMarkdown(body) + '</div></details>';
      }).join('') + '</section>');
  });
  return groups.join('');
}

function renderToc() {
  const rows = [
    ['project-scope', 'Scope and intent'],
    ['project-architecture', 'Architecture and boundaries'],
    ['project-requirements', 'System requirements'],
    ['project-evidence', 'Implementation evidence'],
    ['project-documents', 'Source documents']
  ];
  return rows.map(([id, label]) => '<a href="#/project/calebzone" data-project-section="' + id + '">' + label + '</a>').join('');
}

function renderArticle(manifest, documentBodies, sampleBodies) {
  const project = manifest.project;
  const stats = '<div class="pj-stats"><span><b>' + manifest.modules.length + '</b> ' + text('modules')
    + '</span><span><b>' + manifest.documents.length + '</b> ' + text('documents')
    + '</span><span><b>' + manifest.samples.length + '</b> ' + text('samples') + '</span></div>';
  return '<div class="pj-article">'
    + '<header class="pj-head"><a class="pj-back" href="#/project">← ' + text('back') + '</a>'
    + '<p class="pj-eyebrow">' + text('eyebrow') + '</p><h1>' + escapeHtml(project.title) + '</h1>'
    + '<p class="pj-deck">' + escapeHtml(project.intro) + '</p>' + stats
    + '<div class="pj-meta"><span><b>' + text('status') + '</b> ' + escapeHtml(project.status) + '</span>'
    + '<span><b>' + text('sourceSnapshot') + '</b> ' + escapeHtml(manifest.snapshot) + '</span>'
    + '<span><b>root</b> <code>' + escapeHtml(project.source_root) + '</code></span></div>'
    + '<p class="pj-note">' + escapeHtml(project.owner_note) + '</p></header>'
    + '<details class="pj-toc-mobile"><summary>' + text('contents') + '</summary><nav>' + renderToc() + '</nav></details>'
    + '<div class="pj-grid"><aside class="pj-toc"><p>' + text('contents') + '</p><nav>' + renderToc() + '</nav></aside>'
    + '<article class="pj-body" data-project-body>'
    + '<section class="pj-section" id="project-scope"><h2>' + text('scope') + '</h2>'
    + '<p>This page is the implementation-facing companion to the conceptual System Design material. It records what CalebZone is meant to do, how the modules are separated, and where the current repository proves or qualifies each decision.</p>'
    + '<div class="pj-two-col"><article><h3>Technology baseline</h3>' + renderList(manifest.stack, 'pj-plain-list') + '</article>'
    + '<article><h3>Module ownership</h3>' + renderModules(manifest.modules) + '</article></div></section>'
    + '<section class="pj-section" id="project-architecture"><h2>' + text('architecture') + '</h2>'
    + '<p>The gateway owns the client-facing edge. Domain-oriented services keep their own use cases, while adapters handle Redis, persistence and external providers.</p>'
    + '<figure class="pj-diagram"><figcaption><strong>CalebZone runtime topology</strong><span>editable source</span></figcaption>'
    + '<pre><code class="language-mermaid">' + escapeHtml(manifest.architecture.diagram) + '</code></pre></figure>'
    + '<div class="pj-decision-list">' + (manifest.architecture.decisions || []).map((decision, index) =>
      '<article><span>' + String(index + 1).padStart(2, '0') + '</span><p>' + escapeHtml(decision) + '</p></article>').join('') + '</div></section>'
    + '<section class="pj-section" id="project-requirements"><h2>' + text('requirements') + '</h2>'
    + '<div class="pj-requirement-list">' + (manifest.requirements || []).map((requirement, index) =>
      '<article><b>FR-' + String(index + 1).padStart(2, '0') + '</b><p>' + escapeHtml(requirement) + '</p></article>').join('') + '</div></section>'
    + '<section class="pj-section" id="project-evidence"><h2>' + text('evidence') + '</h2>'
    + '<p>These are copied from the current CalebZone working tree, so the SRS can be checked against implementation details rather than only prose. The gateway samples intentionally leave secrets out.</p>'
    + renderSamples(manifest.samples, sampleBodies) + '</section>'
    + '<section class="pj-section" id="project-documents"><h2>' + text('sourceDocs') + '</h2>'
    + '<p>The source documents below are preserved as collapsible reading material. Their headings, tables and fenced code blocks are rendered in place; the source path remains visible on every entry.</p>'
    + renderDocuments(manifest.documents, documentBodies) + '</section>'
    + '</article></div></div>';
}

function wireToc(root) {
  root.querySelectorAll('[data-project-section]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    root.querySelector('#' + link.dataset.projectSection)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

export function renderProject() {
  return '<section class="pj-shell" data-project-root aria-live="polite"><div class="pj-loading"><span></span><p>'
    + text('loading') + '</p></div></section>';
}

export async function mountProject(host, routeParts = []) {
  const token = ++mountToken;
  const root = host.querySelector('[data-project-root]');
  if (!root) return;
  const slug = routeParts[0] ? decodeURIComponent(routeParts[0]) : 'calebzone';
  if (slug !== 'calebzone') {
    root.innerHTML = '<div class="pj-empty"><p class="pj-eyebrow">Project</p><h1>Project not found</h1><a href="#/project">Back to Project</a></div>';
    return;
  }

  try {
    const manifest = await ProjectDocs.load();
    const [documentBodies, sampleBodies] = await Promise.all([
      Promise.all(manifest.documents.map(async documentMeta => [documentMeta.id, await ProjectDocs.document(documentMeta)])),
      Promise.all(manifest.samples.map(async sample => [sample.id, await ProjectDocs.sample(sample)]))
    ]);
    if (token !== mountToken) return;
    root.innerHTML = renderArticle(manifest, new Map(documentBodies), new Map(sampleBodies));
    document.title = 'CalebZone Project · Backend Engineering';
    wireToc(root);
  } catch (error) {
    if (token !== mountToken) return;
    root.innerHTML = '<div class="pj-empty"><p class="pj-eyebrow">' + text('unavailable') + '</p><h1>'
      + escapeHtml(error?.message || String(error)) + '</h1><a href="#/project">' + text('retry') + '</a></div>';
  }
}
