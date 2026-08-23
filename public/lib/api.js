/* Transport to the Apps Script Web App.

   text/plain, and idToken in the body, are both deliberate: Apps Script
   cannot answer a preflight OPTIONS, so the request has to stay CORS-simple.
   application/json or an Authorization header would trigger one and fail. */
import { SCRIPT_URL } from '../config.js';

export const MAX_RESPONSE_CHARS = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;

const isHttpsUrl = value => typeof value === 'string' && /^https:\/\//i.test(value);
export const isConfigured = () => isHttpsUrl(SCRIPT_URL);

/** `authExpired` tells the store to keep its queue and ask for a new token. */
export class ApiError extends Error {
  constructor(message, { authExpired = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.authExpired = authExpired;
  }
}

export async function call(action, payload = {}, idToken = null) {
  if (!isConfigured()) throw new ApiError('SCRIPT_URL is not configured.');
  if (!idToken) throw new ApiError('Not signed in.', { authExpired: true });

  let res;
  let text;
  let controller = null;
  let timeout = null;
  try {
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    }
    res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // see note above
      body: JSON.stringify({ action, payload, idToken }),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
      ...(controller ? { signal: controller.signal } : {})
    });
    const contentLength = Number(res.headers?.get?.('Content-Length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_CHARS) {
      throw new ApiError('Backend response is too large.');
    }
    text = await res.text();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e?.name === 'AbortError') throw new ApiError('Backend request timed out.');
    throw new ApiError('Could not reach the backend: ' + (e.message || e));
  } finally {
    if (timeout != null) clearTimeout(timeout);
  }

  if (text.length > MAX_RESPONSE_CHARS) throw new ApiError('Backend response is too large.');
  let body;
  try {
    body = JSON.parse(text);
  } catch (e) {
    // Apps Script serves an HTML error page when the deployment permissions
    // are wrong or the script failed to load.
    throw new ApiError(
      res.ok
        ? 'The backend did not return JSON — check that the deployment is set to "Who has access: Anyone".'
        : 'Backend returned HTTP ' + res.status
    );
  }

  // Every response is HTTP 200; the outcome is this flag.
  if (!body.ok) {
    const msg = body.error || 'The backend reported an unspecified error.';
    // Code.gs still answers in Vietnamese, so both wordings must match here.
    throw new ApiError(msg, { authExpired: /token|idToken|hết hạn|đăng nhập|expired|sign ?in/i.test(msg) });
  }
  return body.data;
}

/** Liveness probe, for diagnosing a bad configuration. */
export async function ping() {
  if (!isConfigured()) return false;
  try {
    const res = await fetch(SCRIPT_URL, { redirect: 'follow' });
    const text = await res.text();
    if (text.length > MAX_RESPONSE_CHARS) return false;
    const body = JSON.parse(text);
    return Boolean(body && body.ok);
  } catch (e) {
    return false;
  }
}
