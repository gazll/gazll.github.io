/* One owner for "something is on its way".

   Two scales live here because they answer the same reader question.

   The **bar** covers a wait the shell survives — a route change, a topic pair
   still being fetched, a view whose mount() is off getting its body. Nothing
   on screen moves during those, so without it the page simply looks frozen.
   It is deliberately late and then held: an already-cached topic settles in a
   few milliseconds, and a bar that appears and vanishes inside one frame
   reads as a rendering glitch rather than as progress.

   The **block** is what a view paints into its own body while it has nothing
   to show yet. Every surface used to spell its own; three of them agreed on
   the markup and the fourth had drifted to a second copy under another name.

   The counter is a ref count, not a flag: two waits can overlap (a topic pair
   and an async mount), and the second one finishing must not clear the first. */

import { escapeHtml } from './markdown.js';
import { announce } from './ui.js';

// Under this a navigation reads as instant, and a flash is worse than nothing.
const SHOW_AFTER_MS = 140;
// Once it is on screen it stays long enough to be read as progress.
const MIN_VISIBLE_MS = 320;

let pending = 0;
let appearTimer = 0;
let hideTimer = 0;
let shownAt = 0;

function paint(active) {
  const bar = document.getElementById('routeProgress');
  if (bar) bar.classList.toggle('is-active', active);
}

export function beginLoading() {
  pending++;
  if (pending > 1) return;
  // A wait that starts while the bar is still serving its minimum keeps it up
  // rather than restarting the whole delay.
  clearTimeout(hideTimer);
  hideTimer = 0;
  if (shownAt) return;
  appearTimer = setTimeout(() => {
    appearTimer = 0;
    shownAt = Date.now();
    paint(true);
    // Only a wait long enough to show the bar is worth saying out loud, and it
    // is said through the shell's one live region — a region that arrives with
    // its own text is not reliably read (see CLAUDE.md).
    announce('Loading…');
  }, SHOW_AFTER_MS);
}

export function endLoading() {
  pending = Math.max(0, pending - 1);
  if (pending) return;
  if (appearTimer) { clearTimeout(appearTimer); appearTimer = 0; return; }
  if (!shownAt) return;
  hideTimer = setTimeout(() => {
    hideTimer = 0;
    shownAt = 0;
    paint(false);
  }, Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt)));
}

/** Show the bar for as long as `promise` runs, and hand the same promise back.
    Rejection is reported through the returned promise exactly as before — the
    handler here only stops the bar, so a caller that ignores the result does
    not turn into an unhandled rejection either. */
export function trackLoading(promise) {
  if (!promise || typeof promise.then !== 'function') return promise;
  beginLoading();
  promise.then(endLoading, endLoading);
  return promise;
}

/** The placeholder a view paints while its body is still being fetched.

    No live region of its own: this markup is created together with its text,
    which is exactly the shape a screen reader does not reliably announce, and
    #liveStatus in the shell already carries the message. The text here is for
    the reader who can see it. */
export function loadingBlock(label, options = {}) {
  const accent = options.accent === 'indigo' ? ' on-indigo' : '';
  const compact = options.compact ? ' is-compact' : '';
  return '<div class="app-loading' + accent + compact + '">'
    + '<span class="app-spinner" aria-hidden="true"></span>'
    + '<p>' + escapeHtml(label) + '</p></div>';
}
