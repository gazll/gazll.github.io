import { safeDecodeURIComponent } from '~/utils/uri.js';

/* The hash router is gone, but its URLs were shared and bookmarked — and the
   case-study slugs were kept unnumbered precisely so links would survive
   reorganisation. This maps the retired `#/track/<id>` shapes onto the
   filesystem routes once, on entry; removing it turns every existing bookmark
   into a 404. Client-only because the fragment never reaches the server. */
export default defineNuxtRouteMiddleware(() => {
  const raw = window.location.hash;
  if (!raw.startsWith('#/')) return;

  const legacy = raw.slice(1);
  const secondHash = legacy.indexOf('#');
  const beforeAnchor = secondHash >= 0 ? legacy.slice(0, secondHash) : legacy;
  const anchor = secondHash >= 0 ? legacy.slice(secondHash + 1) : '';
  const queryIndex = beforeAnchor.indexOf('?');
  const pathname = queryIndex >= 0 ? beforeAnchor.slice(0, queryIndex) : beforeAnchor;
  const params = new URLSearchParams(queryIndex >= 0 ? beforeAnchor.slice(queryIndex + 1) : '');
  const parts = pathname.split('/').filter(Boolean).map(part => safeDecodeURIComponent(part));
  const query = params.get('lang') === 'vi' ? { lang: 'vi' } : {};
  let path = '/';
  let hash = anchor ? `#${anchor}` : '';

  if (parts[0] === 'track') {
    const values = parts.slice(1).filter(part => part !== 'question');
    const questionId = values.find(part => /\.q\d+$/.test(part));
    const topicKey = questionId?.split('.')[0] || values[0];
    path = topicKey ? `/topics/${encodeURIComponent(topicKey)}` : '/';
    if (questionId) hash = `#question-${encodeURIComponent(questionId)}`;
  } else if (parts[0] === 'system-design' && parts[1] === 'case' && parts[2]) {
    path = `/case-studies/${encodeURIComponent(parts[2])}`;
  } else if (parts[0] === 'system-design' && parts[1]) {
    path = `/system-design/${encodeURIComponent(parts[1])}`;
    if (parts[2]) hash = `#question-${encodeURIComponent(parts[2])}`;
  } else if (parts[0] === 'project') {
    path = '/project';
  } else if (parts.length) {
    path = `/${parts.map(encodeURIComponent).join('/')}`;
  }

  return navigateTo({ path, query, hash }, { replace: true });
});
