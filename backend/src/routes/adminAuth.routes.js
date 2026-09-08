const express = require('express');
const router = express.Router();

const {
  adminLogin,
  adminRefreshToken,
  adminLogout,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
} = require('../controllers/adminAuth.controller');
const { adminProtect } = require('../middleware/adminAuth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { adminAuthLimiter } = require('../middleware/rateLimit.middleware');
const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Invalid email'),

  // SECURITY: bound the length even on admin login — bcrypt is intentionally
  // slow, so without a max an attacker could send gigabyte strings to exhaust
  // CPU. 128 is the same limit enforced everywhere else in the app.
  password: z.string().min(6, 'Password too short').max(128, 'Password must not exceed 128 characters'),
});

const refreshSchema = z.object({
  refreshToken: z.string().max(1000, 'Token is too long').optional(), // primarily read from the httpOnly cookie now
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required').max(128, 'Password must not exceed 128 characters'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  profilePic: z.string().url('profilePic must be a valid URL').max(2048).optional(),
});

// ── Admin Auth Routes ─────────────────────────────────────────────────────
router.post('/login', adminAuthLimiter, validate(loginSchema), adminLogin);
router.post('/refresh', validate(refreshSchema), adminRefreshToken);
router.post('/logout', adminLogout);

// ── Protected Routes ──────────────────────────────────────────────────────
router.get('/profile', adminProtect, getAdminProfile);
router.put('/profile', adminProtect, validate(updateProfileSchema), updateAdminProfile);
router.put('/change-password', adminProtect, validate(changePasswordSchema), changeAdminPassword);

module.exports = router;