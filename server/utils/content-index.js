const CROSS_REF = /\(([a-z0-9-]+\.[a-z0-9-]+\.q\d+)\)/g;

/* Pages only need the questions cited by the content they render. Keeping this
   projection server-side avoids embedding the full index in every payload. */
export function referencedIds(value, ids = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(CROSS_REF)) ids.add(match[1]);
  } else if (Array.isArray(value)) {
    for (const item of value) referencedIds(item, ids);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) referencedIds(item, ids);
  }
  return ids;
}

export function slimQuestions(index, ids) {
  const questions = {};
  for (const id of ids) {
    const item = index?.items?.[id];
    if (!item) continue;
    questions[id] = { en: item.en, vi: item.vi };
  }
  return questions;
}

/* Progress needs item ids only. Keep the established topics shape so the
   header picker and ring can share one compact object without an async fetch. */
export function progressIndex(index) {
  const topics = (index?.topics || []).map(row => ({
    n: row.n,
    item_ids: row.item_ids || [],
    track_item_ids: row.track_item_ids || []
  }));
  return {
    topics,
    track_item_ids: topics.flatMap(row => row.track_item_ids)
  };
}
