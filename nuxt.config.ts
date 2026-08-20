import { readFileSync } from 'node:fs';

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

  return [
    '/', '/search', '/api/content/search-index', '/gazl', '/stats', '/admin', '/system-design', '/case-studies',
    '/project', '/project/calebzone', '/photography', '/homelab', '/release-notes', '/fshare-tool',
    '/course-registration', ...topicRoutes, ...designRoutes, ...caseRoutes, ...photoRoutes, ...homelabRoutes
  ];
}

export default defineNuxtConfig({
  compatibilityDate: '2026-08-20',
  devtools: { enabled: false },
  ssr: true,
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'referrer', content: 'no-referrer' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'GAZLL' },
        { name: 'twitter:card', content: 'summary' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap' },
        { rel: 'stylesheet', href: '/styles.css' }
      ]
    }
  },
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: contentRoutes()
    }
  },
  routeRules: {
    '/project/calebzone': { redirect: { to: '/project', statusCode: 301 } },
    '/**': { prerender: true }
  }
});
