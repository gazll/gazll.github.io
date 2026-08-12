/** Stable hash routes for individual study-track questions. */

const LANGS = new Set(['en', 'vi']);

function languageFromHash(hash, fallback = 'en') {
  const raw = String(hash == null ? '' : hash).replace(/^#/, '');
  const route = raw.split('#')[0];
  const query = route.includes('?') ? route.slice(route.indexOf('?') + 1) : '';
  const value = query.match(/(?:^|&)lang=(en|vi)(?:&|$)/)?.[1] || '';
  return LANGS.has(value) ? value : fallback;
}

function localized(path, lang = null) {
  const chosen = LANGS.has(lang)
    ? lang
    : languageFromHash(globalThis.location?.hash, 'en');
  return path + '?lang=' + chosen;
}

export function questionHash(questionId, lang = null) {
  return localized('#/track/' + encodeURIComponent(questionId), lang);
}

export function questionUrl(pageHref, questionId) {
  const url = new URL(pageHref);
  url.hash = questionHash(questionId, languageFromHash(url.hash, 'en')).slice(1);
  return url.href;
}

/** Canonical location for a former Study Track question moved into a blueprint. */
export function systemDesignQuestionHash(designSlug, questionId, lang = null) {
  return localized('#/system-design/' + encodeURIComponent(designSlug) + '/' + encodeURIComponent(questionId), lang);
}

export function systemDesignQuestionUrl(pageHref, designSlug, questionId) {
  const url = new URL(pageHref);
  url.hash = systemDesignQuestionHash(designSlug, questionId, languageFromHash(url.hash, 'en')).slice(1);
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
