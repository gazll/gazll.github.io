/* Import a Nitro route handler and call it directly.

   Node strips the TypeScript, so the tests drive the same file the deployed
   site runs — the routes read `public/data/` off disk and shape the JSON every
   page renders from. Before this they drove a browser-side data model that the
   Nuxt migration replaced, so they stayed green while testing code nobody ran.

   The handlers use Nitro's auto-imported globals; those are the only thing a
   plain `node --test` process is missing, so they are defined once here. */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

globalThis.defineEventHandler ??= handler => handler;
globalThis.getRouterParam ??= (event, key) => event?.params?.[key];
globalThis.createError ??= options => Object.assign(
  new Error(options.statusMessage || 'Route error'), options);

const root = path.resolve(import.meta.dirname, '..');

/** `route('content/topic/[slug]', { slug: '01-java-core-jvm' })` */
export async function route(file, params = {}) {
  const url = pathToFileURL(path.join(root, 'server/api', `${file}.get.ts`)).href;
  const handler = (await import(url)).default;
  return handler({ params });
}
