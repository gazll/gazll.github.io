import { escapeHtml } from '../lib/markdown.js';
import { Content } from '../lib/content.js';
import { CaseStudies } from '../lib/case-studies.js';
import { bulletParts, sentences } from '../lib/prose.js';
import { rememberOpened, restoreCard, stickyGroupHeads, takeOpened } from '../lib/reading-position.js';
import { anchorHref, decorateHeadingPermalinks, scrollToAnchor, withRouteLanguage } from '../lib/anchors.js';

let mountToken = 0;
const TOC_STATE_KEY = 'gazl.caseTocCollapsed';
const RETURN_SURFACE = 'case-studies';

const COPY = {
  en: {
    collection: 'Collection', cases: count => count === 1 ? 'case study' : 'case studies', company: 'company',
    availableLanguage: 'English · Vietnamese', minuteRead: 'min read', number: 'No.',
    allCases: 'All case studies', historical: 'Historical case study',
    historicalNote: 'Architecture, technology choices and benchmark figures reflect the system and workload described at publication time.',
    original: 'English original', translation: 'English translation', guideEyebrow: 'Reading guide · Editorial synthesis',
    problem: 'Problem', coreIdea: 'Core idea', outcome: 'Reported outcome', takeaways: 'Key takeaways',
    review: 'Design review lens', guideNote: 'The guide above is editorial synthesis; the preserved Tiki Engineering article continues below.',
    toc: 'On this page', contents: 'Article contents', hideToc: 'Hide contents', showToc: 'Show contents',
    readSource: 'Read at Tiki Engineering', source: 'Source',
    originalArticle: 'original article', closeImage: 'Close image', notFound: 'Case study not found',
    missing: 'That article is not in this collection.', back: 'Back to case studies', loading: 'Loading case studies…',
    unavailable: 'Could not load this collection', unavailableTitle: 'The case-study files are unavailable.', retry: 'Try again',
    levelCore: 'Core', levelAdvanced: 'Advanced', levelExtra: 'Extra', featured: 'Featured',
    locale: 'en'
  },
  vi: {
    collection: 'Collection', cases: count => count === 1 ? 'case study' : 'case studies', company: 'company',
    availableLanguage: 'Vietnamese · English', minuteRead: 'min read', number: 'No.',
    allCases: 'All case studies', historical: 'Historical case study',
    historicalNote: 'Architecture, technology choices và benchmark figures phản ánh system cùng workload tại thời điểm bài được publish.',
    original: 'Vietnamese original', translation: 'Vietnamese translation', guideEyebrow: 'Reading guide · Editorial synthesis',
    problem: 'Problem', coreIdea: 'Core idea', outcome: 'Reported outcome', takeaways: 'Key takeaways',
    review: 'Design review lens', guideNote: 'Phần trên là editorial synthesis để hỗ trợ đọc; bài Tiki Engineering được giữ lại bên dưới.',
    toc: 'On this page', contents: 'Article contents', hideToc: 'Hide contents', showToc: 'Show contents',
    readSource: 'Đọc tại Tiki Engineering', source: 'Nguồn',
    originalArticle: 'bài viết gốc', closeImage: 'Đóng ảnh', notFound: 'Không tìm thấy case study',
    missing: 'Bài viết này không có trong bộ sưu tập.', back: 'Quay lại Case Studies', loading: 'Đang tải case study…',
    unavailable: 'Không thể tải bộ sưu tập', unavailableTitle: 'Các file case study hiện không khả dụng.', retry: 'Thử lại',
    levelCore: 'Core', levelAdvanced: 'Advanced', levelExtra: 'Extra', featured: 'Nổi bật',
    locale: 'vi-VN'
  }
};

const text = () => COPY[Content.lang] || COPY.en;
const MOVED_TO_SYSTEM_DESIGN = 'systems-architecture';
const numberLabel = article => String(article.n).padStart(2, '0');
const languageLabel = article => article.is_translation ? text().translation : text().original;
function levelMarkup(article) {
  const labels = { core: text().levelCore, advanced: text().levelAdvanced, extra: text().levelExtra };
  const level = labels[article?.level] ? article.level : 'advanced';
  return '<span class="content-level level-' + level + '">' + labels[level] + '</span>'
    + (article?.featured ? '<span class="featured-mark" title="' + text().featured + '" aria-label="' + text().featured + '">★</span>' : '');
}

const sourceHref = url => /^https:\/\/engineering\.tiki\.vn\//.test(url || '')
  ? url
  : 'https://engineering.tiki.vn/';

function formatDate(value) {
  const date = new Date(value + 'T00:00:00Z');
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(text().locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function renderCard(article, category) {
  const coverFit = article.cover_fit === 'contain' ? ' contain' : '';
  return '<a class="cs-card" data-card-key="' + escapeHtml(article.slug) + '" href="'
    + escapeHtml(withRouteLanguage('#/case-studies/' + encodeURIComponent(article.slug), Content.lang)) + '">'
    + '<span class="cs-card-art' + coverFit + '" aria-hidden="true"><img src="'
    + escapeHtml(article.cover_image) + '" alt="" loading="lazy" decoding="async"></span>'
    + '<span class="cs-card-content">'
    + '<span class="cs-card-kicker">' + text().number + ' ' + numberLabel(article) + ' · '
    + escapeHtml(article.company) + ' · ' + escapeHtml(languageLabel(article)) + ' ' + levelMarkup(article) + '</span>'
    + '<strong>' + escapeHtml(article.title) + '</strong>'
    + '<span class="cs-card-excerpt">' + escapeHtml(article.excerpt) + '</span>'
    + '<span class="cs-card-meta"><span>' + escapeHtml(category.label) + '</span><span>'
    + article.read_minutes + ' ' + text().minuteRead + '</span></span>'
    + '</span><span class="cs-card-arrow" aria-hidden="true">→</span></a>';
}

function renderLibrary(collection) {
  // Architecture cases now live in the dedicated System Design library.
  // Direct legacy article URLs remain routable for existing bookmarks.
  const articles = (collection.articles || []).filter(article => article.category !== MOVED_TO_SYSTEM_DESIGN);
  const categories = (collection.categories || []).filter(category => category.id !== MOVED_TO_SYSTEM_DESIGN);
  const groups = categories.map(category => {
    const rows = articles.filter(article => article.category === category.id);
    if (!rows.length) return '';
    return '<section class="cs-category" aria-labelledby="cs-category-' + escapeHtml(category.id) + '">'
      + '<header class="cs-category-head"><div><p>' + text().collection + '</p><h2 id="cs-category-' + escapeHtml(category.id) + '">'
      + escapeHtml(category.label) + '</h2><span>' + escapeHtml(category.description) + '</span></div>'
      + '<b>' + rows.length + '</b></header>'
      + '<div class="cs-card-grid">' + rows.map(article => renderCard(article, category)).join('') + '</div></section>';
  }).join('');

  return '<div class="cs-library">'
    + '<header class="cs-library-hero"><p class="cs-eyebrow">' + escapeHtml(collection.library.eyebrow) + '</p>'
    + '<h1 id="case-library-title">' + escapeHtml(collection.library.title) + '</h1>'
    + '<p>' + escapeHtml(collection.library.intro) + '</p>'
    + '<div class="cs-library-stats"><span><b>' + articles.length + '</b> ' + text().cases(articles.length) + '</span>'
    + '<span><b>1</b> ' + text().company + '</span><span>' + text().availableLanguage + '</span></div></header>'
    + groups + '</div>';
}

function articleMeta(article) {
  const tags = (article.tags || []).map(tag => '<span>' + escapeHtml(tag) + '</span>').join('');
  const href = sourceHref(article.source_url);
  return '<header class="cs-article-head">'
    + '<p class="cs-eyebrow">' + text().number + ' ' + numberLabel(article) + ' · '
    + escapeHtml(article.company) + ' · ' + escapeHtml(article.category_label) + ' ' + levelMarkup(article) + '</p>'
    + '<h1 id="case-study-' + escapeHtml(article.slug) + '-title">' + escapeHtml(article.title) + '</h1>'
    + '<p class="cs-deck">' + escapeHtml(article.excerpt) + '</p>'
    + '<div class="cs-byline"><span>' + formatDate(article.published_at) + '</span>'
    + '<a class="cs-origin" href="' + href + '" target="_blank" rel="noopener noreferrer">'
    + escapeHtml(article.company) + ' ↗</a>'
    + '<span class="cs-language">' + escapeHtml(languageLabel(article)) + '</span></div>'
    + '<div class="cs-tags">' + tags + '</div>'
    + '<div class="cs-archive-note"><b>' + text().historical + '</b><span>' + text().historicalNote + '</span></div>'
    + '</header>';
}

/* Guide briefs are deliberately short, but several contain two dense sentences.
   Unlike archived article HTML, this is trusted plain JSON prose and can be
   separated safely without changing the source article. A sentence that
   enumerates becomes the list it already was — lib/prose.js decides which
   ones qualify, and the study surfaces share that judgement. */
function guideLine(value, className) {
  const source = String(value || '').trim();
  const attribute = className ? ' class="' + className + '"' : '';
  const { lead, items } = bulletParts(source);
  if (!items.length || !lead) return '<p' + attribute + '>' + escapeHtml(source) + '</p>';
  return '<p' + attribute + '>' + escapeHtml(lead) + '</p><ul class="cs-clause-list">'
    + items.map(item => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>';
}
function renderGuideProse(value) {
  const source = String(value || '').trim();
  const lines = sentences(source);
  if (source.length < 220 || lines.length < 2) return guideLine(source, '');

  const closing = lines.pop();
  const thesis = closing.length <= 170 ? 'cs-guide-thesis' : '';
  return lines.map((sentence, index) => guideLine(sentence, index === 0 ? 'cs-guide-lead' : '')).join('')
    + guideLine(closing, thesis);
}

function renderGuide(guide) {
  if (!guide) return '';
  const takeaways = (guide.takeaways || []).map(item => '<li>' + escapeHtml(item) + '</li>').join('');
  const reviewLenses = (guide.review_lenses || []).map(item => '<li>' + escapeHtml(item) + '</li>').join('');
  return '<section class="cs-guide" aria-labelledby="cs-guide-title">'
    + '<header><p>' + text().guideEyebrow + '</p>'
    + '<h2 id="cs-guide-title">' + escapeHtml(guide.title) + '</h2></header>'
    + '<div class="cs-guide-brief">'
    + '<article><b>' + text().problem + '</b>' + renderGuideProse(guide.problem) + '</article>'
    + '<article><b>' + text().coreIdea + '</b>' + renderGuideProse(guide.core_idea) + '</article>'
    + '<article><b>' + text().outcome + '</b>' + renderGuideProse(guide.outcome) + '</article>'
    + '</div><div class="cs-guide-depth">'
    + '<article><h3>' + text().takeaways + '</h3><ul>' + takeaways + '</ul></article>'
    + '<article><h3>' + text().review + '</h3><ul>' + reviewLenses + '</ul></article>'
    + '</div><p class="cs-guide-note">' + text().guideNote + ' ↓</p></section>';
}

function renderArticle(article, body, guide) {
  const href = sourceHref(article.source_url);
  // Sticky for the whole article and separate from the site header: these
  // articles run several screens, and a back link that scrolled away with the
  // title made leaving a scroll back to the top.
  return '<div class="cs-article"><div class="cs-backbar"><a class="cs-back" href="'
    + escapeHtml(withRouteLanguage('#/case-studies', Content.lang)) + '">← ' + text().allCases + '</a></div>'
    + articleMeta(article)
    + renderGuide(guide)
    + '<details class="cs-toc-mobile"><summary>' + text().toc + '</summary><nav data-case-toc-mobile></nav></details>'
    + '<div class="cs-article-grid">'
    + '<aside class="cs-toc" data-case-toc-panel aria-label="' + text().contents + '">'
    + '<div class="cs-toc-head"><p>' + text().toc + '</p>'
    + '<button type="button" data-case-toc-toggle aria-expanded="true" aria-controls="cs-toc-content" aria-label="'
    + text().hideToc + '" title="' + text().hideToc + '"><span aria-hidden="true">‹</span></button></div>'
    + '<div class="cs-toc-content" id="cs-toc-content" data-case-toc-content><nav data-case-toc></nav>'
    + '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + text().readSource + ' ↗</a></div></aside>'
    + '<article class="cs-article-body" data-case-body>' + body + '</article>'
    + '</div>'
    + '<footer class="cs-source"><span>' + text().source + '</span><a href="' + href + '" target="_blank" rel="noopener noreferrer">'
    + escapeHtml(article.company) + ' — ' + text().originalArticle + ' ↗</a></footer>'
    + '<dialog class="cs-lightbox" data-case-lightbox><button type="button" aria-label="' + text().closeImage + '">×</button>'
    + '<figure><img alt=""><figcaption></figcaption></figure></dialog></div>';
}

function buildToc(root, slug) {
  const headings = [...root.querySelectorAll('[data-case-body] h2[id], [data-case-body] h3[id]')];
  const articleRoute = '/case-studies/' + encodeURIComponent(slug);
  const html = headings.map(heading => '<a class="' + (heading.tagName === 'H3' ? 'is-sub' : '')
    + '" href="' + escapeHtml(anchorHref(heading.id, articleRoute)) + '" data-anchor-link data-anchor-id="'
    + escapeHtml(heading.id) + '" data-anchor-route="' + escapeHtml(articleRoute) + '" data-case-section="' + escapeHtml(heading.id) + '">'
    + escapeHtml(heading.textContent) + '</a>').join('');
  root.querySelectorAll('[data-case-toc], [data-case-toc-mobile]').forEach(nav => { nav.innerHTML = html; });
  root.querySelectorAll('[data-case-section]').forEach(link => {
    link.addEventListener('click', () => link.closest('.cs-toc-mobile')?.removeAttribute('open'));
  });
}

function readTocState() {
  try { return localStorage.getItem(TOC_STATE_KEY) === '1'; } catch (e) { return false; }
}

function wireTocToggle(root) {
  const grid = root.querySelector('.cs-article-grid');
  const panel = root.querySelector('[data-case-toc-panel]');
  const content = root.querySelector('[data-case-toc-content]');
  const button = root.querySelector('[data-case-toc-toggle]');
  if (!grid || !panel || !content || !button) return;

  const apply = collapsed => {
    grid.classList.toggle('is-toc-collapsed', collapsed);
    panel.classList.toggle('is-collapsed', collapsed);
    content.hidden = collapsed;
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? text().showToc : text().hideToc);
    button.title = collapsed ? text().showToc : text().hideToc;
    button.querySelector('span').textContent = collapsed ? '›' : '‹';
  };

  apply(readTocState());
  button.addEventListener('click', () => {
    const collapsed = !panel.classList.contains('is-collapsed');
    try { localStorage.setItem(TOC_STATE_KEY, collapsed ? '1' : '0'); } catch (e) {}
    apply(collapsed);
  });
}

function wireLightbox(root) {
  const dialog = root.querySelector('[data-case-lightbox]');
  if (!dialog) return;
  const fullImage = dialog.querySelector('img');
  const caption = dialog.querySelector('figcaption');

  root.querySelectorAll('[data-zoom-image]').forEach(button => {
    button.addEventListener('click', () => {
      const image = button.querySelector('img');
      fullImage.src = image.currentSrc || image.src;
      fullImage.alt = image.alt;
      caption.textContent = button.closest('figure')?.querySelector('figcaption')?.textContent || image.alt;
      dialog.showModal();
    });
  });
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
}

async function showArticle(root, collection, slug, token, anchor = '') {
  const article = (collection.articles || []).find(row => row.slug === slug);
  if (!article) {
    root.innerHTML = '<div class="cs-empty"><p class="cs-eyebrow">' + text().notFound + '</p>'
      + '<h1>' + text().missing + '</h1><a href="' + escapeHtml(withRouteLanguage('#/case-studies', Content.lang)) + '">← ' + text().back + '</a></div>';
    decorateHeadingPermalinks(root);
    document.title = text().notFound + ' · Backend Engineering';
    return;
  }

  const body = await collection.body(article);
  if (token !== mountToken) return;

  root.innerHTML = renderArticle(article, body, article.guide);
  rememberOpened(RETURN_SURFACE, article.slug);
  decorateHeadingPermalinks(root);
  document.title = article.title + ' · Backend Engineering';
  buildToc(root, article.slug);
  wireTocToggle(root);
  wireLightbox(root);
  if (anchor) requestAnimationFrame(() => scrollToAnchor(root, anchor, { behavior: 'auto' }));
}

export function renderCaseStudies() {
  return '<section class="cs-shell" data-case-root aria-live="polite">'
    + '<div class="cs-loading"><span></span><p>' + text().loading + '</p></div></section>';
}

export async function mountCaseStudies(host, routeParts = [], anchor = '') {
  const token = ++mountToken;
  const root = host.querySelector('[data-case-root]');
  if (!root) return;

  try {
    const collection = await CaseStudies.load(Content.lang);
    if (token !== mountToken) return;
    const slug = routeParts[0] ? decodeURIComponent(routeParts[0]) : '';
    if (slug) await showArticle(root, collection, slug, token, anchor);
    else {
      root.innerHTML = renderLibrary(collection);
      decorateHeadingPermalinks(root);
      stickyGroupHeads(root, '.cs-category-head');
      // An anchor is an explicit destination and outranks the card the reader
      // came back from.
      if (!anchor) restoreCard(root, takeOpened(RETURN_SURFACE));
    }
  } catch (error) {
    if (token !== mountToken) return;
    root.innerHTML = '<div class="cs-empty"><p class="cs-eyebrow">' + text().unavailable + '</p>'
      + '<h1>' + text().unavailableTitle + '</h1><p>' + escapeHtml(error?.message || String(error)) + '</p>'
      + '<a href="' + escapeHtml(withRouteLanguage('#/case-studies', Content.lang)) + '">' + text().retry + '</a></div>';
    decorateHeadingPermalinks(root);
  }
}
