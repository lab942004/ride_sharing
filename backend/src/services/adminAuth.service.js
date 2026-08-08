const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt.utils');

class AdminAuthService {
  async adminLogin(email, password) {
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      // Log failed attempt
      await this._logLoginAttempt(email, false);
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
    }

    if (admin.status === 'SUSPENDED') {
      await this._logLoginAttempt(email, false);
      throw Object.assign(new Error('Account suspended. Contact super admin.'), { statusCode: 403 });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      await this._logLoginAttempt(email, false);
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
    }

    const tokenPayload = { id: admin.id, email: admin.email, role: admin.role };
    const tokens = generateTokenPair(tokenPayload, 'admin');

    // Store refresh token
    await prisma.adminRefreshToken.create({
      data: {
        token: tokens.refreshToken,
        adminId: admin.id,
        expiresAt: tokens.refreshExpiresAt,
      },
    });

    // Log successful login
    await this._logLoginAttempt(email, true);
    await this._logActivity('ADMIN_LOGIN', 'Admin', admin.id, admin, { email: admin.email });

    const { password: _, refreshTokens, ...adminData } = admin;
    return { ...tokens, admin: adminData };
  }

  async adminRefreshToken(refreshToken) {
    const decoded = verifyRefreshToken(refreshToken, 'admin');
    const storedToken = await prisma.adminRefreshToken.findUnique({
      where: { token: refreshToken },
      include: { admin: true },
    });

    if (!storedToken || storedToken.isRevoked || new Date() > storedToken.expiresAt) {
      throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
    }

    if (storedToken.admin.status === 'SUSPENDED') {
      throw Object.assign(new Error('Account suspended'), { statusCode: 403 });
    }

    // Revoke old token
    await prisma.adminRefreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    const tokenPayload = { id: storedToken.admin.id, email: storedToken.admin.email, role: storedToken.admin.role };
    const tokens = generateTokenPair(tokenPayload, 'admin');

    await prisma.adminRefreshToken.create({
      data: {
        token: tokens.refreshToken,
        adminId: storedToken.admin.id,
        expiresAt: tokens.refreshExpiresAt,
      },
    });

    return tokens;
  }

  async adminLogout(refreshToken) {
    // Explicit falsy guard kept intentionally — see note in auth.service.js's
    // logoutService: an undefined `token` filter would match/revoke every
    // admin's sessions if this check were ever removed.
    if (refreshToken) {
      await prisma.adminRefreshToken.updateMany({
        where: { token: refreshToken, isRevoked: false },
        data: { isRevoked: true },
      });
    }
    return { message: 'Logged out successfully' };
  }

  async updateAdminProfile(adminId, data) {
    const updateData = {};
    if (data.name) updateData.name = data.name;
    if (data.phone) updateData.phone = data.phone;
    if (data.profilePic) updateData.profilePic = data.profilePic;

    const admin = await prisma.admin.update({
      where: { id: adminId },
      data: updateData,
    });

    const { password, refreshTokens, ...adminData } = admin;
    return { admin: adminData };
  }

  async changeAdminPassword(adminId, currentPassword, newPassword) {
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw Object.assign(new Error('Admin not found'), { statusCode: 404 });

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.admin.update({
      where: { id: adminId },
      data: { password: hashedPassword },
    });

    // Revoke all refresh tokens
    await prisma.adminRefreshToken.updateMany({
      where: { adminId, isRevoked: false },
      data: { isRevoked: true },
    });

    return { message: 'Password changed successfully. Please login again.' };
  }

  async _logLoginAttempt(email, success) {
    try {
      await prisma.loginAttempt.create({
        data: { email, success },
      });
    } catch (e) {
      console.error('Failed to log login attempt:', e.message);
    }
  }

  async _logActivity(action, entity, entityId, admin, details = {}) {
    try {
      await prisma.activityLog.create({
        data: {
          action,
          entity,
          entityId,
          details,
          adminId: admin.id,
          adminName: admin.name,
          adminRole: admin.role,
        },
      });
    } catch (e) {
      console.error('Failed to log activity:', e.message);
    }
  }
}

module.exports = new AdminAuthService();