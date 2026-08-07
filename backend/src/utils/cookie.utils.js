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

const baseCookieOptions = (path) => ({
  httpOnly: true,
  secure  : isProd(),               // HTTPS-only in production
  sameSite: isProd() ? 'lax' : 'lax', // 'lax' allows normal top-level navigation/refresh flows
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
