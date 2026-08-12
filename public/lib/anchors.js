/* Shared route/permalink behavior.

   The site uses a hash router, so a normal fragment such as #architecture
   would be mistaken for a view id. Keep the view route first and append one
   more fragment: #/system-design/foo?lang=en#architecture. The router can
   therefore restore both the view and the exact heading on a fresh load while
   the reader's language remains part of every shareable URL. */

const LANGS = new Set(['en', 'vi']);

export function normalizeRouteLanguage(value, fallback = 'en') {
  const candidate = String(value || '').toLowerCase();
  if (LANGS.has(candidate)) return candidate;
  return LANGS.has(fallback) ? fallback : 'en';
}

export function routePathFromHash(hash) {
  const raw = String(hash == null ? '' : hash).replace(/^#/, '');
  const marker = raw.indexOf('#');
  return marker < 0 ? raw : raw.slice(0, marker);
}

export function routePathWithoutQuery(hashOrPath) {
  const path = routePathFromHash(hashOrPath);
  const marker = path.indexOf('?');
  return marker < 0 ? path : path.slice(0, marker);
}

export function routeLanguageFromHash(hash, fallback = 'en') {
  const route = routePathFromHash(hash);
  const query = route.slice(route.indexOf('?') + 1);
  if (!query || !route.includes('?')) return normalizeRouteLanguage(fallback, 'en');
  try {
    return normalizeRouteLanguage(new URLSearchParams(query).get('lang'), fallback);
  } catch (error) {
    return normalizeRouteLanguage(fallback, 'en');
  }
}

export function routeAnchorFromHash(hash) {
  const raw = String(hash == null ? '' : hash).replace(/^#/, '');
  const marker = raw.indexOf('#');
  if (marker < 0) return '';
  try { return decodeURIComponent(raw.slice(marker + 1)); } catch (error) { return ''; }
}

/** Add/replace the language query without disturbing an anchor fragment. */
export function withRouteLanguage(route, lang = null) {
  const raw = String(route || '').replace(/^#/, '') || '/track';
  const marker = raw.indexOf('#');
  const routePart = marker < 0 ? raw : raw.slice(0, marker);
  const anchor = marker < 0 ? '' : raw.slice(marker + 1);
  const chosen = normalizeRouteLanguage(
    lang || routeLanguageFromHash(globalThis.location?.hash, 'en'),
    'en'
  );
  const queryMarker = routePart.indexOf('?');
  const path = queryMarker < 0 ? routePart : routePart.slice(0, queryMarker);
  const query = queryMarker < 0 ? '' : routePart.slice(queryMarker + 1);
  let params;
  try { params = new URLSearchParams(query); } catch (error) { params = new URLSearchParams(); }
  params.set('lang', chosen);
  const localized = path + '?' + params.toString();
  return '#' + localized + (marker < 0 ? '' : '#' + anchor);
}

export function updateRouteLanguage(lang, options = {}) {
  if (typeof location === 'undefined') return withRouteLanguage('/track', lang);
  const href = withRouteLanguage(location.hash || '/track', lang);
  if (location.hash !== href.slice(1)) {
    if (typeof history?.replaceState === 'function') {
      const method = options.push ? 'pushState' : 'replaceState';
      history[method](null, '', href);
    } else {
      location.hash = href.slice(1);
    }
  }
  return href;
}

export function anchorHref(id, route) {
  const value = String(id || '').trim();
  if (!value) return '#';
  const rawRoute = String(route || routePathFromHash(globalThis.location?.hash) || '/track')
    .replace(/^#\/?/, '').split('#')[0];
  const path = '/' + rawRoute.replace(/^\/+/, '');
  return withRouteLanguage(path, routeLanguageFromHash(globalThis.location?.hash, 'en'))
    + '#' + encodeURIComponent(value);
}

function findTarget(root, id) {
  if (!root || !id) return null;
  const target = (root === document ? document : root).querySelector
    ? [...(root === document ? document : root).querySelectorAll('[id]')].find(node => node.id === id)
    : null;
  return target || null;
}

export function scrollToAnchor(root, id, options = {}) {
  const target = findTarget(root, id);
  if (!target) return false;

  // Source documents and mobile TOCs use <details>; a deep link should reveal
  // the heading before trying to scroll it into view.
  let disclosure = target.closest?.('details');
  while (disclosure) {
    disclosure.open = true;
    disclosure = disclosure.parentElement?.closest?.('details');
  }

  if (typeof options.reveal === 'function') options.reveal(target);
  target.scrollIntoView({
    behavior: options.behavior || 'auto',
    block: options.block || 'start',
    inline: 'nearest'
  });
  return true;
}

export function updateAnchorUrl(id, route, options = {}) {
  const href = anchorHref(id, route);
  if (typeof location === 'undefined') return href;

  if (location.hash !== href.slice(1)) {
    if (typeof history?.pushState === 'function') {
      const method = options.replace ? 'replaceState' : 'pushState';
      history[method](null, '', href);
    } else {
      location.hash = href.slice(1);
    }
  }
  return href;
}

/* Event delegation keeps dynamically rendered Markdown headings working. */
export function wireAnchorLinks(root = document) {
  if (!root?.addEventListener) return;
  root.addEventListener('click', event => {
    const target = event.target;
    const link = target?.closest?.('[data-anchor-link]');
    if (!link || (root !== document && !root.contains(link))) return;
    if (event.defaultPrevented) return;
    const id = link.dataset.anchorId || link.getAttribute('href')?.split('#').pop();
    if (!id) return;
    event.preventDefault();
    updateAnchorUrl(id, link.dataset.anchorRoute || routePathFromHash(location.hash));
    scrollToAnchor(root === document ? document : root, id, { behavior: 'smooth' });
    link.closest('.sd-toc-mobile, .cs-toc-mobile, .pj-toc-mobile')?.removeAttribute('open');
  });
}

const ANCHOR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M10.5 13.5a4.5 4.5 0 0 0 6.4.1l2.2-2.2A4.5 4.5 0 0 0 12.7 5l-1.3 1.3"/>'
  + '<path d="M13.5 10.5a4.5 4.5 0 0 0-6.4-.1l-2.2 2.2A4.5 4.5 0 0 0 11.3 19l1.3-1.3"/></svg>';

/** Add a small, keyboard-accessible anchor button beside every owned heading. */
export function decorateHeadingPermalinks(root = document) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]').forEach(heading => {
    if (heading.querySelector(':scope > .heading-anchor-button')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'heading-anchor-button';
    button.dataset.headingAnchor = heading.id;
    button.setAttribute('aria-label', 'Link to this heading');
    button.title = 'Link to this heading';
    button.innerHTML = ANCHOR_ICON;
    heading.appendChild(button);
  });
}

/* A manually authored <h1>…<h6> with an id is a permalink too. Markdown
   headings get a real <a>; this covers the view templates that own their HTML. */
export function wireHeadingPermalinks(root = document) {
  if (!root?.addEventListener) return;
  decorateHeadingPermalinks(root);
  root.addEventListener('click', event => {
    const target = event.target;
    const button = target?.closest?.('[data-heading-anchor]');
    if (button) {
      const heading = button.closest('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
      if (!heading || (root !== document && !root.contains(heading))) return;
      event.preventDefault();
      event.stopPropagation();
      updateAnchorUrl(heading.id);
      heading.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      return;
    }
    if (target?.closest?.('a, button, input, textarea, select')) return;
    const heading = target?.closest?.('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
    if (!heading || (root !== document && !root.contains(heading))) return;
    event.preventDefault();
    updateAnchorUrl(heading.id);
    heading.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  });
}
