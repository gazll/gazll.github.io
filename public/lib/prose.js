/* Structure for authored long-form prose, shared by System Design and Case
   Studies.

   Much of that prose is a list wearing a paragraph's clothes: a lead clause
   followed by semicolon-separated items, or a run of labelled segments packed
   into one string ("Problem solved: … Flow position: …"). Printed verbatim it
   reads as a wall — the reader has to re-parse the punctuation the author
   already meant as structure.

   This module only decides *structure*. It returns plain strings, never
   markup: each view escapes and emphasises the text itself, and the two do it
   differently. Nothing here may lose a character either — a caller renders
   every returned string, so the only source characters a transform may consume
   are the separators it replaced (the `;` between clauses and the whitespace
   after a `:`). */

/* Sentence break for EN and VI. \p{Lu} rather than an ASCII range: the
   lookahead must accept accented capitals (Đ, Ả, Ứ …) or it splits
   mid-sentence. A backtick opens a code span, so it starts a sentence too. */
export const SENTENCE = /(?<=[.?!])\s+(?=[\p{Lu}0-9"“(`])/u;

export function sentences(value) {
  return String(value || '').trim().split(SENTENCE).filter(Boolean);
}

/* A labelled segment opens the string, or a sentence inside it, with a short
   phrase and a colon. The phrase may not contain `.`, `;` or a second `:`, so
   an ordinary mid-sentence colon ("… target for promotion: CDN at the edge")
   is far too long to match and stays prose. */
const LABEL = /(?:^|(?<=[.;]\s))(\p{Lu}[^:;.]{2,44}):\s(?=\S)/gu;

/* Two labels, not one: a single leading label is the ordinary "label: rest"
   row that listRow already promotes, and treating it as a labelled run would
   turn every list row into a one-item definition list. */
const MIN_LABELS = 2;

/** Split "A: … B: … C: …" into its labelled parts, or null when it is prose. */
export function labelledParts(value) {
  const source = String(value || '').trim();
  const parts = [];
  let cursor = 0;
  let label = '';
  for (const match of source.matchAll(LABEL)) {
    // Text before the first label is a preamble: it keeps its place in the
    // sequence but carries no label of its own.
    if (match.index > 0) parts.push({ label, body: source.slice(cursor, match.index).trim() });
    label = match[1];
    cursor = match.index + match[0].length;
  }
  if (!label) return null;
  parts.push({ label, body: source.slice(cursor).trim() });
  return parts.filter(part => part.label).length >= MIN_LABELS ? parts : null;
}

/* Three, not two. Two clauses are a compound sentence and two sentences are a
   claim plus its qualifier — splitting either one fragments prose that already
   reads fine. Three is where the author was enumerating. */
const MIN_CLAUSES = 3;
const MIN_SENTENCES = 3;
const CLAUSE = /;\s+/;
/* …with one exception, and it is a length, not a count. Two clauses stop being
   a compound sentence once the reader has to hold both halves across a whole
   line of text: at that point the `;` is the author enumerating, exactly as
   three clauses would be. 180 characters is where that starts — a two-clause
   row under it is a claim plus its qualifier and stays one line, which is what
   MIN_CLAUSES was protecting. */
const LONG_PAIR = 180;
/* The lead hands off into the list, so it is capped at 90 characters: past
   that it is a paragraph in its own right and the colon was punctuation. */
const LEAD = /^([^:]{4,90}):\s(?=\S)/u;

/** Break one block of prose into a lead line plus the items it enumerates. */
export function bulletParts(value) {
  const source = String(value || '').trim();
  const lines = sentences(source);
  if (lines.length >= MIN_SENTENCES) return { lead: lines[0], items: lines.slice(1) };

  // A single enumerating sentence: "lead: a; b; c". The enumeration is always
  // the last sentence — anything before it introduces the list.
  const last = lines[lines.length - 1] || '';
  const clauses = last.split(CLAUSE).map(clause => clause.trim()).filter(Boolean);
  const minClauses = last.length > LONG_PAIR ? 2 : MIN_CLAUSES;
  if (clauses.length < minClauses) return { lead: source, items: [] };

  const head = clauses[0].match(LEAD);
  const lead = [lines.slice(0, -1).join(' '), head ? head[1] + ':' : ''].filter(Boolean).join(' ');
  const items = [head ? clauses[0].slice(head[0].length) : clauses[0], ...clauses.slice(1)].filter(Boolean);
  return { lead, items };
}
