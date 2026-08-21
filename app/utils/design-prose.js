/* The System Design reading format, ported from the retired hash-router view.

   These five decisions were reviewed together against a real blueprint and
   each replaced something that had already read badly — see CLAUDE.md, "the
   blueprint reading format is reviewed and settled". The native page renders
   the strings this module returns, so the rules live here now rather than in
   a view: a decision row stacks name over detail, a `:` or `—` is a structural
   break, three tones stay rare, and prose the author wrote as a list prints as
   one via lib/prose.js. */

import { escapeHtml } from '../../public/lib/markdown.js';
import { bulletParts, labelledParts, sentences } from '../../public/lib/prose.js';

const numberLabel = n => String(n).padStart(2, '0');

/* Three tones over escaped text: clay = the cost, emerald = the rule, ink-bold
   = quantities. Narrow phrases, not keyword lists — bare verbs lit a dozen
   spans per paragraph and buried the lines that matter. */
const CRITICAL = /(?:\b(?:never safe|not safe for|is not safe|unsafe|must not|does not help|cannot fix|no longer optional|blast radius|hot[- ]?key|bottleneck|single point of failure|data loss|the mistake|goes wrong|breaks? down|silently)\b|(?:không an toàn|không bao giờ|không giúp|không sửa được|cái giá|trả giá|sai lầm|chọn sai|điểm nghẽn|mất dữ liệu|âm thầm))/giu;
const NOTABLE = /(?:\b(?:the rule is|rule of thumb|as a rule|the correct first move|simplest viable|cheapest correctness|reversible|prefer\b|by default|only when|exactly once)\b|(?:nguyên tắc|quy tắc|nước đi đầu tiên|đơn giản nhất|rẻ nhất|đảo ngược được|mặc định|chỉ khi|đúng một lần))/giu;
/* Entities are already in the escaped string, so &#39; must not be read as a
   number — hence the (?<!&#) guard. */
/* The k/M guard must be unicode-aware. `[\w-]` does not include `ỗ`, so
   "1.000 mỗi phút" matched "1.000 m" and rendered the bold ending mid-word —
   silently, and only in Vietnamese, which is why it survived. */
const UNIT = '(?:\\s?(?:triệu|nghìn|tỷ|[kKmM](?![\\p{L}\\d-])|rps|qps|ms|GB|MB|TB|%))?';
/* A range is one quantity, so "1-10 triệu" is matched whole rather than as two
   spans with a bare hyphen between them. */
const QUANTITY = new RegExp('(?<!&#)\\b\\d[\\d.,]*' + UNIT + '(?:\\s?[-–—]\\s?\\d[\\d.,]*' + UNIT + ')?', 'gu');

/* Slot indexes use private-use digits U+E010-E019, never ASCII: QUANTITY runs
   last and would otherwise eat the digits of an earlier pattern's slot. */
const SLOT_OPEN = String.fromCharCode(0xE001);
const SLOT_CLOSE = String.fromCharCode(0xE002);
const slotDigits = n => String(n).replace(/\d/g, d => String.fromCharCode(0xE010 + Number(d)));
const SLOT_RE = new RegExp(SLOT_OPEN + '([\\uE010-\\uE019]+)' + SLOT_CLOSE, 'g');

export function emphasize(value) {
  const escaped = escapeHtml(String(value || ''));
  const held = [];
  // Park each match behind a sentinel so a later pattern cannot match inside
  // markup an earlier one already emitted.
  const park = html => {
    held.push(html);
    return SLOT_OPEN + slotDigits(held.length - 1) + SLOT_CLOSE;
  };
  return escaped
    .replace(CRITICAL, m => park('<b class="sd-crit">' + m + '</b>'))
    .replace(NOTABLE, m => park('<b class="sd-note">' + m + '</b>'))
    .replace(QUANTITY, m => park('<b class="sd-num">' + m + '</b>'))
    .replace(SLOT_RE, (_, digits) => held[Number(
      [...digits].map(ch => ch.charCodeAt(0) - 0xE010).join(''))]);
}

/* Enumerated prose is rendered as the list the author already wrote — see
   lib/prose.js for when a block counts as one. The lead keeps the class the
   paragraph had, because the lead is the sentence that class was styling. */
function bulletList(items) {
  return '<ul class="sd-clause-list">'
    + items.map(item => '<li>' + emphasize(item) + '</li>').join('') + '</ul>';
}

export function proseParagraph(value, className) {
  const source = String(value || '').trim();
  const attribute = className ? ' class="' + className + '"' : '';
  const { lead, items } = bulletParts(source);
  // A list with no lead opens on a bare bullet and the reader loses the
  // sentence it belongs to, so that case stays a paragraph.
  if (!items.length || !lead) return '<p' + attribute + '>' + emphasize(source) + '</p>';
  return '<p' + attribute + '>' + emphasize(lead) + '</p>' + bulletList(items);
}

/* Scope runs 1-5 sentences (median 2), so a fixed split would mangle the short
   ones. Only prose long enough to read as a wall is broken up, and the closing
   sentence is pulled out as the thesis when it is a standalone claim. */
export function renderScope(value) {
  const source = String(value || '').trim();
  const lines = sentences(source);
  if (source.length < 260 || lines.length < 3) return proseParagraph(source, '');

  const lead = lines[0];
  const rest = lines.slice(1);
  // A short final sentence that makes a claim reads as the takeaway; a long one
  // is still body text and stays in the paragraph.
  const closing = rest.length > 1 && rest[rest.length - 1].length <= 160 ? rest.pop() : '';

  return proseParagraph(lead, 'sd-lead')
    + (rest.length ? proseParagraph(rest.join(' '), '') : '')
    + (closing ? '<p class="sd-thesis">' + emphasize(closing) + '</p>' : '');
}

/* 9% of list rows open with "label: rest". Promoting the label to its own line
   is what stops it running into the body text; the other 91% render unchanged,
   so this must degrade to a plain <li>. */
const ROW_LABEL = /^([^:—–]{4,60}):\s+(?=\S)/u;

export function listRow(value) {
  const source = String(value || '').trim();
  const match = source.match(ROW_LABEL);
  // The colon rides with the label: dropping it would delete source text, and
  // the label is a heading here, not a fragment of the sentence below it.
  const label = match ? '<b class="sd-row-label">' + emphasize(match[1]) + ':</b>' : '';
  const body = match ? source.slice(match[0].length) : source;
  const { lead, items } = bulletParts(body);
  const listed = items.length > 0 && Boolean(lead);
  const classes = (match ? 'has-label' : '') + (listed ? (match ? ' ' : '') + 'has-list' : '');
  return '<li' + (classes ? ' class="' + classes + '"' : '') + '>' + label
    + emphasize(listed ? lead : body) + (listed ? bulletList(items) : '') + '</li>';
}

export function list(items) {
  return '<ul>' + (items || []).map(listRow).join('') + '</ul>';
}

export function splitDecision(value) {
  const source = String(value || '');
  const separator = source.search(/(?:\s[—–]\s|:\s)/);
  if (separator < 0) {
    const words = source.split(/\s+/);
    return { name: words.slice(0, 6).join(' ') + (words.length > 6 ? '…' : ''), detail: source };
  }
  const delimiter = source.slice(separator).match(/^(?:\s[—–]\s|:\s)/)?.[0] || '';
  return { name: source.slice(0, separator), detail: source.slice(separator + delimiter.length) };
}

/* The densest text in the library is a decision detail that packs several
   labelled segments into one string ("Problem solved: … Tier verdict: …").
   Each label opens its own line, and a segment that enumerates becomes the
   list it already was — same structural break as the name/detail split, one
   level further in. */
export function detailProse(value, className) {
  const source = String(value || '').trim();
  const parts = labelledParts(source) || [{ label: '', body: source }];
  return '<div class="' + className + '">' + parts.map(part => {
    const { lead, items } = bulletParts(part.body);
    const listed = items.length > 0 && Boolean(lead || part.label);
    // The label is chrome, not prose: emphasising it would nest a tone inside
    // a line that is already set apart, and the tones only mean something
    // while they stay rare.
    const head = (part.label ? '<b class="sd-part-label">' + escapeHtml(part.label) + ':</b> ' : '')
      + emphasize(listed ? lead : part.body);
    return '<div class="sd-part">' + (head.trim() ? '<p>' + head + '</p>' : '')
      + (listed ? bulletList(items) : '') + '</div>';
  }).join('') + '</div>';
}

/* Stacked, not tabular: a fixed name column wasted half the width on 7-char
   names. .sd-comparison-wrap stays as the outer class — tests pin it. */
export function comparisonTable(rows, labels, className) {
  const body = (rows || []).map((value, index) => {
    const row = splitDecision(value);
    return '<div class="sd-decision-row"><p class="sd-decision-name"><span>' + numberLabel(index + 1)
      + '</span>' + emphasize(row.name) + '</p>'
      + (row.detail && row.detail !== row.name
        ? detailProse(row.detail, 'sd-decision-detail') : '') + '</div>';
  }).join('');
  return '<div class="sd-comparison-wrap ' + className + '"><div class="sd-decision-legend"><span>'
    + escapeHtml(labels[0]) + '</span><span>' + escapeHtml(labels[1]) + '</span></div>'
    + '<div class="sd-decision-rows">' + body + '</div></div>';
}

/** One trade-off card: the decision name in bold over its structured detail. */
export function tradeoffCards(rows) {
  return (rows || []).map((row, index) => {
    const parts = splitDecision(row);
    return '<article><span>' + numberLabel(index + 1) + '</span><div><strong>' + emphasize(parts.name)
      + '</strong>' + (parts.detail && parts.detail !== parts.name
        ? detailProse(parts.detail, 'sd-tradeoff-detail') : '') + '</div></article>';
  }).join('');
}

/** One failure-review card per lens, question emphasised over structured prose. */
export function failureCards(entries) {
  return (entries || []).map((entry, index) => '<article><span>' + numberLabel(index + 1)
    + '</span><div><h3>' + emphasize(entry.question) + '</h3>'
    + proseParagraph(entry.answer, '') + '</div></article>').join('');
}
