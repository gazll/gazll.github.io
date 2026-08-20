import { readContentLanguage, writeContentLanguage } from '../../public/lib/i18n.js';

/* The EN/VI choice is a reader preference, not a property of one link. The URL
   stays authoritative — a shared `?lang=vi` must open in Vietnamese for anyone
   — but a reader who picked a language keeps it when they open the site again
   without one. Storage is lib/i18n.js's, the same key the retained modules use,
   so the standalone surfaces and the app never disagree. */
export default defineNuxtPlugin(nuxtApp => {
  const router = useRouter();

  router.afterEach(to => {
    const explicit = to.query.lang;
    if (explicit === 'vi' || explicit === 'en') writeContentLanguage(String(explicit));
  });

  // Only on the first entry, and only when the URL says nothing: rewriting a
  // link that already carries a language would override what was shared.
  nuxtApp.hook('app:mounted', () => {
    const route = router.currentRoute.value;
    if (route.query.lang) return;
    if (readContentLanguage() !== 'vi') return;
    router.replace({ path: route.path, query: { ...route.query, lang: 'vi' }, hash: route.hash });
  });
});
