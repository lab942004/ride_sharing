/**
 * Origin-allowlist middleware (CSRF / cross-site request protection).
 *
 * The refresh token lives in an httpOnly cookie. With `SameSite=None`
 * (the production default here for cross-site frontend/backend hosting) the
 * browser WILL attach that cookie to any request to the API, including ones
 * initiated from an attacker's page (e.g. a hidden <form> or a no-cors fetch
 * to POST /api/auth/refresh). That lets a malicious site silently rotate/revoke
 * a victim's session tokens.
 *
 * Browsers send an `Origin` header on every cross-origin request AND on
 * same-origin POST/fetch requests, so we can cheaply verify it. Non-browser
 * clients (curl, mobile, server-to-server) send no Origin — those are allowed
 * because they don't carry ambient cookies by default.
 */
const originCheck = (allowedOrigins) => (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next(); // non-browser client (curl, mobile, server) — allow

  if (allowedOrigins.includes(origin)) return next();

  return res.status(403).json({
    success: false,
    message: 'Request blocked: cross-origin origin not allowed.',
  });
};

module.exports = { originCheck };
