import { escapeHtml } from './markdown.js';

const DEFAULT_LABELS = { pending: 'Mark reviewed', done: 'Reviewed' };

export function manualReviewMarkup(id, labels = DEFAULT_LABELS) {
  const safeId = escapeHtml(id);
  const pending = escapeHtml(labels.pending || DEFAULT_LABELS.pending);
  return '<button type="button" class="manual-review" data-manual-review-id="' + safeId
    + '" aria-pressed="false" aria-label="' + pending + '" title="' + pending + '">'
    + '<span class="manual-review-box" data-review-check aria-hidden="true">□</span>'
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
    const check = control.querySelector('[data-review-check]');
    const label = control.querySelector('[data-review-label]');
    if (check) check.textContent = done ? '✓' : '□';
    if (label) label.textContent = done ? doneLabel : pending;
  });
}
