import { escapeHtml } from './markdown.js';

const DEFAULT_LABELS = { pending: 'Mark reviewed', done: 'Unmark reviewed' };

export function manualReviewMarkup(id, labels = DEFAULT_LABELS) {
  const safeId = escapeHtml(id);
  const pending = escapeHtml(labels.pending || DEFAULT_LABELS.pending);
  return '<button type="button" class="manual-review" data-manual-review-id="' + safeId
    + '" aria-pressed="false" aria-label="' + pending + '" title="' + pending + '">'
    + '<svg class="manual-review-glyph" viewBox="0 0 16 16" fill="none" aria-hidden="true">'
    + '<rect x="2.25" y="2.25" width="11.5" height="11.5" rx="3" stroke="currentColor" stroke-width="1.5"/>'
    + '<path class="manual-review-checkmark" d="m5 8.1 2 2 4.2-4.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>'
    + '<span class="manual-review-label" data-review-label>' + pending + '</span>'
    + '</button>';
}

export function syncManualReviewControls(root, reviewed, labels = DEFAULT_LABELS) {
  if (!root) return;
  const seen = reviewed instanceof Set ? reviewed : new Set(reviewed || []);
  const pending = labels.pending || DEFAULT_LABELS.pending;
  const doneLabel = labels.done || DEFAULT_LABELS.done;
  root.querySelectorAll('[data-manual-review-id]').forEach(control => {
    const id = control.getAttribute('data-manual-review-id') || '';
    const done = seen.has(id);
    control.classList.toggle('is-reviewed', done);
    control.setAttribute('aria-pressed', String(done));
    control.setAttribute('aria-label', done ? doneLabel : pending);
    control.setAttribute('title', done ? doneLabel : pending);
    const label = control.querySelector('[data-review-label]');
    if (label) label.textContent = done ? doneLabel : pending;
  });
}
