import { escapeHtml, renderMarkdown } from '../lib/markdown.js';
import { copyText } from '../lib/clipboard.js';
import { Content } from '../lib/content.js';
import { SystemDesign } from '../lib/system-design.js';
import { CaseStudies } from '../lib/case-studies.js';
import { mountMermaidDiagrams } from '../lib/mermaid.js';
import { systemDesignQuestionUrl } from '../lib/question-links.js';

let mountToken = 0;

const COPY = {
  en: {
    eyebrow: 'Experience · Design library', blueprints: n => n === 1 ? 'blueprint' : 'blueprints',
    cases: n => n === 1 ? 'production case' : 'production cases', open: 'Open design', read: 'Read production case',
    back: 'System Design library', scope: 'Problem framing', requirements: 'Requirements',
    functional: 'Functional requirements',
    quality: 'Quality attributes', capacity: 'Capacity & constraints', architecture: 'High-level architecture',
    data: 'Data model', stack: 'Technology choices', tradeoffs: 'Trade-offs & failure review',
    migrated: 'Migrated deep-dive notes', migratedNote: 'Preserved from Study Track topics 10–11 and the overlapping Topic 16 sections.',
    source: 'Mermaid source', copy: 'Copy Mermaid', copyLink: 'Copy link', copied: 'Copied', visualizer: 'Open visualizer',
    diagramUnavailable: 'Diagram renderer unavailable. The editable Mermaid source is still available below.',
    production: 'Production evidence', historical: 'Historical architecture',
    historicalNote: 'The preserved article reflects the system, constraints and technology available at publication time.',
    legacyDiagram: 'The former drawing is consolidated into the editable Mermaid architecture above.',
    problem: 'Problem', coreIdea: 'Core idea', outcome: 'Outcome', sourceLabel: 'Source',
    original: 'Original article', toc: 'On this page', loading: 'Loading the System Design library…',
    unavailable: 'Could not load System Design', missing: 'Design not found', retry: 'Back to the library'
  },
  vi: {
    eyebrow: 'Kinh nghiệm · Thư viện thiết kế', blueprints: () => 'bài thiết kế', cases: () => 'case production',
    open: 'Mở bài thiết kế', read: 'Đọc case production', back: 'Thư viện System Design', scope: 'Định nghĩa bài toán',
    requirements: 'Yêu cầu',
    functional: 'Yêu cầu chức năng', quality: 'Thuộc tính chất lượng', capacity: 'Tải & ràng buộc',
    architecture: 'Kiến trúc tổng thể', data: 'Mô hình dữ liệu', stack: 'Lựa chọn công nghệ',
    tradeoffs: 'Trade-off & review lỗi', migrated: 'Ghi chú chuyên sâu đã chuyển',
    migratedNote: 'Được giữ nguyên từ Topic 10–11 và các phần trùng thuộc Topic 16 trong Study Track.', source: 'Source Mermaid',
    copy: 'Copy Mermaid', copyLink: 'Copy link', copied: 'Đã copy', visualizer: 'Mở visualizer',
    diagramUnavailable: 'Không tải được renderer. Source Mermaid có thể chỉnh sửa vẫn nằm ngay bên dưới.',
    production: 'Bằng chứng production', historical: 'Kiến trúc theo thời điểm',
    historicalNote: 'Bài gốc phản ánh hệ thống, ràng buộc và công nghệ ở thời điểm được xuất bản.',
    legacyDiagram: 'Sơ đồ cũ đã được gom vào kiến trúc Mermaid có thể chỉnh sửa ở phía trên.',
    problem: 'Bài toán', coreIdea: 'Ý tưởng chính', outcome: 'Kết quả', sourceLabel: 'Nguồn',
    original: 'Bài viết gốc', toc: 'Trong bài này', loading: 'Đang tải thư viện System Design…',
    unavailable: 'Không thể tải System Design', missing: 'Không tìm thấy bài thiết kế', retry: 'Quay lại thư viện'
  }
};

const text = () => COPY[Content.lang] || COPY.en;
const numberLabel = n => String(n).padStart(2, '0');
// Attribution is the publisher URL and nothing else, so an unexpected host is
// never rendered as a link — it falls back to the publication's own root.
const sourceHref = url => /^https:\/\/engineering\.tiki\.vn\//.test(url || '') ? url : 'https://engineering.tiki.vn/';

function renderDesignCard(design) {
  return '<a class="sd-card" href="#/system-design/' + encodeURIComponent(design.slug) + '">'
    + '<span class="sd-card-num">' + numberLabel(design.n) + '</span><span class="sd-card-main">'
    + '<span class="sd-card-type">Blueprint · ' + escapeHtml(design.effort || '45 min') + '</span>'
    + '<strong>' + escapeHtml(design.title) + '</strong><span>' + escapeHtml(design.excerpt) + '</span>'
    + '<span class="sd-card-tags">' + design.tags.slice(0, 4).map(tag => '<i>' + escapeHtml(tag) + '</i>').join('') + '</span>'
    + '</span><span class="sd-card-go">' + text().open + ' →</span></a>';
}

function renderCaseCard(article) {
  return '<a class="sd-card sd-case-card" href="#/system-design/case/' + encodeURIComponent(article.slug) + '">'
    + '<span class="sd-case-art"><img src="' + escapeHtml(article.cover_image) + '" alt="" loading="lazy"></span>'
    + '<span class="sd-card-main"><span class="sd-card-type">' + text().production + ' · Tiki Engineering</span>'
    + '<strong>' + escapeHtml(article.title) + '</strong><span>' + escapeHtml(article.excerpt) + '</span>'
    + '<span class="sd-card-tags">' + article.tags.slice(0, 4).map(tag => '<i>' + escapeHtml(tag) + '</i>').join('') + '</span>'
    + '</span><span class="sd-card-go">' + text().read + ' →</span></a>';
}

function renderLibrary(collection) {
  const groups = collection.categories.map(category => {
    const designs = collection.designs.filter(design => design.category === category.id);
    if (!designs.length) return '';
    return '<section class="sd-group" aria-labelledby="sd-group-' + escapeHtml(category.id) + '">'
      + '<header><div><p>' + text().eyebrow + '</p><h2 id="sd-group-' + escapeHtml(category.id) + '">'
      + escapeHtml(category.label) + '</h2><span>' + escapeHtml(category.description) + '</span></div><b>' + designs.length + '</b></header>'
      + '<div class="sd-list">' + designs.map(renderDesignCard).join('') + '</div></section>';
  }).join('');

  return '<div class="sd-library"><header class="sd-hero"><p class="cs-eyebrow">' + escapeHtml(collection.library.eyebrow) + '</p>'
    + '<h1>' + escapeHtml(collection.library.title) + '</h1><p>' + escapeHtml(collection.library.intro) + '</p>'
    + '<div class="cs-library-stats"><span><b>' + collection.designs.length + '</b> '
    + text().blueprints(collection.designs.length) + '</span><span><b>' + collection.cases.length + '</b> '
    + text().cases(collection.cases.length) + '</span><span>Mermaid · EN/VI</span></div></header>'
    + groups
    + '<section class="sd-group sd-production"><header><div><p>' + text().production + '</p><h2>'
    + escapeHtml(collection.production.label) + '</h2><span>' + escapeHtml(collection.production.description)
    + '</span></div><b>' + collection.cases.length + '</b></header><div class="sd-list">'
    + collection.cases.map(renderCaseCard).join('') + '</div></section></div>';
}

function list(items) {
  return '<ul>' + (items || []).map(item => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>';
}

function diagramBlock(title, diagram) {
  return '<figure class="sd-diagram" data-diagram-frame><figcaption><strong>' + escapeHtml(title) + '</strong>'
    + '<span><button type="button" data-copy-mermaid>' + text().copy + '</button>'
    + '<a href="https://mermaid.live/" target="_blank" rel="noopener noreferrer">' + text().visualizer + ' ↗</a></span></figcaption>'
    + '<pre class="mermaid" data-mermaid-diagram>' + escapeHtml(diagram) + '</pre>'
    + '<p class="sd-mermaid-status" data-mermaid-status hidden>' + text().diagramUnavailable + '</p>'
    + '<details class="sd-mermaid-source"><summary>' + text().source + '</summary><pre><code data-mermaid-source>'
    + escapeHtml(diagram) + '</code></pre></details></figure>';
}

/* `id` is what the TOC links to, so it is passed explicitly rather than reusing
   the class name — buildToc only picks up headings that carry one. */
function detailRows(title, rows, id) {
  return '<section class="sd-section ' + escapeHtml(id) + '"><h2 id="' + escapeHtml(id) + '">'
    + title + '</h2>' + list(rows) + '</section>';
}

function renderSourceAnswer(markdown) {
  const replacement = '<p class="sd-legacy-diagram-note">' + escapeHtml(text().legacyDiagram) + '</p>';
  return renderMarkdown(markdown).replace(/<figure\s+class=['"]dgm['"][\s\S]*?<\/figure>/gi, replacement);
}

function renderSourceNotes(design) {
  if (!design.sourceNotes.length) return '';
  return '<section class="sd-section sd-notes"><h2 id="migrated-notes">' + text().migrated + '</h2><p>'
    + text().migratedNote + '</p>' + design.sourceNotes.map(note => '<details id="question-' + escapeHtml(note.id)
      + '" data-sd-question="' + escapeHtml(note.id) + '"><summary><span>'
      + escapeHtml(note.q) + '</span><code>' + escapeHtml(note.id) + '</code></summary><div>'
      + '<div class="sd-note-actions"><button type="button" data-copy-sd-question data-design-slug="'
      + escapeHtml(design.slug) + '" data-question-id="' + escapeHtml(note.id) + '">' + text().copyLink
      + '</button></div>' + renderSourceAnswer(note.a) + '</div></details>').join('') + '</section>';
}

function articleShell(header, body) {
  return '<div class="sd-article">' + header + '<details class="sd-toc-mobile"><summary>' + text().toc
    + '</summary><nav data-sd-toc-mobile></nav></details><div class="sd-article-grid">'
    + '<aside class="sd-toc"><p>' + text().toc + '</p><nav data-sd-toc></nav></aside>' + body + '</div></div>';
}

function renderDesignArticle(design) {
  const tags = design.tags.map(tag => '<span>' + escapeHtml(tag) + '</span>').join('');
  const header = '<header class="sd-article-head"><a class="cs-back" href="#/system-design">← ' + text().back + '</a>'
    + '<p class="cs-eyebrow">Blueprint ' + numberLabel(design.n) + ' · ' + escapeHtml(design.effort || '45 min') + '</p>'
    + '<h1>' + escapeHtml(design.title) + '</h1><p>' + escapeHtml(design.excerpt) + '</p><div class="cs-tags">' + tags + '</div></header>';
  const body = '<article class="sd-article-body" data-sd-body>'
    + '<section class="sd-section sd-scope"><h2 id="problem-framing">' + text().scope + '</h2><p>' + escapeHtml(design.scope) + '</p></section>'
    + '<section class="sd-section sd-requirements"><h2 id="requirements">' + text().requirements + '</h2><div><article><h3>'
    + text().functional + '</h3>' + list(design.functional) + '</article><article><h3>' + text().quality + '</h3>'
    + list(design.quality) + '</article></div></section>'
    + detailRows(text().capacity, design.capacity, 'capacity-constraints')
    + '<section class="sd-section"><h2 id="architecture">' + text().architecture + '</h2>'
    + diagramBlock(design.diagram_title || text().architecture, design.diagram) + '</section>'
    + detailRows(text().data, design.data_model, 'data-model')
    + detailRows(text().stack, design.stack, 'technology-choices')
    + detailRows(text().tradeoffs, design.tradeoffs, 'tradeoffs-failure-review')
    + renderSourceNotes(design) + '</article>';
  return articleShell(header, body);
}

function renderCaseGuide(article) {
  const guide = article.guide;
  if (!guide) return '';
  return '<section class="sd-section sd-case-guide"><h2 id="design-review">' + text().production + '</h2>'
    + '<div><article><h3>' + text().problem + '</h3><p>' + escapeHtml(guide.problem) + '</p></article>'
    + '<article><h3>' + text().coreIdea + '</h3><p>' + escapeHtml(guide.core_idea) + '</p></article>'
    + '<article><h3>' + text().outcome + '</h3><p>' + escapeHtml(guide.outcome) + '</p></article></div></section>';
}

function renderProductionArticle(article, overview, archivedBody) {
  const href = sourceHref(article.source_url);
  const tags = article.tags.map(tag => '<span>' + escapeHtml(tag) + '</span>').join('');
  const header = '<header class="sd-article-head"><a class="cs-back" href="#/system-design">← ' + text().back + '</a>'
    + '<p class="cs-eyebrow">' + text().production + ' · Tiki Engineering</p><h1>' + escapeHtml(article.title) + '</h1>'
    + '<p>' + escapeHtml(article.excerpt) + '</p><div class="cs-tags">' + tags + '</div>'
    + '<div class="cs-archive-note"><b>' + text().historical + '</b><span>' + text().historicalNote + '</span></div></header>';
  const body = '<article class="sd-article-body" data-sd-body>'
    + '<section class="sd-section sd-scope"><h2 id="architecture-lens">' + text().architecture + '</h2><p>'
    + escapeHtml(overview?.lens || article.excerpt) + '</p>'
    + (overview?.diagram ? diagramBlock(overview.title || text().architecture, overview.diagram) : '') + '</section>'
    + renderCaseGuide(article)
    + '<section class="sd-section sd-archive"><h2 id="preserved-article">' + text().original + '</h2>'
    + '<div class="cs-article-body">' + archivedBody + '</div></section></article>';
  return articleShell(header, body)
    + '<footer class="cs-source"><span>' + text().sourceLabel + '</span><a href="' + href + '" target="_blank" rel="noopener noreferrer">'
    + 'Tiki Engineering — ' + text().original + ' ↗</a></footer>';
}

function buildToc(root) {
  const headings = [...root.querySelectorAll('[data-sd-body] h2[id], [data-sd-body] h3[id]')];
  const html = headings.map(heading => '<a class="' + (heading.tagName === 'H3' ? 'is-sub' : '')
    + '" href="" data-sd-section="' + escapeHtml(heading.id) + '">' + escapeHtml(heading.textContent) + '</a>').join('');
  root.querySelectorAll('[data-sd-toc], [data-sd-toc-mobile]').forEach(nav => { nav.innerHTML = html; });
  root.querySelectorAll('[data-sd-section]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    root.querySelector('#' + link.dataset.sdSection)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

function wireDiagramTools(root) {
  root.querySelectorAll('[data-copy-mermaid]').forEach(button => button.addEventListener('click', async () => {
    const source = button.closest('[data-diagram-frame]')?.querySelector('[data-mermaid-source]')?.textContent || '';
    try {
      await copyText(source);
      const original = button.textContent;
      button.textContent = text().copied;
      button.classList.add('is-copied');
      setTimeout(() => { button.textContent = original; button.classList.remove('is-copied'); }, 1600);
    } catch (error) {
      window.prompt(text().source + ':', source);
    }
  }));

  root.querySelectorAll('[data-copy-sd-question]').forEach(button => button.addEventListener('click', async () => {
    const url = systemDesignQuestionUrl(window.location.href, button.dataset.designSlug, button.dataset.questionId);
    try {
      await copyText(url);
      const original = button.textContent;
      button.textContent = text().copied;
      button.classList.add('is-copied');
      setTimeout(() => { button.textContent = original; button.classList.remove('is-copied'); }, 1600);
    } catch (error) {
      window.prompt(text().source + ':', url);
    }
  }));
}

function wireArchiveImages(root) {
  root.querySelectorAll('[data-zoom-image]').forEach(button => {
    const image = button.querySelector('img');
    if (image) button.replaceWith(image);
  });
}

function revealLinkedSource(root, questionId) {
  if (!questionId) return;
  const note = [...root.querySelectorAll('[data-sd-question]')]
    .find(candidate => candidate.dataset.sdQuestion === questionId);
  if (!note) return;
  note.open = true;
  note.classList.add('link-target');
  requestAnimationFrame(() => note.scrollIntoView({ block: 'start', inline: 'nearest' }));
}

async function showRoute(root, collection, routeParts, token) {
  if (!routeParts.length) {
    root.innerHTML = renderLibrary(collection);
    document.title = collection.library.title + ' · Backend Engineering';
    return;
  }

  let html = '';
  if (routeParts[0] === 'case') {
    let slug = '';
    try { slug = decodeURIComponent(routeParts[1] || ''); } catch (error) {}
    const article = collection.productionCase(slug);
    if (article) {
      const archivedBody = await CaseStudies.body(article);
      if (token !== mountToken) return;
      html = renderProductionArticle(article, collection.caseOverview(slug), archivedBody);
      document.title = article.title + ' · Backend Engineering';
    }
  } else {
    let slug = '';
    try { slug = decodeURIComponent(routeParts[0]); } catch (error) {}
    const design = collection.design(slug);
    if (design) {
      html = renderDesignArticle(design);
      document.title = design.title + ' · Backend Engineering';
    }
  }

  if (!html) {
    root.innerHTML = '<div class="cs-empty"><p class="cs-eyebrow">' + text().missing + '</p>'
      + '<h1>' + text().missing + '</h1><a href="#/system-design">← ' + text().retry + '</a></div>';
    return;
  }

  root.innerHTML = html;
  buildToc(root);
  wireDiagramTools(root);
  wireArchiveImages(root);
  await mountMermaidDiagrams(root);
  if (routeParts[0] !== 'case') {
    let questionId = '';
    try { questionId = decodeURIComponent(routeParts[1] || ''); } catch (error) {}
    revealLinkedSource(root, questionId);
  }
}

export function renderSystemDesign() {
  return '<section class="sd-shell" data-system-design-root aria-live="polite">'
    + '<div class="cs-loading"><span></span><p>' + text().loading + '</p></div></section>';
}

export async function mountSystemDesign(host, routeParts = []) {
  const token = ++mountToken;
  const root = host.querySelector('[data-system-design-root]');
  if (!root) return;
  try {
    const collection = await SystemDesign.load(Content.lang);
    if (token !== mountToken) return;
    await showRoute(root, collection, routeParts, token);
  } catch (error) {
    if (token !== mountToken) return;
    root.innerHTML = '<div class="cs-empty"><p class="cs-eyebrow">' + text().unavailable + '</p>'
      + '<h1>' + text().unavailable + '</h1><a href="#/system-design">' + text().retry + '</a></div>';
  }
}
