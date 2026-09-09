const bcrypt = require('bcryptjs');
const prisma  = require('../config/db');

const { generateOTP, getOTPExpiry, isOTPExpired }  = require('../utils/otp.utils');
const { generateTokenPair, verifyRefreshToken }     = require('../utils/jwt.utils');
const {
  GMAIL_DOMAIN, extractDomain, isGmailEmail, isAllowedDomain,
  findDomainRecord, upsertPendingDomain,
} = require('../utils/domain.utils');
const { sendOTPEmail, sendDomainRequestEmail }      = require('./email.service');
const { uploadImage }                              = require('../utils/cloudinary.utils');
const { BCRYPT_ROUNDS, VERIFIED_EMAIL_EXPIRY_MIN }  = require('../config/constants');

// ─── Helper: throw an AppError ────────────────────────────────────────────────
const appError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

// ─── Send OTP ─────────────────────────────────────────────────────────────────
/**
 * Multi-organization signup gate:
 * - gmail.com is ALWAYS allowed (general-user exception), and
 * - the "general" account branch is allowed from any provider, and
 * - the "organization" branch requires an ACTIVE domain in the Domain table.
 *   If the domain isn't registered yet, we upsert a PENDING Domain record,
 *   email the site admin to review it, and return a structured 422 error the
 *   frontend can render as the "available within 1 day / contact admin" notice.
 *
 * `purpose` is shown in the email subject ('email verification' | 'password reset').
 */
const sendOTPService = async (email, name, purpose = 'email verification', accountType = 'general') => {
  if (!(await isAllowedDomain(email))) {
    // Not gmail and not an active organization domain → handle per branch.
    const domain = extractDomain(email);
    if (accountType === 'organization' && domain) {
      // Track the request (creates PENDING record or refreshes requestedAt)
      await upsertPendingDomain(domain);
      // Notify the site admin for every rejected signup attempt.
      sendDomainRequestEmail(domain, email).catch((err) =>
        console.error('❌ Domain request email failed:', err.message)
      );
      throw Object.assign(
        new Error(
          `We don't have ${domain} registered yet. It will typically be available within 1 day. ` +
          `Need it sooner? Contact the admin at the email in the footer.`
        ),
        { statusCode: 422, code: 'DOMAIN_NOT_REGISTERED', domain }
      );
    }
    throw appError('This email domain is not allowed to register. Please use a supported email address.', 400);
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
  sendOTPEmail(email, name || 'there', otp, purpose).catch((err) =>
    console.error('❌ OTP email send failed:', err.message)
  );

  return { message: 'OTP sent successfully. Please check your email.' };
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

  // Tell the frontend which profile form to render: gmail.com users get an
  // auto-generated immutable sequence number instead of a roll/employee ID.
  const isGmail = extractDomain(email) === GMAIL_DOMAIN;
  return { verified: true, isGmail };
};

// ─── Register ─────────────────────────────────────────────────────────────────
/**
 * Register enforces that a VerifiedEmail row exists and is not expired.
 * This prevents anyone calling /register without first going through /verify-otp.
 *
 * Multi-org: users register with `accountType` (organization | general).
 * gmail.com users get an auto-generated, immutable sequence number as their
 * identifier (computed atomically server-side). Other users provide a
 * roll/employee ID.
 */
const registerService = async ({ name, identifier, email, phone, password, profilePicFile, accountType = 'general' }) => {
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

  // ── Resolve identifier + account type ──────────────────────────────────────
  const domain = extractDomain(email);
  const isGmail = domain === GMAIL_DOMAIN;

  // The org/general split follows the email domain, not just the client's
  // chosen branch — gmail users are ALWAYS general (sequence number).
  const resolvedAccountType = isGmail
    ? 'general'
    : accountType === 'organization' ? 'organization' : 'general';

  let identifierValue;
  let identifierType;

  if (isGmail) {
    // gmail.com: server-generated immutable sequence number, client value ignored.
    identifierType = 'SEQUENCE';
    identifierValue = null; // computed inside the transaction below
  } else if (resolvedAccountType === 'organization') {
    // Organization branch — identifier required, domain already re-checked.
    if (!identifier || !identifier.trim()) {
      throw appError('Roll number / Employee ID is required for organization accounts.', 400);
    }
    identifierType = 'ROLL_OR_EMP_ID';
    identifierValue = identifier.trim();
  } else if (identifier && identifier.trim()) {
    // General branch (non-gmail) with a provided ID.
    identifierType = 'ROLL_OR_EMP_ID';
    identifierValue = identifier.trim();
  } else {
    // General branch (non-gmail) without an ID → server-generated sequence.
    identifierType = 'SEQUENCE';
    identifierValue = null; // computed inside the transaction below
  }

  // ── Duplicate email check (identifier uniqueness enforced by unique index) ─
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw appError('Email is already registered', 409);
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const profilePicUrl  = profilePicFile ? (await uploadImage(profilePicFile)).secure_url : null;

  // ── Create user + tokens in a transaction ─────────────────────────────────
  const { user, tokens } = await prisma.$transaction(async (tx) => {
    let finalIdentifier = identifierValue;

    // Atomic sequence generation for SEQUENCE-type identifiers (gmail.com and
    // non-gmail general users without an ID): count of existing users under
    // this domain + 10000, computed INSIDE the transaction so concurrent
    // signups can't get the same number under normal operation. The unique
    // constraint on `identifier` is the final backstop against races.
    if (finalIdentifier === null) {
      const count = await tx.user.count({ where: { domain } });
      finalIdentifier = String(count + 10000);
      // Guard against collisions from past deletions shifting the count.
      let collision = await tx.user.findUnique({ where: { identifier: finalIdentifier } });
      while (collision) {
        finalIdentifier = String(BigInt(finalIdentifier) + 1n);
        collision = await tx.user.findUnique({ where: { identifier: finalIdentifier } });
      }
    }

    const newUser = await tx.user.create({
      data  : {
        name,
        identifier      : finalIdentifier,
        identifierType,
        accountType     : resolvedAccountType === 'organization' ? 'ORGANIZATION' : 'GENERAL',
        email,
        phone: phone || null,
        password: hashedPassword,
        profilePic: profilePicUrl,
        domain,
        isVerified: true,
      },
      select: { id: true, name: true, email: true, identifier: true, identifierType: true, accountType: true, domain: true, phone: true, profilePic: true },
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
    id             : user.id,
    name           : user.name,
    email          : user.email,
    identifier     : user.identifier,
    identifierType : user.identifierType,
    accountType    : user.accountType,
    phone          : user.phone,
    profilePic     : user.profilePic || null,
    domain         : user.domain,
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
  if (!stored) {
    throw appError('Refresh token is invalid. Please login again.', 401);
  }

  // SECURITY (replay attack): a token that exists but is already revoked was
  // presented TWICE. That is the signature of a stolen refresh token being
  // replayed after a legitimate rotation — the attacker kept a copy. In that
  // case we revoke ALL of the user's remaining sessions (force full re-login)
  // instead of just rejecting this one, so the attacker can't keep minting
  // tokens from other stolen sessions.
  if (stored.isRevoked) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, isRevoked: false },
      data : { isRevoked: true },
    });
    throw appError('Session detected as compromised. Please login again.', 401);
  }

  if (new Date() > stored.expiresAt) {
    throw appError('Refresh token has expired. Please login again.', 401);
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
