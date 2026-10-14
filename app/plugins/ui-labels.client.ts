/* `?ui` on any URL outlines every [data-ui] block; hovering one shows its name
   (plus its position among blocks of the same name, and its #id), and a click
   copies "name ·n" — so the owner and an assistant can point at the same
   component by name ("make topic-hero shorter") instead of describing it.
   One floating label rather than one per block: forty labelled cards overlap
   into noise. `?ui=0` turns it off; the choice sticks for the session. Readers
   never meet any of this unless they ask for it. */
import { copyText } from '../../public/lib/clipboard.js';

const KEY = 'gazll:ui-labels';

export default defineNuxtPlugin(() => {
  const router = useRouter();
  let label: HTMLDivElement | null = null;
  let current: HTMLElement | null = null;

  const wanted = () => {
    const param = new URL(location.href).searchParams.get('ui');
    try {
      if (param === '0') sessionStorage.removeItem(KEY);
      else if (param !== null) sessionStorage.setItem(KEY, '1');
      return sessionStorage.getItem(KEY) === '1';
    } catch (error) { return param !== null && param !== '0'; }
  };

  const nameOf = (node: HTMLElement) => {
    const name = node.dataset.ui || '';
    const same = [...document.querySelectorAll<HTMLElement>(`[data-ui="${CSS.escape(name)}"]`)];
    return same.length > 1 ? `${name} ·${same.indexOf(node) + 1}` : name;
  };

  function show(node: HTMLElement | null) {
    if (!label || node === current) return;
    document.querySelector('.ui-label-active')?.classList.remove('ui-label-active');
    current = node;
    if (!node) { label.hidden = true; return; }
    node.classList.add('ui-label-active');
    const box = node.getBoundingClientRect();
    label.textContent = nameOf(node) + (node.id ? `  #${node.id}` : '');
    label.style.top = `${Math.max(0, box.top)}px`;
    // A block at the top edge gets its label inside, or it would sit off screen.
    label.classList.toggle('inside', box.top < 24);
    label.style.left = `${Math.max(0, box.left)}px`;
    label.hidden = false;
  }
  const onMove = (event: MouseEvent) => show((event.target as Element)?.closest?.('[data-ui]') as HTMLElement | null);
  const onClick = (event: MouseEvent) => {
    if (!current || !event.altKey) return;
    // Alt+click copies, so ordinary clicks keep working while labels are on.
    event.preventDefault();
    event.stopPropagation();
    void copyText(nameOf(current));
  };

  function sync() {
    const on = wanted();
    document.documentElement.classList.toggle('ui-labels', on);
    if (on && !label) {
      label = document.createElement('div');
      label.className = 'ui-label';
      label.hidden = true;
      label.setAttribute('aria-hidden', 'true');
      const hint = document.createElement('div');
      hint.className = 'ui-label-hint';
      hint.textContent = 'UI names on — hover a block, Alt+click to copy its name · ?ui=0 to hide';
      hint.setAttribute('aria-hidden', 'true');
      document.body.append(label, hint);
      addEventListener('mousemove', onMove, { passive: true });
      addEventListener('click', onClick, true);
      addEventListener('scroll', () => { const node = current; current = null; show(node); }, { passive: true });
    } else if (!on && label) {
      removeEventListener('mousemove', onMove);
      removeEventListener('click', onClick, true);
      label.remove();
      document.querySelector('.ui-label-hint')?.remove();
      label = null;
      show(null);
    }
  }

  router.afterEach(() => { void nextTick(sync); });
  onNuxtReady(sync);
});
