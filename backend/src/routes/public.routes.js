const express = require('express');
const router  = express.Router();
const { getActiveDomains } = require('../utils/domain.utils');

/**
 * GET /api/domains
 * Public, read-only endpoint returning the list of currently active
 * (Super-Admin-managed) allowed email domains. Used by the frontend to show
 * accurate signup hints ("Only @xyz.edu emails are allowed") without
 * hardcoding domains client-side. This is NOT the security boundary —
 * the backend still independently re-validates the domain on every
 * send-otp/register call — it's purely for UX.
 */
router.get('/', async (_req, res, next) => {
  try {
    const domains = await getActiveDomains();
    res.json({ success: true, message: 'Active domains fetched', data: { domains } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
