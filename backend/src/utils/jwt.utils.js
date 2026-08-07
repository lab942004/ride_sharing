const jwt = require('jsonwebtoken');

/**
 * SECURITY: user tokens and admin tokens are signed with DIFFERENT secrets
 * and carry an explicit `type` claim ('user' | 'admin'). This means:
 *  - A user access token can never be verified by the admin secret (or vice
 *    versa), even if some future change made user/admin IDs collide.
 *  - Even within one secret, `type` is checked so a token generated for one
 *    purpose can't be replayed against a middleware expecting the other.
 *
 * JWT_ADMIN_SECRET / JWT_ADMIN_REFRESH_SECRET should be set to distinct
 * values in .env. If unset, we deterministically derive a distinct-but-
 * related fallback so the app still works out of the box in dev — but this
 * fallback is NOT a substitute for setting real distinct secrets in
 * production (see .env.example).
 */
const USER_ACCESS_SECRET  = process.env.JWT_SECRET;
const USER_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ADMIN_ACCESS_SECRET  = process.env.JWT_ADMIN_SECRET || `${process.env.JWT_SECRET}::admin`;
const ADMIN_REFRESH_SECRET = process.env.JWT_ADMIN_REFRESH_SECRET || `${process.env.JWT_REFRESH_SECRET}::admin`;

const secretsFor = (type) =>
  type === 'admin'
    ? { access: ADMIN_ACCESS_SECRET, refresh: ADMIN_REFRESH_SECRET }
    : { access: USER_ACCESS_SECRET, refresh: USER_REFRESH_SECRET };

/**
 * Parse duration strings like '7d', '15m', '2h' into milliseconds.
 */
const parseDurationMs = (duration) => {
  const unit  = duration.slice(-1);
  const value = parseInt(duration.slice(0, -1), 10);
  const map   = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return (map[unit] || 86_400_000) * value;
};

const generateAccessToken = (payload, type = 'user') =>
  jwt.sign({ ...payload, type }, secretsFor(type).access, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

const generateRefreshToken = (payload, type = 'user') =>
  jwt.sign({ ...payload, type }, secretsFor(type).refresh, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

/**
 * Verify an access/refresh token against the secret for the expected type,
 * and assert the token's own `type` claim matches. Throws if either check
 * fails (jsonwebtoken errors for signature/expiry, a plain Error for a
 * type mismatch).
 */
const verifyAccessToken = (token, expectedType = 'user') => {
  const decoded = jwt.verify(token, secretsFor(expectedType).access);
  if (decoded.type !== expectedType) {
    throw Object.assign(new Error('Token type mismatch'), { name: 'JsonWebTokenError' });
  }
  return decoded;
};

const verifyRefreshToken = (token, expectedType = 'user') => {
  const decoded = jwt.verify(token, secretsFor(expectedType).refresh);
  if (decoded.type !== expectedType) {
    throw Object.assign(new Error('Token type mismatch'), { name: 'JsonWebTokenError' });
  }
  return decoded;
};

/**
 * Generate both access + refresh token pair for a given token type.
 * Returns { accessToken, refreshToken, refreshExpiresAt }
 */
const generateTokenPair = (payload, type = 'user') => {
  const accessToken  = generateAccessToken(payload, type);
  const refreshToken = generateRefreshToken(payload, type);

  // Calculate refresh token expiry for DB storage
  const expiryMs       = parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
  const refreshExpiresAt = new Date(Date.now() + expiryMs);

  return { accessToken, refreshToken, refreshExpiresAt };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  parseDurationMs,
};
