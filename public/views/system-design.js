import { escapeHtml, renderMarkdown } from '../lib/markdown.js';
import { copyText } from '../lib/clipboard.js';
import { Content } from '../lib/content.js';
import { SystemDesign } from '../lib/system-design.js';
import { CaseStudies } from '../lib/case-studies.js';
import { mountMermaidDiagrams } from '../lib/mermaid.js';
import { systemDesignQuestionUrl } from '../lib/question-links.js';
import { SYSTEM_DESIGN_RESEARCH } from '../data/system-design/research.js';

let mountToken = 0;

const COPY = {
  en: {
    eyebrow: 'Experience · Design library', blueprints: n => n === 1 ? 'blueprint' : 'blueprints',
    cases: n => n === 1 ? 'production case' : 'production cases', open: 'Open design', read: 'Read production case',
    back: 'System Design library', scope: 'Problem framing', requirements: 'Requirements',
    functional: 'Functional requirements',
    quality: 'Quality attributes', capacity: 'Capacity & constraints', architecture: 'High-level architecture',
    data: 'Data model', stack: 'Technology choices', tradeoffs: 'Trade-offs & failure review',
    dataIntro: 'Compare records by ownership and responsibility before choosing storage. A record is authoritative, operational or derived; mixing those roles creates unclear consistency boundaries.',
    dataName: 'Record / model', dataRole: 'Fields, ownership and responsibility',
    dataChecksTitle: 'Compare the models on',
    dataChecks: ['transaction boundary and invariant', 'read/write path and indexes', 'partition key and hot-key risk', 'retention, audit and privacy', 'whether it can be rebuilt after loss'],
    stackIntro: 'Treat this as a decision map, not a shopping list. Each component must solve a named constraint and carry an explicit operational cost.',
    stackLayer: 'Layer / option', stackReason: 'Choice, purpose and boundary',
    stackChecksTitle: 'Challenge every choice with',
    stackChecks: ['simplest viable alternative', 'consistency and latency impact', 'failure and degraded mode', 'team/on-call capability', 'migration and exit trigger'],
    tradeoffIntro: 'Each row is a tension the design accepts—not a universal best practice. Review both sides and record the condition that would reverse the decision.',
    decision: 'Decision tension', consequence: 'Failure-review questions',
    failureChecks: ['What invariant can break?', 'Which metric detects it first?', 'How is the blast radius contained?', 'Can retry duplicate or reorder work?', 'How do we repair, reconcile and prove recovery?'],
    research: 'Engineering deep dives', researched: 'Current practice distilled from primary documentation. Validate version-specific details against the linked sources before implementation.',
    furtherReading: 'Primary sources',
    migrated: 'Migrated deep-dive notes', migratedNote: 'Preserved from Study Track topics 10–11 and the overlapping Topic 16 sections.',
    source: 'Mermaid source', copy: 'Copy Mermaid', copyLink: 'Copy link', copied: 'Copied', visualizer: 'Open visualizer',
    diagramUnavailable: 'Diagram renderer unavailable. The editable Mermaid source is still available below.',
    production: 'Production evidence', historical: 'Historical architecture',
    historicalNote: 'The preserved article reflects the system, constraints and technology available at publication time.',
    legacyDiagram: 'The former drawing is consolidated into the editable Mermaid architecture above.',
    problem: 'Problem', coreIdea: 'Core idea', outcome: 'Outcome', sourceLabel: 'Source',
    original: 'Original article', toc: 'On this page', tocToggle: 'Collapse contents',
    loading: 'Loading the System Design library…',
    unavailable: 'Could not load System Design', missing: 'Design not found', retry: 'Back to the library'
  },
  vi: {
    eyebrow: 'Kinh nghiệm · Thư viện thiết kế', blueprints: () => 'bài thiết kế', cases: () => 'case production',
    open: 'Mở bài thiết kế', read: 'Đọc case production', back: 'Thư viện System Design', scope: 'Định nghĩa bài toán',
    requirements: 'Yêu cầu',
    functional: 'Yêu cầu chức năng', quality: 'Thuộc tính chất lượng', capacity: 'Tải & ràng buộc',
    architecture: 'Kiến trúc tổng thể', data: 'Mô hình dữ liệu', stack: 'Lựa chọn công nghệ',
    tradeoffs: 'Trade-off & review lỗi', migrated: 'Ghi chú chuyên sâu đã chuyển',
    dataIntro: 'So sánh record theo quyền sở hữu và trách nhiệm trước khi chọn storage. Mỗi record nên là authoritative, operational hoặc derived; trộn các vai trò này sẽ làm boundary consistency mơ hồ.',
    dataName: 'Record / mô hình', dataRole: 'Field, ownership và trách nhiệm',
    dataChecksTitle: 'So sánh các mô hình theo',
    dataChecks: ['transaction boundary và invariant', 'read/write path và index', 'partition key và rủi ro hot key', 'retention, audit và privacy', 'khả năng rebuild sau khi mất dữ liệu'],
    stackIntro: 'Xem đây là bản đồ quyết định, không phải danh sách công nghệ. Mỗi component phải giải một constraint cụ thể và có operational cost rõ ràng.',
    stackLayer: 'Layer / phương án', stackReason: 'Lựa chọn, mục đích và boundary',
    stackChecksTitle: 'Cần chất vấn mỗi lựa chọn bằng',
    stackChecks: ['phương án đơn giản nhất có thể dùng', 'ảnh hưởng consistency và latency', 'failure mode và degraded mode', 'năng lực team/on-call', 'migration và trigger để thay đổi'],
    tradeoffIntro: 'Mỗi dòng là một mâu thuẫn mà thiết kế chấp nhận, không phải best practice đúng cho mọi hệ thống. Cần review cả hai phía và ghi điều kiện khiến quyết định phải đảo chiều.',
    decision: 'Mâu thuẫn cần quyết định', consequence: 'Câu hỏi review lỗi',
    failureChecks: ['Invariant nào có thể vỡ?', 'Metric nào phát hiện sớm nhất?', 'Giới hạn blast radius thế nào?', 'Retry có duplicate hoặc đảo thứ tự không?', 'Repair, reconcile và chứng minh recovery thế nào?'],
    research: 'Nghiên cứu kỹ thuật chuyên sâu', researched: 'Best practice hiện tại được tổng hợp từ tài liệu gốc. Cần kiểm tra chi tiết theo version trong nguồn liên kết trước khi triển khai.',
    furtherReading: 'Nguồn chính thống',
    migratedNote: 'Được giữ nguyên từ Topic 10–11 và các phần trùng thuộc Topic 16 trong Study Track.', source: 'Source Mermaid',
    copy: 'Copy Mermaid', copyLink: 'Copy link', copied: 'Đã copy', visualizer: 'Mở visualizer',
    diagramUnavailable: 'Không tải được renderer. Source Mermaid có thể chỉnh sửa vẫn nằm ngay bên dưới.',
    production: 'Bằng chứng production', historical: 'Kiến trúc theo thời điểm',
    historicalNote: 'Bài gốc phản ánh hệ thống, ràng buộc và công nghệ ở thời điểm được xuất bản.',
    legacyDiagram: 'Sơ đồ cũ đã được gom vào kiến trúc Mermaid có thể chỉnh sửa ở phía trên.',
    problem: 'Bài toán', coreIdea: 'Ý tưởng chính', outcome: 'Kết quả', sourceLabel: 'Nguồn',
    original: 'Bài viết gốc', toc: 'Trong bài này', tocToggle: 'Thu gọn mục lục',
    loading: 'Đang tải thư viện System Design…',
    unavailable: 'Không thể tải System Design', missing: 'Không tìm thấy bài thiết kế', retry: 'Quay lại thư viện'
  }
};

const text = () => COPY[Content.lang] || COPY.en;
const numberLabel = n => String(n).padStart(2, '0');

/* Desktop-only preference. The mobile <details> TOC must stay unaffected by it,
   so nothing here touches .sd-toc-mobile. */
const TOC_KEY = 'gazl.sd.toc';
function tocCollapsed() {
  try { return localStorage.getItem(TOC_KEY) === '0'; } catch (error) { return false; }
}
function storeTocCollapsed(collapsed) {
  try { localStorage.setItem(TOC_KEY, collapsed ? '0' : '1'); } catch (error) {}
}
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
  return '<ul>' + (items || []).map(item => '<li>' + emphasize(item) + '</li>').join('') + '</ul>';
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

/* Three tones over escaped text: clay = the cost, emerald = the rule, ink-bold
   = quantities. Narrow phrases, not keyword lists — bare verbs lit a dozen
   spans per paragraph and buried the lines that matter. See CLAUDE.md. */
const CRITICAL = /(?:\b(?:never safe|not safe for|is not safe|unsafe|must not|does not help|cannot fix|no longer optional|blast radius|hot[- ]?key|bottleneck|single point of failure|data loss|the mistake|goes wrong|breaks? down|silently)\b|(?:không an toàn|không bao giờ|không giúp|không sửa được|cái giá|trả giá|sai lầm|chọn sai|điểm nghẽn|mất dữ liệu|âm thầm))/giu;
const NOTABLE = /(?:\b(?:the rule is|rule of thumb|as a rule|the correct first move|simplest viable|cheapest correctness|reversible|prefer\b|by default|only when|exactly once)\b|(?:nguyên tắc|quy tắc|nước đi đầu tiên|đơn giản nhất|rẻ nhất|đảo ngược được|mặc định|chỉ khi|đúng một lần))/giu;
/* Entities are already in the escaped string, so &#39; must not be read as a
   number — hence the (?<!&#) guard. */
const UNIT = '(?:\\s?(?:triệu|nghìn|tỷ|[kKmM](?![\\w-])|rps|qps|ms|GB|MB|TB|%))?';
/* A range is one quantity, so "1-10 triệu" is matched whole rather than as two
   spans with a bare hyphen between them. */
const QUANTITY = new RegExp('(?<!&#)\\b\\d[\\d.,]*' + UNIT + '(?:\\s?[-–—]\\s?\\d[\\d.,]*' + UNIT + ')?', 'gu');

/* Slot indexes use private-use digits U+E010-E019, never ASCII: QUANTITY runs
   last and would otherwise eat the digits of an earlier pattern's slot. */
const SLOT_OPEN = String.fromCharCode(0xE001);
const SLOT_CLOSE = String.fromCharCode(0xE002);
const slotDigits = n => String(n).replace(/\d/g, d => String.fromCharCode(0xE010 + Number(d)));
const SLOT_RE = new RegExp(SLOT_OPEN + '([\\uE010-\\uE019]+)' + SLOT_CLOSE, 'g');

function emphasize(value) {
  const escaped = escapeHtml(String(value || ''));
  const held = [];
  // Park each match behind a sentinel so a later pattern cannot match inside
  // markup an earlier one already emitted.
  const park = html => {
    held.push(html);
    return SLOT_OPEN + slotDigits(held.length - 1) + SLOT_CLOSE;
  };
  return escaped
    .replace(CRITICAL, m => park('<b class="sd-crit">' + m + '</b>'))
    .replace(NOTABLE, m => park('<b class="sd-note">' + m + '</b>'))
    .replace(QUANTITY, m => park('<b class="sd-num">' + m + '</b>'))
    .replace(SLOT_RE, (_, digits) => held[Number(
      [...digits].map(ch => ch.charCodeAt(0) - 0xE010).join(''))]);
}

function splitDecision(value) {
  const source = String(value || '');
  const separator = source.search(/(?:\s[—–]\s|:\s)/);
  if (separator < 0) {
    const words = source.split(/\s+/);
    return { name: words.slice(0, 6).join(' ') + (words.length > 6 ? '…' : ''), detail: source };
  }
  const delimiter = source.slice(separator).match(/^(?:\s[—–]\s|:\s)/)?.[0] || '';
  return { name: source.slice(0, separator), detail: source.slice(separator + delimiter.length) };
}

/* Stacked, not tabular: a fixed name column wasted half the width on 7-char
   names. .sd-comparison-wrap stays as the outer class — tests pin it. */
function comparisonTable(rows, labels, className) {
  const body = (rows || []).map((value, index) => {
    const row = splitDecision(value);
    return '<div class="sd-decision-row"><p class="sd-decision-name"><span>' + numberLabel(index + 1)
      + '</span>' + emphasize(row.name) + '</p>'
      + (row.detail && row.detail !== row.name
        ? '<p class="sd-decision-detail">' + emphasize(row.detail) + '</p>' : '') + '</div>';
  }).join('');
  return '<div class="sd-comparison-wrap ' + className + '"><div class="sd-decision-legend"><span>'
    + escapeHtml(labels[0]) + '</span><span>' + escapeHtml(labels[1]) + '</span></div>'
    + '<div class="sd-decision-rows">' + body + '</div></div>';
}

function decisionChecks(title, checks) {
  return '<aside class="sd-decision-checks"><strong>' + escapeHtml(title) + '</strong><ul>'
    + checks.map(check => '<li>' + escapeHtml(check) + '</li>').join('') + '</ul></aside>';
}

function decisionSection(title, intro, rows, labels, checksTitle, checks, id, className) {
  return '<section class="sd-section sd-decision-section ' + className + '"><h2 id="' + id + '">' + title + '</h2>'
    + '<p class="sd-section-intro">' + emphasize(intro) + '</p>'
    + comparisonTable(rows, labels, className + '-table')
    + decisionChecks(checksTitle, checks) + '</section>';
}

function tradeoffSection(rows) {
  const cards = (rows || []).map((row, index) => {
    const parts = splitDecision(row);
    return '<article><span>' + numberLabel(index + 1) + '</span><div><strong>' + emphasize(parts.name)
      + '</strong>' + (parts.detail && parts.detail !== parts.name
        ? '<p>' + emphasize(parts.detail) + '</p>' : '') + '</div></article>';
  }).join('');
  return '<section class="sd-section sd-tradeoff-review"><h2 id="tradeoffs-failure-review">' + text().tradeoffs + '</h2>'
    + '<p class="sd-section-intro">' + emphasize(text().tradeoffIntro) + '</p><div class="sd-tradeoff-list">'
    + cards + '</div>' + decisionChecks(text().consequence, text().failureChecks) + '</section>';
}

const RESEARCH_ORIGINS = new Set([
  'https://sre.google', 'https://docs.aws.amazon.com', 'https://developers.cloudflare.com',
  'https://redis.io', 'https://docs.stripe.com', 'https://www.postgresql.org',
  'https://kafka.apache.org', 'https://learn.microsoft.com', 'https://www.elastic.co',
  'https://opentelemetry.io'
]);

function safeResearchHref(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && RESEARCH_ORIGINS.has(url.origin) ? url.href : '';
  } catch (error) { return ''; }
}

function renderResearch(design) {
  const ids = SYSTEM_DESIGN_RESEARCH.assignments[design.slug] || [];
  const packs = ids.map(id => SYSTEM_DESIGN_RESEARCH.packs[id]).filter(Boolean);
  if (!packs.length) return '';
  const body = packs.map(pack => {
    const localized = pack[Content.lang] || pack.en;
    const sections = localized.sections.map(section => '<article><h3>' + escapeHtml(section.title) + '</h3>'
      + list(section.items) + '</article>').join('');
    const sources = pack.sources.map(([label, href]) => {
      const safe = safeResearchHref(href);
      return safe ? '<a href="' + escapeHtml(safe) + '" target="_blank" rel="noopener noreferrer">'
        + escapeHtml(label) + ' ↗</a>' : '';
    }).join('');
    return '<section class="sd-research-pack"><header><h3>' + escapeHtml(localized.title) + '</h3><p>'
      + escapeHtml(localized.intro) + '</p></header><div class="sd-research-grid">' + sections + '</div>'
      + '<footer><strong>' + text().furtherReading + '</strong>' + sources + '</footer></section>';
  }).join('');
  return '<section class="sd-section sd-research"><h2 id="engineering-deep-dives">' + text().research + '</h2><p>'
    + text().researched + '</p>' + body + '</section>';
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

/* Collapses to an icon rail rather than unmounting, so the body never reflows
   mid-read. State is per reader, not per article. */
function articleShell(header, body) {
  const collapsed = tocCollapsed();
  return '<div class="sd-article' + (collapsed ? ' toc-collapsed' : '') + '" data-sd-article>'
    + header + '<details class="sd-toc-mobile"><summary>' + text().toc
    + '</summary><nav data-sd-toc-mobile></nav></details><div class="sd-article-grid">'
    + '<aside class="sd-toc"><div class="sd-toc-head"><p>' + text().toc + '</p>'
    + '<button type="button" class="sd-toc-toggle" data-sd-toc-toggle aria-expanded="' + (collapsed ? 'false' : 'true')
    + '" title="' + text().tocToggle + '"><span aria-hidden="true"></span>'
    + '<span class="sr-only">' + text().tocToggle + '</span></button></div>'
    + '<nav data-sd-toc></nav></aside>' + body + '</div></div>';
}

function renderDesignArticle(design) {
  const tags = design.tags.map(tag => '<span>' + escapeHtml(tag) + '</span>').join('');
  const header = '<header class="sd-article-head"><a class="cs-back" href="#/system-design">← ' + text().back + '</a>'
    + '<p class="cs-eyebrow">Blueprint ' + numberLabel(design.n) + ' · ' + escapeHtml(design.effort || '45 min') + '</p>'
    + '<h1>' + escapeHtml(design.title) + '</h1><p>' + escapeHtml(design.excerpt) + '</p><div class="cs-tags">' + tags + '</div></header>';
  const body = '<article class="sd-article-body" data-sd-body>'
    + '<section class="sd-section sd-scope"><h2 id="problem-framing">' + text().scope + '</h2><p>' + emphasize(design.scope) + '</p></section>'
    + '<section class="sd-section sd-requirements"><h2 id="requirements">' + text().requirements + '</h2><div><article><h3>'
    + text().functional + '</h3>' + list(design.functional) + '</article><article><h3>' + text().quality + '</h3>'
    + list(design.quality) + '</article></div></section>'
    + detailRows(text().capacity, design.capacity, 'capacity-constraints')
    + '<section class="sd-section"><h2 id="architecture">' + text().architecture + '</h2>'
    + diagramBlock(design.diagram_title || text().architecture, design.diagram) + '</section>'
    + decisionSection(text().data, text().dataIntro, design.data_model, [text().dataName, text().dataRole],
      text().dataChecksTitle, text().dataChecks, 'data-model', 'sd-data-decision')
    + decisionSection(text().stack, text().stackIntro, design.stack, [text().stackLayer, text().stackReason],
      text().stackChecksTitle, text().stackChecks, 'technology-choices', 'sd-stack-decision')
    + tradeoffSection(design.tradeoffs)
    + renderResearch(design)
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
    link.closest('.sd-toc-mobile')?.removeAttribute('open');
  }));

  const article = root.querySelector('[data-sd-article]');
  root.querySelector('[data-sd-toc-toggle]')?.addEventListener('click', event => {
    const collapsed = article.classList.toggle('toc-collapsed');
    event.currentTarget.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    storeTocCollapsed(collapsed);
  });
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
