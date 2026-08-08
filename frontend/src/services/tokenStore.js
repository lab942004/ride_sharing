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
