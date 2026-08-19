import { setPageMetadata } from './page-metadata.js';

const SCRIPT_ID = 'gazl-article-structured-data';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function clearArticleStructuredData() {
  document.getElementById(SCRIPT_ID)?.remove();
}

export function setArticleStructuredData(row, {
  headline, description = '', image = '', lang = 'en', url = '', sourceUrl = ''
} = {}) {
  clearArticleStructuredData();

  // The tab title is the reader's, the JSON-LD is the crawler's: name the page
  // first, so an article missing a date still gets its own title rather than
  // keeping the generic view name showView() just set.
  if (headline) setPageMetadata({ title: headline, description });
  if (!headline || !ISO_DATE.test(String(row?.created_at || ''))) return;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline,
    datePublished: row.created_at,
    dateModified: ISO_DATE.test(String(row.updated_at || '')) ? row.updated_at : row.created_at,
    inLanguage: lang,
    mainEntityOfPage: url || window.location.href,
    publisher: { '@type': 'Organization', name: 'Gazl' }
  };
  if (description) data.description = description;
  if (image) data.image = new URL(image, document.baseURI).href;
  if (/^https:\/\//.test(sourceUrl)) data.isBasedOn = sourceUrl;

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  document.head.appendChild(script);
}
