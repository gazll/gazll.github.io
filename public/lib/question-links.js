/** Stable hash routes for individual study-track questions. */

export function questionHash(questionId) {
  return '#/track/' + encodeURIComponent(questionId);
}

export function questionUrl(pageHref, questionId) {
  const url = new URL(pageHref);
  url.hash = questionHash(questionId).slice(1);
  return url.href;
}

/** Canonical location for a former Study Track question moved into a blueprint. */
export function systemDesignQuestionHash(designSlug, questionId) {
  return '#/system-design/' + encodeURIComponent(designSlug) + '/' + encodeURIComponent(questionId);
}

export function systemDesignQuestionUrl(pageHref, designSlug, questionId) {
  const url = new URL(pageHref);
  url.hash = systemDesignQuestionHash(designSlug, questionId).slice(1);
  return url.href;
}

/** Decode the one route segment after `#/track/`; malformed links are ignored. */
export function questionIdFromRoute(routeParts) {
  if (!Array.isArray(routeParts) || routeParts.length !== 1) return null;
  try {
    return decodeURIComponent(routeParts[0]) || null;
  } catch (e) {
    return null;
  }
}

/** Find by immutable content id, never by the repeated visual labels such as Q6. */
export function findQuestion(topics, questionId) {
  if (!questionId) return null;
  for (let topicIndex = 0; topicIndex < topics.length; topicIndex++) {
    for (const section of topics[topicIndex].sections || []) {
      const item = (section.items || []).find(candidate => candidate.id === questionId);
      if (item) return { topicIndex, section, item };
    }
  }
  return null;
}
