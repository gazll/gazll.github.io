import { escapeHtml } from '../lib/markdown.js';
import { Content } from '../lib/content.js';
import { knowledgeCollection } from '../lib/knowledge.js';
import { buildToc, wireLightbox, wireTocToggle } from '../lib/article-reader.js';
import { loadingBlock } from '../lib/loading.js';
import { contentDateFacts } from '../lib/content-dates.js';
import { setArticleStructuredData } from '../lib/structured-data.js';
import { setPageMetadata } from '../lib/page-metadata.js';
import { rememberOpened, restoreCard, stickyGroupHeads, takeOpened } from '../lib/reading-position.js';
import { decorateHeadingPermalinks, scrollToAnchor, withRouteLanguage } from '../lib/anchors.js';

/* Material outside interview preparation. Every article here is first-party, so
   this view carries none of the Case Studies source machinery: no publisher
   credit, no preserved-archive note, no translation badge. It reuses the .cs-*
   article styles because the reading layout is the same one. */

const COPY = {
  en: {
    collection: 'Collection', articles: n => n === 1 ? 'article' : 'articles',
    number: 'No.', minuteRead: 'min read', back: 'All articles',
    guideEyebrow: 'Reading guide', summary: 'In short', points: 'What to hold on to',
    guideNote: 'The guide above is a reading aid; the full write-up continues below.',
    toc: 'On this page', contents: 'Article contents', hideToc: 'Hide contents', showToc: 'Show contents',
    closeImage: 'Close image', notFound: 'Article not found',
    missing: 'That article is not in this collection.', loading: 'Loading…',
    unavailable: 'Could not load this collection', retry: 'Try again',
    levelCore: 'Core', levelAdvanced: 'Advanced', levelExtra: 'Extra', featured: 'Featured'
  },
  vi: {
    collection: 'Collection', articles: n => n === 1 ? 'bài viết' : 'bài viết',
    number: 'Số', minuteRead: 'phút đọc', back: 'Tất cả bài viết',
    guideEyebrow: 'Hướng dẫn đọc', summary: 'Tóm lại', points: 'Những điều cần nhớ',
    guideNote: 'Phần trên là tóm lược để hỗ trợ đọc; bài viết đầy đủ nằm bên dưới.',
    toc: 'On this page', contents: 'Article contents', hideToc: 'Hide contents', showToc: 'Show contents',
    closeImage: 'Đóng ảnh', notFound: 'Không tìm thấy bài viết',
    missing: 'Bài viết này không có trong bộ sưu tập.', loading: 'Đang tải…',
    unavailable: 'Không thể tải bộ sưu tập', retry: 'Thử lại',
    levelCore: 'Core', levelAdvanced: 'Advanced', levelExtra: 'Extra', featured: 'Nổi bật'
  }
};

const text = () => COPY[Content.lang] || COPY.en;
const numberLabel = article => String(article.n).padStart(2, '0');

function levelMarkup(article) {
  const labels = { core: text().levelCore, advanced: text().levelAdvanced, extra: text().levelExtra };
  const level = labels[article?.level] ? article.level : 'core';
  return '<span class="content-level level-' + level + '">' + labels[level] + '</span>'
    + (article?.featured ? '<span class="featured-mark" role="img" title="' + escapeHtml(text().featured)
      + '" aria-label="' + escapeHtml(text().featured) + '">★</span>' : '');
}

function renderCard(id, article, category) {
  const coverFit = article.cover_fit === 'contain' ? ' contain' : '';
  const updated = contentDateFacts(article, Content.lang).slice(-1)
    .map(fact => '<span>' + escapeHtml(fact.label + ' ' + fact.formatted) + '</span>').join('');
  return '<a class="cs-card" data-card-key="' + escapeHtml(article.slug) + '" href="'
    + escapeHtml(withRouteLanguage('#/' + id + '/' + encodeURIComponent(article.slug), Content.lang)) + '">'
    + '<span class="cs-card-art' + coverFit + '" aria-hidden="true"><img src="'
    + escapeHtml(article.cover_image) + '" alt="" loading="lazy" decoding="async"></span>'
    + '<span class="cs-card-content">'
    + '<span class="cs-card-kicker">' + text().number + ' ' + numberLabel(article) + ' · '
    + escapeHtml(category?.label || article.category) + ' ' + levelMarkup(article) + '</span>'
    + '<strong>' + escapeHtml(article.title) + '</strong>'
    + '<span class="cs-card-excerpt">' + escapeHtml(article.excerpt) + '</span>'
    + '<span class="cs-card-meta"><span>' + article.read_minutes + ' ' + text().minuteRead + '</span>'
    + updated + '</span>'
    + '</span><span class="cs-card-arrow" aria-hidden="true">→</span></a>';
}

function renderLibrary(id, collection) {
  const groups = collection.categories.map(category => {
    const rows = collection.articles.filter(article => article.category === category.id);
    if (!rows.length) return '';
    return '<section class="cs-category">'
      + '<header class="cs-category-head"><div><p>' + text().collection + '</p>'
      + '<h2 id="kn-category-' + escapeHtml(category.id) + '">' + escapeHtml(category.label) + '</h2>'
      + '<span>' + escapeHtml(category.description) + '</span></div><b>' + rows.length + '</b></header>'
      + '<div class="cs-card-grid">' + rows.map(row => renderCard(id, row, category)).join('') + '</div></section>';
  }).join('');

  const total = collection.articles.length;
  return '<header class="cs-library-hero"><p class="cs-eyebrow">' + escapeHtml(collection.library.eyebrow) + '</p>'
    + '<h1>' + escapeHtml(collection.library.title) + '</h1>'
    + '<p class="intro">' + escapeHtml(collection.library.intro) + '</p>'
    + '<p class="cs-library-count">' + total + ' ' + text().articles(total) + '</p></header>' + groups;
}

function articleMeta(article, category) {
  const dates = contentDateFacts(article, Content.lang)
    .map(fact => '<span><b>' + escapeHtml(fact.label) + '</b><time datetime="' + escapeHtml(fact.value)
      + '">' + escapeHtml(fact.formatted) + '</time></span>').join('');
  const tags = (article.tags || []).map(tag => '<span class="tag">' + escapeHtml(tag) + '</span>').join('');
  return '<header class="cs-article-head"><p class="cs-eyebrow">' + text().number + ' ' + numberLabel(article)
    + ' · ' + escapeHtml(category?.label || article.category) + ' ' + levelMarkup(article) + '</p>'
    + '<h1 id="kn-' + escapeHtml(article.slug) + '-title">' + escapeHtml(article.title) + '</h1>'
    + '<p class="intro">' + escapeHtml(article.excerpt) + '</p>'
    + '<div class="cs-byline content-dates">' + dates
    + '<span>' + article.read_minutes + ' ' + text().minuteRead + '</span></div>'
    + (tags ? '<div class="tags">' + tags + '</div>' : '') + '</header>';
}

function renderGuide(guide) {
  if (!guide) return '';
  const points = (guide.points || []).map(item => '<li>' + escapeHtml(item) + '</li>').join('');
  return '<section class="cs-guide" aria-labelledby="kn-guide-title">'
    + '<header><p>' + text().guideEyebrow + '</p>'
    + '<h2 id="kn-guide-title">' + escapeHtml(guide.title) + '</h2></header>'
    + '<div class="cs-guide-brief"><article><b>' + text().summary + '</b><p>'
    + escapeHtml(guide.summary || '') + '</p></article></div>'
    + '<div class="cs-guide-depth"><article><h3>' + text().points + '</h3><ul>' + points + '</ul></article></div>'
    + '<p class="cs-guide-note">' + text().guideNote + ' ↓</p></section>';
}

function renderArticle(id, article, category, body, guide) {
  return '<div class="cs-article"><div class="cs-backbar"><a class="cs-back" href="'
    + escapeHtml(withRouteLanguage('#/' + id, Content.lang)) + '">← ' + text().back + '</a></div>'
    + articleMeta(article, category)
    + renderGuide(guide)
    + '<details class="cs-toc-mobile"><summary>' + text().toc + '</summary><nav data-case-toc-mobile></nav></details>'
    + '<div class="cs-article-grid">'
    + '<aside class="cs-toc" data-case-toc-panel aria-label="' + text().contents + '">'
    + '<div class="cs-toc-head"><p>' + text().toc + '</p>'
    + '<button type="button" data-case-toc-toggle aria-expanded="true" aria-controls="kn-toc-content" aria-label="'
    + text().hideToc + '" title="' + text().hideToc + '"><span aria-hidden="true">‹</span></button></div>'
    + '<div class="cs-toc-content" id="kn-toc-content" data-case-toc-content><nav data-case-toc></nav></div></aside>'
    + '<article class="cs-article-body" data-case-body>' + body + '</article></div>'
    + '<dialog class="cs-lightbox" data-case-lightbox><button type="button" aria-label="' + text().closeImage + '">×</button>'
    + '<figure><img alt=""><figcaption></figcaption></figure></dialog></div>';
}

/** One library plus its reader. `id` is both the VIEWS id and the route root. */
export function createKnowledgeView(id) {
  let mountToken = 0;
  let libraryObserver = null;

  const render = () => '<section class="cs-wrap" data-knowledge-root="' + id + '">'
    + loadingBlock(text().loading) + '</section>';

  const showArticle = async (root, collection, slug, token, anchor) => {
    const article = collection.articles.find(row => row.slug === slug);
    if (!article) {
      root.innerHTML = '<div class="cs-empty"><p class="cs-eyebrow">' + text().notFound + '</p>'
        + '<h1>' + text().missing + '</h1><a href="'
        + escapeHtml(withRouteLanguage('#/' + id, Content.lang)) + '">' + text().back + '</a></div>';
      return;
    }
    const body = await collection.body(article);
    if (token !== mountToken) return;
    const category = collection.categories.find(row => row.id === article.category);
    root.innerHTML = renderArticle(id, article, category, body, article.guide);
    setArticleStructuredData(article, {
      headline: article.title,
      description: article.excerpt,
      image: article.cover_image,
      lang: Content.lang,
      url: window.location.href
    });
    // Remembered before the reader scrolls, so returning lands on this card.
    rememberOpened(id, article.slug);
    buildToc(root, '/' + id + '/' + encodeURIComponent(article.slug));
    wireTocToggle(root, {
      stateKey: 'gazl.knowledgeToc.' + id,
      showLabel: text().showToc,
      hideLabel: text().hideToc
    });
    wireLightbox(root);
    decorateHeadingPermalinks(root);
    if (anchor) scrollToAnchor(anchor);
  };

  const mount = async (host, routeParts = [], anchor = '') => {
    const token = ++mountToken;
    libraryObserver?.disconnect();
    libraryObserver = null;
    const root = host.querySelector('[data-knowledge-root="' + id + '"]');
    if (!root) return;

    try {
      const collection = await knowledgeCollection(id).load(Content.lang);
      if (token !== mountToken) return;
      const slug = routeParts[0] ? decodeURIComponent(routeParts[0]) : '';
      if (slug) {
        await showArticle(root, collection, slug, token, anchor);
        return;
      }
      root.innerHTML = renderLibrary(id, collection);
      setPageMetadata({
        title: collection.library.title,
        description: collection.library.intro,
        url: window.location.href
      });
      decorateHeadingPermalinks(root);
      libraryObserver = stickyGroupHeads(root, '.cs-category-head');
      if (!anchor) restoreCard(root, takeOpened(id));
    } catch (error) {
      if (token !== mountToken) return;
      root.innerHTML = '<div class="cs-empty"><p class="cs-eyebrow">' + text().unavailable + '</p>'
        + '<h1>' + escapeHtml(error?.message || String(error)) + '</h1><a href="'
        + escapeHtml(withRouteLanguage('#/' + id, Content.lang)) + '">' + text().retry + '</a></div>';
      decorateHeadingPermalinks(root);
    }
  };

  return { render, mount };
}

const photography = createKnowledgeView('photography');
const homelab = createKnowledgeView('homelab');

export const renderPhotography = photography.render;
export const mountPhotography = photography.mount;
export const renderHomelab = homelab.render;
export const mountHomelab = homelab.mount;
