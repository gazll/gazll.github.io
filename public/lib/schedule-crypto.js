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
/* The envelope is fetched from a public repository. Treat its metadata as
   hostile input: without a ceiling, a tampered `iterations` field could make
   every visitor spend an unbounded amount of CPU before the passphrase is
   even checked. Ciphertext is also bounded so a compromised static artifact
   cannot turn an unlock attempt into an allocation bomb. */
const MAX_CIPHERTEXT_BYTES = 2 * 1024 * 1024;
const MIN_CIPHERTEXT_BYTES = 16; // AES-GCM authentication tag
export const MAX_ENVELOPE_JSON_CHARS = 3 * 1024 * 1024;
const MAX_HINT_CHARS = 2000;

const subtle = () => {
  const api = globalThis.crypto?.subtle;
  if (!api) throw new Error('WebCrypto is unavailable — a secure context (https or localhost) is required.');
  return api;
};

/* Spreading a whole ciphertext into String.fromCharCode hits the browser's
   argument limit once a private schedule grows beyond a few hundred KB. Keep
   the conversion linear and bounded in every engine instead. */
const toBase64 = (bytes) => {
  const view = new Uint8Array(bytes);
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < view.length; offset += chunk) {
    binary += String.fromCharCode(...view.subarray(offset, offset + chunk));
  }
  return btoa(binary);
};
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

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function decodeField(value, name, { exactBytes, minBytes = 0, maxBytes = MAX_CIPHERTEXT_BYTES } = {}) {
  if (typeof value !== 'string' || !value || value.length > Math.ceil(maxBytes * 4 / 3) + 4 || !BASE64.test(value)) {
    throw new Error(`Invalid sealed schedule ${name}.`);
  }
  let bytes;
  try { bytes = fromBase64(value); }
  catch (error) { throw new Error(`Invalid sealed schedule ${name}.`); }
  if (exactBytes != null && bytes.length !== exactBytes) throw new Error(`Invalid sealed schedule ${name}.`);
  if (bytes.length < minBytes || bytes.length > maxBytes) throw new Error(`Invalid sealed schedule ${name}.`);
  return bytes;
}

function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('Not a sealed envelope.');
  }
  if (envelope.v !== ENVELOPE_VERSION || envelope.alg !== 'AES-GCM-256' || envelope.kdf !== 'PBKDF2-SHA-256') {
    throw new Error(`Unsupported envelope version ${envelope.v}.`);
  }
  const iterations = Number(envelope.iterations);
  /* This version emits one fixed KDF profile. Reject both a downgrade and an
     attacker-controlled increase instead of silently accepting either. */
  if (!Number.isSafeInteger(iterations) || iterations !== KDF_ITERATIONS) {
    throw new Error('Unsupported sealed schedule KDF parameters.');
  }
  const salt = decodeField(envelope.salt, 'salt', { exactBytes: SALT_BYTES, maxBytes: SALT_BYTES });
  const iv = decodeField(envelope.iv, 'iv', { exactBytes: IV_BYTES, maxBytes: IV_BYTES });
  const ct = decodeField(envelope.ct, 'ciphertext', {
    minBytes: MIN_CIPHERTEXT_BYTES,
    maxBytes: MAX_CIPHERTEXT_BYTES
  });
  if (envelope.hint != null && (typeof envelope.hint !== 'string' || envelope.hint.length > MAX_HINT_CHARS)) {
    throw new Error('Invalid sealed schedule hint.');
  }
  return { salt, iv, ct, iterations };
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
  const checked = validateEnvelope(envelope);
  if (!passphrase) throw new Error('A passphrase is required.');

  const key = await deriveKey(passphrase, checked.salt, checked.iterations);
  let plain;
  try {
    plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: checked.iv },
      key,
      checked.ct
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
  (() => {
    try { validateEnvelope(value); return true; }
    catch (error) { return false; }
  })();
