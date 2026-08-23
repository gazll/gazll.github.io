/* Google sign-in via Google Identity Services.

   GIS hands back an ID token in-page (no redirect), which then rides along
   with every Apps Script request for the backend to verify.

   The token lives one hour and GIS does not refresh it. We schedule a silent
   renewal before expiry; if that cannot happen quietly the sign-in button
   comes back. The credential exists in JavaScript memory only — never in
   localStorage/sessionStorage — while study data keeps its own offline queue.

   What IS persisted is the profile *hint*: display name, email and avatar URL.
   That is not a credential — it cannot authenticate anything, and the backend
   ignores it entirely (user_id always comes from the verified token's `sub`).
   It exists so a returning reader sees their own avatar on first paint instead
   of a signed-out header while keeping the choice to start a new session with
   the reader. Never put `token` in here.

   Prompts can be suppressed by FedCM or browser privacy rules, so every
   explicit attempt is BOUNDED and ends back at a real sign-in button. */
import { GOOGLE_CLIENT_ID, SCRIPT_URL } from '../config.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client?hl=en';
const LEGACY_SESSION_KEY = 'gazl.session';
const HINT_KEY = 'gazl.profile';
const SKEW_MS = 90_000;      // expire early so an in-flight request cannot die mid-way
const PROMPT_MS = 8_000;     // hard ceiling on one explicit prompt attempt
const listeners = new Set();
function emit() { for (const fn of listeners) { try { fn(Auth); } catch (e) {} } }

let gisReady = null;
let gisInit = null;
let initPromise = null;
let renewTimer = null;
let promptTimer = null;
let promptPending = false;

export const Auth = {
  /** { sub, email, name, picture, role, token, exp } or null. */
  session: null,
  /** { sub, email, name, picture } from localStorage — display only, no token. */
  hint: null,
  /** Set once startup has discarded any legacy persisted credential. */
  ready: false,
  error: null,

  get enabled() { return Boolean(GOOGLE_CLIENT_ID && SCRIPT_URL); },
  get user() { return this.session; },
  get isAdmin() { return this.session?.role === 'admin'; },

  /** Whoever we can show in the header: a live session, else the stored hint. */
  get identity() { return this.session || this.hint; },
  get displayName() { return this.identity?.name || this.identity?.email || 'You'; },
  get avatar() { return this.identity?.picture || ''; },
  get email() { return this.identity?.email || ''; },

  /** No usable token, and an explicit Google prompt is genuinely running. */
  get connecting() { return Boolean(!this.token && promptPending); },

  /** A usable token, or null. Checked before every request. */
  get token() {
    const s = this.session;
    if (!s) return null;
    return Date.now() < s.exp - SKEW_MS ? s.token : null;
  },

  /** Signed in but the token lapsed — needs a fresh one. */
  get expired() { return Boolean(this.session) && !this.token; },

  /** The one value the UI switches on. */
  get state() {
    if (!this.enabled) return 'offline';
    if (!this.ready) return 'loading';
    if (this.session && this.token) return 'signed';
    if (this.error) return 'error';
    if (this.connecting) return 'connecting';
    if (this.identity) return 'stale';
    return 'anon';
  },

  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  init() {
    if (initPromise) return initPromise;
    initPromise = initializeAuth();
    return initPromise;
  },

  /** Explicit, user-initiated prompt; repeated calls are ignored while pending. */
  async signIn() {
    if (!this.enabled || promptPending) return;
    this.error = null;
    try {
      await initializeGis();
      beginPrompt();
      google.accounts.id.prompt(handlePromptMoment);
      emit();
    } catch (e) {
      endPrompt();
      this.error = 'Could not open Google sign-in.';
      emit();
    }
  },

  /** Mount Google's own button when One Tap/FedCM is suppressed. */
  renderButton(holder) { return renderSignInButton(holder); },

  signOut() {
    clearTimeout(renewTimer);
    endPrompt();
    this.session = null;
    this.hint = null;
    this.error = null;
    clearLegacySession();
    clearHint();
    // Prevent a later explicit prompt from restoring the signed-out account.
    try { google.accounts.id.disableAutoSelect(); } catch (e) {}
    emit();
  },

  /** Role comes from the backend's `pull` response, not from the token. */
  applyProfile(profile) {
    if (!this.session || !profile) return;
    this.session.role = profile.role || 'user';
    if (profile.name) this.session.name = profile.name;
    if (profile.picture) this.session.picture = profile.picture;
    writeHint(this.session);
    emit();
  }
};

async function initializeAuth() {
  // Versions before July 2026 persisted the full ID token. Remove that
  // credential before rendering anything, even when sync is disabled.
  clearLegacySession();
  Auth.session = null;
  if (!Auth.enabled) { Auth.ready = true; emit(); return; }

  // Show the remembered face, but never start a Google prompt without an
  // explicit user action. This prevents One Tap/FedCM from re-authenticating
  // in a loop after a dismissal, tab switch, or token expiry.
  Auth.hint = readHint();
  Auth.ready = true;
  emit();

  try {
    await initializeGis();
    scheduleRenew();
  } catch (e) {
    Auth.error = 'Could not load Google sign-in.';
    endPrompt();
    emit();
  }
}

/* ---------- explicit sign-in, always bounded ---------- */

function beginPrompt() {
  promptPending = true;
  clearTimeout(promptTimer);
  promptTimer = setTimeout(() => { if (promptPending) { endPrompt(); emit(); } }, PROMPT_MS);
}

function endPrompt() {
  promptPending = false;
  clearTimeout(promptTimer);
}

/** Under FedCM these predicates are deprecated and some throw, so probe each
    one; if none answers, PROMPT_MS still ends the attempt. */
function handlePromptMoment(notification) {
  if (!notification || !promptPending) return;
  const says = name => {
    try { return typeof notification[name] === 'function' && notification[name](); }
    catch (e) { return false; }
  };
  if (says('isNotDisplayed') || says('isSkippedMoment') || says('isDismissedMoment')) {
    endPrompt();
    emit();
  }
}

/* ---------- token lifecycle ---------- */

function onCredential(response) {
  const token = response?.credential;
  if (!token) return;
  const claims = decodeJwt(token);
  const exp = Number(claims?.exp) * 1000;
  if (!claims?.sub || !Number.isFinite(exp)) return;
  if (Auth.session?.token === token && Auth.token) return;

  const keepRole = Auth.session?.role;    // avoid the ADMIN badge blinking off
  Auth.session = {
    sub: claims.sub,
    email: claims.email || '',
    name: claims.name || '',
    picture: claims.picture || '',
    role: keepRole || 'user',
    token,
    exp
  };
  Auth.hint = writeHint(Auth.session);
  Auth.error = null;
  endPrompt();
  scheduleRenew();
  emit();
}

function scheduleRenew() {
  clearTimeout(renewTimer);
  if (!Auth.session) return;
  const wait = Auth.session.exp - SKEW_MS - Date.now();
  if (wait <= 0) { emit(); return; }
  renewTimer = setTimeout(() => {
    if (Auth.session) emit(); // token is stale; the reader chooses when to re-auth
  }, wait);
}

function clearLegacySession() {
  try { localStorage.removeItem(LEGACY_SESSION_KEY); } catch (e) {}
}

/* ---------- profile hint (display only — never the token) ---------- */

function writeHint(s) {
  const hint = { sub: s.sub, email: s.email || '', name: s.name || '', picture: s.picture || '' };
  try { localStorage.setItem(HINT_KEY, JSON.stringify(hint)); } catch (e) {}
  return hint;
}

function readHint() {
  try {
    const raw = localStorage.getItem(HINT_KEY);
    if (!raw) return null;
    const h = JSON.parse(raw);
    if (!h || typeof h !== 'object' || !h.sub) return null;
    // A stored `token`/`exp` would mean an older or tampered entry. Drop it:
    // this object must never be able to authenticate anything.
    return { sub: String(h.sub), email: String(h.email || ''), name: String(h.name || ''), picture: String(h.picture || '') };
  } catch (e) { return null; }
}

function clearHint() {
  try { localStorage.removeItem(HINT_KEY); } catch (e) {}
}

/**
 * Reads the payload for display only — this is NOT verification. The
 * signature is checked in Apps Script, so a forged token here only breaks
 * the forger's own UI.
 */
function decodeJwt(token) {
  try {
    const part = String(token).split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
    // Via TextDecoder so accented names survive.
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) { return null; }
}

function loadGis() {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google Identity Services.'));
    document.head.appendChild(s);
  }).catch(error => {
    gisReady = null;
    throw error;
  });
  return gisReady;
}

function initializeGis() {
  if (gisInit) return gisInit;
  gisInit = loadGis().then(() => {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: onCredential,
      auto_select: false,            // sign-in starts only after an explicit action
      cancel_on_tap_outside: true,   // false traps clicks under FedCM's native prompt
      use_fedcm_for_prompt: true
    });
  }).catch(error => {
    gisInit = null;
    throw error;
  });
  return gisInit;
}

function avatarFace() {
  if (Auth.avatar) {
    return '<img class="avatar" src="' + esc(Auth.avatar) + '" alt="" referrerpolicy="no-referrer">';
  }
  if (Auth.identity) {
    return '<span class="avatar avatar-fallback">' + esc(Auth.displayName.slice(0, 1).toUpperCase()) + '</span>';
  }
  // Signed out: a neutral face, still a button.
  return '<span class="avatar avatar-anon" aria-hidden="true">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
    + '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20c1.4-3.9 4.1-5.8 7.5-5.8s6.1 1.9 7.5 5.8"/></svg></span>';
}

const STATE_LABEL = {
  offline: 'Offline mode — backend not configured',
  loading: 'Loading…',
  error: 'Sign-in failed — click to retry',
  signed: () => 'Account: ' + Auth.displayName,
  connecting: 'Reconnecting…',
  stale: 'Session ended — click to sign in',
  anon: 'Sign in with Google'
};

function avatarHtml() {
  const state = Auth.state;
  const raw = STATE_LABEL[state] || STATE_LABEL.anon;
  const label = typeof raw === 'function' ? raw() : raw;

  return '<button class="authbtn" id="authBtn" data-state="' + state + '"'
    + ' aria-haspopup="dialog" title="' + esc(label) + '" aria-label="' + esc(label) + '">'
    + avatarFace()
    + (Auth.isAdmin && state === 'signed' ? '<span class="av-admin" title="Admin">★</span>' : '')
    + '</button>';
}

function menuHtml() {
  const state = Auth.state;
  let body;

  if (state === 'offline') {
    body = '<p class="am-note">No backend is configured, so progress is kept on this device only. '
      + 'See the README to turn on Google Sheet sync.</p>';
  } else if (state === 'signed') {
    body = '<div class="am-id">'
      + '<div class="am-name">' + esc(Auth.displayName) + (Auth.isAdmin ? '<span class="rolebadge">ADMIN</span>' : '') + '</div>'
      + (Auth.email ? '<div class="am-mail">' + esc(Auth.email) + '</div>' : '')
      + '</div>'
      + '<p class="am-note ok">Progress, notes and the interview journal are syncing to your Google Sheet.</p>'
      + '<button class="am-action danger" id="btnSignOut">Sign out</button>';
  } else if (state === 'connecting') {
    body = '<div class="am-id">'
      + '<div class="am-name">' + esc(Auth.displayName) + '</div>'
      + (Auth.email ? '<div class="am-mail">' + esc(Auth.email) + '</div>' : '')
      + '</div>'
      + '<p class="am-note">Trying to sign you back in without asking. This takes a moment — '
      + 'if nothing happens, a sign-in button will appear here.</p>';
  } else if (Auth.identity) {
    body = '<div class="am-id">'
      + '<div class="am-name">' + esc(Auth.displayName) + '</div>'
      + (Auth.email ? '<div class="am-mail">' + esc(Auth.email) + '</div>' : '')
      + '</div>'
      + '<p class="am-note">Your session ended and Google could not renew it silently — that is normal '
      + 'when third-party cookies are blocked. Sign in again to resume syncing; anything waiting is '
      + 'still safe on this device.</p>'
      + '<div class="gis-holder" id="gisBtn"></div>'
      + '<button class="am-action danger" id="btnSignOut">Forget this account</button>';
  } else {
    body = '<p class="am-note">Sign in with Google to keep your progress, notes and interview journal '
      + 'in your own Google Sheet. Everything works signed out too — it just stays on this device.</p>'
      + '<div class="gis-holder" id="gisBtn"></div>';
  }

  return '<div class="authmenu" role="dialog" aria-label="Account">'
    + (Auth.error ? '<p class="am-note err">' + esc(Auth.error) + '</p>' : '')
    + body + '</div>';
}

/** Google's own button: more reliable than One Tap, which FedCM can suppress. */
async function renderSignInButton(holder) {
  if (!holder) return false;
  try {
    await initializeGis();
    holder.replaceChildren();
    google.accounts.id.renderButton(holder, {
      type: 'standard', theme: 'outline', size: 'large',
      shape: 'pill', text: 'signin_with', logo_alignment: 'center',
      locale: 'en', width: 240
    });
    return true;
  } catch (e) {
    return false;
  }
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
