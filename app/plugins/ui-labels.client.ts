/* `?ui` on any URL outlines every [data-ui] block and labels it with its name,
   so the owner and an assistant can point at the same component by name
   ("make topic-hero shorter") instead of describing it. Clicking a label
   copies the name. `?ui=0` turns it off; the choice sticks for the session.
   Off by default and inert for readers: nothing here runs unless asked. */
import { copyText } from '../../public/lib/clipboard.js';

const KEY = 'gazll:ui-labels';

export default defineNuxtPlugin(() => {
  const router = useRouter();
  let layer: HTMLDivElement | null = null;
  let frame = 0;
  let observer: MutationObserver | null = null;

  const wanted = () => {
    const param = new URL(location.href).searchParams.get('ui');
    try {
      if (param === '0') sessionStorage.removeItem(KEY);
      else if (param !== null) sessionStorage.setItem(KEY, '1');
      return sessionStorage.getItem(KEY) === '1';
    } catch (error) { return param !== null && param !== '0'; }
  };

  function paint() {
    frame = 0;
    if (!layer) return;
    layer.textContent = '';
    const seen = new Map<string, number>();
    for (const node of document.querySelectorAll<HTMLElement>('[data-ui]')) {
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const name = node.dataset.ui || '';
      const count = (seen.get(name) || 0) + 1;
      seen.set(name, count);
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'ui-label';
      label.textContent = count > 1 ? `${name} ·${count}` : name;
      label.title = node.id ? `#${node.id} — click to copy` : 'click to copy';
      label.style.top = `${box.top + scrollY}px`;
      label.style.left = `${box.left + scrollX}px`;
      label.addEventListener('click', () => { void copyText(name); });
      layer.append(label);
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };

  function sync() {
    const on = wanted();
    document.documentElement.classList.toggle('ui-labels', on);
    if (on && !layer) {
      layer = document.createElement('div');
      layer.className = 'ui-label-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.append(layer);
      observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'hidden'] });
      addEventListener('resize', schedule);
    } else if (!on && layer) {
      observer?.disconnect();
      removeEventListener('resize', schedule);
      layer.remove();
      layer = null;
    }
    if (on) schedule();
  }

  router.afterEach(() => { void nextTick(sync); });
  onNuxtReady(sync);
});
