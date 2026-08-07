const { verifyAccessToken } = require('../utils/jwt.utils');
const { sendError } = require('../utils/response.utils');
const prisma = require('../config/db');

/**
 * Admin/Super Admin authentication middleware
 * Validates Bearer token and attaches req.admin with full details
 */
const adminProtect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Access denied. No token provided.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token, 'admin');

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
      include: { refreshTokens: true },
    });

    if (!admin) return sendError(res, 401, 'Admin not found. Token invalid.');
    if (admin.status === 'SUSPENDED') return sendError(res, 403, 'Account suspended. Contact super admin.');

    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError')
      return sendError(res, 401, 'Token expired. Please login again.');
    if (error.name === 'JsonWebTokenError')
      return sendError(res, 401, 'Invalid token.');
    next(error);
  }
};

/**
 * Restrict to specific roles
 * Usage: restrictTo('SUPER_ADMIN') or restrictTo('ADMIN', 'SUPER_ADMIN')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return sendError(res, 403, 'You do not have permission to perform this action.');
    }
    next();
  };
};

/**
 * NOTE ON DOMAIN SCOPING:
 * Non-super-admin domain scoping is enforced explicitly inside each method
 * of `admin.service.js` (every read/write compares `admin.domain` against
 * the target record's domain before proceeding). There is deliberately no
 * generic "scopeToDomain" middleware here anymore — a previous version had
 * one defined but never wired into any route, which was misleading (it
 * looked like scoping was centrally enforced when it wasn't). If you add a
 * new admin-facing resource, you MUST add the domain check inside its
 * service method — see e.g. `getUserById`/`suspendUser` for the pattern.
 */

module.exports = { adminProtect, restrictTo };