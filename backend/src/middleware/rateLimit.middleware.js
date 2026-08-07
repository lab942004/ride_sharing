const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000; // 15 min

/**
 * General API rate limiter — applied globally.
 */
const globalLimiter = rateLimit({
  windowMs,
  max             : parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  standardHeaders : true,
  legacyHeaders   : false,
  message         : { success: false, message: 'Too many requests. Please try again later.' },
});

/**
 * Strict limiter for OTP send — max 5 requests per 15 minutes per IP.
 * Prevents OTP spam / enumeration attacks.
 */
const otpLimiter = rateLimit({
  windowMs,
  max             : parseInt(process.env.OTP_RATE_LIMIT_MAX, 10) || 5,
  standardHeaders : true,
  legacyHeaders   : false,
  message         : { success: false, message: 'Too many OTP requests. Please wait before trying again.' },
});

/**
 * Auth limiter — login / register / reset-password.
 * Max 10 attempts per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs,
  max             : 10,
  standardHeaders : true,
  legacyHeaders   : false,
  message         : { success: false, message: 'Too many authentication attempts. Please try again later.' },
});

/**
 * Admin login limiter — stricter than the regular user auth limiter, keyed
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
  keyGenerator    : (req) => {
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    return `${req.ip}:${email}`;
  },
  message: { success: false, message: 'Too many admin login attempts. Please try again later.' },
});

/**
 * Bulk notification limiter — sending a notification blast to many users is
 * expensive and abusable (spam) even by an authenticated admin account.
 * Max 5 bulk sends per hour per admin.
 */
const bulkNotificationLimiter = rateLimit({
  windowMs        : 60 * 60 * 1000,
  max             : 5,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) => req.admin?.id || req.ip,
  message         : { success: false, message: 'Too many bulk notification requests. Please try again later.' },
});

/**
 * Geocode search limiter — protects our own /api/geocode proxy from abuse.
 * Doubly important now that the search tier (Mappls, see
 * mappls.utils.js) is a metered API — an open proxy here is a billing
 * risk, not just a load risk.
 * Max 30 lookups per minute per user — generous for typing-driven
 * autocomplete, but not enough to be useful for bulk scraping via our proxy.
 */
const geocodeLimiter = rateLimit({
  windowMs        : 60 * 1000,
  max             : 30,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) => req.user?.id || req.ip,
  message         : { success: false, message: 'Too many location searches. Please slow down.' },
});

module.exports = { globalLimiter, otpLimiter, authLimiter, adminAuthLimiter, bulkNotificationLimiter, geocodeLimiter };
