const { z } = require('zod');

// ─── Reusable base fields ─────────────────────────────────────────────────────
const emailField = z
  .string({ required_error: 'Email is required' })
  .email('Please provide a valid email address')
  .toLowerCase()
  .trim();

const passwordField = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  );

const otpField = z
  .string({ required_error: 'OTP is required' })
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^\d+$/, 'OTP must contain only numbers');

const indianPhoneField = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian phone number')
  .optional();

// ─── Schemas ──────────────────────────────────────────────────────────────────

/**
 * POST /auth/send-otp
 */
// const sendOTPSchema = z.object({
//   email: emailField,
//   name : z
//     .string({ required_error: 'Name is required' })
//     .min(2, 'Name must be at least 2 characters')
//     .max(50, 'Name must not exceed 50 characters')
//     .trim(),
// });

const sendOTPSchema = z.object({
  email: emailField,
  // Which signup branch the user chose. The backend independently re-derives
  // the effective account type from the email domain at register time.
  accountType: z.enum(['organization', 'general']).default('general'),
});


/**
 * POST /auth/verify-otp
 */
const verifyOTPSchema = z.object({
  email: emailField,
  otp  : otpField,
});

/**
 * POST /auth/register
 * Note: OTP must have been verified first (enforced in service layer via VerifiedEmail table).
 */
// const registerSchema = z
//   .object({
//     name           : z.string({ required_error: 'Name is required' }).min(2).max(50).trim(),
//     identifier         : z
//       .string({ required_error: 'Roll number is required' })
//       .min(3, 'Roll number must be at least 3 characters')
//       .max(20, 'Roll number must not exceed 20 characters')
//       .trim()
//       .toUpperCase(),
//     email          : emailField,
//     phone          : indianPhoneField,
//     password       : passwordField,
//     confirmPassword: z.string({ required_error: 'Please confirm your password' }),
//   })
//   .refine((data) => data.password === data.confirmPassword, {
//     message: 'Passwords do not match',
//     path   : ['confirmPassword'],
//   });


const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(2)
    .max(50)
    .trim(),

  // Roll number / employee ID. Required for organization accounts; optional
  // for general accounts (gmail.com users never send one — the server
  // generates an immutable sequence number instead, ignoring any client value).
  identifier: z
    .string()
    .min(3, 'ID must be at least 3 characters')
    .max(20, 'ID must not exceed 20 characters')
    .trim()
    .optional(),

  email: emailField,

  phone: indianPhoneField,

  password: passwordField,

  accountType: z.enum(['organization', 'general']).default('general'),
});


/**
 * POST /auth/login
 */
const loginSchema = z.object({
  email   : emailField,
  password: z
    .string({ required_error: 'Password is required' })
    // Max length matters even on LOGIN: bcrypt is intentionally slow, and
    // without an upper bound an attacker could flood the endpoint with
    // huge "passwords" to exhaust CPU (bcrypt DoS). 128 chars is the same
    // bound we enforce at registration.
    .min(1)
    .max(128, 'Password must not exceed 128 characters'),
});

/**
 * POST /auth/refresh
 * The refresh token is normally read from the httpOnly cookie set at
 * login/register time, so the body field is optional (kept only as a
 * fallback for non-browser clients).
 */
// Refresh/JWT tokens are compact (~200-400 chars); a much larger value is a
// signal of garbage/malicious input, so cap it to keep JWT verification cheap.
const optionalTokenField = z.string().max(1000, 'Token is too long').optional();

const refreshTokenSchema = z.object({
  refreshToken: optionalTokenField,
});

/**
 * POST /auth/logout
 */
const logoutSchema = z.object({
  refreshToken: optionalTokenField,
});

/**
 * POST /auth/forgot-password
 */
const forgotPasswordSchema = z.object({
  emailOrPhone: z.union(
    [
      z.string().email('Please provide a valid email'),
      z.string().regex(/^[6-9]\d{9}$/, 'Please provide a valid phone number'),
    ],
    { required_error: 'Email or phone number is required' }
  ),
});

/**
 * POST /auth/reset-password
 */
const resetPasswordSchema = z
  .object({
    email          : emailField,
    otp            : otpField,
    newPassword    : passwordField,
    // confirmPassword: z.string({ required_error: 'Please confirm your new password' }),
  })
  // .refine((data) => data.newPassword === data.confirmPassword, {
  //   message: 'Passwords do not match',
  //   path   : ['confirmPassword'],
  // });

module.exports = {
  sendOTPSchema,
  verifyOTPSchema,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
