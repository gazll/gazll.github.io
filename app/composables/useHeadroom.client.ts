/* Headroom: the header hides going down and reveals going up, and publishes its
   own height as `--hdr-h`.

   Both halves matter. The hiding is what gives a long read the full viewport;
   `--hdr-h` is what seven sticky rules in styles.css offset against — the
   backbars, both article TOCs, the library group headers, the project TOC and
   an open question's pinned title. Without the sync they all fall back to the
   64px default and a pinned element sits under the header whenever its real
   height differs. */

// Must travel this far one way before the state flips. The threshold is
// measured from where the current direction STARTED, not from the previous
// event: comparing against the previous event lets a few px of momentum wobble
// flip the class every frame, and each flip restarts the .26s transform
// transition — that is the juddering.
const FLIP_PX = 14;
const TOP_ZONE = 160; // always visible near the top

export function useHeadroom() {
  onMounted(() => {
    const header = document.querySelector<HTMLElement>('header.top');
    if (!header) return;

    let lastY = Math.max(0, window.scrollY);
    let anchorY = lastY;
    let dir = 0;
    let queued = false;

    // 0 while headroom-hidden, the real height otherwise.
    const syncHeaderOffset = () => {
      const height = header.classList.contains('hidden') ? 0 : header.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--hdr-h', `${height}px`);
    };
    const revealOnFocus = () => {
      if (!header.classList.contains('hidden')) return;
      header.classList.remove('hidden');
      syncHeaderOffset();
    };
    const resize = new ResizeObserver(syncHeaderOffset);
    resize.observe(header);
    header.addEventListener('focusin', revealOnFocus);

    const apply = () => {
      queued = false;
      const y = Math.max(0, window.scrollY);
      const next = y > lastY ? 1 : y < lastY ? -1 : dir;
      if (next !== dir) { dir = next; anchorY = lastY; } // turned around: re-anchor
      lastY = y;

      // The drawer and topic panel own the header while they are open.
      if (document.body.classList.contains('topic-open')
        || document.body.classList.contains('nav-open') || y <= TOP_ZONE) {
        header.classList.remove('hidden');
        syncHeaderOffset();
        return;
      }
      if (dir === 1 && y - anchorY > FLIP_PX) header.classList.add('hidden');
      else if (dir === -1 && anchorY - y > FLIP_PX) header.classList.remove('hidden');
      syncHeaderOffset();
    };

    // Coalesce to one update per frame; scroll fires far more often than that.
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(apply);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    apply();

    onBeforeUnmount(() => {
      window.removeEventListener('scroll', onScroll);
      header.removeEventListener('focusin', revealOnFocus);
      resize.disconnect();
      document.documentElement.style.removeProperty('--hdr-h');
    });
  });
}
