/* The one passphrase resolver for every tool that seals under secret/.

   Env, then secret/app.key, then ask. The key file is a convenience for
   the machine that edits the content, and it is safe only because `secret/`
   is gitignored — the same reason the plaintext may live there. It is still a
   credential on disk, so it is never created automatically and never echoed
   back. The schedule and the movie catalog share it on purpose: one passphrase
   in the password manager, one `schedule_access` grant on the backend. The
   cost is that anyone granted the calendar can open the catalog too. */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const KEYFILE = path.join(ROOT, 'secret', 'app.key');
export const ENV_KEY = 'GAZLL_SCHEDULE_KEY';

const ENTER = [13, 10];
const CTRL_C = 3;
const BACKSPACE = [127, 8];

const die = (line) => { process.stderr.write(`${line}\n`); process.exit(1); };

/** Keys are compared by code so no control character has to sit in this file. */
export async function passphrase() {
  const fromEnv = process.env[ENV_KEY];
  if (fromEnv) return fromEnv;

  if (existsSync(KEYFILE)) {
    // Trailing newlines are what an editor adds, not what you typed.
    const stored = readFileSync(KEYFILE, 'utf8').replace(/\r?\n$/, '');
    if (stored.trim()) return stored;
    die(`${path.relative(ROOT, KEYFILE)} is empty — put the passphrase in it, or set ${ENV_KEY}.`);
  }

  if (!process.stdin.isTTY) die(`No TTY — set ${ENV_KEY} or create ${path.relative(ROOT, KEYFILE)}.`);

  process.stdout.write('Passphrase: ');
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
  if (!value) die('Empty passphrase.');
  return value;
}
