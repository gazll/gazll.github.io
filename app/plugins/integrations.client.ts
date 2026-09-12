import { Auth } from '../../public/lib/auth.js';
import { Store } from '../../public/lib/store.js';
import { SearchHistory } from '../../public/lib/search-history.js';
import { call, setSessionHooks } from '../../public/lib/api.js';

export default defineNuxtPlugin(() => {
  // The transport hands session envelopes to Auth, and sign-out tells the
  // backend to drop the row — best effort, the local copy goes regardless.
  setSessionHooks({
    adopt: (session: unknown, usedToken: string) => Auth.adoptSession(session, usedToken),
    drop: (usedToken: string) => Auth.dropSession(usedToken)
  });
  Auth.hooks.logout = (token: string) => { void call('auth.logout', {}, token).catch(() => {}); };

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
