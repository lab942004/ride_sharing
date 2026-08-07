const adminAuthService = require('../services/adminAuth.service');
const { sendSuccess } = require('../utils/response.utils');
const {
  ADMIN_COOKIE_NAME, ADMIN_COOKIE_PATH, setRefreshCookie, clearRefreshCookie,
} = require('../utils/cookie.utils');

const readRefreshToken = (req) => req.cookies?.[ADMIN_COOKIE_NAME] || req.body?.refreshToken;

const adminLogin = async (req, res, next) => {
  try {
    const result = await adminAuthService.adminLogin(req.body.email, req.body.password);
    setRefreshCookie(res, ADMIN_COOKIE_NAME, result.refreshToken, result.refreshExpiresAt, ADMIN_COOKIE_PATH);
    const { refreshToken: _rt, refreshExpiresAt: _exp, ...body } = result;
    sendSuccess(res, 200, 'Admin login successful', body);
  } catch (e) { next(e); }
};

const adminRefreshToken = async (req, res, next) => {
  try {
    const token = readRefreshToken(req);
    if (!token) return next(Object.assign(new Error('No refresh token provided'), { statusCode: 401 }));

    const tokens = await adminAuthService.adminRefreshToken(token);
    setRefreshCookie(res, ADMIN_COOKIE_NAME, tokens.refreshToken, tokens.refreshExpiresAt, ADMIN_COOKIE_PATH);
    sendSuccess(res, 200, 'Token refreshed successfully', { accessToken: tokens.accessToken });
  } catch (e) { next(e); }
};

const adminLogout = async (req, res, next) => {
  try {
    const token = readRefreshToken(req);
    const result = await adminAuthService.adminLogout(token);
    clearRefreshCookie(res, ADMIN_COOKIE_NAME, ADMIN_COOKIE_PATH);
    sendSuccess(res, 200, result.message);
  } catch (e) { next(e); }
};

const getAdminProfile = async (req, res) => {
  const { password, refreshTokens, ...adminData } = req.admin;
  sendSuccess(res, 200, 'Admin profile fetched', { admin: adminData });
};

const updateAdminProfile = async (req, res, next) => {
  try {
    const result = await adminAuthService.updateAdminProfile(req.admin.id, req.body);
    sendSuccess(res, 200, 'Profile updated successfully', result);
  } catch (e) { next(e); }
};

const changeAdminPassword = async (req, res, next) => {
  try {
    const result = await adminAuthService.changeAdminPassword(
      req.admin.id,
      req.body.currentPassword,
      req.body.newPassword
    );
    sendSuccess(res, 200, result.message);
  } catch (e) { next(e); }
};

module.exports = {
  adminLogin,
  adminRefreshToken,
  adminLogout,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
};