/* Which key opens a sealed surface, in the browser.

   Every envelope is sealed with its scope's own random key, and the scope
   keys travel in /data/keyring.enc.json, sealed with the owner's master
   passphrase (tools/keyring.mjs). So a page asked to open `schedule` with
   some secret tries it two ways: as the master (open the keyring, take the
   scope key out) and, failing that, as the scope key itself — which is what
   a granted account is handed by the backend, and what an owner may share
   with someone for one surface only. The envelope's GCM tag is the judge;
   nothing here decides a secret is "right".

   One browser slot (KEY_STORE) holds whatever the reader typed and asked to
   keep. A key the backend handed over is used and dropped, never stored, so
   deleting the `access` row really stops the next hand-over. */

import { fetchEnvelope, KEY_STORE, unseal } from './schedule-crypto.js';

export const KEYRING_URL = '/data/keyring.enc.json';
export const SCOPES = Object.freeze(['schedule', 'interviews', 'fshare', 'x']);

let opened = null; // { secret, keys } — the keyring, for the master that opened it

async function keyringFor(secret) {
  if (opened?.secret === secret) return opened.keys;
  const envelope = await fetchEnvelope(KEYRING_URL);
  if (!envelope) return null;
  const document = await unseal(envelope, secret);
  opened = { secret, keys: document?.keys || {} };
  return opened.keys;
}

/** The scope key for `secret`: from the keyring when it is the master,
    otherwise the secret itself, for the envelope to accept or refuse. */
export async function scopeKey(secret, scope) {
  if (!SCOPES.includes(scope)) throw new Error(`Unknown scope "${scope}".`);
  try {
    const keys = await keyringFor(secret);
    if (keys?.[scope]) return keys[scope];
  } catch (error) { /* not the master: try it as the scope key */ }
  return secret;
}

export function storedSecret() {
  try { return sessionStorage.getItem(KEY_STORE) || localStorage.getItem(KEY_STORE) || ''; } catch (error) { return ''; }
}

/** Session by default, device only when asked: a borrowed browser must not
    keep the key to someone else's data. */
export function rememberSecret(secret, onDevice) {
  try { (onDevice ? localStorage : sessionStorage).setItem(KEY_STORE, secret); } catch (error) { /* private mode */ }
}

/** Locking any page forgets the key everywhere it was kept — the pages share
    one slot, and a half-locked browser would surprise in the wrong direction. */
export function forgetSecret() {
  opened = null;
  try { sessionStorage.removeItem(KEY_STORE); localStorage.removeItem(KEY_STORE); } catch (error) { /* private mode */ }
}

/** The backend's hand-over for a granted account: `access.key` for this
    scope, then the pre-keyring `schedule.key` while an older deployment is
    still live. Null when not granted or not shared. */
export async function grantedKey(apiCall, token, scope) {
  if (!token) return null;
  try {
    const data = await apiCall('access.key', { scope }, token);
    if (data?.key) return data.key;
  } catch (error) { /* not granted, not shared, or an old deployment */ }
  if (scope !== 'schedule') return null;
  try {
    const data = await apiCall('schedule.key', {}, token);
    return data?.key || null;
  } catch (error) { return null; }
}
