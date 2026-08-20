/* Keeping the reader oriented in a long library: which group they are in while
   scrolling down it. Both surfaces (System Design, Case Studies) share it — the
   libraries differ in markup, not in behaviour.

   Returning to the card a reader came back from used to live here too, as a
   sessionStorage key each library consumed on mount. app/router.options.ts owns
   that now: it restores the real scroll offset once the page has laid out,
   which is both more precise and works on every surface rather than these
   two. */

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
