/* Merge of the two interview-journal sources.

   The seed (interviews.json, in the repo) and the reader's own Sheet rows are
   shown as one list. These tests pin the rules that keeps them apart: own rows
   first, seed entries the reader already imported drop out, `own` marks which
   rows may be written, and a backend failure still leaves the seed visible.

   config.js is gitignored, so it is written to a temp dir and the modules are
   imported from there — that is the only reason for the copy step below. */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_URL = 'https://script.example.test/exec';
// fileURLToPath, not .pathname — the latter yields "/D:/…" on Windows, which
// node then resolves against the current drive as "D:\D:\…".
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const MASTER = JSON.parse(readFileSync(PUBLIC + 'data/interviews.json', 'utf8'));

let dir, Interviews, Auth;

const SEED = {
  companies: [
    { name: 'Rakuten', role: 'Senior Backend Engineer', date: '2026-07', result: 'pending',
      references: [{ label: 'PostgreSQL', url: 'https://www.postgresql.org/docs/current/' }],
      stack: ['Java'], questions: [{ round: 'Vòng 1 · Coding', q: 'LC 30', a: 'sliding window', note: 'n',
        diagrams: [{ title: 'Window', mermaid: 'flowchart LR\nA --> B', flaws: [], upgrades: [] }] }] },
    { name: 'Công ty mẫu', role: 'SBE', date: '2026-06', result: 'pending', stack: [], questions: [] }
  ]
};

/** Serves interviews.json locally and fakes the Apps Script endpoint. */
function stubFetch({ remote = [], fail = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('interviews.json')) {
      return { ok: true, json: async () => SEED };
    }
    if (u === SCRIPT_URL) {
      calls.push(JSON.parse(opts.body));
      if (fail) throw new Error('backend down');
      const { action, payload } = JSON.parse(opts.body);
      if (action === 'interviews.list') {
        return { ok: true, text: async () => JSON.stringify({ ok: true, data: { companies: remote } }) };
      }
      if (action === 'interviews.save') {
        const id = 'uuid-' + (remote.length + 1);
        remote.push({ id, ...payload.company });
        return { ok: true, text: async () => JSON.stringify({ ok: true, data: { id } }) };
      }
    }
    throw new Error('unexpected fetch: ' + u);
  };
  return calls;
}

const signIn = () => { Auth.session = { sub: 'u1', token: 't', exp: Date.now() + 3600e3 }; };
const signOut = () => { Auth.session = null; };

test('master interview data includes the embedIT backpressure question', () => {
  const embedIT = MASTER.companies.find(company => company.name === 'embedIT');
  assert.ok(embedIT, 'embedIT is present in master interview data');
  const question = embedIT.questions.find(row => /backpressure/i.test(row.q));
  assert.ok(question, 'embedIT includes a backpressure question');
  assert.match(question.a, /bounded queue/i);
  assert.match(question.a, /consumer/i);
});

test('master interview data includes the reviewed VOZ playbook and ATM report', () => {
  const playbook = MASTER.companies.find(company => company.kind === 'playbook');
  const atm = MASTER.companies.find(company => company.kind === 'community-report');
  assert.equal(playbook.source.url, 'https://voz.vn/t/lam-chu-system-design-interview-trong-vong-1-tuan.981368/');
  assert.ok(playbook.questions.length >= 5);
  assert.match(playbook.questions.map(row => row.a).join('\n'), /trade-off/i);
  assert.ok(atm.questions.some(row => /ATM/i.test(row.q)));
  assert.ok(atm.questions.some(row => /idempotency/i.test(row.a)));
  assert.ok(atm.questions.some(row => /ledger/i.test(row.a)));
  assert.equal(playbook.questions[0].diagrams.length, 1);
  const review = atm.questions.find(row => /diagram ATM/i.test(row.q));
  assert.ok(review, 'ATM report includes a diagram-by-diagram technical review');
  assert.equal(review.diagrams.length, 6);
  assert.ok(review.diagrams.some(diagram => diagram.mermaid.startsWith('sequenceDiagram\n')));
  assert.ok(review.diagrams.some(diagram => diagram.mermaid.startsWith('stateDiagram-v2\n')));
  assert.ok(review.diagrams.every(diagram => diagram.flaws.length >= 2 && diagram.upgrades.length >= 2));
  assert.match(review.a, /dual-write/i);
  assert.match(atm.questions[0].a, /FUNDS_RESERVED → DISPENSE_REQUESTED → POSTED/);
  assert.match(atm.questions[0].a, /CANCELLED/);
  assert.match(atm.questions[0].a, /REVERSED.*compensation/);
  assert.match(atm.questions[0].a, /không giữ DB transaction/i);
  assert.ok(atm.references.length >= 5);
  assert.ok(atm.references.every(reference => reference.url.startsWith('https://')));
  for (const company of MASTER.companies) {
    assert.match(company.created_at, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(company.updated_at, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(company.slug);
  }
});

test('Gazl Try renders reviewed Mermaid diagrams through the native component', async () => {
  const view = readFileSync(fileURLToPath(new URL('../app/components/gazl/GazlJournal.client.vue', import.meta.url)), 'utf8');

  // Diagram text round-trips through the Sheet, so it is reader-authored: every
  // place it reaches HTML must escape it. Asserting the absence of an unescaped
  // interpolation catches a new call site, which pinning one spelling did not.
  const uses = [...view.matchAll(/(.{0,12})diagram\.mermaid/g)].map(m => m[1]);
  assert.ok(uses.length > 0, 'the view must render the Mermaid source at all');
  assert.ok(uses.every(before => !before.includes('v-html')), 'diagram source must not be inserted as HTML');
  assert.match(view, /ContentMermaidDiagram/, 'the native renderer needs its mount component');
  assert.match(view, /question\.diagrams/, 'questions must render their diagrams');
  assert.match(view, /<pre><code>{{ diagram\.mermaid }}<\/code><\/pre>/,
    'the editable source must use Vue text escaping');
});

test('master interview data includes the end-to-end interview playbook without outcome myths', () => {
  const playbook = MASTER.companies.find(company => company.slug === 'end-to-end-interview-playbook-2026');
  assert.ok(playbook, 'the end-to-end interview playbook must be published in Gazl Try');
  assert.equal(playbook.kind, 'playbook');
  assert.ok(playbook.questions.length >= 10);
  const content = playbook.questions.map(row => `${row.q}\n${row.a}\n${row.note}`).join('\n');
  assert.match(content, /Present → Evidence → Transition → Fit/);
  assert.match(content, /Clarify → Model → Decide → Verify/);
  assert.match(content, /Hypothesis/);
  assert.match(content, /Definition of Done/);
  assert.match(content, /evidence matrix/);
  assert.match(content, /DA\/Analytics/);
  assert.match(content, /DE\/Data platform/);
  assert.match(content, /semantics → use case → limit → evidence/);
  for (const company of ['OCB', 'MoMo', 'FPT', '7‑Eleven', 'Pizza Hut', 'GHN', 'Abbott']) {
    assert.match(content, new RegExp(company), `the source company name ${company} must remain visible`);
  }
  assert.match(content, /không nên coi thời lượng là quy luật/i);
  assert.equal(playbook.questions.filter(row => row.diagrams).length, 1);
});

test('the Apps Script schema round-trips revisions, diagrams and references with append-only columns', () => {
  const backend = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  assert.match(backend, /'note', 'sort_order', 'diagrams_json'/);
  assert.match(backend, /diagrams: parseStoredDiagrams\(q\.diagrams_json\)/);
  assert.match(backend, /diagrams_json: diagramsJson/);
  assert.match(backend, /'active_question_set', 'references_json'/);
  assert.match(backend, /references: parseStoredReferences\(r\.references_json\)/);
  assert.match(backend, /created_at: iso\(r\.created_at\)\.slice\(0, 10\)/);
  assert.ok(backend.indexOf('qt.appendAll(prepared.map') < backend.indexOf('t.update(existing._row, fields)'));
  assert.match(backend, /Schema changes are append-only/);
});

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'iv-'));
  cpSync(PUBLIC + 'lib', join(dir, 'lib'), { recursive: true });
  writeFileSync(join(dir, 'config.js'),
    `export const GOOGLE_CLIENT_ID = 'cid';\nexport const SCRIPT_URL = '${SCRIPT_URL}';\n`);
  // pathToFileURL: a bare Windows path is not a URL the ESM loader accepts.
  ({ Interviews } = await import(pathToFileURL(join(dir, 'lib/interviews.js')).href));
  ({ Auth } = await import(pathToFileURL(join(dir, 'lib/auth.js')).href));
});

after(() => rmSync(dir, { recursive: true, force: true }));
beforeEach(() => { signOut(); Interviews.companies = []; Interviews.error = null; });

test('signed out shows the seed, read-only', async () => {
  stubFetch();
  await Interviews.load();
  assert.equal(Interviews.source, 'seed');
  assert.equal(Interviews.editable, false);
  assert.deepEqual(Interviews.companies.map(c => c.name), ['Rakuten', 'Công ty mẫu']);
  assert.ok(Interviews.companies.every(c => c.own === false));
});

test('signed in shows own rows first, then the seed', async () => {
  stubFetch({ remote: [{ id: 'uuid-1', name: 'Grab', questions: [] }] });
  signIn();
  await Interviews.load();

  assert.equal(Interviews.source, 'remote');
  assert.equal(Interviews.editable, true);
  assert.deepEqual(Interviews.companies.map(c => c.name), ['Grab', 'Rakuten', 'Công ty mẫu']);
  assert.deepEqual(Interviews.companies.map(c => c.own), [true, false, false]);
  assert.equal(Interviews.ownCompanies.length, 1);
  assert.equal(Interviews.seedCompanies.length, 2);
});

test('a seed entry already imported is not shown twice', async () => {
  stubFetch({ remote: [{ id: 'uuid-1', name: '  rakuten ', questions: [] }] });   // case + spacing differ
  signIn();
  await Interviews.load();

  const names = Interviews.companies.map(c => c.name.trim().toLowerCase());
  assert.equal(names.filter(n => n === 'rakuten').length, 1, 'Rakuten must appear once');
  assert.equal(Interviews.companies.find(c => c.name.trim().toLowerCase() === 'rakuten').own, true);
});

test('importSeed copies the seed row into the Sheet and the seed card drops out', async () => {
  stubFetch({ remote: [] });
  signIn();
  await Interviews.load();

  const seedRakuten = Interviews.companies.find(c => c.name === 'Rakuten');
  assert.equal(seedRakuten.own, false);
  assert.equal(seedRakuten.id, 'seed-0');

  await Interviews.importSeed(seedRakuten.id);

  const after = Interviews.companies.filter(c => c.name === 'Rakuten');
  assert.equal(after.length, 1, 'no duplicate after import');
  assert.equal(after[0].own, true, 'the surviving Rakuten is the own row');
  assert.equal(after[0].questions.length, 1, 'questions came across');
  assert.equal(after[0].questions[0].diagrams.length, 1, 'diagram attachments came across');
  assert.equal(after[0].references[0].label, 'PostgreSQL', 'primary references came across');
});

test('importSeed does not send the seed id, so the backend creates a new row', async () => {
  const calls = stubFetch({ remote: [] });
  signIn();
  await Interviews.load();
  await Interviews.importSeed('seed-0');

  const save = calls.find(c => c.action === 'interviews.save');
  assert.equal(save.payload.company.id, undefined, 'seed-0 must not travel to the backend');
  assert.ok(save.payload.company.questions.every(q => q.id === undefined));
});

test('importSeed preserves external attribution inside the editable copy', async () => {
  SEED.companies[0].source = { label: 'Source label', url: 'https://voz.vn/thread' };
  const calls = stubFetch({ remote: [] });
  signIn();
  await Interviews.load();
  await Interviews.importSeed('seed-0');

  const save = calls.find(c => c.action === 'interviews.save');
  assert.match(save.payload.company.questions[0].note, /Source label/);
  assert.match(save.payload.company.questions[0].note, /https:\/\/voz\.vn\/thread/);
  delete SEED.companies[0].source;
});

test('importSeed refuses a row that is already the reader\'s own', async () => {
  stubFetch({ remote: [{ id: 'uuid-1', name: 'Grab', questions: [] }] });
  signIn();
  await Interviews.load();
  await assert.rejects(() => Interviews.importSeed('uuid-1'), /already in your journal/);
});

test('a backend failure still leaves the seed visible', async () => {
  stubFetch({ fail: true });
  signIn();
  await Interviews.load();

  assert.equal(Interviews.source, 'seed');
  assert.equal(Interviews.editable, false);
  assert.deepEqual(Interviews.companies.map(c => c.name), ['Rakuten', 'Công ty mẫu']);
  assert.ok(Interviews.error, 'the error is surfaced to the view');
});

test('seed ids cannot collide with Sheet uuids', async () => {
  stubFetch({ remote: [{ id: 'uuid-1', name: 'Grab', questions: [] }] });
  signIn();
  await Interviews.load();
  const ids = Interviews.companies.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length, 'ids stay unique across both sources');
  assert.ok(Interviews.seedCompanies.every(c => c.id.startsWith('seed-')));
});
