/* Recent searches, kept where they belong.

   Signed out, history is `sessionStorage`: a shared or borrowed browser must
   not keep a stranger's reading trail after the tab closes. Signed in, it is
   `localStorage` under the account bucket — same shape as Store's buckets —
   and is mirrored to the Sheet so it follows the reader between devices.

   Signing in carries the session list across once and then clears it, so the
   searches made while deciding to sign in are not lost, and cannot leak into a
   second account signed in afterwards from the same tab.

   The remote half is best-effort by design. An older Apps Script deployment
   answers "Action không hợp lệ." for these actions, and that must cost the
   reader nothing: every network path here fails into local-only history. */
import { call } from './api.js';
import { Auth } from './auth.js';
// Keep history on the small text leaf. Importing the full search engine here
// pulls ranking, highlighting and markdown escaping into every initial page,
// even when the search panel has not been opened yet.
import { fold } from './search-text.js';

const SESSION_KEY = 'gazl.search.session';
const ACCOUNT_PREFIX = 'gazl.search.';
const MAX_ENTRIES = 40;
const PUSH_DELAY = 1200;

const listeners = new Set();

/* Storage is read through these rather than captured at import time: Safari
   private mode throws on access, and the tests install their own. */
function store(session) {
  try {
    return session ? globalThis.sessionStorage : globalThis.localStorage;
  } catch (error) {
    return null;
  }
}

function readList(session, key) {
  try {
    const raw = store(session)?.getItem(key);
    const value = raw == null ? null : JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function writeList(session, key, value) {
  try { store(session)?.setItem(key, JSON.stringify(value)); } catch (error) {}
}

function dropKey(session, key) {
  try { store(session)?.removeItem(key); } catch (error) {}
}

/** Same query typed with different case or accents is the same search. */
const keyOf = entry => fold(String(entry && entry.q || '')).replace(/\s+/g, ' ').trim();

function clean(row) {
  const q = String(row && row.q || '').replace(/\s+/g, ' ').trim();
  if (!q) return null;
  return { q, at: String(row.at || ''), hits: Number(row.hits) > 0 ? Number(row.hits) : 1 };
}

/**
 * Newest first, one row per query.
 *
 * `hits` merges as a maximum rather than a sum: the same rows are pulled back
 * from the Sheet on every sign-in, and summing would inflate them each time.
 */
export function mergeHistory(...lists) {
  const byKey = new Map();
  for (const list of lists) {
    for (const row of list || []) {
      const entry = clean(row);
      if (!entry) continue;
      const key = keyOf(entry);
      const seen = byKey.get(key);
      if (!seen) { byKey.set(key, entry); continue; }
      seen.hits = Math.max(seen.hits, entry.hits);
      // The newest spelling wins, so "kafka" typed today replaces "Kafka".
      if (entry.at > seen.at) { seen.at = entry.at; seen.q = entry.q; }
    }
  }
  return [...byKey.values()]
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    .slice(0, MAX_ENTRIES);
}

export const SearchHistory = {
  entries: [],
  /** The identity this history follows. Replaced wholesale by `attachAuth`. */
  auth: Auth,
  /** 'anon' (session storage) or the signed-in account's `sub`. */
  bucket: 'anon',
  loaded: false,

  _pending: new Map(),
  _timer: null,
  _inflight: null,

  get signedIn() { return this.bucket !== 'anon'; },
  get storageKey() { return this.signedIn ? ACCOUNT_PREFIX + this.bucket : SESSION_KEY; },

  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  _emit() { for (const fn of listeners) { try { fn(this); } catch (error) {} } },

  _read() { this.entries = mergeHistory(readList(!this.signedIn, this.storageKey)); },
  _write() { writeList(!this.signedIn, this.storageKey, this.entries); },

  /** Loads the current bucket and follows the account from then on. */
  attachAuth(auth = Auth) {
    if (this.loaded) return this;
    this.auth = auth;
    this.bucket = auth.session ? auth.session.sub : 'anon';
    this._read();
    this.loaded = true;

    auth.onChange(() => {
      const next = this.auth.session ? this.auth.session.sub : 'anon';
      if (next === this.bucket) {
        // Same account, fresh token: whatever could not be sent goes now.
        if (this.signedIn && this.auth.token && this._pending.size) this._flush();
        return;
      }

      const carry = this.bucket === 'anon' && next !== 'anon' ? this.entries : null;
      this.bucket = next;
      this._read();

      if (carry && carry.length) {
        this.entries = mergeHistory(this.entries, carry);
        this._write();
        // Carried across, so it must not land in a second account next.
        dropKey(true, SESSION_KEY);
        for (const entry of carry) this._pending.set(keyOf(entry), entry);
      }

      this._emit();
      if (this.signedIn) this.pull();
    });

    if (this.signedIn) this.pull();
    return this;
  },

  /** Remote history merged in, then anything the Sheet is missing sent up. */
  async pull() {
    if (!this.signedIn || !this.auth.enabled || !this.auth.token) return this.entries;
    let data;
    try {
      data = await call('search.pull', {}, this.auth.token);
    } catch (error) {
      return this.entries;   // older deployment or no network: local is enough
    }

    const remote = (data && data.history) || [];
    const stored = new Map(remote.map(row => [keyOf(row), String(row && row.q || '')]));
    this.entries = mergeHistory(this.entries, remote);

    // Rows the Sheet is missing, and rows whose spelling the merge changed —
    // `search.delete` matches on the exact string, so the two must converge.
    for (const entry of this.entries) {
      const key = keyOf(entry);
      if (stored.get(key) !== entry.q) this._pending.set(key, entry);
    }

    this._write();
    this._emit();
    if (this._pending.size) this._flush();
    return this.entries;
  },

  /** One search the reader acted on — typing alone never records. */
  record(query) {
    const entry = clean({ q: query, at: new Date().toISOString(), hits: 1 });
    if (!entry || entry.q.length < 2) return null;
    const key = keyOf(entry);
    const previous = this.entries.find(row => keyOf(row) === key);
    entry.hits = (previous ? previous.hits : 0) + 1;

    this.entries = [entry, ...this.entries.filter(row => keyOf(row) !== key)].slice(0, MAX_ENTRIES);
    this._write();
    this._emit();
    this._queue(entry);
    return entry;
  },

  remove(query) {
    const key = keyOf({ q: query });
    const before = this.entries.length;
    this.entries = this.entries.filter(row => keyOf(row) !== key);
    if (this.entries.length === before) return;
    this._pending.delete(key);
    this._write();
    this._emit();
    this._deleteRemote({ queries: [String(query)] });
  },

  clear() {
    this.entries = [];
    this._pending.clear();
    clearTimeout(this._timer);
    this._write();
    this._emit();
    this._deleteRemote({ all: true });
  },

  _queue(entry) {
    if (!this.signedIn) return;
    this._pending.set(keyOf(entry), entry);
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._flush(), PUSH_DELAY);
  },

  /** Best-effort: a failed send leaves the rows queued for the next attempt. */
  _flush() {
    clearTimeout(this._timer);
    if (this._inflight) return this._inflight;
    if (!this.signedIn || !this.auth.enabled || !this.auth.token || !this._pending.size) return Promise.resolve();
    const batch = [...this._pending.values()];
    this._inflight = (async () => {
      try {
        await call('search.push', { history: batch }, this.auth.token);
        for (const entry of batch) this._pending.delete(keyOf(entry));
      } catch (error) {
        // Best effort: keeping the entries queued lets the next sign-in or
        // successful network event retry without duplicating requests now.
      } finally {
        this._inflight = null;
      }
    })();
    return this._inflight;
  },

  async _deleteRemote(payload) {
    if (!this.signedIn || !this.auth.enabled || !this.auth.token) return;
    try { await call('search.delete', payload, this.auth.token); } catch (error) {}
  }
};
