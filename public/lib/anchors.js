/* Shared permalink behavior for headings and section links.

   The site uses a hash router, so a normal fragment such as #architecture
   would be mistaken for a view id.  Keep the view route first and append one
   more fragment: #/system-design/foo#architecture.  The router can therefore
   restore both the view and the exact heading on a fresh load. */

export function routePathFromHash(hash) {
  const raw = String(hash == null ? '' : hash).replace(/^#/, '');
  const marker = raw.indexOf('#');
  return marker < 0 ? raw : raw.slice(0, marker);
}

export function anchorHref(id, route) {
  const value = String(id || '').trim();
  if (!value) return '#';
  const rawRoute = String(route || routePathFromHash(globalThis.location?.hash) || '/track')
    .replace(/^#\/?/, '').split('#')[0];
  const path = '/' + rawRoute.replace(/^\/+/, '');
  return '#' + path + '#' + encodeURIComponent(value);
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

/* A manually authored <h1>…<h6> with an id is a permalink too. Markdown
   headings get a real <a>; this covers the view templates that own their HTML. */
export function wireHeadingPermalinks(root = document) {
  if (!root?.addEventListener) return;
  root.addEventListener('click', event => {
    const target = event.target;
    if (target?.closest?.('a, button, input, textarea, select')) return;
    const heading = target?.closest?.('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
    if (!heading || (root !== document && !root.contains(heading))) return;
    event.preventDefault();
    updateAnchorUrl(heading.id);
    heading.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  });
}
