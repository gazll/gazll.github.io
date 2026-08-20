/* Turns a written cross-reference — "(01-java-core-jvm.memory.q1)" — into a
   link to the item that owns the explanation.

   The material leans on one rule: a mechanism is explained in exactly one item,
   and everywhere else states the local decision and points here. That only
   works if the pointer is reachable AND says where it goes; before this, a
   reader met a 45-character id as dead text, and after the Nuxt migration a
   bare "Q3" that named nothing.

   An item lives on one of two surfaces, so the route differs. Both inputs come
   from data the page already has: `data/content-index.json` carries every item
   id with its question in both languages (which is exactly why it exists), and
   a topic or blueprint route ships the `sourceOwners` map. Unknown targets
   return null and the renderer leaves the plain text alone. */

const LABEL_MAX = 60;

/* The label is the target's own question, shown in the language being read.
   Markdown markers are stripped rather than escaped: the label is spliced into
   the stream before inline processing runs, so a stray ` or * would be read as
   markup around the link. */
export function labelFor(question) {
  const flat = String(question || '').replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
  if (flat.length <= LABEL_MAX) return flat;
  const cut = flat.slice(0, LABEL_MAX);
  const stop = cut.lastIndexOf(' ');
  // Never end inside an entity — "&lt" would render as text, not "<".
  return (stop > LABEL_MAX / 2 ? cut.slice(0, stop) : cut).replace(/&[a-z#0-9]*$/i, '').trim() + '…';
}

export const trackHref = id => `/topics/${id.split('.')[0]}#question-${encodeURIComponent(id)}`;
export const designHref = (slug, id) => `/system-design/${slug}#question-${encodeURIComponent(id)}`;

/** The set of ids the Study Track still browses, out of data/content-index.json. */
export function trackItemIds(index) {
  const rows = Object.values(index?.topics || {});
  return new Set(rows.flatMap(row => row.track_item_ids || []));
}

/** Resolver for renderMarkdown: id -> {href, label}, or null to leave as text. */
export function crossRefResolver({ questions = {}, onTrack = new Set(), owners = {}, lang = 'en' } = {}) {
  return id => {
    const text = questions[id];
    if (!text) return null;
    const label = labelFor(text[lang] || text.en || text.vi);
    if (!label) return null;

    if (onTrack.has(id)) return { href: trackHref(id), label };
    // Off the track: only the blueprint holding it knows the route. No owner
    // means no link, not a broken one.
    const owner = owners[id];
    return owner ? { href: designHref(owner, id), label } : null;
  };
}
