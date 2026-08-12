import { escapeHtml, renderMarkdown } from '../lib/markdown.js';
import { copyText } from '../lib/clipboard.js';
import { Content } from '../lib/content.js';
import { SystemDesign } from '../lib/system-design.js';
import { CaseStudies } from '../lib/case-studies.js';
import { mountMermaidDiagrams } from '../lib/mermaid.js';
import { systemDesignQuestionUrl } from '../lib/question-links.js';
import { crossRefResolver } from '../lib/cross-ref.js';
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
    decision: 'Decision tension', consequence: 'Failure-review questions', failureReviewAnswered: 'Failure review — answers for this design',
    failureAnswerLead: [
      'The stated correctness guard is: ',
      'Start detection from this workload or capacity trigger: ',
      'Contain the failure at this boundary: ',
      'Retry and ordering safety are anchored in: ',
      'Recovery evidence and the repair path start with: '
    ],
    failureChecks: ['What invariant can break?', 'Which metric detects it first?', 'How is the blast radius contained?', 'Can retry duplicate or reorder work?', 'How do we repair, reconcile and prove recovery?'],
    research: 'Engineering deep dives', researched: 'Current practice distilled from primary documentation. Validate version-specific details against the linked sources before implementation.',
    furtherReading: 'Primary sources',
    migrated: 'Migrated deep-dive notes', migratedNote: 'Preserved from Study Track topics 10–11 and the overlapping Topic 16 sections.',
    source: 'Mermaid source', copy: 'Copy Mermaid', copyLink: 'Copy link', copied: 'Copied', visualizer: 'Open visualizer',
    zoomControls: 'Diagram zoom', zoomOut: 'Zoom out', zoomIn: 'Zoom in', zoomReset: 'Reset zoom',
    diagramUnavailable: 'Diagram renderer unavailable. The editable Mermaid source is still available below.',
    production: 'Production evidence', historical: 'Historical architecture',
    historicalNote: 'The preserved article reflects the system, constraints and technology available at publication time.',
    legacyDiagram: 'The former drawing is consolidated into the editable Mermaid architecture above.',
    problem: 'Problem', coreIdea: 'Core idea', outcome: 'Outcome', takeaways: 'Key takeaways', review: 'Review questions', sourceLabel: 'Source',
    original: 'Original article', toc: 'On this page', tocToggle: 'Collapse contents',
    loading: 'Loading the System Design library…',
    unavailable: 'Could not load System Design', missing: 'Design not found', retry: 'Back to the library'
  },
  vi: {
    eyebrow: 'Experience · Design library', blueprints: n => n === 1 ? 'blueprint' : 'blueprints', cases: n => n === 1 ? 'production case' : 'production cases',
    open: 'Mở blueprint', read: 'Đọc production case', back: 'System Design library', scope: 'Problem framing',
    requirements: 'Requirements',
    functional: 'Functional requirements', quality: 'Quality attributes', capacity: 'Capacity & constraints',
    architecture: 'High-level architecture', data: 'Data model', stack: 'Technology choices',
    tradeoffs: 'Trade-offs & failure review', migrated: 'Migrated deep dives',
    dataIntro: 'So sánh record theo quyền sở hữu và trách nhiệm trước khi chọn storage. Mỗi record nên là authoritative, operational hoặc derived; trộn các vai trò này sẽ làm boundary consistency mơ hồ.',
    dataName: 'Record / model', dataRole: 'Fields, ownership và responsibility',
    dataChecksTitle: 'Compare models on',
    dataChecks: ['transaction boundary và invariant', 'read/write path và indexes', 'partition key và hot-key risk', 'retention, audit và privacy', 'rebuildability sau data loss'],
    stackIntro: 'Xem đây là bản đồ quyết định, không phải danh sách công nghệ. Mỗi component phải giải một constraint cụ thể và có operational cost rõ ràng.',
    stackLayer: 'Layer / option', stackReason: 'Choice, purpose và boundary',
    stackChecksTitle: 'Challenge mỗi choice bằng',
    stackChecks: ['simplest viable alternative', 'consistency và latency impact', 'failure/degraded mode', 'team/on-call capability', 'migration và exit trigger'],
    tradeoffIntro: 'Mỗi row là một tension mà design chấp nhận, không phải best practice đúng cho mọi hệ thống. Review cả hai phía và ghi điều kiện khiến decision phải đảo chiều.',
    decision: 'Decision tension', consequence: 'Failure-review questions', failureReviewAnswered: 'Failure review — câu trả lời cho design này',
    failureAnswerLead: [
      'Correctness guard được nêu cho design này là: ',
      'Bắt đầu detect từ workload hoặc capacity trigger: ',
      'Contain failure tại boundary sau: ',
      'An toàn retry và ordering dựa vào: ',
      'Bằng chứng recovery và đường repair bắt đầu từ: '
    ],
    failureChecks: ['Invariant nào có thể break?', 'Metric nào detect sớm nhất?', 'Blast radius được contain thế nào?', 'Retry có duplicate hoặc reorder work không?', 'Repair, reconcile và prove recovery thế nào?'],
    research: 'Engineering deep dives', researched: 'Best practice hiện tại được chắt lọc từ primary docs. Kiểm tra version-specific details trong nguồn liên kết trước khi triển khai.',
    furtherReading: 'Primary sources',
    migratedNote: 'Giữ lại từ Topic 10–11 và các phần overlap của Topic 16 trong Study Track.', source: 'Mermaid source',
    copy: 'Copy Mermaid', copyLink: 'Copy link', copied: 'Đã copy', visualizer: 'Mở visualizer',
    zoomControls: 'Phóng to/thu nhỏ sơ đồ', zoomOut: 'Thu nhỏ', zoomIn: 'Phóng to', zoomReset: 'Đặt lại tỷ lệ',
    diagramUnavailable: 'Renderer không khả dụng. Editable Mermaid source vẫn nằm bên dưới.',
    production: 'Production evidence', historical: 'Historical architecture',
    historicalNote: 'Bài gốc phản ánh system, constraints và technology ở thời điểm được publish.',
    legacyDiagram: 'Legacy diagram đã được gom vào editable Mermaid architecture ở phía trên.',
    problem: 'Problem', coreIdea: 'Core idea', outcome: 'Outcome', takeaways: 'Key takeaways', review: 'Review questions', sourceLabel: 'Source',
    original: 'Original article', toc: 'On this page', tocToggle: 'Collapse contents',
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
  return '<ul>' + (items || []).map(listRow).join('') + '</ul>';
}

function diagramBlock(title, diagram) {
  return '<figure class="sd-diagram" data-diagram-frame><figcaption><strong>' + escapeHtml(title) + '</strong>'
    + '<span class="sd-diagram-actions"><button type="button" data-copy-mermaid>' + text().copy + '</button>'
    + '<span class="sd-diagram-zoom" data-mermaid-zoom-controls role="group" aria-label="' + escapeHtml(text().zoomControls) + '" hidden>'
    + '<button type="button" data-mermaid-zoom-out aria-label="' + escapeHtml(text().zoomOut) + '" title="' + escapeHtml(text().zoomOut) + '">−</button>'
    + '<button type="button" data-mermaid-zoom-reset aria-label="' + escapeHtml(text().zoomReset) + '" title="' + escapeHtml(text().zoomReset) + '">100%</button>'
    + '<button type="button" data-mermaid-zoom-in aria-label="' + escapeHtml(text().zoomIn) + '" title="' + escapeHtml(text().zoomIn) + '">+</button></span>'
    + '<a href="https://mermaid.live/" target="_blank" rel="noopener noreferrer">' + text().visualizer + ' ↗</a></span></figcaption>'
    + '<div class="sd-diagram-viewport" data-mermaid-viewport tabindex="0"><pre class="mermaid" data-mermaid-diagram>' + escapeHtml(diagram) + '</pre></div>'
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

/* Sentence break for EN and VI. VI has no different rule here, but the
   lookahead must accept accented capitals or it splits mid-sentence. */
const SENTENCE = /(?<=[.?!])\s+(?=[A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝ0-9"“(])/u;

/* Scope runs 1-5 sentences (median 2), so a fixed split would mangle the short
   ones. Only prose long enough to read as a wall is broken up, and the closing
   sentence is pulled out as the thesis when it is a standalone claim. */
function renderScope(value) {
  const source = String(value || '').trim();
  const sentences = source.split(SENTENCE).filter(Boolean);
  if (source.length < 260 || sentences.length < 3) {
    return '<p>' + emphasize(source) + '</p>';
  }

  const lead = sentences[0];
  const rest = sentences.slice(1);
  // A short final sentence that makes a claim reads as the takeaway; a long one
  // is still body text and stays in the paragraph.
  const closing = rest.length > 1 && rest[rest.length - 1].length <= 160 ? rest.pop() : '';

  return '<p class="sd-lead">' + emphasize(lead) + '</p>'
    + (rest.length ? '<p>' + emphasize(rest.join(' ')) + '</p>' : '')
    + (closing ? '<p class="sd-thesis">' + emphasize(closing) + '</p>' : '');
}

/* 9% of list rows open with "label: rest". Promoting the label to its own line
   is what stops it running into the body text; the other 91% render unchanged,
   so this must degrade to a plain <li>. */
const ROW_LABEL = /^([^:—–]{4,60}):\s+(?=\S)/u;

function listRow(value) {
  const source = String(value || '').trim();
  const match = source.match(ROW_LABEL);
  if (!match) return '<li>' + emphasize(source) + '</li>';
  // The colon rides with the label: dropping it would delete source text, and
  // the label is a heading here, not a fragment of the sentence below it.
  return '<li class="has-label"><b class="sd-row-label">' + emphasize(match[1]) + ':</b>'
    + emphasize(source.slice(match[0].length)) + '</li>';
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

function reviewEvidence(rows, pattern, fallback = '') {
  return (rows || []).find(row => pattern.test(row)) || (rows || [])[0] || fallback;
}

/* Existing blueprint fields are the source of truth for the normal case. A
   bespoke `failure_review` is only needed when a design, such as flash sale,
   has a richer runbook answer than its decision rows can express. */
function inferredFailureReview(design) {
  const quality = design.quality || [];
  const capacity = design.capacity || [];
  const data = design.data_model || [];
  const stack = design.stack || [];
  const tradeoffs = design.tradeoffs || [];
  const retryRows = [...quality, ...data, ...stack, ...tradeoffs];
  const recoveryRows = [...data, ...quality, ...stack, ...tradeoffs];
  const leads = text().failureAnswerLead;
  return [
    {
      question: text().failureChecks[0],
      answer: leads[0] + reviewEvidence(quality, /invariant|correctness|consistent|oversell|balanced|durab|bất biến|đúng|không.*vượt/i)
    },
    {
      question: text().failureChecks[1],
      answer: leads[1] + reviewEvidence(capacity, /measure|benchmark|track|load.test|peak|budget|estimate|model|đo|benchmark|theo dõi|đỉnh/i)
    },
    {
      question: text().failureChecks[2],
      answer: leads[2] + reviewEvidence([...stack, ...quality], /bound|limit|partition|isolate|queue|cache|circuit|shard|separate|gateway|giới hạn|cô lập|phân vùng|hàng đợi|cache/i)
    },
    {
      question: text().failureChecks[3],
      answer: leads[3] + reviewEvidence(retryRows, /idempoten|retry|version|sequence|outbox|dedup|unique|replay|thử lại|phiên bản|thứ tự|duy nhất/i)
    },
    {
      question: text().failureChecks[4],
      answer: leads[4] + reviewEvidence(recoveryRows, /reconcil|replay|audit|restore|recover|outbox|snapshot|repair|durab|đối soát|khôi phục|sửa|bền/i)
    }
  ];
}

function failureReviewSection(design) {
  const answers = (design.failure_review || []).filter(entry => entry?.question && entry?.answer);
  const resolved = answers.length ? answers : inferredFailureReview(design);
  const cards = resolved.map((entry, index) => '<article><span>' + numberLabel(index + 1) + '</span><div><h3>'
    + emphasize(entry.question) + '</h3><p>' + emphasize(entry.answer) + '</p></div></article>').join('');
  return '<aside class="sd-failure-review"><strong>' + escapeHtml(text().failureReviewAnswered) + '</strong>'
    + '<div>' + cards + '</div></aside>';
}

function tradeoffSection(design) {
  const cards = (design.tradeoffs || []).map((row, index) => {
    const parts = splitDecision(row);
    return '<article><span>' + numberLabel(index + 1) + '</span><div><strong>' + emphasize(parts.name)
      + '</strong>' + (parts.detail && parts.detail !== parts.name
        ? '<p>' + emphasize(parts.detail) + '</p>' : '') + '</div></article>';
  }).join('');
  return '<section class="sd-section sd-tradeoff-review"><h2 id="tradeoffs-failure-review">' + text().tradeoffs + '</h2>'
    + '<p class="sd-section-intro">' + emphasize(text().tradeoffIntro) + '</p><div class="sd-tradeoff-list">'
    + cards + '</div>' + failureReviewSection(design) + '</section>';
}

const RESEARCH_ORIGINS = new Set([
  'https://sre.google', 'https://docs.aws.amazon.com', 'https://developers.cloudflare.com',
  'https://redis.io', 'https://docs.stripe.com', 'https://www.postgresql.org',
  'https://kafka.apache.org', 'https://learn.microsoft.com', 'https://www.elastic.co',
  'https://opentelemetry.io', 'https://www.rfc-editor.org', 'https://docs.spring.io',
  'https://openid.net', 'https://resilience4j.readme.io', 'https://www.openpolicyagent.org'
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
  return renderMarkdown(markdown, { resolveRef: crossRefResolver() }).replace(/<figure\s+class=['"]dgm['"][\s\S]*?<\/figure>/gi, replacement);
}

function renderSourceNotes(design) {
  if (!design.sourceNotes.length) return '';
  const migratedNote = design.slug === 'api-gateway-identity-edge'
    ? (Content.lang === 'vi'
      ? 'Giữ lại từ Topic 27 — API gateway và identity edge trong System Design.'
      : 'Preserved from Topic 27 — API gateway and identity edge in System Design.')
    : text().migratedNote;
  return '<section class="sd-section sd-notes"><h2 id="migrated-notes">' + text().migrated + '</h2><p>'
    + migratedNote + '</p>' + design.sourceNotes.map(note => '<details id="question-' + escapeHtml(note.id)
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
    + '<section class="sd-section sd-scope"><h2 id="problem-framing">' + text().scope + '</h2>'
    + renderScope(design.scope) + '</section>'
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
    + tradeoffSection(design)
    + renderResearch(design)
    + renderSourceNotes(design) + '</article>';
  return articleShell(header, body);
}

function renderCaseGuide(article) {
  const guide = article.guide;
  if (!guide) return '';
  const takeaways = (guide.takeaways || []).map(item => '<li>' + emphasize(item) + '</li>').join('');
  const reviewLenses = (guide.review_lenses || []).map(item => '<li>' + emphasize(item) + '</li>').join('');
  return '<section class="sd-section sd-case-guide"><h2 id="design-review">' + text().production + '</h2>'
    + '<div class="sd-case-guide-brief"><article><h3>' + text().problem + '</h3><p>' + emphasize(guide.problem) + '</p></article>'
    + '<article><h3>' + text().coreIdea + '</h3><p>' + emphasize(guide.core_idea) + '</p></article>'
    + '<article><h3>' + text().outcome + '</h3><p>' + emphasize(guide.outcome) + '</p></article></div>'
    + '<div class="sd-case-guide-depth"><article><h3>' + text().takeaways + '</h3><ul>' + takeaways + '</ul></article>'
    + '<article><h3>' + text().review + '</h3><ul>' + reviewLenses + '</ul></article></div></section>';
}

function renderProductionArticle(article, overview, archivedBody) {
  const href = sourceHref(article.source_url);
  const tags = article.tags.map(tag => '<span>' + escapeHtml(tag) + '</span>').join('');
  const header = '<header class="sd-article-head"><a class="cs-back" href="#/system-design">← ' + text().back + '</a>'
    + '<p class="cs-eyebrow">' + text().production + ' · Tiki Engineering</p><h1>' + escapeHtml(article.title) + '</h1>'
    + '<p>' + escapeHtml(article.excerpt) + '</p><div class="cs-tags">' + tags + '</div>'
    + '<div class="cs-archive-note"><b>' + text().historical + '</b><span>' + text().historicalNote + '</span></div></header>';
  const body = '<article class="sd-article-body" data-sd-body>'
    + '<section class="sd-section sd-scope"><h2 id="architecture-lens">' + text().architecture + '</h2>'
    + renderScope(overview?.lens || article.excerpt)
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

const MERMAID_ZOOM_MIN = 0.5;
const MERMAID_ZOOM_MAX = 2.5;
const MERMAID_ZOOM_STEP = 0.25;

function setDiagramZoom(frame, requested) {
  const viewport = frame.querySelector('[data-mermaid-viewport]');
  const svg = viewport?.querySelector('svg');
  if (!viewport || !svg) return;

  const previous = Number(frame.dataset.mermaidZoom || 1);
  const zoom = Math.min(MERMAID_ZOOM_MAX, Math.max(MERMAID_ZOOM_MIN, requested));
  const centerX = viewport.scrollLeft + viewport.clientWidth / 2;
  const centerY = viewport.scrollTop + viewport.clientHeight / 2;
  svg.style.width = (zoom * 100).toFixed(0) + '%';
  frame.dataset.mermaidZoom = String(zoom);
  frame.classList.toggle('is-zoomed', zoom !== 1);

  const label = Math.round(zoom * 100) + '%';
  const reset = frame.querySelector('[data-mermaid-zoom-reset]');
  if (reset) {
    reset.textContent = label;
    reset.setAttribute('aria-label', text().zoomReset + ' (' + label + ')');
  }
  viewport.scrollLeft = Math.max(0, centerX * zoom / previous - viewport.clientWidth / 2);
  viewport.scrollTop = Math.max(0, centerY * zoom / previous - viewport.clientHeight / 2);
}

function wireDiagramZoom(root) {
  root.querySelectorAll('[data-diagram-frame].is-rendered').forEach(frame => {
    if (frame.dataset.mermaidZoomWired) return;
    const viewport = frame.querySelector('[data-mermaid-viewport]');
    const controls = frame.querySelector('[data-mermaid-zoom-controls]');
    if (!viewport || !controls || !viewport.querySelector('svg')) return;
    frame.dataset.mermaidZoomWired = 'true';
    controls.hidden = false;
    setDiagramZoom(frame, 1);

    const change = amount => setDiagramZoom(frame, Number(frame.dataset.mermaidZoom || 1) + amount);
    frame.querySelector('[data-mermaid-zoom-in]')?.addEventListener('click', () => change(MERMAID_ZOOM_STEP));
    frame.querySelector('[data-mermaid-zoom-out]')?.addEventListener('click', () => change(-MERMAID_ZOOM_STEP));
    frame.querySelector('[data-mermaid-zoom-reset]')?.addEventListener('click', () => setDiagramZoom(frame, 1));

    viewport.addEventListener('keydown', event => {
      if (event.key === '+' || event.key === '=') { event.preventDefault(); change(MERMAID_ZOOM_STEP); }
      if (event.key === '-') { event.preventDefault(); change(-MERMAID_ZOOM_STEP); }
      if (event.key === '0') { event.preventDefault(); setDiagramZoom(frame, 1); }
    });
    viewport.addEventListener('wheel', event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      change(event.deltaY < 0 ? MERMAID_ZOOM_STEP : -MERMAID_ZOOM_STEP);
    }, { passive: false });

    let drag = null;
    viewport.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('is-dragging');
    });
    viewport.addEventListener('pointermove', event => {
      if (!drag) return;
      viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      viewport.scrollTop = drag.top - (event.clientY - drag.y);
    });
    const stopDrag = event => {
      if (!drag) return;
      drag = null;
      viewport.classList.remove('is-dragging');
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    };
    viewport.addEventListener('pointerup', stopDrag);
    viewport.addEventListener('pointercancel', stopDrag);
  });
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
  wireDiagramZoom(root);
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
