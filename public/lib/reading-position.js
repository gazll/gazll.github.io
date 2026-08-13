/* Keeping the reader oriented in a long library: which group they are in
   while scrolling down it, and where they were when they come back out of an
   article. Both surfaces (System Design, Case Studies) share it — the libraries
   differ in markup, not in behaviour.

   sessionStorage, not localStorage: this is where one reading session left
   off, and it must not follow a borrowed browser into the next one. */

const PREFIX = 'gazl.return.';

function session() {
  try { return globalThis.sessionStorage || null; } catch (error) { return null; }
}

/* The router scrolls to the top on every view change, which is right for a
   fresh navigation and wrong for a return: whoever opens the fourteenth
   blueprint and comes back should land on it, not at the top of a list they
   then have to re-scan. The key is written when an article renders and
   consumed when its library renders, so it survives exactly one trip back —
   reaching the library any other way still starts at the top. */
export function rememberOpened(surface, key) {
  if (!key) return;
  try { session()?.setItem(PREFIX + surface, String(key)); } catch (error) {}
}

/** Read the remembered card and forget it in the same move. */
export function takeOpened(surface) {
  const store = session();
  if (!store) return '';
  try {
    const key = store.getItem(PREFIX + surface) || '';
    store.removeItem(PREFIX + surface);
    return key;
  } catch (error) {
    return '';
  }
}

/* Matched in JS rather than through a selector: a key travels through the
   route, so it must never be concatenated into one. */
export function restoreCard(root, key) {
  if (!root || !key) return null;
  const card = [...root.querySelectorAll('[data-card-key]')]
    .find(node => node.dataset.cardKey === key);
  if (!card) return null;
  requestAnimationFrame(() => {
    const box = card.getBoundingClientRect();
    // Centred, so a sticky group header cannot cover the card. Scrolling the
    // window rather than calling scrollIntoView is deliberate: the router
    // starts a smooth scroll to the top on every view change, and only a
    // scroll on the same box cancels it — scrollIntoView loses that race and
    // the page slides back to the top behind the reader.
    const top = box.top + window.scrollY - Math.max(0, (window.innerHeight - box.height) / 2);
    window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    // Instant, too: this is a restored position, not a journey to watch.
    card.classList.add('is-returned');
    setTimeout(() => card.classList.remove('is-returned'), 2200);
  });
  return card;
}

/* A library runs long enough that the group a card belongs to scrolls out of
   sight, and the answer to "which section am I in" was a scroll back up. The
   group header sticks under the site header instead; `is-stuck` is what lets
   a pinned header shed its description and stay a label rather than becoming
   a second hero. */
export function stickyGroupHeads(root, selector) {
  const heads = [...(root?.querySelectorAll(selector) || [])];
  if (!heads.length || typeof IntersectionObserver !== 'function') return null;
  // The site header hides on scroll-down, so --hdr-h moves between 0 and its
  // real height. The observer is only toggling a class, so it reads the offset
  // once: being a frame late at a group boundary is invisible, and re-observing
  // on every header flip is not.
  const offset = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--hdr-h')) || 64;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('is-stuck',
      entry.intersectionRatio < 1 && entry.boundingClientRect.top <= offset + 2));
  }, { threshold: [1], rootMargin: '-' + (offset + 1) + 'px 0px 0px 0px' });
  heads.forEach(head => observer.observe(head));
  return observer;
}
