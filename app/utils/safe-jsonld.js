/* JSON-LD is placed in a raw-text <script> element by Nuxt. Escape characters
   that could terminate that element if an authored title or description ever
   contains hostile HTML. The result remains valid JSON for search crawlers. */
const JSON_LD_ESCAPES = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029'
};

export function safeJsonLd(value) {
  const serialized = JSON.stringify(value);
  return (serialized == null ? 'null' : serialized)
    .replace(/[<>&\u2028\u2029]/g, character => JSON_LD_ESCAPES[character]);
}
