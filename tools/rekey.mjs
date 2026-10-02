#!/usr/bin/env node
/* Rotate the master passphrase, or re-seal everything under the current KDF.

     node tools/rekey.mjs               # ask for a new master (twice)
     node tools/rekey.mjs --generate    # make a random master, print it ONCE
     node tools/rekey.mjs --same        # same keys, every envelope re-sealed
                                        # under the current KDF profile

   The master only seals the keyring (tools/keyring.mjs), so rotating it
   re-seals that one small file: the scope keys, the envelopes and every
   KEY_<SCOPE> on the backend stay as they are. To take a surface back from
   someone who was granted it, rotate that scope instead
   (`keyring.mjs rotate <scope>`).

   What no rotation can do: every earlier version of the keyring stays in git
   history under the master it was sealed with, and it holds the scope keys of
   its day. A public repository does not un-publish — the old master still
   opens old commits. That is why the new one must be strong from the start,
   and why `strengthProblems` refuses a weak one. */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KDF_ITERATIONS, seal, unseal } from '../public/lib/schedule-crypto.js';
import { generatePassphrase, KEYFILE, passphrase, promptHidden, strengthProblems, writeKeyfile } from './passphrase.mjs';
import { KEYRING_FILE, openKeyring, SCOPES, sealKeyring, writeEnvelope } from './keyring.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const out = (line) => process.stdout.write(`${line}\n`);
const die = (line) => { process.stderr.write(`${line}\n`); process.exit(1); };
const rel = (file) => path.relative(ROOT, file);

async function newMaster() {
  if (process.argv.includes('--generate')) return generatePassphrase();
  const first = await promptHidden('New master passphrase: ');
  const second = await promptHidden('Repeat it: ');
  if (first !== second) die('The two entries differ — nothing was changed.');
  return first;
}

async function main() {
  const oldMaster = await passphrase();
  const ring = await openKeyring(oldMaster).catch(() => die('The current master does not open the keyring. Nothing was changed.'));
  if (!ring) die(`${rel(KEYRING_FILE)} not found — run \`node tools/keyring.mjs init\` first.`);

  if (process.argv.includes('--same')) {
    for (const [scope, file] of Object.entries(SCOPES)) {
      if (!existsSync(file)) continue;
      const envelope = JSON.parse(await readFile(file, 'utf8'));
      const value = await unseal(envelope, ring.keys[scope]);
      await writeEnvelope(file, await seal(value, ring.keys[scope], { hint: envelope.hint || '', compress: envelope.enc === 'gzip' }));
      out(`re-sealed ${rel(file)}`);
    }
    await sealKeyring(ring, oldMaster);
    return out(`Every envelope and the keyring at ${KDF_ITERATIONS} iterations. Commit them together.`);
  }

  const master = await newMaster();
  if (master === oldMaster) die('That is the current master — use --same to only re-seal.');
  const problems = strengthProblems(master);
  if (problems.length) die(`Too weak for a key whose ciphertext is public forever — needs ${problems.join('; ')}. Nothing was changed.`);

  await sealKeyring(ring, master);
  if (JSON.stringify(await openKeyring(master)) !== JSON.stringify(ring)) die('The new keyring did not round-trip.');
  out(`re-sealed ${rel(KEYRING_FILE)} under the new master`);
  if (existsSync(KEYFILE)) { writeKeyfile(master); out(`${rel(KEYFILE)} updated (owner-only).`); }
  if (process.argv.includes('--generate')) out(`\nNew master passphrase (shown once — put it in your password manager now): ${master}`);
  out('');
  out('Still to do:');
  out('  1. Password manager: replace the entry; keep the OLD one too — it opens older commits.');
  out(`  2. Commit ${rel(KEYRING_FILE)} and push.`);
  out('  3. Each browser that saved the old master asks once for the new one.');
  out('  Backend KEY_<SCOPE> properties are unaffected — scope keys did not change.');
}

main().catch(error => die(error.message || String(error)));
