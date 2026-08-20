import { stickyGroupHeads } from '../../public/lib/reading-position.js';

/* The CSS pins a library's group header on its own, but the pinned state has a
   second half: `is-stuck` sheds the description and shrinks the title. Without
   it a stuck header keeps its full hero copy and costs more screen than the
   orientation is worth — which is the thing the sticky rule was written to
   avoid. lib/reading-position.js owns the observer; this only binds it to a
   component's lifetime. */
export function useStickyGroupHeads(root: Ref<HTMLElement | null>, selector: string) {
  let observer: IntersectionObserver | null = null;

  const bind = () => {
    observer?.disconnect();
    observer = root.value ? stickyGroupHeads(root.value, selector) : null;
  };

  onMounted(() => nextTick(bind));
  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
  });

  // Rows are re-rendered when the reader re-sorts or switches language, and the
  // observer holds the old nodes; rebinding is what keeps it pointed at the DOM
  // actually on screen.
  return { rebind: () => nextTick(bind) };
}
