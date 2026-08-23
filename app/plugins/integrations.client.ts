import { Auth } from '../../public/lib/auth.js';
import { Store } from '../../public/lib/store.js';
import { SearchHistory } from '../../public/lib/search-history.js';
import { call } from '../../public/lib/api.js';

export default defineNuxtPlugin(() => {
  Store.attachAuth();
  SearchHistory.attachAuth();

  // Google Identity Services is optional. Start it after the first useful
  // paint so the third-party request cannot compete with the document, CSS or
  // hydration on a slow phone. An explicit sign-in click still initializes it
  // immediately through Auth.signIn().
  const startAuth = () => { void Auth.init(); };
  const idle = (globalThis as any).requestIdleCallback;
  if (typeof idle === 'function') idle(startAuth, { timeout: 2000 });
  else setTimeout(startAuth, 0);

  return { provide: { auth: Auth, studyStore: Store, searchHistory: SearchHistory, apiCall: call } };
});
