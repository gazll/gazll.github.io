/* A presentation talk is Markdown whose `## ` headings are its slides.
   The page owns the frame (title, presenter, date, agenda, contents) and the
   author owns only what goes inside each section, so a talk cannot break the
   layout by how it is written. Mermaid fences are split out here because
   renderMarkdown escapes every fence as code; the page mounts them instead.
   Pure: the talk route, tools/check-diagrams.mjs and the tests share it. */

export const TALK_KINDS = ['current', 'new'];
export const TALK_STATUSES = ['open', 'preparing', 'done'];

const slugify = text => String(text).normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function blocksOf(lines) {
  const blocks = [];
  let text = [];
  let diagram = null;
  const flush = () => { if (text.join('').trim()) blocks.push({ kind: 'md', text: text.join('\n') }); text = []; };
  for (const line of lines) {
    if (diagram) {
      if (/^```\s*$/.test(line.trim())) { blocks.push({ kind: 'mermaid', text: diagram.join('\n') }); diagram = null; }
      else diagram.push(line);
    } else if (/^```mermaid\s*$/.test(line.trim())) { flush(); diagram = []; }
    else text.push(line);
  }
  if (diagram) text.push('```mermaid', ...diagram); // unclosed: show it as text rather than lose it
  flush();
  return blocks;
}

/** `[{ id, title, blocks: [{ kind: 'md' | 'mermaid', text }] }]`; text before the first `##` is an untitled intro. */
export function talkSections(md) {
  const raw = [];
  let current = { title: '', lines: [] };
  let fenced = false;
  for (const line of String(md || '').replace(/\r/g, '').split('\n')) {
    if (/^```/.test(line.trim())) fenced = !fenced;
    const heading = !fenced && /^##\s+(.+?)\s*#*$/.exec(line.trim());
    if (heading) { raw.push(current); current = { title: heading[1], lines: [] }; continue; }
    current.lines.push(line);
  }
  raw.push(current);
  return raw.filter(section => section.title || section.lines.join('').trim())
    .map((section, index) => ({
      id: `s${index + 1}${section.title ? '-' + slugify(section.title) : ''}`,
      title: section.title,
      blocks: blocksOf(section.lines)
    }));
}
