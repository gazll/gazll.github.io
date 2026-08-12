/* Turns a written cross-reference — "(01-java-core-jvm.memory.q1)" — into a
   link to the item that owns the explanation.

   The material leans on one rule: a mechanism is explained in exactly one
   item, and everywhere else states the local decision and points here. That
   only works if the pointer is reachable; before this, a reader met a 45-
   character id as dead text and had to go hunting.

   An item lives on one of two surfaces, so the route differs, and the answer
   can change while the app runs (System Design loads lazily). Hence a resolver
   built per render rather than a static map: unknown or not-yet-loaded targets
   return null and the renderer leaves the plain text alone. */
import { Content } from './content.js';
import { SystemDesign } from './system-design.js';
import { questionHash, systemDesignQuestionHash } from './question-links.js';

const LABEL_MAX = 60;

/* The label is the target's own question, shown in the language being read.
   Markdown markers are stripped rather than escaped: the label is spliced into
   the stream before inline processing runs, so a stray ` or * would be read as
   markup around the link. */
function labelFor(question) {
  const flat = String(question || '').replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
  if (flat.length <= LABEL_MAX) return flat;
  const cut = flat.slice(0, LABEL_MAX);
  const stop = cut.lastIndexOf(' ');
  // Never end inside an entity — "&lt" would render as text, not "<".
  return (stop > LABEL_MAX / 2 ? cut.slice(0, stop) : cut).replace(/&[a-z#0-9]*$/i, '').trim() + '…';
}

/** Resolver for renderMarkdown: id -> {href, label}, or null to leave as text. */
export function crossRefResolver({ content = Content, systemDesign = SystemDesign } = {}) {
  // topicItemIds rebuilds a Set on every read, so take it once per render.
  let onTrack = null;
  return (id) => {
    const pair = content.itemPair(id);
    if (!pair) return null;
    const text = pair[content.lang] || pair.en;
    const label = labelFor(text && text.q);
    if (!label) return null;

    if (!onTrack) onTrack = content.topicItemIds;
    if (onTrack.has(id)) return { href: questionHash(id), label };

    // Off the track: only the blueprint holding it knows the route, and it is
    // loaded on demand. Not loaded yet means no link, not a broken one.
    const design = systemDesign.designForSourceItem ? systemDesign.designForSourceItem(id) : null;
    return design ? { href: systemDesignQuestionHash(design.slug, id), label } : null;
  };
}
