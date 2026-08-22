/* Envelope encryption for the private schedule.

   gazll.github.io is a user-pages repository, so it is necessarily public and
   everything under public/data/ is world-readable. Hiding the reminder list
   behind a signed-in UI would be exactly the "hiding the Admin menu is
   cosmetic" mistake — the file would still answer a plain GET. So the file
   that ships IS the ciphertext, and the passphrase is the real gate.

   One module for both sides on purpose. The tool that seals before a commit
   and the page that opens it afterwards must agree on the KDF, the iteration
   count and the byte layout; two implementations of that would drift and the
   failure is a file nobody can open. Node has had WebCrypto, btoa and atob as
   globals since 16, so this needs no branch.

   The plaintext source never enters the repository: it lives in secret/, which
   is gitignored, and tools/schedule-seal.mjs runs in both directions — seal to
   publish, unseal to recover the original from any commit. Losing the working
   tree therefore loses nothing; losing the passphrase loses everything. */

export const ENVELOPE_VERSION = 1;
export const KDF_ITERATIONS = 310000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const subtle = () => {
  const api = globalThis.crypto?.subtle;
  if (!api) throw new Error('WebCrypto is unavailable — a secure context (https or localhost) is required.');
  return api;
};

const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text) => Uint8Array.from(atob(text), char => char.charCodeAt(0));

async function deriveKey(passphrase, salt, iterations) {
  const material = await subtle().importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return subtle().deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Plain object -> the envelope committed as data/schedule/private.enc.json.
 *
 * `hint` rides OUTSIDE the ciphertext on purpose — a reminder you can only
 * read after unlocking is no reminder at all. That also means it is public,
 * because the file is: write a hint that jogs your own memory and tells a
 * stranger nothing, and keep it short of anything that narrows a guess.
 */
export async function seal(value, passphrase, { hint = '' } = {}) {
  if (!passphrase) throw new Error('A passphrase is required.');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const ct = await subtle().encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(value))
  );
  return {
    v: ENVELOPE_VERSION,
    alg: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA-256',
    iterations: KDF_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(ct),
    sealed_at: new Date().toISOString(),
    ...(hint ? { hint: String(hint) } : {})
  };
}

/** The envelope back to the original object. Throws on a wrong passphrase. */
export async function unseal(envelope, passphrase) {
  if (!envelope || typeof envelope !== 'object') throw new Error('Not a sealed envelope.');
  if (envelope.v !== ENVELOPE_VERSION) throw new Error(`Unsupported envelope version ${envelope.v}.`);
  if (!passphrase) throw new Error('A passphrase is required.');

  const key = await deriveKey(passphrase, fromBase64(envelope.salt), Number(envelope.iterations) || KDF_ITERATIONS);
  let plain;
  try {
    plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.ct)
    );
  } catch (error) {
    // GCM authenticates, so a failure here is a wrong key or a damaged file —
    // never partially decrypted output. Say which, because the fix differs.
    throw new Error('Could not open the schedule — wrong passphrase, or the file was modified.');
  }
  return JSON.parse(new TextDecoder().decode(plain));
}

/** A cheap shape check before asking anyone for a passphrase. */
export const isEnvelope = (value) =>
  Boolean(value && typeof value === 'object' && value.v === ENVELOPE_VERSION && value.ct && value.iv && value.salt);
