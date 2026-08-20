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
    '/', '/search', '/gazl', '/stats', '/admin', '/system-design', '/case-studies',
    '/project', '/photography', '/homelab', '/release-notes', '/fshare-tool',
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
        { name: 'referrer', content: 'no-referrer' }
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
    '/**': { prerender: true }
  }
});
