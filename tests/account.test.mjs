import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { test, before, after, beforeEach } from 'node:test';
import { readFile } from 'node:fs/promises';
import { mkdtempSync, cpSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* Everything behind a signed-in reader: the sign-in state machine, the
   access rules the backend enforces, and the interview journal's two sources.

   Merged from: auth.state, security, interviews.merge.
   Each block keeps its own scope so fixtures and helpers cannot collide. */

// ---- from auth.state.test.mjs ----
{
  /* The sign-in state machine in lib/auth.js.

     The bug these pin: `connecting` used to mean nothing more than "there is a
     stored profile and no token", so whenever silent sign-in quietly failed —
     FedCM suppressing the prompt, third-party cookies blocked, no Google
     session in this browser — the header span spun forever and never offered a
     way in. A silent attempt must always END: with a token, with a prompt
     notification, or with the timeout. When it ends empty the state is `stale`,
     which is a still badge and a real sign-in button.

     The credential itself is covered in security.test.mjs; this file is only
     about which state the UI is told to render. */






  const root = path.resolve(import.meta.dirname, '..');

  function jwt(payload) {
    return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
  }

  /**
   * Loads auth.js with a controllable clock and a scriptable GIS stub, so a
   * silent attempt can be resolved, rejected or left to time out on demand.
   */
  async function loadAuth({ storedProfile } = {}) {
    const source = await readFile(path.join(root, 'public/lib/auth.js'), 'utf8');
    const values = new Map();
    if (storedProfile) values.set('gazl.profile', JSON.stringify(storedProfile));

    const timers = [];
    let promptCallback = null;
    let promptCalls = 0;
    let credentialCallback = null;
    const listeners = {};

    const google = {
      accounts: {
        id: {
          initialize(options) { credentialCallback = options.callback; },
          prompt(cb) { promptCalls++; promptCallback = cb || null; },
          disableAutoSelect() {},
          renderButton() {}
        }
      }
    };

    const document = {
      visibilityState: 'visible',
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
      createElement: () => ({ set onload(f) { f(); }, set onerror(_) {} }),
      head: { appendChild() {} }
    };

    // A movable clock, so the retry cooldown can be tested from both sides.
    let skew = 0;
    const RealDate = Date;
    class FakeDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [RealDate.now() + skew])); }
      static now() { return RealDate.now() + skew; }
    }

    const context = vm.createContext({
      atob: globalThis.atob,
      console: { error() {}, log() {}, warn() {} },
      Date: FakeDate,
      document,
      google,
      localStorage: {
        getItem: k => (values.has(k) ? values.get(k) : null),
        setItem: (k, v) => values.set(k, String(v)),
        removeItem: k => values.delete(k)
      },
      setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
      clearTimeout(id) { if (timers[id - 1]) timers[id - 1].cancelled = true; },
      TextDecoder,
      Uint8Array,
      window: { google }
    });

    const config = new vm.SourceTextModule(
      'export const GOOGLE_CLIENT_ID = "cid"; export const SCRIPT_URL = "https://backend.invalid/exec";',
      { context, identifier: 'config.js' }
    );
    await config.link(() => {});
    await config.evaluate();

    const mod = new vm.SourceTextModule(source, { context, identifier: 'auth.js' });
    await mod.link(specifier => {
      assert.equal(specifier, '../config.js');
      return config;
    });
    await mod.evaluate();

    return {
      Auth: mod.namespace.Auth,
      /** Run the longest pending timer — stands in for SILENT_MS elapsing. */
      fireTimers() {
        const live = timers.filter(t => !t.cancelled && !t.done);
        for (const t of live) { t.done = true; t.fn(); }
      },
      tellPrompt(moment) { if (promptCallback) promptCallback(moment); },
      signInWith(claims) { credentialCallback({ credential: jwt(claims) }); },
      fireVisibility(state = 'visible') {
        document.visibilityState = state;
        for (const fn of listeners.visibilitychange || []) fn();
      },
      advance(ms) { skew += ms; },
      get promptCalls() { return promptCalls; }
    };
  }

  const HINT = { sub: 'u1', email: 'u@example.com', name: 'Returning Reader', picture: '' };
  const validClaims = { sub: 'u1', email: 'u@example.com', name: 'Returning Reader',
    exp: Math.floor(Date.now() / 1000) + 3600 };

  test('a returning reader starts in connecting, not signed out', async () => {
    const b = await loadAuth({ storedProfile: HINT });
    await b.Auth.init();

    assert.equal(b.Auth.state, 'connecting');
    assert.equal(b.Auth.displayName, 'Returning Reader', 'the known face shows immediately');
    assert.equal(b.Auth.token, null);
  });

  test('a silent attempt that produces nothing ends as stale, never stuck connecting', async () => {
    const b = await loadAuth({ storedProfile: HINT });
    await b.Auth.init();
    assert.equal(b.Auth.state, 'connecting');

    b.fireTimers();   // SILENT_MS elapses with no credential

    assert.equal(b.Auth.state, 'stale');
    assert.equal(b.Auth.connecting, false, 'the spinner must stop');
    assert.equal(b.Auth.identity.name, 'Returning Reader', 'we still know who they are');
  });

  test('GIS reporting a dead prompt ends the attempt without waiting for the timeout', async () => {
    const b = await loadAuth({ storedProfile: HINT });
    await b.Auth.init();

    b.tellPrompt({ isNotDisplayed: () => true, isSkippedMoment: () => false });

    assert.equal(b.Auth.state, 'stale');
  });

  test('a prompt predicate that throws does not wedge the state', async () => {
    // Under FedCM several of these are deprecated and can throw on access.
    const b = await loadAuth({ storedProfile: HINT });
    await b.Auth.init();

    b.tellPrompt({ isNotDisplayed() { throw new Error('deprecated under FedCM'); } });
    assert.equal(b.Auth.state, 'connecting', 'an unusable notification tells us nothing');

    b.fireTimers();
    assert.equal(b.Auth.state, 'stale', 'the timeout is still the backstop');
  });

  test('a credential arriving resolves connecting into signed', async () => {
    const b = await loadAuth({ storedProfile: HINT });
    await b.Auth.init();

    b.signInWith(validClaims);

    assert.equal(b.Auth.state, 'signed');
    assert.equal(b.Auth.connecting, false);
    assert.ok(b.Auth.token);
  });

  test('nobody stored means signed out, with no silent attempt at all', async () => {
    const b = await loadAuth();
    await b.Auth.init();

    assert.equal(b.Auth.state, 'anon');
    assert.equal(b.Auth.connecting, false);
  });

  test('returning to the tab does not re-prompt inside the cooldown', async () => {
    // Silent sign-in that just failed will fail again for the same reason, so
    // flicking between tabs must not turn into a prompt storm.
    const b = await loadAuth({ storedProfile: HINT });
    await b.Auth.init();
    b.fireTimers();
    const after = b.promptCalls;

    b.fireVisibility('visible');
    b.fireVisibility('visible');

    assert.equal(b.promptCalls, after);
    assert.equal(b.Auth.state, 'stale');
  });

  test('once the cooldown passes, returning to the tab retries exactly once', async () => {
    const b = await loadAuth({ storedProfile: HINT });
    await b.Auth.init();
    b.fireTimers();
    const after = b.promptCalls;

    b.advance(61_000);
    b.fireVisibility('visible');
    assert.equal(b.promptCalls, after + 1, 'one fresh attempt');
    assert.equal(b.Auth.state, 'connecting');

    // The new attempt is already in flight; a second return adds nothing.
    b.fireVisibility('visible');
    assert.equal(b.promptCalls, after + 1);
  });

  test('a signed-in reader is never re-prompted on tab focus', async () => {
    const b = await loadAuth({ storedProfile: HINT });
    await b.Auth.init();
    b.signInWith(validClaims);
    const after = b.promptCalls;

    b.advance(61_000);
    b.fireVisibility('visible');

    assert.equal(b.promptCalls, after);
    assert.equal(b.Auth.state, 'signed');
  });

  test('a hidden tab does not trigger a retry', async () => {
    const b = await loadAuth({ storedProfile: HINT });
    await b.Auth.init();
    b.fireTimers();
    const before = b.promptCalls;

    b.fireVisibility('hidden');

    assert.equal(b.promptCalls, before);
  });

  test('signing out drops the face and leaves nothing spinning', async () => {
    const b = await loadAuth({ storedProfile: HINT });
    await b.Auth.init();
    b.signInWith(validClaims);

    b.Auth.signOut();

    assert.equal(b.Auth.state, 'anon');
    assert.equal(b.Auth.connecting, false);
    assert.equal(b.Auth.identity, null);
  });

  test('an expired token reads as stale rather than signed', async () => {
    const b = await loadAuth({ storedProfile: HINT });
    await b.Auth.init();
    b.signInWith({ ...validClaims, exp: Math.floor(Date.now() / 1000) - 10 });

    assert.equal(b.Auth.token, null);
    assert.equal(b.Auth.expired, true);
    assert.equal(b.Auth.state, 'stale');
  });
}

// ---- from security.test.mjs ----
{
  const root = path.resolve(import.meta.dirname, '..');

  function memoryStorage(seed = {}) {
    const values = new Map(Object.entries(seed));
    return {
      values,
      api: {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
      }
    };
  }

  function jwt(payload) {
    const encoded = Buffer.from(JSON.stringify(payload))
      .toString('base64url');
    return `header.${encoded}.signature`;
  }

  async function loadAuth({ storedSession, storedProfile } = {}) {
    const source = await readFile(path.join(root, 'public/lib/auth.js'), 'utf8');
    const seed = {};
    if (storedSession) seed['gazl.session'] = JSON.stringify(storedSession);
    if (storedProfile) seed['gazl.profile'] = JSON.stringify(storedProfile);
    const storage = memoryStorage(seed);
    const consoleCalls = [];
    let credentialCallback = null;

    const google = {
      accounts: {
        id: {
          initialize(options) { credentialCallback = options.callback; },
          prompt() {},
          disableAutoSelect() {},
          renderButton() {}
        }
      }
    };

    const context = vm.createContext({
      atob: globalThis.atob,
      clearTimeout() {},
      console: {
        error(...args) { consoleCalls.push(['error', ...args]); },
        log(...args) { consoleCalls.push(['log', ...args]); },
        warn(...args) { consoleCalls.push(['warn', ...args]); }
      },
      document: {},
      google,
      localStorage: storage.api,
      setTimeout() { return 1; },
      TextDecoder,
      Uint8Array,
      window: { google }
    });

    const config = new vm.SourceTextModule(
      'export const GOOGLE_CLIENT_ID = "browser-client"; export const SCRIPT_URL = "https://backend.invalid/exec";',
      { context, identifier: 'config.js' }
    );
    await config.link(() => {});
    await config.evaluate();

    const auth = new vm.SourceTextModule(source, {
      context,
      identifier: path.join(root, 'public/lib/auth.js')
    });
    await auth.link(specifier => {
      assert.equal(specifier, '../config.js');
      return config;
    });
    await auth.evaluate();

    return {
      Auth: auth.namespace.Auth,
      consoleCalls,
      credential(response) {
        assert.ok(credentialCallback, 'GIS credential callback was registered');
        credentialCallback(response);
      },
      storage: storage.values
    };
  }

  async function loadBackend() {
    const source = await readFile(path.join(root, 'apps-script/Code.gs'), 'utf8');
    const context = vm.createContext({
      ContentService: {
        MimeType: { JSON: 'application/json' },
        createTextOutput(text) {
          return {
            text,
            setMimeType() { return this; }
          };
        }
      }
    });
    new vm.Script(source, { filename: 'apps-script/Code.gs' }).runInContext(context);
    return context;
  }

  test('interview diagram and reference payloads are normalized before persistence', async () => {
    const backend = await loadBackend();
    const diagram = backend.normalizeDiagrams([{
      phase: 'Critical path',
      title: 'Reserve then post',
      mermaid: 'sequenceDiagram\n  A->>B: reserve',
      flaws: ['one'],
      upgrades: ['two']
    }]);
    assert.equal(JSON.parse(JSON.stringify(diagram))[0].title, 'Reserve then post');
    assert.throws(
      () => backend.normalizeDiagrams([{ mermaid: 'flowchart LR\n%%{init: {}}%%\nA --> B' }]),
      /directive/i
    );
    assert.throws(
      () => backend.normalizeDiagrams([{ mermaid: 'classDiagram\nA <|-- B' }]),
      /flowchart, sequenceDiagram/i
    );

    const references = backend.normalizeReferences([{ label: 'PostgreSQL', url: 'https://www.postgresql.org/docs/current/' }]);
    assert.equal(JSON.parse(JSON.stringify(references))[0].label, 'PostgreSQL');
    assert.throws(() => backend.normalizeReferences([{ label: 'bad', url: 'http://example.test' }]), /HTTPS/);

    assert.throws(() => backend.ACTIONS['interviews.save']({ sub: 'u1' }, {
      company: {
        name: 'Unsafe payload',
        questions: [{ q: 'q', diagrams: [{ mermaid: 'flowchart LR\n%%{init: {}}%%\nA --> B' }] }]
      }
    }), /directive/i, 'validation must fail before the lock or Sheet is touched');
  });

  async function loadApi() {
    const source = await readFile(path.join(root, 'public/lib/api.js'), 'utf8');
    const requests = [];
    const context = vm.createContext({
      fetch: async (url, options) => {
        requests.push({ url, options });
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({ ok: true, data: { accepted: true } });
          }
        };
      }
    });

    const config = new vm.SourceTextModule(
      'export const SCRIPT_URL = "https://backend.invalid/exec";',
      { context, identifier: 'config.js' }
    );
    await config.link(() => {});
    await config.evaluate();

    const api = new vm.SourceTextModule(source, {
      context,
      identifier: path.join(root, 'public/lib/api.js')
    });
    await api.link(specifier => {
      assert.equal(specifier, '../config.js');
      return config;
    });
    await api.evaluate();

    return { call: api.namespace.call, requests };
  }

  function responseBody(output) {
    return JSON.parse(output.text);
  }

  test('Google ID tokens live in memory only and a legacy stored token is discarded', async () => {
    const oldToken = 'legacy-secret-token';
    const browser = await loadAuth({
      storedSession: {
        sub: 'old-user',
        email: 'old@example.com',
        role: 'admin',
        token: oldToken,
        exp: Date.now() + 3_600_000
      }
    });

    await browser.Auth.init();

    assert.equal(browser.Auth.session, null);
    assert.equal(browser.storage.has('gazl.session'), false);

    const newToken = jwt({
      sub: 'new-user',
      email: 'new@example.com',
      name: 'New User',
      exp: Math.floor(Date.now() / 1000) + 3600
    });
    browser.credential({ credential: newToken });

    assert.equal(browser.Auth.token, newToken);
    assert.equal(browser.storage.has('gazl.session'), false);

    // The profile hint exists so a returning reader sees their own avatar on
    // first paint. It must stay a display record: anything token-shaped in here
    // would put a credential back on disk, which is the whole thing we avoid.
    const hint = JSON.parse(browser.storage.get('gazl.profile'));
    assert.deepEqual(Object.keys(hint).sort(), ['email', 'name', 'picture', 'sub']);
    assert.equal(JSON.stringify(hint).includes(newToken), false);
  });

  test('the stored profile hint cannot smuggle a credential back into a session', async () => {
    // A tampered or downgraded entry that carries a token must not be trusted.
    const forged = 'attacker-planted-token';
    const browser = await loadAuth({
      storedProfile: {
        sub: 'victim', email: 'v@example.com', name: 'V', picture: '',
        token: forged, exp: Date.now() + 3_600_000, role: 'admin'
      }
    });

    await browser.Auth.init();

    // The face is shown...
    assert.equal(browser.Auth.identity.name, 'V');
    assert.equal(browser.Auth.displayName, 'V');
    // ...but nothing about it authenticates or elevates anything.
    assert.equal(browser.Auth.session, null);
    assert.equal(browser.Auth.token, null);
    assert.equal(browser.Auth.isAdmin, false);
    assert.equal(browser.Auth.connecting, true);
    assert.equal(browser.Auth.hint.token, undefined);
    assert.equal(browser.Auth.hint.role, undefined);
    assert.equal(browser.Auth.hint.exp, undefined);
  });

  test('signing out clears the profile hint, not just the in-memory session', async () => {
    const browser = await loadAuth();
    await browser.Auth.init();
    browser.credential({
      credential: jwt({ sub: 'u', email: 'u@example.com', name: 'U', exp: Math.floor(Date.now() / 1000) + 3600 })
    });
    assert.equal(browser.storage.has('gazl.profile'), true);

    browser.Auth.signOut();

    assert.equal(browser.Auth.session, null);
    assert.equal(browser.Auth.hint, null);
    assert.equal(browser.Auth.identity, null);
    assert.equal(browser.storage.has('gazl.profile'), false);
  });

  test('a malformed Google credential never writes diagnostic details to the console', async () => {
    const browser = await loadAuth();
    await browser.Auth.init();

    browser.credential({ credential: 'private-malformed-token' });

    assert.deepEqual(browser.consoleCalls, []);
  });

  test('the API transport keeps the ID token out of URLs, headers, caches and referrers', async () => {
    const api = await loadApi();
    const token = 'private-id-token';

    await api.call('pull', {}, token);

    assert.equal(api.requests.length, 1);
    const request = api.requests[0];
    assert.doesNotMatch(request.url, /private-id-token/);
    assert.doesNotMatch(JSON.stringify(request.options.headers), /private-id-token/);
    assert.equal(JSON.parse(request.options.body).idToken, token);
    assert.equal(request.options.cache, 'no-store');
    assert.equal(request.options.credentials, 'omit');
    assert.equal(request.options.referrerPolicy, 'no-referrer');
  });

  test('an unauthenticated backend request is rejected before any action can run', async () => {
    const backend = await loadBackend();
    let actionRan = false;
    backend.ACTIONS['security.probe'] = function () {
      actionRan = true;
      return {};
    };

    const body = responseBody(backend.doPost({
      postData: {
        contents: JSON.stringify({
          action: 'security.probe',
          payload: {},
          idToken: ''
        })
      }
    }));

    assert.equal(body.ok, false);
    assert.equal(actionRan, false);
  });

  test('backend responses do not disclose internal exception details', async () => {
    const backend = await loadBackend();
    backend.requireUser = function () {
      return { sub: 'user-a', role: 'user' };
    };
    backend.ACTIONS['security.leak'] = function () {
      throw new Error('private sheet id: secret-sheet-123');
    };

    const body = responseBody(backend.doPost({
      postData: {
        contents: JSON.stringify({
          action: 'security.leak',
          payload: {},
          idToken: 'valid-for-test'
        })
      }
    }));

    assert.equal(body.ok, false);
    assert.equal(body.error, 'Lỗi máy chủ. Vui lòng thử lại sau.');
    assert.doesNotMatch(JSON.stringify(body), /secret-sheet-123/);
  });

  test('row ownership is isolated by the verified Google subject', async () => {
    const backend = await loadBackend();
    const rows = [
      { user_id: 'user-a', item_id: 'A' },
      { user_id: 'user-b', item_id: 'B' },
      { user_id: 'user-a', item_id: 'C' }
    ];

    const mine = backend.mine(rows, { sub: 'user-b' });

    assert.deepEqual(JSON.parse(JSON.stringify(mine)), [
      { user_id: 'user-b', item_id: 'B' }
    ]);
  });

  test('a normal user is denied before the admin action reads any sheet', async () => {
    const backend = await loadBackend();

    assert.throws(
      () => backend.ACTIONS['admin.overview']({ sub: 'user-a', role: 'user' }),
      /admin/i
    );
  });
}

// ---- from interviews.merge.test.mjs ----
{
  /* Merge of the two interview-journal sources.

     The seed (interviews.json, in the repo) and the reader's own Sheet rows are
     shown as one list. These tests pin the rules that keeps them apart: own rows
     first, seed entries the reader already imported drop out, `own` marks which
     rows may be written, and a backend failure still leaves the seed visible.

     config.js is gitignored, so it is written to a temp dir and the modules are
     imported from there — that is the only reason for the copy step below. */







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
}
