async function deployedVersion() {
  try {
    const url = new URL('/version.json', window.location.origin);
    url.searchParams.set('_', String(Date.now()));
    const response = await fetch(url, { cache: 'no-store' });
    const release = response.ok ? await response.json() : null;
    return /^[A-Za-z0-9._-]+$/.test(release?.version || '') ? release.version : 'dev';
  } catch (error) {
    return 'dev';
  }
}

export default defineNuxtPlugin(async () => {
  const version = await deployedVersion();
  const moduleUrl = (path: string) => version === 'dev' ? path : `${path}?v=${encodeURIComponent(version)}`;
  const [{ Auth }, { Store }, { SearchHistory }, { call }] = await Promise.all([
    import(/* @vite-ignore */ moduleUrl('/lib/auth.js')),
    import(/* @vite-ignore */ moduleUrl('/lib/store.js')),
    import(/* @vite-ignore */ moduleUrl('/lib/search-history.js')),
    import(/* @vite-ignore */ moduleUrl('/lib/api.js'))
  ]);

  Store.attachAuth();
  SearchHistory.attachAuth();
  // Google Identity Services is an optional network integration. Hydration and
  // all offline features must not wait for that script to load.
  void Auth.init();

  return { provide: { auth: Auth, studyStore: Store, searchHistory: SearchHistory, apiCall: call } };
});
