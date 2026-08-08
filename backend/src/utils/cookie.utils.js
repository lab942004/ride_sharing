/**
 * httpOnly refresh-token cookie helpers.
 *
 * Refresh tokens are long-lived (default 7 days) and, if stolen, allow an
 * attacker to mint new access tokens indefinitely. Storing them in
 * localStorage (readable by any JS running on the page) means a single XSS
 * bug anywhere in the app hands over long-term account takeover. Cookies
 * marked httpOnly cannot be read by JavaScript at all, which closes that
 * theft vector — the browser attaches the cookie automatically on requests
 * to the API, and the frontend never needs to see the raw value.
 */
const isProd = () => process.env.NODE_ENV === 'production';

// SameSite cookie policy.
// - 'lax'  : only works when frontend & backend are the SAME site (identical
//   origin, or true subdomains of one registrable domain with COOKIE_DOMAIN
//   set). Browsers will NOT attach a Lax cookie to background XHR/fetch
//   calls made cross-site — which is exactly what the frontend's silent
//   "restore session" call on every page load is. If frontend/backend are on
//   different hosts (e.g. Vercel + Render — this project's default/expected
//   deployment shape per .env.example), 'lax' silently breaks that call,
//   which looks like "the user gets logged out on every refresh" even
//   though the refresh token itself is still perfectly valid.
// - 'none' : required for cross-site deployments. Requires Secure=true
//   (HTTPS), which is why it's not used in local http dev.
//
// Default to 'none' in production (the common case for this project is
// frontend and backend on separate hosts) unless the operator explicitly
// opts into 'lax' via COOKIE_SAME_SITE for a genuine same-site deployment.
const sameSite = process.env.COOKIE_SAME_SITE || (isProd() ? 'none' : 'lax');

const baseCookieOptions = (path) => ({
  httpOnly: true,
  secure  : isProd() || sameSite === 'none', // 'none' requires Secure
  sameSite,
  path,
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
});

const setRefreshCookie = (res, name, token, expiresAt, path) => {
  res.cookie(name, token, {
    ...baseCookieOptions(path),
    expires: expiresAt,
  });
};

const clearRefreshCookie = (res, name, path) => {
  res.clearCookie(name, baseCookieOptions(path));
};

module.exports = {
  USER_COOKIE_NAME : 'rs_refresh',
  ADMIN_COOKIE_NAME: 'rs_admin_refresh',
  USER_COOKIE_PATH : '/api/auth',
  ADMIN_COOKIE_PATH: '/api/admin/auth',
  setRefreshCookie,
  clearRefreshCookie,
};
