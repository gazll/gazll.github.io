/* Per-route page metadata for a hash-routed SPA — deliberately only the two
   things client-side JavaScript can actually influence.

   `og:*` / `twitter:*` are NOT written here. The crawlers that consume them —
   Slack, Discord, Facebook, LinkedIn, X — fetch the raw HTML and never execute
   JavaScript, so a tag written after load reaches none of them. index.html
   carries the site-level card instead, and that is what an unfurled link shows.
   Per-route cards would need pre-rendered HTML per route, not more DOM writing.

   `<link rel="canonical">` is not written here either: every route differs only
   by the `#` fragment, which search engines drop when normalising, so all of
   them canonicalise to the same document. The static tag in index.html says
   that once, correctly.

   What is left is real: `document.title` names the view in the tab, the back/
   forward history entries and a bookmark, and Google does render JavaScript, so
   a per-route description is read there. */

const SITE_NAME = 'Backend Engineering';
const DEFAULT_TITLE = 'Technical Mastery Track';
const DEFAULT_DESCRIPTION = 'A bilingual backend engineering study track with system-design blueprints, production case studies and interview practice.';

function clean(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function setPageMetadata({ title = DEFAULT_TITLE, description = DEFAULT_DESCRIPTION } = {}) {
  const shortTitle = clean(title) || DEFAULT_TITLE;
  document.title = shortTitle.includes(SITE_NAME) ? shortTitle : shortTitle + ' · ' + SITE_NAME;

  const summary = clean(description) || DEFAULT_DESCRIPTION;
  let node = document.head.querySelector('meta[name="description"]');
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute('name', 'description');
    document.head.appendChild(node);
  }
  node.setAttribute('content', summary);
}

export const DEFAULT_PAGE_DESCRIPTION = DEFAULT_DESCRIPTION;
