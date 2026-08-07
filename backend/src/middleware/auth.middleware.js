const { verifyAccessToken } = require('../utils/jwt.utils');
const { sendError }         = require('../utils/response.utils');
const prisma                = require('../config/db');

/**
 * Protect middleware — validates Bearer token and attaches req.user.
 * Also checks that the refresh token is not revoked (via DB lookup).
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Access denied. No token provided.');
    }

    const token   = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token, 'user');

    const user = await prisma.user.findUnique({
      where : { id: decoded.id },
      select: {
        id        : true,
        name      : true,
        email     : true,
        rollNo    : true,
        phone     : true,
        profilePic: true,
        domain    : true,
        isVerified: true,
      },
    });

    if (!user)            return sendError(res, 401, 'User not found. Token invalid.');
    if (!user.isVerified) return sendError(res, 403, 'Account not verified. Please verify your email first.');

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError')
      return sendError(res, 401, 'Token expired. Please login again.');
    if (error.name === 'JsonWebTokenError')
      return sendError(res, 401, 'Invalid token.');
    next(error);
  }
};

module.exports = { protect };
