import type { RouterConfig } from '@nuxt/schema';

/* Back must land on the card the reader clicked, not at the top of the library.

   Nuxt's default scrollBehavior resolves as soon as the route component is
   ready, which on these pages is before the content exists: every index awaits
   its own `useAsyncData`, and the case-study and Other Knowledge grids then
   grow again as their cover images arrive. Restoring against a document that is
   still 300px tall clamps the offset to 0 — which is exactly the "back goes to
   the top" symptom, and why the per-page sessionStorage workaround in
   CollectionIndex could not fix it either.

   So the restore waits for `page:finish` and then two frames: one for Vue to
   commit the rendered page, one for the browser to lay it out. */

/* The sticky header covers whatever a fragment scrolls to, so a hash landing
   is offset by it. Matches `scroll-margin-top` on .sd-section, kept here for
   the elements that have none. */
const HEADER_OFFSET = 84;

function settled(nuxtApp: ReturnType<typeof useNuxtApp>) {
  return new Promise<void>(resolve => {
    nuxtApp.hooks.hookOnce('page:finish', () => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

export default <RouterConfig>{
  async scrollBehavior(to, from, savedPosition) {
    const nuxtApp = useNuxtApp();

    /* Same page, different query or fragment — the language switch and every
       in-page anchor. Nothing re-renders from scratch, so waiting for
       `page:finish` would hang; and a language switch must keep the reader
       where they were rather than jumping to the top. */
    if (to.path === from.path) {
      if (!to.hash) return false;
      return { el: to.hash, top: HEADER_OFFSET, behavior: 'smooth' };
    }

    await settled(nuxtApp);
    if (to.hash) {
      // A missing target is not an error: a stale deep link should still land
      // the reader on the page rather than throwing inside the router.
      if (document.querySelector(to.hash)) return { el: to.hash, top: HEADER_OFFSET };
      return { left: 0, top: 0 };
    }
    return savedPosition || { left: 0, top: 0 };
  }
};
