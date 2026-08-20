/* The two pure text primitives search is built on, split out so the server can
   import them without pulling in the browser data layer (Content, the
   collection loaders, the DOM helpers) that lib/search.js needs.

   lib/search.js re-exports both, so there is still exactly one implementation.
*/

/**
 * Lowercase, strip Vietnamese diacritics, keep the length identical.
 *
 * Length matters: "đồng bộ" and "dong bo" must be the same 7 characters so a
 * match found in the folded copy can be highlighted in the original. Hence
 * per-character folding rather than `normalize('NFD').replace(...)`, which
 * would expand every accented letter into two or three code units.
 */
export function fold(text) {
  const source = String(text == null ? '' : text);
  let out = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const lower = ch.toLowerCase();
    // Some code points lowercase into two characters; keep the original then.
    const one = lower.length === 1 ? lower : ch;
    if (one === 'đ') { out += 'd'; continue; }
    const decomposed = one.normalize('NFD');
    out += decomposed.length > 1 ? decomposed[0] : one;
  }
  return out;
}

/**
 * Readable text out of an answer written for `renderMarkdown`.
 *
 * SVG goes first and whole: diagram labels are single words positioned by
 * coordinates, so they read as noise in a snippet. Entities are decoded after
 * tags are stripped, never before — `&lt;pid&gt;` is text the author wrote and
 * must survive as `<pid>`, not become a tag that the next rule deletes.
 */
export function plainText(markdown) {
  return String(markdown == null ? '' : markdown)
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&amp;/gi, '&')
    .replace(/^\s*:::(?:deep|tip|warn)\s*/gm, ' ')
    .replace(/^\s*:::\s*$/gm, ' ')
    .replace(/\[\[[rgob]:([^\]]+)\]\]/g, '$1')
    .replace(/```[a-z]*/gi, ' ')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, ' ')
    // Emphasis and code markers are removed, not spaced out: a space before
    // the "." of `` `jcmd`. `` would read as a typo in the snippet.
    .replace(/[*`]/g, '')
    .replace(/[|#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
