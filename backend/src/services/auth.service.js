const bcrypt = require('bcryptjs');
const prisma  = require('../config/db');

const { generateOTP, getOTPExpiry, isOTPExpired }  = require('../utils/otp.utils');
const { generateTokenPair, verifyRefreshToken }     = require('../utils/jwt.utils');
const { extractDomain, isAllowedDomain }            = require('../utils/domain.utils');
const { sendOTPEmail }                              = require('./email.service');
const { uploadImage }                              = require('../utils/cloudinary.utils');
const { BCRYPT_ROUNDS, VERIFIED_EMAIL_EXPIRY_MIN }  = require('../config/constants');

// ─── Helper: throw an AppError ────────────────────────────────────────────────
const appError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

// ─── Send OTP ─────────────────────────────────────────────────────────────────
/**
 * Validate domain → delete old OTPs → create new OTP → send email.
 * `purpose` is shown in the email subject ('email verification' | 'password reset').
 */
const sendOTPService = async (email, name, purpose = 'email verification') => {
  if (!(await isAllowedDomain(email))) {
    throw appError('This email domain is not allowed to register. Please use your college email address.', 400);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw appError('This email is already registered. Please login or use a different email.', 409);
  }

  // Remove any pending OTPs for this email to enforce one-at-a-time
  await prisma.oTP.deleteMany({ where: { email } });

  const otp       = generateOTP();
  const expiresAt = getOTPExpiry(5); // 5 minutes

  await prisma.oTP.create({ data: { email, otp, expiresAt } });

  // Fire-and-forget — don't block the response
  sendOTPEmail(email, name || 'Student', otp, purpose).catch((err) =>
    console.error('❌ OTP email send failed:', err.message)
  );

  return { message: 'OTP sent successfully. Please check your college email.' };
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────
/**
 * Verify OTP → delete it → create VerifiedEmail proof record.
 * The VerifiedEmail row has a 30-minute window for the user to complete registration.
 */
const verifyOTPService = async (email, otp) => {
  const record = await prisma.oTP.findFirst({
    where  : { email },
    orderBy: { createdAt: 'desc' },
  });

  if (!record)                throw appError('No OTP found for this email. Please request a new one.', 400);
  if (isOTPExpired(record.expiresAt)) {
    await prisma.oTP.delete({ where: { id: record.id } });
    throw appError('OTP has expired. Please request a new one.', 400);
  }
  if (record.otp !== otp)    throw appError('Invalid OTP. Please try again.', 400);

  // Delete the OTP — single use
  await prisma.oTP.delete({ where: { id: record.id } });

  // Upsert a VerifiedEmail proof record (overwrite if already exists)
  await prisma.verifiedEmail.upsert({
    where : { email },
    create: { email, expiresAt: getOTPExpiry(VERIFIED_EMAIL_EXPIRY_MIN) },
    update: { verifiedAt: new Date(), expiresAt: getOTPExpiry(VERIFIED_EMAIL_EXPIRY_MIN) },
  });

  return { verified: true };
};

// ─── Register ─────────────────────────────────────────────────────────────────
/**
 * Register enforces that a VerifiedEmail row exists and is not expired.
 * This prevents anyone calling /register without first going through /verify-otp.
 */
const registerService = async ({ name, rollNo, email, phone, password, profilePicFile }) => {
  // Re-check the domain here too (not just at send-otp time) — a domain may
  // have been deactivated by an admin in between OTP verification and
  // registration completing.
  if (!(await isAllowedDomain(email))) {
    throw appError('This email domain is no longer allowed to register.', 400);
  }

  // ── Proof-of-OTP check ─────────────────────────────────────────────────────
  const proof = await prisma.verifiedEmail.findUnique({ where: { email } });
  if (!proof) {
    throw appError(
      'Email not verified. Please verify your email with OTP before registering.',
      400
    );
  }
  if (new Date() > proof.expiresAt) {
    await prisma.verifiedEmail.delete({ where: { email } });
    throw appError(
      'Email verification has expired. Please start the registration process again.',
      400
    );
  }

  // ── Duplicate check ───────────────────────────────────────────────────────
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { rollNo }] },
  });
  if (existing) {
    const field = existing.email === email ? 'Email' : 'Roll number';
    throw appError(`${field} is already registered`, 409);
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const domain         = extractDomain(email);
  const profilePicUrl  = profilePicFile ? (await uploadImage(profilePicFile)).secure_url : null;

  // ── Create user + tokens in a transaction ─────────────────────────────────
  const { user, tokens } = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data  : {
        name,
        rollNo,
        email,
        phone: phone || null,
        password: hashedPassword,
        profilePic: profilePicUrl,
        domain,
        isVerified: true,
      },
      select: { id: true, name: true, email: true, rollNo: true, domain: true, phone: true, profilePic: true },
    });

    const tokens = generateTokenPair({ id: newUser.id, email: newUser.email, domain: newUser.domain });

    // Store refresh token in DB for revocation support
    await tx.refreshToken.create({
      data: { token: tokens.refreshToken, userId: newUser.id, expiresAt: tokens.refreshExpiresAt },
    });

    // Consume the VerifiedEmail proof
    await tx.verifiedEmail.delete({ where: { email } });

    return { user: newUser, tokens };
  });

  return { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, refreshExpiresAt: tokens.refreshExpiresAt };
};

// ─── Login ────────────────────────────────────────────────────────────────────
const loginService = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user)            throw appError('Invalid email or password', 401);
  if (!user.isVerified) throw appError('Please verify your email first', 403);
  if (user.isBanned)    throw appError('Your account has been banned. Contact support.', 403);
  if (user.isSuspended) throw appError('Your account has been suspended. Contact support.', 403);

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw appError('Invalid email or password', 401);

  const tokens = generateTokenPair({ id: user.id, email: user.email, domain: user.domain });

  // Store refresh token for revocation
  await prisma.refreshToken.create({
    data: { token: tokens.refreshToken, userId: user.id, expiresAt: tokens.refreshExpiresAt },
  });

  const safeUser = {
    id        : user.id,
    name      : user.name,
    email     : user.email,
    rollNo    : user.rollNo,
    phone     : user.phone,
    profilePic: user.profilePic || null,
    domain    : user.domain,
  };
  return { user: safeUser, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, refreshExpiresAt: tokens.refreshExpiresAt };
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
const refreshTokenService = async (refreshToken) => {
  // Verify JWT signature first
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw appError('Invalid or expired refresh token', 401);
  }

  // Check DB — token must exist, not revoked, and not expired
  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.isRevoked || new Date() > stored.expiresAt) {
    throw appError('Refresh token is invalid or has been revoked. Please login again.', 401);
  }

  const user = await prisma.user.findUnique({
    where : { id: decoded.id },
    select: { id: true, email: true, domain: true, isVerified: true, isBanned: true, isSuspended: true },
  });
  if (!user || !user.isVerified) throw appError('User not found', 401);
  if (user.isBanned || user.isSuspended) throw appError('Your account is no longer active. Please contact support.', 403);

  // Rotate refresh token: revoke old, issue new
  const newTokens = generateTokenPair({ id: user.id, email: user.email, domain: user.domain });

  await prisma.$transaction([
    prisma.refreshToken.update({ where: { token: refreshToken }, data: { isRevoked: true } }),
    prisma.refreshToken.create({
      data: { token: newTokens.refreshToken, userId: user.id, expiresAt: newTokens.refreshExpiresAt },
    }),
  ]);

  return { accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken, refreshExpiresAt: newTokens.refreshExpiresAt };
};

// ─── Logout ───────────────────────────────────────────────────────────────────
const logoutService = async (refreshToken) => {
  // IMPORTANT: guard against `refreshToken` being undefined — passing
  // `{ where: { token: undefined } }` to Prisma is treated as "no filter"
  // and would revoke EVERY user's refresh tokens. Silently succeed
  // (idempotent) if there's nothing to revoke.
  if (!refreshToken) return { message: 'Logged out successfully' };

  await prisma.refreshToken.updateMany({
    where: { token: refreshToken },
    data : { isRevoked: true },
  });
  return { message: 'Logged out successfully' };
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
const forgotPasswordService = async (emailOrPhone) => {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: emailOrPhone }, { phone: emailOrPhone }] },
  });

  // Always return the same message to prevent user enumeration
  if (!user) return { message: 'If this account exists, a reset OTP has been sent to the registered email.' };

  await prisma.oTP.deleteMany({ where: { email: user.email } });

  const otp       = generateOTP();
  const expiresAt = getOTPExpiry(5);
  await prisma.oTP.create({ data: { email: user.email, otp, expiresAt } });

  sendOTPEmail(user.email, user.name, otp, 'password reset').catch((err) =>
    console.error('❌ Forgot-password email failed:', err.message)
  );

  return { message: 'If this account exists, a reset OTP has been sent to the registered email.' };
};

// ─── Reset Password ───────────────────────────────────────────────────────────
const resetPasswordService = async (email, otp, newPassword) => {
  // Reuse OTP verify — this deletes the OTP row but does NOT create a VerifiedEmail
  const record = await prisma.oTP.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } });
  if (!record)                throw appError('No OTP found for this email.', 400);
  if (isOTPExpired(record.expiresAt)) {
    await prisma.oTP.delete({ where: { id: record.id } });
    throw appError('OTP has expired. Please request a new one.', 400);
  }
  if (record.otp !== otp)    throw appError('Invalid OTP.', 400);

  await prisma.oTP.delete({ where: { id: record.id } });

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { email }, data: { password: hashedPassword } });

  // Revoke all refresh tokens for this user (force re-login)
  await prisma.refreshToken.updateMany({
    where: { user: { email } },
    data : { isRevoked: true },
  });

  return { message: 'Password reset successfully. Please login with your new password.' };
};

module.exports = {
  sendOTPService,
  verifyOTPService,
  registerService,
  loginService,
  refreshTokenService,
  logoutService,
  forgotPasswordService,
  resetPasswordService,
};
