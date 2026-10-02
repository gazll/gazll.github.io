#!/usr/bin/env node
/* Seal and unseal the private Gazl Try entries.

     node tools/interview-seal.mjs seal       # secret/ -> the committed envelope
     node tools/interview-seal.mjs unseal     # the committed envelope -> secret/
     node tools/interview-seal.mjs validate   # check the plaintext, no passphrase
     node tools/interview-seal.mjs --check    # the envelope opens and matches

   Company entries written from someone's own job search — which companies,
   which postings, what was asked — are personal, but a Google Sheet is the
   wrong home for them: a Sheet is what gets shared by accident. They ship the
   way the reminder list does, as an envelope under the same passphrase
   (tools/passphrase.mjs), so a schedule_access grant opens them too.

   The plaintext lives in gitignored secret/, so `unseal` is the recovery path
   and `git log` on the envelope is the history. Like schedule-seal, this is
   NOT a check.mjs stage: CI has neither the passphrase nor secret/. */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEnvelope, seal, unseal } from '../public/lib/schedule-crypto.js';
import { passphrase } from './passphrase.mjs';
import { hintLeaks } from './schedule-seal.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PLAIN = path.join(ROOT, 'secret', 'interviews.json');
const SEALED = path.join(ROOT, 'public', 'data', 'interviews', 'private.enc.json');
const RESULTS = new Set(['', 'pending', 'passed', 'offer', 'failed']);

const out = (line) => process.stdout.write(`${line}\n`);
const die = (line) => { process.stderr.write(`${line}\n`); process.exit(1); };
const rel = (file) => path.relative(ROOT, file);
const text = (value) => typeof value === 'string';

async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/* The same shape the journal renders for interviews.json rows, checked here
   because the plaintext never reaches validate-content.mjs. A name is required
   because the journal merges by it: an own Sheet row with the same name hides
   the sealed one, exactly as it hides a seed entry. */
export function validate(document) {
  const companies = document?.companies;
  if (!Array.isArray(companies)) return ['`companies` must be an array.'];
  const problems = [];
  const names = new Set();
  companies.forEach((company, index) => {
    const at = `companies[${index}]`;
    if (!text(company?.name) || !company.name.trim()) problems.push(`${at}: needs a \`name\`.`);
    else if (names.has(company.name.trim().toLowerCase())) problems.push(`${at}: duplicate name "${company.name}".`);
    else names.add(company.name.trim().toLowerCase());
    if (company?.result !== undefined && !RESULTS.has(company.result)) problems.push(`${at}: unknown result "${company.result}".`);
    for (const field of ['role', 'date', 'jd', 'brief']) {
      if (company?.[field] !== undefined && !text(company[field])) problems.push(`${at}.${field}: must be text.`);
    }
    if (company?.stack !== undefined && !(Array.isArray(company.stack) && company.stack.every(text))) problems.push(`${at}.stack: must be a list of text.`);
    if (company?.rounds !== undefined && !Array.isArray(company.rounds)) problems.push(`${at}.rounds: must be a list.`);
    (company?.questions || []).forEach((question, qIndex) => {
      if (!text(question?.q) || !question.q.trim()) problems.push(`${at}.questions[${qIndex}]: needs \`q\`.`);
    });
  });
  return problems;
}

async function main() {
  const command = ['seal', 'unseal', 'validate'].find(name => process.argv.includes(name))
    || (process.argv.includes('--check') ? 'check' : null);
  const force = process.argv.includes('--force');
  if (!command) die('Usage: interview-seal.mjs seal | unseal | validate | --check');

  if (command === 'validate' || command === 'seal') {
    if (!existsSync(PLAIN)) die(`${rel(PLAIN)} not found — write { "companies": [...] } there first.`);
    const document = await readJson(PLAIN);
    const problems = validate(document);
    if (problems.length) die(`${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    if (command === 'validate') return out(`${rel(PLAIN)} is valid — ${document.companies.length} entr(ies). Not sealed.`);
    const key = await passphrase();
    const leak = hintLeaks(document.hint, key);
    if (leak) die(`The hint contains "${leak}", which is also in the passphrase — the hint is published in the clear.`);
    await writeJson(SEALED, await seal(document, key, { hint: document.hint }));
    return out(`Sealed ${document.companies.length} entr(ies) into ${rel(SEALED)}. Commit it.`);
  }

  if (!existsSync(SEALED)) die(`${rel(SEALED)} not found.`);
  const envelope = await readJson(SEALED);
  if (!isEnvelope(envelope)) die('That file is not a sealed envelope.');
  const opened = await unseal(envelope, await passphrase());

  if (command === 'unseal') {
    if (existsSync(PLAIN) && !force) die(`${rel(PLAIN)} exists — pass --force to overwrite it.`);
    await writeJson(PLAIN, opened);
    return out(`Recovered ${opened.companies?.length ?? 0} entr(ies) into ${rel(PLAIN)}.`);
  }

  const problems = validate(opened);
  if (problems.length) die(`Sealed content is invalid:\n  ${problems.join('\n  ')}`);
  if (existsSync(PLAIN) && JSON.stringify(await readJson(PLAIN)) !== JSON.stringify(opened)) {
    die(`${rel(PLAIN)} differs from the sealed envelope — run \`seal\` and commit.`);
  }
  out(`Envelope opens; ${opened.companies.length} entr(ies) valid; sealed ${envelope.sealed_at}.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch(error => die(error.message || String(error)));
