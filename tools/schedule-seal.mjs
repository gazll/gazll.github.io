#!/usr/bin/env node
/* Seal and unseal the private schedule.

     node tools/schedule-seal.mjs seal      # secret/ -> the committed envelope
     node tools/schedule-seal.mjs unseal    # the committed envelope -> secret/
     node tools/schedule-seal.mjs --check   # the envelope still opens and matches
     node tools/schedule-seal.mjs init      # a starter file to edit

   Both directions exist for one reason: recovery. The plaintext lives in
   secret/, which is gitignored, so nothing backs it up. The envelope IS in
   git, every version of it, so `unseal` on a fresh clone rebuilds the original
   from any commit with nothing but the passphrase. Keep that passphrase in a
   password manager — it is the only unrecoverable part of this system.

   NOT part of tools/check.mjs, deliberately. CI has neither the passphrase nor
   secret/, so a --check stage there would fail on every run; this one is for
   the machine that edits the content. */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEnvelope, seal, unseal } from '../public/lib/schedule-crypto.js';
import { passphrase } from './passphrase.mjs';
import { CATEGORIES, REPEAT_KINDS, SEVERITIES } from '../public/lib/schedule.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PLAIN = path.join(ROOT, 'secret', 'schedule.json');
const SEALED = path.join(ROOT, 'public', 'data', 'schedule', 'private.enc.json');

const out = (line) => process.stdout.write(`${line}\n`);
const die = (line) => { process.stderr.write(`${line}\n`); process.exit(1); };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isText = (value) =>
  typeof value === 'string' ? value.trim().length > 0
    : Boolean(value && typeof value === 'object' && (value.en || value.vi));

/* Shape is checked here rather than in validate-content.mjs because the
   plaintext never reaches the repository — seal time is the only moment both
   the rules and the real content are in the same place. */
function validate(document) {
  const problems = [];
  const events = document?.events;
  if (!Array.isArray(events)) return ['`events` must be an array.'];

  /* Members are data, not a closed set in code: who a household tracks is
     nobody else's business and changes without a release. The ids are checked
     against this file's own list so a typo cannot silently orphan a row into
     an owner that does not exist and never shows up under any filter. */
  const members = new Set();
  (document.members || []).forEach((member, index) => {
    if (!member?.id || !/^[a-z0-9][a-z0-9-]*$/.test(member.id)) problems.push(`members[${index}]: needs a kebab-case \`id\`.`);
    else if (members.has(member.id)) problems.push(`members[${index}]: duplicate id "${member.id}".`);
    else members.add(member.id);
    if (!isText(member?.name)) problems.push(`members[${index}]: needs a \`name\`.`);
  });

  /* Standing notes: what is true but not dated — what is in the cupboard, why
     a schedule is on hold. They are not events, so they never get a date, a
     status or a place in the agenda. */
  const noteIds = new Set();
  (document.notes || []).forEach((note, index) => {
    const where = `notes[${index}]${note?.id ? ` (${note.id})` : ''}`;
    if (!note?.id || !/^[a-z0-9][a-z0-9-]*$/.test(note.id)) problems.push(`${where}: needs a kebab-case \`id\`.`);
    else if (noteIds.has(note.id)) problems.push(`${where}: duplicate \`id\`.`);
    else noteIds.add(note.id);
    if (!isText(note?.body)) problems.push(`${where}: needs a \`body\`.`);
    if (note?.member && !members.has(note.member)) problems.push(`${where}: unknown member "${note.member}".`);
    if (note?.category && !CATEGORIES.includes(note.category)) {
      problems.push(`${where}: \`category\` must be one of ${CATEGORIES.join(', ')}.`);
    }
  });

  /* Households, then groups inside them. An item belongs to a house rather
     than a person — a NAS is not one member's — so this is a separate axis
     from `members`, not a rename of it. */
  const households = new Set();
  (document.households || []).forEach((house, index) => {
    if (!house?.id || !/^[a-z0-9][a-z0-9-]*$/.test(house.id)) problems.push(`households[${index}]: needs a kebab-case \`id\`.`);
    else if (households.has(house.id)) problems.push(`households[${index}]: duplicate id "${house.id}".`);
    else households.add(house.id);
    if (!isText(house?.name)) problems.push(`households[${index}]: needs a \`name\`.`);
  });

  const groups = new Set();
  (document.groups || []).forEach((group, index) => {
    const where = `groups[${index}]${group?.id ? ` (${group.id})` : ''}`;
    if (!group?.id || !/^[a-z0-9][a-z0-9-]*$/.test(group.id)) problems.push(`${where}: needs a kebab-case \`id\`.`);
    else if (groups.has(group.id)) problems.push(`${where}: duplicate \`id\`.`);
    else groups.add(group.id);
    if (!isText(group?.name)) problems.push(`${where}: needs a \`name\`.`);
    if (group?.household && !households.has(group.household)) problems.push(`${where}: unknown household "${group.household}".`);
  });

  const itemIds = new Set();
  (document.items || []).forEach((item, index) => {
    const where = `items[${index}]${item?.id ? ` (${item.id})` : ''}`;
    if (!item?.id || !/^[a-z0-9][a-z0-9-]*$/.test(item.id)) problems.push(`${where}: needs a kebab-case \`id\`.`);
    else if (itemIds.has(item.id)) problems.push(`${where}: duplicate \`id\`.`);
    else itemIds.add(item.id);
    if (!isText(item?.name)) problems.push(`${where}: needs a \`name\`.`);
    // `bought` may be absent — a receipt nobody kept is a real state, and
    // guessing a date would make the history lie rather than admit the gap.
    if (item?.bought && !ISO.test(item.bought)) problems.push(`${where}: \`bought\` must be YYYY-MM-DD.`);
    if (item?.warranty_months != null && !(Number(item.warranty_months) >= 0)) {
      problems.push(`${where}: \`warranty_months\` must be a number.`);
    }
    if (item?.warranty_months && !item?.bought) problems.push(`${where}: a warranty needs a \`bought\` date to count from.`);
    if (item?.group && !groups.has(item.group)) problems.push(`${where}: unknown group "${item.group}".`);
    if (item?.household && !households.has(item.household)) problems.push(`${where}: unknown household "${item.household}".`);
    /* A replacement is what makes the history answer "how old is the battery"
       rather than only "how old is the thing", so its date is not optional. */
    for (const entry of item?.service || []) {
      if (!ISO.test(entry?.date || '')) problems.push(`${where}: service entry needs a \`date\` (YYYY-MM-DD).`);
      if (!isText(entry?.what)) problems.push(`${where}: service entry on ${entry?.date || '?'} needs \`what\`.`);
    }
  });

  const checklistIds = new Set();
  (document.checklists || []).forEach((list, index) => {
    const where = `checklists[${index}]${list?.id ? ` (${list.id})` : ''}`;
    if (!list?.id || !/^[a-z0-9][a-z0-9-]*$/.test(list.id)) problems.push(`${where}: needs a kebab-case \`id\`.`);
    else if (checklistIds.has(list.id)) problems.push(`${where}: duplicate \`id\`.`);
    else checklistIds.add(list.id);
    if (!isText(list?.name)) problems.push(`${where}: needs a \`name\`.`);
    if (list?.household && !households.has(list.household)) problems.push(`${where}: unknown household "${list.household}".`);
    /* Entry ids are the keys tick state is stored under, exactly as item_id is
       a stored Sheet key elsewhere: rename one and its tick is orphaned, so
       they are checked for uniqueness across EVERY list, not just within one. */
    for (const entry of list?.items || []) {
      const at = `${where}.items[${entry?.id || '?'}]`;
      if (!entry?.id || !/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) problems.push(`${at}: needs a kebab-case \`id\`.`);
      else if (checklistIds.has(entry.id)) problems.push(`${at}: id "${entry.id}" is already used — tick state keys on it.`);
      else checklistIds.add(entry.id);
      if (!isText(entry?.text)) problems.push(`${at}: needs \`text\`.`);
    }
  });

  const seen = new Set();
  events.forEach((event, index) => {
    const where = `events[${index}]${event?.id ? ` (${event.id})` : ''}`;
    const fail = (message) => problems.push(`${where}: ${message}`);

    if (!event?.id || !/^[a-z0-9][a-z0-9-]*$/.test(event.id)) fail('needs a kebab-case `id`.');
    else if (seen.has(event.id)) fail('duplicate `id`.');
    else seen.add(event.id);

    if (!isText(event?.title)) fail('needs a `title` (string, or { en, vi }).');
    if (!CATEGORIES.includes(event?.category)) fail(`\`category\` must be one of ${CATEGORIES.join(', ')}.`);
    if (event?.member && !members.has(event.member)) fail(`unknown member "${event.member}".`);
    if (event?.severity && !SEVERITIES.includes(event.severity)) {
      fail(`\`severity\` must be one of ${SEVERITIES.join(', ')}.`);
    }

    const repeat = event?.repeat;
    if (!repeat || !REPEAT_KINDS.includes(repeat.kind)) {
      fail(`\`repeat.kind\` must be one of ${REPEAT_KINDS.join(', ')}.`);
    } else if (repeat.kind === 'once' && !ISO.test(repeat.on || '')) {
      fail('`repeat.on` must be YYYY-MM-DD.');
    } else if (repeat.kind === 'yearly' && !ISO.test(repeat.anchor || '')) {
      fail('`repeat.anchor` must be YYYY-MM-DD — the first time it happened.');
    } else if (repeat.kind === 'lunar-yearly' && !(repeat.day >= 1 && repeat.day <= 30 && repeat.month >= 1 && repeat.month <= 12)) {
      fail('`repeat.day` (1-30) and `repeat.month` (1-12) are lunar dates.');
    } else if (repeat.kind === 'monthly' && !(repeat.day >= 1 && repeat.day <= 31)) {
      fail('`repeat.day` must be 1-31.');
    } else if (repeat.kind === 'rolling') {
      if (!(Number(repeat.every) > 0)) fail('`repeat.every` must be a positive number.');
      if (!['day', 'month', 'year'].includes(repeat.unit)) fail('`repeat.unit` must be day, month or year.');
      // Rolling means "N since the last one", so with no starting point there
      // is nothing to count from and the event would never come due.
      if (!repeat.anchor && !(event.history || []).length) fail('rolling needs `repeat.anchor` or at least one `history` date.');
    }

    for (const date of event?.history || []) {
      if (!ISO.test(date)) fail(`history entry "${date}" must be YYYY-MM-DD.`);
    }
    if (event?.odometer && !(event.odometer.every_km > 0 && event.odometer.per_month > 0)) {
      fail('`odometer` needs positive `every_km` and `per_month`.');
    }
  });
  return problems;
}

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const writeJson = async (file, value) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const STARTER = {
  version: 1,
  note: 'Edit this file, run `node tools/schedule-seal.mjs seal`, then commit the envelope. This file is gitignored and never leaves the machine.',
  events: [
    {
      id: 'example-card-fee',
      title: { vi: 'Phí thường niên thẻ (ví dụ)', en: 'Card annual fee (example)' },
      category: 'finance',
      severity: 'critical',
      repeat: { kind: 'yearly', anchor: '2024-11-18' },
      lead_days: 45,
      cost: '500.000d',
      note: { vi: 'Gọi tổng đài xin miễn phí trước ngày cắt.', en: 'Call to request a waiver before the cut-off.' },
      history: ['2025-11-18']
    }
  ]
};

/* The hint rides outside the ciphertext, so it is as public as the repo. A
   hint that carries characters of the passphrase — even "buried in noise", as
   the playbook once advised — shortens an attacker's search by exactly that
   much, and the trick itself is documented here. The seal tool holds both
   strings at once, so it can refuse rather than trust the author's judgement:
   no run of HINT_RUN characters may appear in both. */
const HINT_RUN = 4;
export function hintLeaks(hint, passphrase) {
  const a = String(hint || '').toLowerCase();
  const b = String(passphrase || '').toLowerCase();
  for (let i = 0; i + HINT_RUN <= a.length; i++) {
    const run = a.slice(i, i + HINT_RUN);
    if (run.trim().length === HINT_RUN && b.includes(run)) return run;
  }
  return '';
}

async function main() {
  const command = ['seal', 'unseal', 'init', 'validate'].find(name => process.argv.includes(name))
    || (process.argv.includes('--check') ? 'check' : null);
  const force = process.argv.includes('--force');

  if (!command) die('Usage: schedule-seal.mjs seal | unseal | validate | init | --check');

  // Checking your own JSON should not cost a passphrase, so this stops short
  // of the envelope: same rules `seal` applies, no crypto and no output file.
  if (command === 'validate') {
    if (!existsSync(PLAIN)) die(`${path.relative(ROOT, PLAIN)} not found — run \`init\` first.`);
    const document = await readJson(PLAIN);
    const problems = validate(document);
    if (problems.length) die(`${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    const ticks = (document.checklists || []).reduce((total, list) => total + (list.items || []).length, 0);
    return out(`${path.relative(ROOT, PLAIN)} is valid — ${document.events.length} event(s), `
      + `${(document.items || []).length} item(s), ${(document.checklists || []).length} checklist(s) `
      + `with ${ticks} entries, ${(document.notes || []).length} note(s), `
      + `${(document.members || []).length} member(s). Not sealed.`);
  }

  if (command === 'init') {
    if (existsSync(PLAIN) && !force) die(`${path.relative(ROOT, PLAIN)} already exists — pass --force to replace it.`);
    await writeJson(PLAIN, STARTER);
    return out(`Wrote ${path.relative(ROOT, PLAIN)} — edit it, then run \`seal\`.`);
  }

  if (command === 'seal') {
    if (!existsSync(PLAIN)) die(`${path.relative(ROOT, PLAIN)} not found — run \`init\` first.`);
    const document = await readJson(PLAIN);
    const problems = validate(document);
    if (problems.length) die(`${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    const key = await passphrase();
    const leak = hintLeaks(document.hint, key);
    if (leak) die(`The hint contains "${leak}", which is also in the passphrase. The hint is published in the clear beside the ciphertext — it must share no run of ${HINT_RUN} characters with the passphrase. Write a cue only you can follow, not a fragment.`);
    await writeJson(SEALED, await seal(document, key, { hint: document.hint }));
    return out(`Sealed ${document.events.length} event(s) into ${path.relative(ROOT, SEALED)}. Commit it.`);
  }

  if (!existsSync(SEALED)) die(`${path.relative(ROOT, SEALED)} not found.`);
  const envelope = await readJson(SEALED);
  if (!isEnvelope(envelope)) die('That file is not a sealed envelope.');
  const opened = await unseal(envelope, await passphrase());

  if (command === 'unseal') {
    if (existsSync(PLAIN) && !force) die(`${path.relative(ROOT, PLAIN)} exists — pass --force to overwrite it.`);
    await writeJson(PLAIN, opened);
    return out(`Recovered ${opened.events?.length ?? 0} event(s) into ${path.relative(ROOT, PLAIN)}.`);
  }

  // --check: the envelope opens, its contents are valid, and if a local
  // plaintext exists it has not drifted from what was last sealed.
  const problems = validate(opened);
  if (problems.length) die(`Sealed content is invalid:\n  ${problems.join('\n  ')}`);
  if (existsSync(PLAIN)) {
    const local = await readJson(PLAIN);
    if (JSON.stringify(local) !== JSON.stringify(opened)) {
      die('secret/schedule.json differs from the sealed envelope — run `seal` and commit.');
    }
  }
  out(`Envelope opens; ${opened.events.length} event(s) valid; sealed ${envelope.sealed_at}.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch(error => die(error.message || String(error)));
