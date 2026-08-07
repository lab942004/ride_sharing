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
//     rollNo         : z
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

  rollNo: z
    .string({ required_error: 'Roll number is required' })
    .min(3, 'Roll number must be at least 3 characters')
    .max(20, 'Roll number must not exceed 20 characters')
    .trim()
    .toUpperCase(),

  email: emailField,

  phone: indianPhoneField,

  password: passwordField,
});


/**
 * POST /auth/login
 */
const loginSchema = z.object({
  email   : emailField,
  password: z.string({ required_error: 'Password is required' }),
});

/**
 * POST /auth/refresh
 * The refresh token is normally read from the httpOnly cookie set at
 * login/register time, so the body field is optional (kept only as a
 * fallback for non-browser clients).
 */
const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

/**
 * POST /auth/logout
 */
const logoutSchema = z.object({
  refreshToken: z.string().optional(),
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
