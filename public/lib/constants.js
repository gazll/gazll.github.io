/* Closed-set identifiers shared across data/ and the UI. A typo in a raw
   string like "algorith" or "hrad" fails silently — nothing reads these
   values against a fixed set except tools/validate-content.mjs, so app.js
   and views/* should read the `key` off these arrays/maps rather than
   re-typing the literal.

   `label` is what the UI shows — English only, per CLAUDE.md's "interface
   is always English" rule. `vi` is kept for reference/documentation only;
   nothing in this codebase renders it (topic_type/difficulty are UI chrome,
   not study content, so they don't follow the content VI/EN switch). */

/** A topic's subject-matter category. Drives the filter bar, the stepper
    chip accent colour (`[data-topic-type="…"]` in styles.css), and the hero
    accent. `microservice` covers the standalone Microservices track, which
    is a topic like any other rather than a separate concept. */
export const TOPIC_TYPES = [
  { key: 'core', label: 'Core', vi: 'Cốt lõi' },
  { key: 'data', label: 'Data', vi: 'Dữ liệu' },
  { key: 'design', label: 'Design', vi: 'Thiết kế' },
  { key: 'platform', label: 'Platform', vi: 'Nền tảng' },
  { key: 'algorithm', label: 'Algorithm', vi: 'Thuật toán' },
  { key: 'microservice', label: 'Microservice', vi: 'Vi dịch vụ' }
];
export const TOPIC_TYPE_LABEL = Object.fromEntries(TOPIC_TYPES.map(t => [t.key, t.label]));

/** An item's difficulty. Drives the CORE/ADVANCED/EXTRA badge
    (`BADGE` in lib/ui.js) and the `.difficulty-*` card accent in
    styles.css. Renamed from the old `lvl` field to avoid reading like a
    second "type" next to topic_type. Keys match their label in lowercase
    (`core`/`advanced`/`extra`) — the old `hard`/`ext` keys read as a
    different taxonomy than the badge actually shown. */
export const DIFFICULTIES = [
  { key: 'core', label: 'CORE', vi: 'Cốt lõi' },
  { key: 'advanced', label: 'ADVANCED', vi: 'Nâng cao' },
  { key: 'extra', label: 'EXTRA', vi: 'Mở rộng' }
];
export const DIFFICULTY_LABEL = Object.fromEntries(DIFFICULTIES.map(d => [d.key, d.label]));

/* ---------- external link allowlists ----------

   Every outbound link is checked against one of these before it renders, so a
   wrong or hostile URL degrades to plain text instead of becoming a link. They
   live here, next to the other closed sets, because five copies had already
   drifted apart: tools/validate-content.mjs was silently missing an origin the
   views allowed. Views and the validator now read the same sets.

   The three sets are different promises to the reader and must not be merged:
   a publisher credit says "this is where the original was published", a prompt
   link says "this thread is the question, not the answer", and a reference is
   primary documentation backing a technical claim. */

/** Publishers whose original article a case study or production case credits. */
export const PUBLISHER_ORIGINS = Object.freeze([
  'https://engineering.tiki.vn',
  'https://discord.com',
  'https://blog.cloudmentor.pro',
  'https://shopify.engineering'
]);

/** Discussion threads that supplied a question a blueprint or journal entry
    answers. Never an authority for a claim — the answer is researched here. */
export const PROMPT_ORIGINS = Object.freeze([
  'https://voz.vn'
]);

/** Primary vendor docs, specs and RFCs cited by research packs and journal
    entries. Per CLAUDE.md this list grows when a better source needs it. */
export const REFERENCE_ORIGINS = Object.freeze([
  'https://sre.google', 'https://docs.aws.amazon.com', 'https://developers.cloudflare.com',
  'https://redis.io', 'https://docs.stripe.com', 'https://www.postgresql.org',
  'https://kafka.apache.org', 'https://learn.microsoft.com', 'https://www.elastic.co',
  'https://opentelemetry.io', 'https://www.rfc-editor.org', 'https://docs.spring.io',
  'https://openid.net', 'https://resilience4j.readme.io', 'https://www.openpolicyagent.org',
  'https://www.rabbitmq.com', 'https://www.pcisecuritystandards.org',
  'https://blog.pcisecuritystandards.org'
]);

/** Build one origin guard. `fallback` is what an unapproved URL becomes: '#'
    where the caller still renders an anchor, '' where it drops the link. */
export function originGuard(origins, fallback = '#') {
  const allowed = new Set(origins.flat());
  return value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && allowed.has(url.origin) ? url.href : fallback;
    } catch (error) { return fallback; }
  };
}
