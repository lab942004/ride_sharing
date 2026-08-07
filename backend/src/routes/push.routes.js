const express = require('express');
const router  = express.Router();
const { z }   = require('zod');

const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  subscribeHandler,
  unsubscribeHandler,
  vapidKeyHandler,
} = require('../controllers/push.controller');

const subscribeSchema = z.object({
  endpoint: z.string().url('Invalid endpoint'),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh is required'),
    auth: z.string().min(1, 'auth is required'),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url('Invalid endpoint'),
});

router.use(protect);

router.post('/subscribe',   validate(subscribeSchema),   subscribeHandler);
router.post('/unsubscribe', validate(unsubscribeSchema), unsubscribeHandler);
router.get('/vapid-key',    vapidKeyHandler);

module.exports = router;