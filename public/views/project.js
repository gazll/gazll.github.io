import { escapeHtml, renderMarkdown } from '../lib/markdown.js';
import { ProjectDocs } from '../lib/project.js';
import { Content } from '../lib/content.js';
import { contentDateFacts } from '../lib/content-dates.js';
import { setArticleStructuredData } from '../lib/structured-data.js';
import { anchorHref, decorateHeadingPermalinks, scrollToAnchor, withRouteLanguage } from '../lib/anchors.js';

let mountToken = 0;

const COPY = {
  en: {
    eyebrow: 'Project · Software requirements specification', back: 'Project', sourceSnapshot: 'Source snapshot',
    status: 'Status', root: 'root', modules: 'modules', documents: 'documents', samples: 'implementation samples',
    scope: 'Scope and intent', architecture: 'Architecture and boundaries', requirements: 'System requirements',
    evidence: 'Implementation evidence', sourceDocs: 'Source documents', contents: 'On this page',
    loading: 'Loading project documentation…', unavailable: 'Could not load project documentation', retry: 'Try again',
    original: 'Original project document', sampleSource: 'Source', openSample: 'Open sample',
    sanitized: 'Secrets redacted for publication.', technologyBaseline: 'Technology baseline',
    moduleOwnership: 'Module ownership', editableSource: 'editable source', headingLink: 'Link to this section',
    notFound: 'Project not found', notFoundBack: 'Back to Project'
  },
  vi: {
    eyebrow: 'Project · Đặc tả yêu cầu phần mềm', back: 'Project', sourceSnapshot: 'Snapshot source',
    status: 'Trạng thái', root: 'root', modules: 'module', documents: 'tài liệu', samples: 'sample triển khai',
    scope: 'Phạm vi và mục tiêu', architecture: 'Kiến trúc và boundary', requirements: 'Yêu cầu hệ thống',
    evidence: 'Bằng chứng triển khai', sourceDocs: 'Tài liệu nguồn', contents: 'Nội dung trang',
    loading: 'Đang tải tài liệu project…', unavailable: 'Không thể tải tài liệu project', retry: 'Thử lại',
    original: 'Tài liệu gốc của project', sampleSource: 'Source', openSample: 'Mở sample',
    sanitized: 'Secret đã được loại khỏi bản publish.', technologyBaseline: 'Technology baseline',
    moduleOwnership: 'Module ownership', editableSource: 'source có thể chỉnh sửa', headingLink: 'Liên kết đến mục này',
    notFound: 'Không tìm thấy project', notFoundBack: 'Quay lại Project'
  }
};

const text = key => (COPY[Content.lang] || COPY.en)[key] || COPY.en[key] || key;
const PROJECT_ROUTE = '/project/calebzone';

function localizedManifest(manifest) {
  const localized = manifest.locales?.[Content.lang] || manifest.locales?.en || {};
  return {
    project: { ...manifest.project, ...(localized.project || {}) },
    stack: localized.stack || manifest.stack || [],
    modules: localized.modules || manifest.modules || [],
    requirements: localized.requirements || manifest.requirements || [],
    architecture: { ...manifest.architecture, ...(localized.architecture || {}) },
    prose: localized.prose || {}
  };
}

function heading(level, id, label, className = '') {
  return '<h' + level + ' id="' + escapeHtml(id) + '"' + (className ? ' class="' + className + '"' : '') + '><a class="pj-heading-anchor"'
    + ' data-anchor-link data-anchor-id="' + escapeHtml(id) + '" data-anchor-route="' + escapeHtml(PROJECT_ROUTE)
    + '" href="' + escapeHtml(anchorHref(id, PROJECT_ROUTE)) + '" aria-label="' + escapeHtml(text('headingLink')) + '">'
    + escapeHtml(label) + '</a></h' + level + '>';
}

function renderList(items, className = '') {
  return '<ul' + (className ? ' class="' + className + '"' : '') + '>'
    + (items || []).map(item => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>';
}

function renderModules(modules) {
  return '<div class="pj-module-grid">' + (modules || []).map(module =>
    '<article class="pj-module"><code>' + escapeHtml(module.name) + '</code>'
    + '<p>' + escapeHtml(module.role) + '</p></article>').join('') + '</div>';
}

function dateFacts(row) {
  return contentDateFacts(row, Content.lang).map(fact => '<span><b>' + escapeHtml(fact.label) + '</b> <time datetime="'
    + escapeHtml(fact.value) + '">' + escapeHtml(fact.formatted) + '</time></span>').join('');
}

function updatedBadge(row) {
  const facts = contentDateFacts(row, Content.lang);
  const fact = facts.find(candidate => candidate.kind === 'updated') || facts.at(-1);
  return fact ? '<time class="pj-updated" datetime="' + escapeHtml(fact.value) + '">' + escapeHtml(fact.label + ' ' + fact.formatted) + '</time>' : '';
}

function renderSamples(samples, bodies) {
  return '<div class="pj-sample-list">' + (samples || []).map((sample, index) => {
    const body = bodies.get(sample.id) || '';
    return '<details class="pj-sample"' + (index < 3 ? ' open' : '') + ' id="sample-' + escapeHtml(sample.id) + '">'
      + '<summary><span><strong>' + escapeHtml(sample.title) + '</strong><small>'
      + escapeHtml(sample.focus) + '</small>' + updatedBadge(sample) + '</span><code>' + escapeHtml(sample.language) + '</code></summary>'
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
    const categoryId = 'project-doc-category-' + category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    groups.push('<section class="pj-doc-group">' + heading(3, categoryId, category)
      + rows.map((documentMeta, index) => {
        const body = bodies.get(documentMeta.id) || '';
        return '<details class="pj-doc"' + (groups.length === 0 && index === 0 ? ' open' : '')
          + ' id="doc-' + escapeHtml(documentMeta.id) + '"><summary><span><strong>'
          + escapeHtml(documentMeta.title) + '</strong><small>' + escapeHtml(documentMeta.source) + '</small>'
          + updatedBadge(documentMeta) + '</span>'
          + '<b>↘</b></summary><div class="pj-doc-body">' + renderMarkdown(body, {
            headingPrefix: 'doc-' + documentMeta.id,
            headingRoute: PROJECT_ROUTE,
            headingLinkLabel: text('headingLink')
          }) + '</div></details>';
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
  return rows.map(([id, label]) => '<a href="' + escapeHtml(anchorHref(id, PROJECT_ROUTE)) + '" data-anchor-link data-anchor-id="'
    + escapeHtml(id) + '" data-anchor-route="' + escapeHtml(PROJECT_ROUTE) + '" data-project-section="' + id + '">' + label + '</a>').join('');
}

function renderArticle(manifest, documentBodies, sampleBodies) {
  const localized = localizedManifest(manifest);
  const project = localized.project;
  const prose = localized.prose;
  const stats = '<div class="pj-stats"><span><b>' + localized.modules.length + '</b> ' + text('modules')
    + '</span><span><b>' + manifest.documents.length + '</b> ' + text('documents')
    + '</span><span><b>' + manifest.samples.length + '</b> ' + text('samples') + '</span></div>';
  return '<div class="pj-article">'
    + '<header class="pj-head"><a class="pj-back" href="' + escapeHtml(withRouteLanguage('#/project', Content.lang)) + '">← ' + text('back') + '</a>'
    + '<p class="pj-eyebrow">' + text('eyebrow') + '</p>' + heading(1, 'project-calebzone-title', project.title)
    + '<p class="pj-deck">' + escapeHtml(project.intro) + '</p>' + stats
    + '<div class="pj-meta"><span><b>' + text('status') + '</b> ' + escapeHtml(project.status) + '</span>'
    + '<span><b>' + text('sourceSnapshot') + '</b> ' + escapeHtml(manifest.snapshot) + '</span>'
    + '<span><b>' + text('root') + '</b> <code>' + escapeHtml(project.source_root) + '</code></span>'
    + dateFacts(manifest) + '</div>'
    + '<p class="pj-note">' + escapeHtml(project.owner_note) + '</p></header>'
    + '<details class="pj-toc-mobile"><summary>' + text('contents') + '</summary><nav>' + renderToc() + '</nav></details>'
    + '<div class="pj-grid"><aside class="pj-toc"><p>' + text('contents') + '</p><nav>' + renderToc() + '</nav></aside>'
    + '<article class="pj-body" data-project-body>'
    + '<section class="pj-section" id="project-scope">' + heading(2, 'project-scope', text('scope'))
    + '<p>' + escapeHtml(prose.scope || 'This page is the implementation-facing companion to the conceptual System Design material. It records what CalebZone is meant to do, how the modules are separated, and where the current repository proves or qualifies each decision.') + '</p>'
    + '<div class="pj-two-col"><article>' + heading(3, 'project-technology', prose.technologyTitle || text('technologyBaseline')) + renderList(localized.stack, 'pj-plain-list') + '</article>'
    + '<article>' + heading(3, 'project-module-ownership', prose.modulesTitle || text('moduleOwnership')) + renderModules(localized.modules) + '</article></div></section>'
    + '<section class="pj-section" id="project-architecture">' + heading(2, 'project-architecture', text('architecture'))
    + '<p>' + escapeHtml(prose.architecture || 'The gateway owns the client-facing edge. Domain-oriented services keep their own use cases, while adapters handle Redis, persistence and external providers.') + '</p>'
    + '<figure class="pj-diagram"><figcaption><strong>' + escapeHtml(prose.diagramTitle || 'CalebZone runtime topology') + '</strong><span>' + escapeHtml(prose.editableSource || text('editableSource')) + '</span></figcaption>'
    + '<pre><code class="language-mermaid">' + escapeHtml(manifest.architecture.diagram) + '</code></pre></figure>'
    + '<div class="pj-decision-list">' + (localized.architecture.decisions || []).map((decision, index) =>
      '<article><span>' + String(index + 1).padStart(2, '0') + '</span><p>' + escapeHtml(decision) + '</p></article>').join('') + '</div></section>'
    + '<section class="pj-section" id="project-requirements">' + heading(2, 'project-requirements', text('requirements'))
    + (prose.requirements ? '<p>' + escapeHtml(prose.requirements) + '</p>' : '')
    + '<div class="pj-requirement-list">' + (localized.requirements || []).map((requirement, index) =>
      '<article><b>FR-' + String(index + 1).padStart(2, '0') + '</b><p>' + escapeHtml(requirement) + '</p></article>').join('') + '</div></section>'
    + '<section class="pj-section" id="project-evidence">' + heading(2, 'project-evidence', text('evidence'))
    + '<p>' + escapeHtml(prose.evidence || 'These are copied from the current CalebZone working tree, so the SRS can be checked against implementation details rather than only prose. The gateway samples intentionally leave secrets out.') + '</p>'
    + renderSamples(manifest.samples, sampleBodies) + '</section>'
    + '<section class="pj-section" id="project-documents">' + heading(2, 'project-documents', text('sourceDocs'))
    + '<p>' + escapeHtml(prose.documents || 'The source documents below are preserved as collapsible reading material. Their headings, tables and fenced code blocks are rendered in place; the source path remains visible on every entry.') + '</p>'
    + renderDocuments(manifest.documents, documentBodies) + '</section>'
    + '</article></div></div>';
}

function wireToc(root) {
  root.querySelectorAll('[data-project-section]').forEach(link => link.addEventListener('click', () => {
    link.closest('.pj-toc-mobile')?.removeAttribute('open');
  }));
}

export function renderProject() {
  return '<section class="pj-shell" data-project-root aria-live="polite"><div class="pj-loading"><span></span><p>'
    + text('loading') + '</p></div></section>';
}

export async function mountProject(host, routeParts = [], anchor = '') {
  const token = ++mountToken;
  const root = host.querySelector('[data-project-root]');
  if (!root) return;
  const slug = routeParts[0] ? decodeURIComponent(routeParts[0]) : 'calebzone';
  if (slug !== 'calebzone') {
    root.innerHTML = '<div class="pj-empty"><p class="pj-eyebrow">Project</p><h1>' + text('notFound') + '</h1><a href="' + escapeHtml(withRouteLanguage('#/project', Content.lang)) + '">'
      + text('notFoundBack') + '</a></div>';
    decorateHeadingPermalinks(root);
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
    decorateHeadingPermalinks(root);
    document.title = 'CalebZone Project · Backend Engineering';
    setArticleStructuredData(manifest, {
      headline: localizedManifest(manifest).project.title,
      description: localizedManifest(manifest).project.intro,
      lang: Content.lang,
      url: window.location.href
    });
    wireToc(root);
    if (anchor) requestAnimationFrame(() => scrollToAnchor(root, anchor, { behavior: 'auto' }));
  } catch (error) {
    if (token !== mountToken) return;
    root.innerHTML = '<div class="pj-empty"><p class="pj-eyebrow">' + text('unavailable') + '</p><h1>'
      + escapeHtml(error?.message || String(error)) + '</h1><a href="' + escapeHtml(withRouteLanguage('#/project', Content.lang)) + '">' + text('retry') + '</a></div>';
    decorateHeadingPermalinks(root);
  }
}
