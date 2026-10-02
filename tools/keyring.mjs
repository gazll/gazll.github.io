#!/usr/bin/env node
/* The keyring: one master passphrase, one random key per sealed surface.

     node tools/keyring.mjs init            # create keys for any scope missing one
     node tools/keyring.mjs migrate         # re-seal envelopes still under the master
     node tools/keyring.mjs status          # which envelope opens with which key
     node tools/keyring.mjs show <scope>    # print ONE scope key (for setScopeKey)
     node tools/keyring.mjs rotate <scope>  # new key for one scope, re-seal its file
     node tools/keyring.mjs reset --force   # master forgotten: fresh keys, re-seal from secret/

   Why two layers. One passphrase is what a person can remember and type on a
   new machine (secret/app.key, or GAZLL_KEY). But a grant is a grant to ONE
   surface — family on the schedule must not open the movie catalog — and the
   ciphertext is the gate, so surfaces need different keys. Each envelope is
   therefore sealed with its scope's random key, and the scope keys live in
   public/data/keyring.enc.json, sealed with the master. The owner opens
   everything with the master; the backend hands a granted account only its
   scope's key (Script Property KEY_<SCOPE>, sheet `access`).

   The keyring itself is in git, so a fresh clone plus the master passphrase
   recovers every key — nothing else to back up. Rotating the master
   (tools/rekey.mjs) re-seals only this small file; rotating a scope re-seals
   only that surface. Neither reaches copies already in git history. */

import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEnvelope, seal, unseal } from '../public/lib/schedule-crypto.js';
import { generatePassphrase, passphrase } from './passphrase.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const KEYRING_FILE = path.join(ROOT, 'public', 'data', 'keyring.enc.json');

/* The one list of sealed surfaces. The browser and the backend name the same
   scopes (lib/site-keys.js, ACCESS_SCOPES in Code.gs). */
export const SCOPES = Object.freeze({
  schedule: path.join(ROOT, 'public', 'data', 'schedule', 'private.enc.json'),
  interviews: path.join(ROOT, 'public', 'data', 'interviews', 'private.enc.json'),
  fshare: path.join(ROOT, 'public', 'data', 'fshare-movie', 'catalog.enc.json'),
  x: path.join(ROOT, 'public', 'data', 'fshare-x', 'catalog.enc.json')
});

const out = (line) => process.stdout.write(`${line}\n`);
const die = (line) => { process.stderr.write(`${line}\n`); process.exit(1); };
const rel = (file) => path.relative(ROOT, file);

async function readEnvelope(file) {
  const envelope = JSON.parse(await readFile(file, 'utf8'));
  if (!isEnvelope(envelope)) die(`${rel(file)} is not an envelope this version can open.`);
  return envelope;
}

/** .tmp + rename, so a crash never leaves half an envelope in the tree. */
export async function writeEnvelope(file, envelope) {
  await writeFile(`${file}.tmp`, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  await rename(`${file}.tmp`, file);
}

export async function openKeyring(master) {
  if (!existsSync(KEYRING_FILE)) return null;
  const opened = await unseal(await readEnvelope(KEYRING_FILE), master);
  return { version: 1, keys: { ...(opened.keys || {}) } };
}

export async function sealKeyring(ring, master) {
  await writeEnvelope(KEYRING_FILE, await seal(ring, master));
}

/** The key a seal tool uses for its surface. */
export async function scopeKey(scope) {
  if (!SCOPES[scope]) die(`Unknown scope "${scope}".`);
  const ring = await openKeyring(await passphrase());
  if (!ring) die(`${rel(KEYRING_FILE)} not found — run \`node tools/keyring.mjs init\` first.`);
  if (!ring.keys[scope]) die(`The keyring has no "${scope}" key — run \`node tools/keyring.mjs init\`.`);
  return ring.keys[scope];
}

/** Which key opens `file` now: its scope key, the master (pre-keyring), or neither. */
async function opensWith(file, scopeValue, master) {
  const envelope = await readEnvelope(file);
  for (const [name, key] of [['scope key', scopeValue], ['master', master]]) {
    if (!key) continue;
    try { return { by: name, envelope, value: await unseal(envelope, key) }; } catch (error) { /* try the next */ }
  }
  return { by: null, envelope };
}

async function main() {
  const [command, scope] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const master = await passphrase();

  /* The forgotten-master path. The old keyring cannot be opened, so its scope
     keys are gone with it; the data survives only as the plaintext in
     secret/, which each seal tool re-seals under the fresh keys. Refused when
     the current master still opens the keyring — then nothing was lost, and a
     reset would only orphan every envelope. */
  if (command === 'reset') {
    if (!process.argv.includes('--force')) die('reset replaces every scope key. Re-run with --force once you are sure the old master is gone.');
    let opens = false;
    try { opens = Boolean(await openKeyring(master)); } catch (error) { /* expected: the old master is lost */ }
    if (opens) die('The current master still opens the keyring — nothing to reset. Use `node tools/rekey.mjs` to change it.');
    const fresh = { version: 1, keys: Object.fromEntries(Object.keys(SCOPES).map(name => [name, generatePassphrase()])) };
    await sealKeyring(fresh, master);
    out(`New keyring under the current master. Now re-seal every surface from secret/:`);
    out('  node tools/schedule-seal.mjs seal · node tools/interview-seal.mjs seal');
    out('  node tools/fshare-movie.mjs seal  · node tools/fshare-x.mjs seal');
    out('Then commit the keyring with every envelope, and re-run gazl → "Cài key cho một scope" for each shared scope.');
    return out('A surface whose plaintext is not in secret/ cannot be recovered — its envelope stays under the lost key.');
  }

  let ring = await openKeyring(master);

  if (command === 'init') {
    ring = ring || { version: 1, keys: {} };
    const added = Object.keys(SCOPES).filter(name => !ring.keys[name]);
    added.forEach(name => { ring.keys[name] = generatePassphrase(); });
    if (!added.length) return out('Every scope already has a key. Nothing changed.');
    await sealKeyring(ring, master);
    return out(`Keys created for: ${added.join(', ')}. Run \`migrate\`, then commit ${rel(KEYRING_FILE)} with the envelopes.`);
  }

  if (!ring) die(`${rel(KEYRING_FILE)} not found — run \`init\` first.`);

  if (command === 'status' || command === 'migrate') {
    for (const [name, file] of Object.entries(SCOPES)) {
      if (!existsSync(file)) { out(`${name.padEnd(11)} no envelope yet`); continue; }
      const { by, envelope, value } = await opensWith(file, ring.keys[name], master);
      if (command === 'status' || by !== 'master') { out(`${name.padEnd(11)} ${by ? `opens with the ${by}` : 'OPENS WITH NEITHER'}`); continue; }
      const next = await seal(value, ring.keys[name], { hint: envelope.hint || '', compress: envelope.enc === 'gzip' });
      if (JSON.stringify(await unseal(next, ring.keys[name])) !== JSON.stringify(value)) die(`${rel(file)} did not round-trip.`);
      await writeEnvelope(file, next);
      out(`${name.padEnd(11)} re-sealed under its scope key`);
    }
    return;
  }

  if (command === 'show') {
    if (!ring.keys[scope]) die(`No key for "${scope}". Scopes: ${Object.keys(SCOPES).join(', ')}`);
    return out(ring.keys[scope]);
  }

  if (command === 'rotate') {
    const file = SCOPES[scope];
    if (!file) die(`Unknown scope "${scope}". Scopes: ${Object.keys(SCOPES).join(', ')}`);
    const fresh = generatePassphrase();
    if (existsSync(file)) {
      const envelope = await readEnvelope(file);
      const value = await unseal(envelope, ring.keys[scope]);
      await writeEnvelope(file, await seal(value, fresh, { hint: envelope.hint || '', compress: envelope.enc === 'gzip' }));
    }
    ring.keys[scope] = fresh;
    await sealKeyring(ring, master);
    out(`Rotated "${scope}". Commit ${rel(KEYRING_FILE)} and ${rel(file)} together.`);
    return out(`If ${scope} is shared: menu gazl -> "Cài key cho một scope" with \`node tools/keyring.mjs show ${scope}\`.`);
  }

  die('Usage: keyring.mjs init | migrate | status | show <scope> | rotate <scope> | reset --force');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch(error => die(error.message || String(error)));
