#!/usr/bin/env node
/* Re-seal every envelope under public/data/ in one go.

     node tools/rekey.mjs --same        # same passphrase, current KDF profile
     node tools/rekey.mjs               # ask for a new passphrase (twice)
     node tools/rekey.mjs --generate    # make a random one, print it ONCE

   One passphrase covers every envelope, so rotating it is one operation, not
   four tools run by hand in the hope that none is forgotten: an envelope left
   under the old key is a file the pages can no longer open. Everything is
   opened and re-sealed in memory, each new envelope is proven to open with
   the new key, and only then is anything written (.tmp + rename).

   What rotation cannot do: every earlier version of every envelope stays in
   git history under the passphrase it was sealed with. A public repository
   does not un-publish, so rotation protects what is sealed from now on — the
   old passphrase still opens the old commits. That is why the new one must
   be strong from the start, and why `strengthProblems` refuses a weak one. */

import { existsSync } from 'node:fs';
import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEnvelope, KDF_ITERATIONS, seal, unseal } from '../public/lib/schedule-crypto.js';
import { generatePassphrase, KEYFILE, passphrase, promptHidden, strengthProblems, writeKeyfile } from './passphrase.mjs';
import { hintLeaks } from './schedule-seal.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = path.join(ROOT, 'public', 'data');
const out = (line) => process.stdout.write(`${line}\n`);
const die = (line) => { process.stderr.write(`${line}\n`); process.exit(1); };
const rel = (file) => path.relative(ROOT, file);

/** Found on disk rather than listed, so an envelope added later is covered
    without anyone remembering to register it here. */
async function envelopes(directory = DATA) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await envelopes(file));
    else if (entry.name.endsWith('.enc.json')) found.push(file);
  }
  return found.sort();
}

async function newPassphrase() {
  if (process.argv.includes('--generate')) return generatePassphrase();
  const first = await promptHidden('New passphrase: ');
  const second = await promptHidden('Repeat it: ');
  if (first !== second) die('The two entries differ — nothing was changed.');
  return first;
}

async function main() {
  const same = process.argv.includes('--same');
  const files = await envelopes();
  if (!files.length) die('No *.enc.json under public/data/.');

  const oldKey = await passphrase();
  const opened = [];
  for (const file of files) {
    const envelope = JSON.parse(await readFile(file, 'utf8'));
    if (!isEnvelope(envelope)) die(`${rel(file)} is not an envelope this version can open.`);
    try {
      opened.push({ file, envelope, value: await unseal(envelope, oldKey) });
    } catch (error) {
      die(`${rel(file)} does not open with the current passphrase — it is not under the one site key. Nothing was changed.`);
    }
  }

  const newKey = same ? oldKey : await newPassphrase();
  if (!same) {
    if (newKey === oldKey) die('The new passphrase is the old one — use --same to only re-seal.');
    const problems = strengthProblems(newKey);
    if (problems.length) die(`Too weak for a key whose ciphertext is public forever — needs ${problems.join('; ')}. Nothing was changed.`);
  }

  const sealed = [];
  for (const { file, envelope, value } of opened) {
    if (envelope.hint && hintLeaks(envelope.hint, newKey)) die(`${rel(file)}'s public hint shares characters with the new passphrase. Nothing was changed.`);
    const next = await seal(value, newKey, { hint: envelope.hint || '', compress: envelope.enc === 'gzip' });
    // Prove it before anything touches the disk.
    const back = await unseal(next, newKey);
    if (JSON.stringify(back) !== JSON.stringify(value)) die(`${rel(file)} did not round-trip. Nothing was changed.`);
    sealed.push({ file, next });
  }

  for (const { file, next } of sealed) {
    await writeFile(`${file}.tmp`, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await rename(`${file}.tmp`, file);
    out(`re-sealed ${rel(file)} (${KDF_ITERATIONS} iterations)`);
  }

  if (same) return out('Same passphrase, current KDF profile. Commit the envelopes together.');

  if (existsSync(KEYFILE)) { writeKeyfile(newKey); out(`${rel(KEYFILE)} updated (owner-only).`); }
  if (process.argv.includes('--generate')) {
    out('');
    out(`New passphrase (shown once — put it in your password manager now): ${newKey}`);
  }
  out('');
  out('Still to do, in this order:');
  out('  1. Password manager: replace the entry; keep the OLD one too — it is what opens older commits.');
  out('  2. Apps Script: menu gazl → "Cài passphrase lịch riêng" (setScheduleKey), if sign-in unlock is used.');
  out('  3. Commit every re-sealed envelope in ONE commit, then push.');
  out('  4. Each browser asks once for the new passphrase; the old one stored there no longer opens anything.');
}

main().catch(error => die(error.message || String(error)));
