import { readFileSync } from 'node:fs';

// Dev-only allowance so Impeccable live mode can load.
const __impeccableLiveDev =
  process.env.NODE_ENV === 'development' ? ' http://localhost:8400' : '';

function json(path: string) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

function contentRoutes() {
  const manifest = json('./public/data/manifest.json');
  const systemDesign = json('./public/data/system-design/catalog.json');
  const caseStudies = json('./public/data/case-studies/manifest.json');
  const photography = json('./public/data/photography/manifest.json');
  const homelab = json('./public/data/homelab/manifest.json');

  const topicRoutes = manifest.topics
    .filter((topic: { surface?: string }) => topic.surface !== 'system-design')
    .map((topic: { file: string }) => `/topics/${topic.file.split('/').pop()!.replace(/\.json$/, '')}`);
  const designRoutes = systemDesign.designs.map((row: { slug: string }) => `/system-design/${row.slug}`);
  const caseRoutes = caseStudies.articles.map((row: { slug: string }) => `/case-studies/${row.slug}`);
  const photoRoutes = photography.articles.map((row: { slug: string }) => `/photography/${row.slug}`);
  const homelabRoutes = homelab.articles.map((row: { slug: string }) => `/homelab/${row.slug}`);

  /* EN only, and deliberately so — this is a decision, not a gap.

     The language is a query parameter (?lang=vi), and a query string cannot
     become a static file: Nitro renders such a route and then discards it, so
     listing a VI pass here re-renders every page and writes nothing.

     Static VI would mean a real /vi/ path prefix — a routing change across
     every internal link, the legacy-hash redirect and the header switch. It
     buys exactly three things: Vietnamese SEO, Vietnamese social previews, and
     ~50-100ms off first paint. This site is a private study reference for a
     handful of readers who all have the link, so none of the three is worth a
     routing rewrite. VI itself is complete and correct on the client, and the
     chosen language persists via lib/i18n.js.

     Revisit only if the site goes public and search indexing starts to matter. */
  return [
    '/', '/search', '/api/content/search-index/en', '/api/content/search-index/vi', '/api/content/item-index', '/api/content/english-study', '/gazl-try', '/stats', '/admin', '/english-study', '/system-design', '/case-studies',
    '/project', '/project/calebzone', '/photography', '/homelab', '/release-notes', '/fshare-tool',
    '/course-registration', '/calendar', ...topicRoutes, ...designRoutes, ...caseRoutes, ...photoRoutes, ...homelabRoutes
  ];
}

export default defineNuxtConfig({
  compatibilityDate: '2026-08-20',
  devtools: { enabled: false },
  ssr: true,
  /* Keep the shared stylesheet cacheable across routes instead of copying it
     into every prerendered HTML document. Vite still emits the minified,
     hashed CSS asset. */
  features: { inlineStyles: false },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'referrer', content: 'no-referrer' },
        /* The site talks to Google Identity and Apps Script and nothing else;
           the ID token is a credential, so the allowed origins stay explicit.
           'unsafe-inline' covers the hydration payload Nuxt inlines — the
           previous hand-written bootstrap did not need it. */
        { 'http-equiv': 'Content-Security-Policy', content: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          `script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client${__impeccableLiveDev}`,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: https://*.googleusercontent.com",
          `connect-src 'self' https://fshare.annnekkk.com https://accounts.google.com/gsi/ https://script.google.com https://script.googleusercontent.com${__impeccableLiveDev}`,
          "frame-src https://accounts.google.com/gsi/",
          "form-action 'none'",
          "worker-src 'none'",
          'upgrade-insecure-requests'
        ].join('; ') },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'GAZLL' },
        { name: 'twitter:card', content: 'summary' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap' },
      ]
    }
  },
  nitro: {
    prerender: {
      /* Every content route is enumerated above. Crawling links again walks
         the language-query variants and payload links without producing
         additional static files. */
      crawlLinks: false,
      /* Content pages are independent local renders; let Nitro overlap them. */
      concurrency: 16,
      routes: contentRoutes()
    }
  },
  routeRules: {
    '/project/calebzone': { redirect: { to: '/project', statusCode: 301 } },
    /* The journal was /gazl before it was named. Shared links must keep
       resolving, exactly as the retired hash URLs do. */
    '/gazl': { redirect: { to: '/gazl-try', statusCode: 301 } },
    '/**': { prerender: true }
  }
});
