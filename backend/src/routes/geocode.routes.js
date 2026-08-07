const express = require('express');
const router  = express.Router();
const { z }   = require('zod');

const { protect }       = require('../middleware/auth.middleware');
const { validate }      = require('../middleware/validate.middleware');
const { geocodeLimiter } = require('../middleware/rateLimit.middleware');
const { mapplsSearch }  = require('../utils/mappls.utils');

/**
 * These routes exist so the FRONTEND never talks to Mappls directly:
 *  1. The Mappls API key must never be exposed to the browser — routing
 *     through the backend keeps it server-side only.
 *  2. It lets us enforce our own rate budget across all users at once,
 *     rather than each browser tab burning through Mappls' metered quota
 *     independently.
 *  3. It lets us rate-limit and require login per our own rules, rather
 *     than exposing an open, unauthenticated proxy to the public internet.
 *
 * Gated behind `protect` — only logged-in users creating/browsing rides
 * need this, and it keeps the proxy from being usable as an anonymous
 * open geocoding relay (which, on a metered API, is also a billing risk).
 */

const searchQuerySchema = z.object({
  q: z.string().trim().min(3, 'Type at least 3 characters').max(200),
  viewbox: z.string().optional(), // minLng,minLat,maxLng,maxLat — biases results around a known location
});

router.get('/search', protect, geocodeLimiter, validate(searchQuerySchema, 'query'), async (req, res, next) => {
  try {
    const results = await mapplsSearch(req.query.q, { viewbox: req.query.viewbox });
    res.json({ success: true, message: 'Locations fetched', data: { results } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;