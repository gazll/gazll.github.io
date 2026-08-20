import { escapeHtml } from './markdown.js';
import { anchorHref } from './anchors.js';

/* Long-form article chrome shared by every library that renders one: the
   heading TOC, its collapse state and the figure lightbox. The `data-case-*`
   hooks predate the second library and are kept as the markup contract —
   "case" reads as "article" here, not as "case study". */

/** Fills both the desktop and mobile TOC from the body's h2/h3 ids. */
export function buildToc(root, articleRoute) {
  const headings = [...root.querySelectorAll('[data-case-body] h2[id], [data-case-body] h3[id]')];
  const html = headings.map(heading => '<a class="' + (heading.tagName === 'H3' ? 'is-sub' : '')
    + '" href="' + escapeHtml(anchorHref(heading.id, articleRoute)) + '" data-anchor-link data-anchor-id="'
    + escapeHtml(heading.id) + '" data-anchor-route="' + escapeHtml(articleRoute) + '" data-case-section="'
    + escapeHtml(heading.id) + '">' + escapeHtml(heading.textContent) + '</a>').join('');
  root.querySelectorAll('[data-case-toc], [data-case-toc-mobile]').forEach(nav => { nav.innerHTML = html; });
  root.querySelectorAll('[data-case-section]').forEach(link => {
    link.addEventListener('click', () => link.closest('.cs-toc-mobile')?.removeAttribute('open'));
  });
}

/* Desktop only. Per the Case Studies rule the mobile <details> TOC must stay
   untouched by this, so nothing here reads or writes .cs-toc-mobile. */
export function wireTocToggle(root, { stateKey, showLabel, hideLabel }) {
  const grid = root.querySelector('.cs-article-grid');
  const panel = root.querySelector('[data-case-toc-panel]');
  const content = root.querySelector('[data-case-toc-content]');
  const button = root.querySelector('[data-case-toc-toggle]');
  if (!grid || !panel || !content || !button) return;

  const apply = collapsed => {
    grid.classList.toggle('is-toc-collapsed', collapsed);
    panel.classList.toggle('is-collapsed', collapsed);
    content.hidden = collapsed;
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? showLabel : hideLabel);
    button.title = collapsed ? showLabel : hideLabel;
    button.querySelector('span').textContent = collapsed ? '›' : '‹';
  };

  let stored = false;
  try { stored = localStorage.getItem(stateKey) === '1'; } catch (error) {}
  apply(stored);
  button.addEventListener('click', () => {
    const collapsed = !panel.classList.contains('is-collapsed');
    try { localStorage.setItem(stateKey, collapsed ? '1' : '0'); } catch (error) {}
    apply(collapsed);
  });
}

export function wireLightbox(root) {
  const dialog = root.querySelector('[data-case-lightbox]');
  if (!dialog) return;
  const fullImage = dialog.querySelector('img');
  const caption = dialog.querySelector('figcaption');

  root.querySelectorAll('[data-zoom-image]').forEach(button => {
    button.addEventListener('click', () => {
      const image = button.querySelector('img');
      fullImage.src = image.currentSrc || image.src;
      fullImage.alt = image.alt;
      caption.textContent = button.closest('figure')?.querySelector('figcaption')?.textContent || image.alt;
      dialog.showModal();
    });
  });
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
}
