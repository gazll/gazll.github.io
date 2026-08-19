/* Shared UI fragments used by both app.js and the views. */

export const chevSVG = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';

export const BADGE = {
  core: '<span class="qbadge core">CORE</span>',
  advanced: '<span class="qbadge advanced">ADVANCED</span>',
  extra: '<span class="qbadge extra">EXTRA</span>'
};

export function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Local calendar day. toISOString() would bucket by UTC and shift the day. */
/** Announce a state change through the one live region in index.html.
    Re-announcing the same string needs a clearing tick, or a screen reader
    treats the unchanged text as nothing to say. */
export function announce(message) {
  const node = document.getElementById('liveStatus');
  if (!node) return;
  node.textContent = '';
  requestAnimationFrame(() => { node.textContent = message; });
}

export function localDay(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
