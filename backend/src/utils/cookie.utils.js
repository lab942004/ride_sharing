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
// - 'lax'  (default): works when frontend & backend are on the same site
//   (e.g. same domain or subdomains of the same registrable domain).
// - 'none' : required when frontend & backend are on DIFFERENT sites
//   (e.g. admin panel on Vercel, backend on Render). Requires Secure=true.
// Set COOKIE_SAME_SITE="none" in production for cross-site deployments.
const sameSite = process.env.COOKIE_SAME_SITE || (isProd() ? 'lax' : 'lax');

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
