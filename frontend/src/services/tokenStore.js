// In-memory access-token store.
//
// SECURITY: the access token used to live in localStorage, which is
// readable by any JavaScript running on the page — a single XSS bug
// anywhere in the app (or a compromised third-party script) could exfiltrate
// it. Keeping it only in a module-scoped JS variable means it disappears on
// full page reload/tab close and is never written to any browser storage
// API. The refresh token never touches the frontend at all anymore — it's
// an httpOnly cookie the browser manages automatically.
//
// Because the access token is gone after a reload, AuthContext calls
// POST /auth/refresh (cookie-based) once on app start to obtain a fresh one.

let _accessToken = null;

export const getAccessToken = () => _accessToken;
export const setAccessToken = (token) => { _accessToken = token; };
export const clearAccessToken = () => { _accessToken = null; };

// ── Lightweight "a session may exist" flag ─────────────────────────────────
// The refresh token is an httpOnly cookie, so JavaScript can never read it to
// tell whether a session exists. Without this, AuthContext would fire
// POST /auth/refresh unconditionally on every page load, and for visitors who
// were never logged in that always returns 401 — correct, but it shows up as a
// scary console error and wastes a request.
//
// We keep a simple boolean flag (NOT a token — just "we believe a session may
// exist"). We only attempt silent re-auth when it's set. localStorage (not
// sessionStorage) is used so the flag survives tab close and a returning,
// still-logged-in user's session is properly restored on a later visit.
// localStorage access is wrapped in try/catch for strict privacy/SSR edge cases.
const SESSION_FLAG_KEY = 'rs_has_session';

export const hasSessionFlag = () => {
  try { return localStorage.getItem(SESSION_FLAG_KEY) === '1'; }
  catch { return false; }
};

export const setSessionFlag = () => {
  try { localStorage.setItem(SESSION_FLAG_KEY, '1'); } catch { /* ignore */ }
};

export const clearSessionFlag = () => {
  try { localStorage.removeItem(SESSION_FLAG_KEY); } catch { /* ignore */ }
};

