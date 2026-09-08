const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000; // 15 min

/**
 * SHARED STORE (Redis) FOR HORIZONTAL SCALING
 * -----------------------------------------------------------------------
 * express-rate-limit's default store is in-memory, scoped to a single Node
 * process. That's fine for one instance, but the moment this backend runs
 * as more than one process - multiple containers behind a load balancer,
 * PM2 cluster mode, etc. - each instance keeps its own independent
 * counters. A client round-robined across N instances effectively gets
 * N times every configured limit, silently. This matters most for the
 * security-sensitive limiters here (otpLimiter, authLimiter,
 * adminAuthLimiter) where the whole point is bounding attempts regardless
 * of which instance handles the request.
 *
 * Fix: back every limiter with a shared Redis store when REDIS_URL is
 * configured, so all instances see the same counters. When it isn't set
 * (e.g. local dev, or a deliberately single-instance deployment) we fall
 * back to the in-memory store exactly as before - nothing changes for
 * that case, and there's no hard dependency on Redis being present.
 */
let sharedStore;
if (process.env.REDIS_URL) {
  try {
    const Redis = require('ioredis');
    const { RedisStore } = require('rate-limit-redis');
    const redisClient = new Redis(process.env.REDIS_URL, {
      // Rate limiting should degrade gracefully, not crash the process -
      // keep retrying in the background instead of throwing on connect.
      maxRetriesPerRequest: null,
      lazyConnect         : false,
    });
    redisClient.on('error', (err) => {
      console.error('[RateLimit] Redis connection error (falling back to in-memory limits):', err.message);
    });

    const makeRedisStore = (prefix) =>
      new RedisStore({
        prefix,
        // rate-limit-redis expects a `call(...args)` sending function; ioredis
        // exposes commands directly, so adapt via `call`.
        sendCommand: (...args) => redisClient.call(...args),
      });

    sharedStore = makeRedisStore;
    console.log('[RateLimit] Using shared Redis store for rate limiting (multi-instance safe).');
  } catch (err) {
    console.error('[RateLimit] Failed to initialize Redis store, falling back to in-memory:', err.message);
    sharedStore = null;
  }
} else {
  console.warn(
    '[RateLimit] REDIS_URL not set - using in-memory rate limiting. ' +
    'This is fine for a single instance, but limits will NOT be shared ' +
    'across multiple instances/containers if you scale horizontally.'
  );
}

// Returns a Redis-backed store for this limiter, or `undefined` (letting
// express-rate-limit fall back to its built-in in-memory store) when no
// REDIS_URL is configured or Redis failed to initialize.
const storeFor = (name) => (sharedStore ? sharedStore(`rl:${name}:`) : undefined);

/**
 * General API rate limiter - applied globally.
 */
const globalLimiter = rateLimit({
  windowMs,
  max             : parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  standardHeaders : true,
  legacyHeaders   : false,
  store           : storeFor('global'),
  message         : { success: false, message: 'Too many requests. Please try again later.' },
});

/**
 * Strict limiter for OTP send - max 5 requests per 15 minutes per IP.
 * Prevents OTP spam / enumeration attacks.
 */
const otpLimiter = rateLimit({
  windowMs,
  max             : parseInt(process.env.OTP_RATE_LIMIT_MAX, 10) || 5,
  standardHeaders : true,
  legacyHeaders   : false,
  store           : storeFor('otp'),
  message         : { success: false, message: 'Too many OTP requests. Please wait before trying again.' },
});

/**
 * Auth limiter - login / register / reset-password.
 * Max 10 attempts per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs,
  max             : 10,
  standardHeaders : true,
  legacyHeaders   : false,
  store           : storeFor('auth'),
  message         : { success: false, message: 'Too many authentication attempts. Please try again later.' },
});

/**
 * Admin login limiter - stricter than the regular user auth limiter, keyed
 * additionally by the attempted email (in addition to IP) so a campus-wide
 * shared IP can't mask a targeted brute-force attempt against one admin
 * account, and a distributed attacker can't just rotate IPs to bypass it.
 * Max 5 attempts per 15 minutes per IP+email combination.
 */
const adminAuthLimiter = rateLimit({
  windowMs,
  max             : 5,
  standardHeaders : true,
  legacyHeaders   : false,
  store           : storeFor('admin-auth'),
  keyGenerator    : (req) => {
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    return `${req.ip}:${email}`;
  },
  message: { success: false, message: 'Too many admin login attempts. Please try again later.' },
});

/**
 * Bulk notification limiter - sending a notification blast to many users is
 * expensive and abusable (spam) even by an authenticated admin account.
 * Max 5 bulk sends per hour per admin.
 */
const bulkNotificationLimiter = rateLimit({
  windowMs        : 60 * 60 * 1000,
  max             : 5,
  standardHeaders : true,
  legacyHeaders   : false,
  store           : storeFor('bulk-notification'),
  keyGenerator    : (req) => req.admin?.id || req.ip,
  message         : { success: false, message: 'Too many bulk notification requests. Please try again later.' },
});

/**
 * Geocode search limiter - protects our own /api/geocode proxy from abuse.
 * Doubly important now that the search tier (Mappls, see
 * mappls.utils.js) is a metered API - an open proxy here is a billing
 * risk, not just a load risk.
 * Max 30 lookups per minute per user - generous for typing-driven
 * autocomplete, but not enough to be useful for bulk scraping via our proxy.
 */
const geocodeLimiter = rateLimit({
  windowMs        : 60 * 1000,
  max             : 30,
  standardHeaders : true,
  legacyHeaders   : false,
  store           : storeFor('geocode'),
  keyGenerator    : (req) => req.user?.id || req.ip,
  message         : { success: false, message: 'Too many location searches. Please slow down.' },
});

module.exports = { globalLimiter, otpLimiter, authLimiter, adminAuthLimiter, bulkNotificationLimiter, geocodeLimiter };
