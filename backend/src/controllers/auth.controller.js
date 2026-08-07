const {
  sendOTPService,
  verifyOTPService,
  registerService,
  loginService,
  refreshTokenService,
  logoutService,
  forgotPasswordService,
  resetPasswordService,
} = require('../services/auth.service');
const { sendSuccess } = require('../utils/response.utils');
const {
  USER_COOKIE_NAME, USER_COOKIE_PATH, setRefreshCookie, clearRefreshCookie,
} = require('../utils/cookie.utils');

// Read the refresh token from the httpOnly cookie first (the secure path);
// fall back to the request body only for API/non-browser clients that
// can't hold cookies (e.g. a future mobile app). Never require both.
const readRefreshToken = (req) => req.cookies?.[USER_COOKIE_NAME] || req.body?.refreshToken;

const sendOTP = async (req, res, next) => {
  try {
    const result = await sendOTPService(req.body.email, req.body.name);
    sendSuccess(res, 200, result.message);
  } catch (e) { next(e); }
};

const verifyOTP = async (req, res, next) => {
  try {
    const result = await verifyOTPService(req.body.email, req.body.otp);
    sendSuccess(res, 200, 'OTP verified successfully. You may now complete registration.', result);
  } catch (e) { next(e); }
};

const register = async (req, res, next) => {
  try {
    const registerPayload = {
      ...req.body,
      profilePicFile: req.file,
    };
    const result = await registerService(registerPayload);
    setRefreshCookie(res, USER_COOKIE_NAME, result.refreshToken, result.refreshExpiresAt, USER_COOKIE_PATH);
    const { refreshToken: _rt, refreshExpiresAt: _exp, ...body } = result;
    sendSuccess(res, 201, 'Account created successfully', body);
  } catch (e) { next(e); }
};

const login = async (req, res, next) => {
  try {
    const result = await loginService(req.body.email, req.body.password);
    setRefreshCookie(res, USER_COOKIE_NAME, result.refreshToken, result.refreshExpiresAt, USER_COOKIE_PATH);
    const { refreshToken: _rt, refreshExpiresAt: _exp, ...body } = result;
    sendSuccess(res, 200, 'Login successful', body);
  } catch (e) { next(e); }
};

const refreshToken = async (req, res, next) => {
  try {
    const token = readRefreshToken(req);
    if (!token) return next(Object.assign(new Error('No refresh token provided'), { statusCode: 401 }));

    const tokens = await refreshTokenService(token);
    setRefreshCookie(res, USER_COOKIE_NAME, tokens.refreshToken, tokens.refreshExpiresAt, USER_COOKIE_PATH);
    sendSuccess(res, 200, 'Token refreshed successfully', { accessToken: tokens.accessToken });
  } catch (e) { next(e); }
};

const logout = async (req, res, next) => {
  try {
    const token = readRefreshToken(req);
    const result = await logoutService(token);
    clearRefreshCookie(res, USER_COOKIE_NAME, USER_COOKIE_PATH);
    sendSuccess(res, 200, result.message);
  } catch (e) { next(e); }
};

const forgotPassword = async (req, res, next) => {
  try {
    const result = await forgotPasswordService(req.body.emailOrPhone);
    sendSuccess(res, 200, result.message);
  } catch (e) { next(e); }
};

const resetPassword = async (req, res, next) => {
  try {
    const result = await resetPasswordService(
      req.body.email,
      req.body.otp,
      req.body.newPassword
    );
    sendSuccess(res, 200, result.message);
  } catch (e) { next(e); }
};

const getMe = async (req, res) => {
  sendSuccess(res, 200, 'Profile fetched', { user: req.user });
};

module.exports = {
  sendOTP,
  verifyOTP,
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
};
