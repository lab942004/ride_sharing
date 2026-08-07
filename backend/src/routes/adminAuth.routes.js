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
  password: z.string().min(6, 'Password too short'),
});

const refreshSchema = z.object({
  refreshToken: z.string().optional(), // primarily read from the httpOnly cookie now
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
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