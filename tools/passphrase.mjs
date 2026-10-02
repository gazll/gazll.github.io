/* The one site key: one passphrase seals every envelope under public/data/.

   Env, then secret/app.key, then ask. The key file is a convenience for the
   machine that edits the content, and it is safe only because `secret/` is
   gitignored and readable by its owner alone — it is still a credential on
   disk, so it is never created implicitly and never echoed back. Every
   envelope (schedule, private Gazl Try entries, movie and X catalogs) shares
   it on purpose: one passphrase in the password manager, one
   `schedule_access` grant on the backend. The cost is that anyone granted
   one can open them all. `tools/rekey.mjs` rotates it across all of them. */

import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const KEYFILE = path.join(ROOT, 'secret', 'app.key');
export const ENV_KEY = 'GAZLL_KEY';
// The name every script and shell profile used before the key covered more
// than the schedule; still read so nothing breaks, never written anywhere.
const LEGACY_ENV_KEY = 'GAZLL_SCHEDULE_KEY';

const ENTER = [13, 10];
const CTRL_C = 3;
const BACKSPACE = [127, 8];

const die = (line) => { process.stderr.write(`${line}\n`); process.exit(1); };

/** Keys are compared by code so no control character has to sit in this file. */
export async function promptHidden(label) {
  if (!process.stdin.isTTY) die(`No TTY — set ${ENV_KEY} or create ${path.relative(ROOT, KEYFILE)}.`);
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = '';
  for await (const chunk of process.stdin) {
    const code = chunk[0];
    if (ENTER.includes(code)) break;
    if (code === CTRL_C) { process.stdout.write('\n'); process.exit(130); }
    if (BACKSPACE.includes(code)) { value = value.slice(0, -1); continue; }
    value += chunk.toString('utf8');
  }
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdout.write('\n');
  return value;
}

export async function passphrase() {
  const fromEnv = process.env[ENV_KEY] || process.env[LEGACY_ENV_KEY];
  if (fromEnv) return fromEnv;

  if (existsSync(KEYFILE)) {
    // Trailing newlines are what an editor adds, not what you typed.
    const stored = readFileSync(KEYFILE, 'utf8').replace(/\r?\n$/, '');
    if (stored.trim()) return stored;
    die(`${path.relative(ROOT, KEYFILE)} is empty — put the passphrase in it, or set ${ENV_KEY}.`);
  }

  const value = await promptHidden('Passphrase: ');
  if (!value) die('Empty passphrase.');
  return value;
}

/* The ciphertext is public forever — every version stays in git history — so
   the passphrase is attacked offline, at GPU speed, with no rate limit and no
   lockout. PBKDF2 multiplies the cost of each guess; only length and
   randomness decide how many guesses there are. A rule a parser can check:
   long enough that even a weak character mix carries the search space, and
   not one character or one short pattern repeated. */
export const MIN_LENGTH = 20;
export function strengthProblems(value) {
  const problems = [];
  const text = String(value || '');
  if (text.length < MIN_LENGTH) problems.push(`at least ${MIN_LENGTH} characters (a 5–6 word passphrase, or --generate)`);
  if (new Set(text).size < 10) problems.push('at least 10 distinct characters');
  if (/(.{1,4})\1{3,}/.test(text)) problems.push('no short pattern repeated');
  return problems;
}

/** ~129 bits from the OS RNG, grouped for typing: 26 symbols of a 31-letter
    alphabet without the look-alikes (0/O, 1/I/L). Bytes past the largest
    multiple of 31 are redrawn, so every symbol is equally likely. */
export function generatePassphrase() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const limit = 256 - (256 % alphabet.length);
  const chars = [];
  while (chars.length < 26) {
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
      if (byte < limit && chars.length < 26) chars.push(alphabet[byte % alphabet.length]);
    }
  }
  return chars.join('').match(/.{1,5}/g).join('-');
}

/** Write the key file readable by its owner only. Never called implicitly. */
export function writeKeyfile(value) {
  writeFileSync(KEYFILE, `${value}\n`, { encoding: 'utf8', mode: 0o600 });
  chmodSync(KEYFILE, 0o600);
}
