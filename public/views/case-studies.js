import { escapeHtml } from '../lib/markdown.js';
import { PUBLISHER_ORIGINS, originGuard } from '../lib/constants.js';
import { Content } from '../lib/content.js';
import { CaseStudies } from '../lib/case-studies.js';
import { buildToc as tocFromBody, wireLightbox, wireTocToggle as tocToggle } from '../lib/article-reader.js';
import { contentActivityDate, contentDateFacts } from '../lib/content-dates.js';
import { setArticleStructuredData } from '../lib/structured-data.js';
import { setPageMetadata } from '../lib/page-metadata.js';
import { bulletParts, sentences } from '../lib/prose.js';
import { announce } from '../lib/ui.js';
import { loadingBlock } from '../lib/loading.js';
import { rememberOpened, restoreCard, stickyGroupHeads, takeOpened } from '../lib/reading-position.js';
import { anchorHref, decorateHeadingPermalinks, scrollToAnchor, withRouteLanguage } from '../lib/anchors.js';

let mountToken = 0;
let librarySort = 'curriculum';
let libraryObserver = null;
const TOC_STATE_KEY = 'gazl.caseTocCollapsed';
const RETURN_SURFACE = 'case-studies';

const COPY = {
  en: {
    collection: 'Collection', cases: count => count === 1 ? 'case study' : 'case studies',
    sources: count => count === 1 ? 'source' : 'sources',
    availableLanguage: 'English · Vietnamese', minuteRead: 'min read', number: 'No.',
    allCases: 'All case studies', historical: 'Historical case study', synthesis: 'Editorial synthesis', firstParty: 'First-party incident', editorial: 'Editorial case study',
    historicalNote: 'Architecture, technology choices and benchmark figures reflect the system and workload described at publication time.',
    synthesisNote: 'This article is a rewritten case study based on the credited source, not a preserved copy of the original.',
    original: 'English original', translation: 'English translation', synthesisLanguage: 'English synthesis', guideEyebrow: 'Reading guide · Editorial synthesis',
    problem: 'Problem', coreIdea: 'Core idea', outcome: 'Reported outcome', takeaways: 'Key takeaways',
    review: 'Design review lens', guideNote: 'The guide above is editorial synthesis; the full case study continues below.',
    guideNoteOwn: 'The guide above is a reading aid; the full write-up continues below.',
    toc: 'On this page', contents: 'Article contents', hideToc: 'Hide contents', showToc: 'Show contents',
    readSource: 'Read original source', source: 'Source',
    originalArticle: 'original article', closeImage: 'Close image', notFound: 'Case study not found',
    missing: 'That article is not in this collection.', back: 'Back to case studies', loading: 'Loading case studies…',
    unavailable: 'Could not load this collection', unavailableTitle: 'The case-study files are unavailable.', retry: 'Try again',
    levelCore: 'Core', levelAdvanced: 'Advanced', levelExtra: 'Extra', featured: 'Featured',
    order: 'Order', curriculumOrder: 'Curriculum', recentOrder: 'Recently updated',
    latestTitle: 'Latest updates', latestDescription: 'Every case study in one feed, newest editorial activity first.',
    curriculumStatus: 'Case studies restored to curriculum order.', recentStatus: 'Case studies sorted by latest activity.',
    locale: 'en'
  },
  vi: {
    collection: 'Collection', cases: count => count === 1 ? 'case study' : 'case studies',
    sources: count => count === 1 ? 'source' : 'sources',
    availableLanguage: 'Vietnamese · English', minuteRead: 'min read', number: 'No.',
    allCases: 'All case studies', historical: 'Historical case study', synthesis: 'Editorial synthesis', firstParty: 'First-party incident', editorial: 'Editorial case study',
    historicalNote: 'Architecture, technology choices và benchmark figures phản ánh system cùng workload tại thời điểm bài được publish.',
    synthesisNote: 'Bài này được biên soạn lại từ nguồn đã ghi công, không phải bản sao được lưu nguyên văn từ bài gốc.',
    original: 'Vietnamese original', translation: 'Vietnamese translation', synthesisLanguage: 'Vietnamese synthesis', guideEyebrow: 'Reading guide · Editorial synthesis',
    problem: 'Problem', coreIdea: 'Core idea', outcome: 'Reported outcome', takeaways: 'Key takeaways',
    review: 'Design review lens', guideNote: 'Phần trên là editorial synthesis để hỗ trợ đọc; case study đầy đủ nằm bên dưới.',
    guideNoteOwn: 'Phần trên là tóm lược để hỗ trợ đọc; bài viết đầy đủ nằm bên dưới.',
    toc: 'On this page', contents: 'Article contents', hideToc: 'Hide contents', showToc: 'Show contents',
    readSource: 'Đọc bài nguồn', source: 'Nguồn',
    originalArticle: 'bài viết gốc', closeImage: 'Đóng ảnh', notFound: 'Không tìm thấy case study',
    missing: 'Bài viết này không có trong bộ sưu tập.', back: 'Quay lại Case Studies', loading: 'Đang tải case study…',
    unavailable: 'Không thể tải bộ sưu tập', unavailableTitle: 'Các file case study hiện không khả dụng.', retry: 'Thử lại',
    levelCore: 'Core', levelAdvanced: 'Advanced', levelExtra: 'Extra', featured: 'Nổi bật',
    order: 'Sắp xếp', curriculumOrder: 'Lộ trình', recentOrder: 'Mới cập nhật',
    latestTitle: 'Cập nhật mới nhất', latestDescription: 'Toàn bộ case study trong một feed, xếp theo hoạt động biên tập mới nhất.',
    curriculumStatus: 'Đã đưa case study về thứ tự lộ trình.', recentStatus: 'Đã xếp case study theo hoạt động mới nhất.',
    locale: 'vi-VN'
  }
};

const text = () => COPY[Content.lang] || COPY.en;
const MOVED_TO_SYSTEM_DESIGN = 'systems-architecture';
const numberLabel = article => String(article.n).padStart(2, '0');
const languageLabel = article => article.content_kind === 'synthesis' && !article.is_translation
  ? text().synthesisLanguage
  : article.is_translation ? text().translation : text().original;
function levelMarkup(article) {
  const labels = { core: text().levelCore, advanced: text().levelAdvanced, extra: text().levelExtra };
  const level = labels[article?.level] ? article.level : 'advanced';
  return '<span class="content-level level-' + level + '">' + labels[level] + '</span>'
    // role="img": a bare <span> carrying aria-label is not exposed by most AT.
    + (article?.featured ? '<span class="featured-mark" role="img" title="' + escapeHtml(text().featured)
      + '" aria-label="' + escapeHtml(text().featured) + '">★</span>' : '');
}

const sourceHref = originGuard(PUBLISHER_ORIGINS);

// Archived rows name their publisher; locally authored rows name their kind.
const bylineLabel = article => article.first_party ? text().firstParty : article.editorial ? text().editorial : article.company;
const hasExternalSource = article => !article.first_party && !article.editorial;

function sourceCount(articles) {
  const publishers = new Set(articles.filter(hasExternalSource).map(a => a.company));
  return publishers.size + (articles.some(a => !hasExternalSource(a)) ? 1 : 0);
}

function dateMarkup(row, includePublished = false) {
  const facts = contentDateFacts(row, Content.lang, { includePublished });
  return facts.map(fact => '<span><b>' + escapeHtml(fact.label) + '</b><time datetime="'
    + escapeHtml(fact.value) + '">' + escapeHtml(fact.formatted) + '</time></span>').join('');
}

function renderCard(article, category) {
  const coverFit = article.cover_fit === 'contain' ? ' contain' : '';
  return '<a class="cs-card" data-card-key="' + escapeHtml(article.slug) + '" href="'
    + escapeHtml(withRouteLanguage('#/case-studies/' + encodeURIComponent(article.slug), Content.lang)) + '">'
    + '<span class="cs-card-art' + coverFit + '" aria-hidden="true"><img src="'
    + escapeHtml(article.cover_image) + '" alt="" loading="lazy" decoding="async"></span>'
    + '<span class="cs-card-content">'
    + '<span class="cs-card-kicker">' + text().number + ' ' + numberLabel(article) + ' · '
    + escapeHtml(bylineLabel(article)) + ' · ' + escapeHtml(languageLabel(article)) + ' ' + levelMarkup(article) + '</span>'
    + '<strong>' + escapeHtml(article.title) + '</strong>'
    + '<span class="cs-card-excerpt">' + escapeHtml(article.excerpt) + '</span>'
    + '<span class="cs-card-meta"><span>' + escapeHtml(category.label) + '</span><span>'
    + article.read_minutes + ' ' + text().minuteRead + '</span>'
    + contentDateFacts(article, Content.lang).slice(-1).map(fact => '<span>' + escapeHtml(fact.label) + ' '
      + escapeHtml(fact.formatted) + '</span>').join('') + '</span>'
    + '</span><span class="cs-card-arrow" aria-hidden="true">→</span></a>';
}

function renderLibrary(collection) {
  // Architecture cases now live in the dedicated System Design library.
  // Direct legacy article URLs remain routable for existing bookmarks.
  const articles = (collection.articles || []).filter(article => article.category !== MOVED_TO_SYSTEM_DESIGN);
  const categories = (collection.categories || []).filter(category => category.id !== MOVED_TO_SYSTEM_DESIGN);
  const categoryById = new Map(categories.map(category => [category.id, category]));
  const curriculumGroups = categories.map(category => {
    const rows = articles.filter(article => article.category === category.id)
      .sort((a, b) => a.n - b.n);
    if (!rows.length) return '';
    return '<section class="cs-category" aria-labelledby="cs-category-' + escapeHtml(category.id) + '">'
      + '<header class="cs-category-head"><div><p>' + text().collection + '</p><h2 id="cs-category-' + escapeHtml(category.id) + '">'
      + escapeHtml(category.label) + '</h2><span>' + escapeHtml(category.description) + '</span></div>'
      + '<b>' + rows.length + '</b></header>'
      + '<div class="cs-card-grid">' + rows.map(article => renderCard(article, category)).join('') + '</div></section>';
  }).join('');
  const recentGroup = '<section class="cs-category content-latest" aria-labelledby="case-latest-title">'
    + '<header class="cs-category-head"><div><p>' + text().collection + '</p><h2 id="case-latest-title">'
    + text().latestTitle + '</h2><span>' + text().latestDescription + '</span></div><b>' + articles.length + '</b></header>'
    + '<div class="cs-card-grid">' + [...articles]
      .sort((a, b) => contentActivityDate(b).localeCompare(contentActivityDate(a)) || a.n - b.n)
      .map(article => renderCard(article, categoryById.get(article.category))).join('') + '</div></section>';
  const groups = librarySort === 'recent' ? recentGroup : curriculumGroups;

  return '<div class="cs-library">'
    + '<header class="cs-library-hero"><p class="cs-eyebrow">' + escapeHtml(collection.library.eyebrow) + '</p>'
    + '<h1 id="case-library-title">' + escapeHtml(collection.library.title) + '</h1>'
    + '<p>' + escapeHtml(collection.library.intro) + '</p>'
    // Counted, not hard-coded: first-party rows have no publisher, so they are
    // their own source rather than a missing one.
    + '<div class="cs-library-stats"><span><b>' + articles.length + '</b> ' + text().cases(articles.length) + '</span>'
    + '<span><b>' + sourceCount(articles) + '</b> ' + text().sources(sourceCount(articles)) + '</span>'
    + '<span>' + text().availableLanguage + '</span></div>'
    + '<div class="content-sort" role="group" aria-label="' + text().order + '"><span>' + text().order + '</span>'
    + '<button type="button" data-content-sort="curriculum" aria-pressed="' + (librarySort === 'curriculum') + '">'
    + text().curriculumOrder + '</button><button type="button" data-content-sort="recent" aria-pressed="'
    + (librarySort === 'recent') + '">' + text().recentOrder + '</button></div>'
    + '</header>'
    + groups + '</div>';
}

function wireLibrarySort(root, collection) {
  root.querySelectorAll('[data-content-sort]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.contentSort === librarySort) return;
    librarySort = button.dataset.contentSort;
    announce(librarySort === 'recent' ? text().recentStatus : text().curriculumStatus);
    libraryObserver?.disconnect();
    root.innerHTML = renderLibrary(collection);
    decorateHeadingPermalinks(root);
    libraryObserver = stickyGroupHeads(root, '.cs-category-head');
    wireLibrarySort(root, collection);
    requestAnimationFrame(() => {
      root.querySelector('[data-content-sort="' + librarySort + '"]')?.focus();
    });
  }));
}

function articleMeta(article) {
  const tags = (article.tags || []).map(tag => '<span>' + escapeHtml(tag) + '</span>').join('');
  // A locally authored write-up has no publisher to credit and nothing
  // off-site to link, so it gets neither an origin link nor an archive note.
  const origin = !hasExternalSource(article)
    ? ''
    : '<a class="cs-origin" href="' + sourceHref(article.source_url) + '" target="_blank" rel="noopener noreferrer">'
      + escapeHtml(article.company) + ' ↗</a>';
  const archiveLabel = article.content_kind === 'synthesis' ? text().synthesis : text().historical;
  const archiveNote = article.content_kind === 'synthesis' ? text().synthesisNote : text().historicalNote;
  return '<header class="cs-article-head">'
    + '<p class="cs-eyebrow">' + text().number + ' ' + numberLabel(article) + ' · '
    + escapeHtml(bylineLabel(article)) + ' · ' + escapeHtml(article.category_label) + ' ' + levelMarkup(article) + '</p>'
    + '<h1 id="case-study-' + escapeHtml(article.slug) + '-title">' + escapeHtml(article.title) + '</h1>'
    + '<p class="cs-deck">' + escapeHtml(article.excerpt) + '</p>'
    + '<div class="cs-byline content-dates">' + dateMarkup(article, hasExternalSource(article)) + origin
    + '<span class="cs-language">' + escapeHtml(languageLabel(article)) + '</span></div>'
    + '<div class="cs-tags">' + tags + '</div>'
    + (!hasExternalSource(article) ? '' : '<div class="cs-archive-note"><b>' + archiveLabel + '</b><span>' + archiveNote + '</span></div>')
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

function renderGuide(guide, article) {
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
    + '</div><p class="cs-guide-note">' + (article?.first_party ? text().guideNoteOwn : text().guideNote) + ' ↓</p></section>';
}

function renderArticle(article, body, guide) {
  const href = sourceHref(article.source_url);
  // Sticky for the whole article and separate from the site header: these
  // articles run several screens, and a back link that scrolled away with the
  // title made leaving a scroll back to the top.
  return '<div class="cs-article"><div class="cs-backbar"><a class="cs-back" href="'
    + escapeHtml(withRouteLanguage('#/case-studies', Content.lang)) + '">← ' + text().allCases + '</a></div>'
    + articleMeta(article)
    + renderGuide(guide, article)
    + '<details class="cs-toc-mobile"><summary>' + text().toc + '</summary><nav data-case-toc-mobile></nav></details>'
    + '<div class="cs-article-grid">'
    + '<aside class="cs-toc" data-case-toc-panel aria-label="' + text().contents + '">'
    + '<div class="cs-toc-head"><p>' + text().toc + '</p>'
    + '<button type="button" data-case-toc-toggle aria-expanded="true" aria-controls="cs-toc-content" aria-label="'
    + text().hideToc + '" title="' + text().hideToc + '"><span aria-hidden="true">‹</span></button></div>'
    + '<div class="cs-toc-content" id="cs-toc-content" data-case-toc-content><nav data-case-toc></nav>'
    + (!hasExternalSource(article) ? '' : '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + text().readSource + ' ↗</a>') + '</div></aside>'
    + '<article class="cs-article-body" data-case-body>' + body + '</article>'
    + '</div>'
    + (!hasExternalSource(article) ? '' : '<footer class="cs-source"><span>' + text().source + '</span><a href="' + href + '" target="_blank" rel="noopener noreferrer">'
      + escapeHtml(article.company) + ' — ' + text().originalArticle + ' ↗</a></footer>')
    + '<dialog class="cs-lightbox" data-case-lightbox><button type="button" aria-label="' + text().closeImage + '">×</button>'
    + '<figure><img alt=""><figcaption></figcaption></figure></dialog></div>';
}

const buildToc = (root, slug) => tocFromBody(root, '/case-studies/' + encodeURIComponent(slug));
const wireTocToggle = root => tocToggle(root,
  { stateKey: TOC_STATE_KEY, showLabel: text().showToc, hideLabel: text().hideToc });

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
  setArticleStructuredData(article, {
    headline: article.title,
    description: article.excerpt,
    image: article.cover_image,
    lang: Content.lang,
    url: window.location.href,
    sourceUrl: article.source_url
  });
  buildToc(root, article.slug);
  wireTocToggle(root);
  wireLightbox(root);
  if (anchor) requestAnimationFrame(() => scrollToAnchor(root, anchor, { behavior: 'auto' }));
}

export function renderCaseStudies() {
  return '<section class="cs-shell" data-case-root aria-live="polite">'
    + loadingBlock(text().loading) + '</section>';
}

export async function mountCaseStudies(host, routeParts = [], anchor = '') {
  const token = ++mountToken;
  libraryObserver?.disconnect();
  libraryObserver = null;
  const root = host.querySelector('[data-case-root]');
  if (!root) return;

  try {
    const collection = await CaseStudies.load(Content.lang);
    if (token !== mountToken) return;
    const slug = routeParts[0] ? decodeURIComponent(routeParts[0]) : '';
    if (slug) await showArticle(root, collection, slug, token, anchor);
    else {
      root.innerHTML = renderLibrary(collection);
      setPageMetadata({ title: collection.library.title, description: collection.library.intro, url: window.location.href });
      decorateHeadingPermalinks(root);
      libraryObserver?.disconnect();
      libraryObserver = stickyGroupHeads(root, '.cs-category-head');
      wireLibrarySort(root, collection);
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
