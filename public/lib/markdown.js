/* ---------- Markdown renderer (dependency-free, tuned to this book's subset) ----------
   Supports: paragraphs, **bold**, *italic*, `code`, "- "/"1." lists,
   ::: deep | tip | warn ::: callouts, and raw HTML blocks (SVG diagrams / tables / pre). */

// Placeholder for code spans during inline processing. Private-use U+E000,
// so it can never collide with real content. Built via fromCharCode rather
// than typed literally: the character is invisible in an editor, and if it
// ever gets lost to an empty string the regex below wraps every number in
// <code>.
const SENT = String.fromCharCode(0xE000);

// Written cross-reference: "(topic-key.section-slug.qN)". validate-content.mjs
// checks every one of these points at a real item, so the only question here
// is whether the caller can turn it into a route.
const XREF = /\(([a-z0-9-]+\.[a-z0-9-]+\.q\d+)\)/g;

export function renderMarkdown(md, options) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const resolveRef = options && options.resolveRef;
  let i = 0, html = '';

  // No resolver means the id stays the plain text it has always been — that is
  // what keeps every existing caller and test unchanged.
  function linkRefs(t) {
    if (!resolveRef) return t;
    return t.replace(XREF, (whole, id) => {
      const target = resolveRef(id);
      return target
        ? '(<a class="xref" href="' + target.href + '" title="' + id + '">&#8594; ' + target.label + '</a>)'
        : whole;
    });
  }

  function inlineMd(t) {
    const codes = [];
    t = t.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return SENT + (codes.length - 1) + SENT; });
    // After code extraction: an id inside `backticks` is being shown, not cited.
    t = linkRefs(t);
    t = t.replace(/\[\[([rgob]):([^\]]+)\]\]/g, '<span class="hl-$1">$2</span>');  // colored keyword
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    t = t.replace(new RegExp(SENT + '(\\d+)' + SENT, 'g'), (_, n) => '<code>' + codes[+n] + '</code>');
    return t;
  }
  const isSpecial = l => { const s = l.trim(); return s.startsWith(':::') || s.startsWith('<') || /^([-*]|\d+\.)\s+/.test(s); };

  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }
    const trimmed = lines[i].trim();

    // ::: callout container
    const cm = /^:::(deep|tip|warn)\s*(.*)$/.exec(trimmed);
    if (cm) {
      i++;
      const inner = [];
      while (i < lines.length && lines[i].trim() !== ':::') { inner.push(lines[i]); i++; }
      i++; // skip closing :::
      const label = cm[2].trim();
      if (cm[1] === 'deep') {
        // Chrome, not content: this label stays English even when the body
        // below it is the Vietnamese original.
        html += "<div class='deep'><span class='deep-tag'>&#9656; DEEP DIVE · SENIOR</span>" + renderMarkdown(inner.join('\n'), options) + '</div>';
      } else {
        const cls = cm[1] === 'warn' ? 'warn' : 'takeaway';
        html += '<div class="' + cls + '">' + (label ? '<b>' + label + ':</b> ' : '') + inlineMd(inner.join(' ').trim()) + '</div>';
      }
      continue;
    }

    // raw HTML block (figure/svg/table/pre/...) — collect until blank line
    if (trimmed.startsWith('<')) {
      const buf = [];
      while (i < lines.length && lines[i].trim()) { buf.push(lines[i]); i++; }
      const raw = buf.join('\n');
      // Table cells cite items too. <pre> and <svg> are excluded: there the id
      // is sample text or diagram content, and an <a> would be wrong markup.
      html += /<(?:pre|svg)\b/.test(raw) ? raw : linkRefs(raw);
      continue;
    }

    // list
    if (/^([-*]|\d+\.)\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')); i++; }
      const tag = ordered ? 'ol' : 'ul';
      html += '<' + tag + '>' + items.map(t => '<li>' + inlineMd(t) + '</li>').join('') + '</' + tag + '>';
      continue;
    }

    // paragraph
    const buf = [];
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i])) { buf.push(lines[i].trim()); i++; }
    html += '<p>' + inlineMd(buf.join(' ')) + '</p>';
  }
  return html;
}

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** For user-authored markdown: escape first, so raw HTML cannot inject. */
export function renderUser(md) { return renderMarkdown(escapeHtml(md)); }

/** renderUser without the wrapping <p>, for inline placement. */
export function inlineUser(md) {
  return renderUser(md).replace(/^<p>([\s\S]*?)<\/p>\s*$/, '$1');
}
