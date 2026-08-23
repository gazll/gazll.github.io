/* ---------- Markdown renderer (dependency-free, tuned to this book's subset) ----------
   Supports: paragraphs, headings/permalinks, **bold**, *italic*, `code`,
   fenced code, "- "/"1." lists, simple GFM tables, ::: deep | tip | warn :::
   callouts, and raw HTML blocks (SVG diagrams / tables / pre). */

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
const INTERNAL_HREF = /^(?:#[^\s]*|\/(?!\/)[^\s]*)$/;

export function renderMarkdown(md, options) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const resolveRef = options && options.resolveRef;
  const headingIds = new Map();
  let headingNumber = 0;
  let i = 0, html = '';

  // No resolver means the id stays the plain text it has always been — that is
  // what keeps every existing caller and test unchanged.
  function linkRefs(t) {
    if (!resolveRef) return t;
    return t.replace(XREF, (whole, id) => {
      const target = resolveRef(id);
      const href = target && String(target.href || '');
      return target && INTERNAL_HREF.test(href)
        ? '(<a class="xref" href="' + escapeHtml(href) + '" title="' + escapeHtml(id) + '">&#8594; ' + escapeHtml(target.label) + '</a>)'
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
  const fenceMatch = l => /^```([A-Za-z0-9_+.#-]*)\s*$/.exec(l.trim());
  const headingMatch = l => /^(#{1,6})\s+(.+?)\s*#*$/.exec(l.trim());
  const headingId = value => {
    const base = String(value || '').replace(/[`*_]/g, '').trim().toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'section';
    headingNumber++;
    if (options?.stableHeadingIds) return 'heading-' + headingNumber;
    const count = headingIds.get(base) || 0;
    headingIds.set(base, count + 1);
    const prefix = String(options?.headingPrefix || '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return (prefix ? prefix + '-' : '') + (count ? base + '-' + count : base);
  };
  const splitTableRow = line => {
    let row = line.trim();
    if (row.startsWith('|')) row = row.slice(1);
    if (row.endsWith('|')) row = row.slice(0, -1);
    return row.split('|').map(cell => cell.trim());
  };
  const isTableSeparator = line => {
    const cells = splitTableRow(line);
    return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
  };
  const isSpecial = l => {
    const s = l.trim();
    return s.startsWith(':::') || s.startsWith('<') || fenceMatch(s) || headingMatch(s)
      || /^([-*]|\d+\.)\s+/.test(s) || /^\s*\|.*\|\s*$/.test(s);
  };

  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }
    const trimmed = lines[i].trim();

    // Fenced code is used by imported project documents and is intentionally
    // escaped as a whole block: code samples must never become active HTML.
    const fence = fenceMatch(trimmed);
    if (fence) {
      i++;
      const buf = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      if (i < lines.length) i++;
      const language = fence[1] ? ' class="language-' + escapeHtml(fence[1]) + '"' : '';
      html += '<pre><code' + language + '>' + escapeHtml(buf.join('\n')) + '</code></pre>';
      continue;
    }

    const heading = headingMatch(trimmed);
    if (heading) {
      const level = heading[1].length;
      const label = heading[2].trim();
      const id = headingId(label);
      const route = String(options?.headingRoute || '').replace(/^#/, '').replace(/#.*$/, '');
      const href = route ? '#' + route + '#' + encodeURIComponent(id) : '#' + encodeURIComponent(id);
      const linkLabel = options?.headingLinkLabel || 'Link to this section';
      html += '<h' + level + ' id="' + escapeHtml(id) + '"><a class="md-heading-anchor" data-anchor-link data-anchor-id="'
        + escapeHtml(id) + '"' + (route ? ' data-anchor-route="' + escapeHtml(route) + '"' : '')
        + ' href="' + escapeHtml(href) + '" aria-label="' + escapeHtml(linkLabel) + '">' + inlineMd(label)
        + '</a></h' + level + '>';
      i++;
      continue;
    }

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
        // Tip/warn used to flatten the whole body into one inline paragraph.
        // Rendering the same safe subset as the main body makes deliberate
        // paragraph/list breaks visible and keeps dense decision summaries
        // readable without changing existing one-line callouts.
        html += '<div class="' + cls + '">' + (label ? '<b>' + escapeHtml(label) + ':</b> ' : '')
          + renderMarkdown(inner.join('\n'), options) + '</div>';
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

    // Small GFM-style tables are useful in project SRS documents. The
    // separator line makes this unambiguous and leaves ordinary pipe prose
    // untouched.
    if (i + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]) && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(splitTableRow(lines[i])); i++; }
      html += '<table class="md-table"><thead><tr>' + headers.map(cell => '<th>' + inlineMd(cell) + '</th>').join('')
        + '</tr></thead><tbody>' + rows.map(row => '<tr>' + headers.map((_, index) => '<td>' + inlineMd(row[index] || '') + '</td>').join('') + '</tr>').join('')
        + '</tbody></table>';
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
