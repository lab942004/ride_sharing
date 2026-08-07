const adminService = require('../services/admin.service');
const { sendSuccess } = require('../utils/response.utils');

// ─── Dashboard ──────────────────────────────────────────────────────────────
const getAdminDashboard = async (req, res, next) => {
  try {
    const data = await adminService.getAdminDashboard(req.admin);
    sendSuccess(res, 200, 'Dashboard data fetched', data);
  } catch (e) { next(e); }
};

// ─── Domain Management (Super Admin only) ──────────────────────────────────
const getDomains = async (req, res, next) => {
  try {
    const data = await adminService.getDomains();
    sendSuccess(res, 200, 'Domains fetched', data);
  } catch (e) { next(e); }
};

const createDomain = async (req, res, next) => {
  try {
    const data = await adminService.createDomain(req.body);
    sendSuccess(res, 201, 'Domain created successfully', data);
  } catch (e) { next(e); }
};

const updateDomain = async (req, res, next) => {
  try {
    const data = await adminService.updateDomain(req.params.id, req.body);
    sendSuccess(res, 200, 'Domain updated successfully', data);
  } catch (e) { next(e); }
};

const deleteDomain = async (req, res, next) => {
  try {
    await adminService.deleteDomain(req.params.id);
    sendSuccess(res, 200, 'Domain deleted successfully');
  } catch (e) { next(e); }
};

// ─── Admin Management (Super Admin only) ───────────────────────────────────
const getAdmins = async (req, res, next) => {
  try {
    const data = await adminService.getAdmins(req.query);
    sendSuccess(res, 200, 'Admins fetched', data);
  } catch (e) { next(e); }
};

const createAdmin = async (req, res, next) => {
  try {
    const data = await adminService.createAdmin(req.body, req.admin);
    sendSuccess(res, 201, 'Admin created successfully', data);
  } catch (e) { next(e); }
};

const updateAdmin = async (req, res, next) => {
  try {
    const data = await adminService.updateAdmin(req.params.id, req.body, req.admin);
    sendSuccess(res, 200, 'Admin updated successfully', data);
  } catch (e) { next(e); }
};

const deleteAdmin = async (req, res, next) => {
  try {
    await adminService.deleteAdmin(req.params.id, req.admin);
    sendSuccess(res, 200, 'Admin deleted successfully');
  } catch (e) { next(e); }
};

const suspendAdmin = async (req, res, next) => {
  try {
    const data = await adminService.suspendAdmin(req.params.id, req.admin);
    sendSuccess(res, 200, 'Admin suspended successfully', data);
  } catch (e) { next(e); }
};

const activateAdmin = async (req, res, next) => {
  try {
    const data = await adminService.activateAdmin(req.params.id, req.admin);
    sendSuccess(res, 200, 'Admin activated successfully', data);
  } catch (e) { next(e); }
};

const resetAdminPassword = async (req, res, next) => {
  try {
    const data = await adminService.resetAdminPassword(req.params.id, req.admin, req.body.newPassword);
    sendSuccess(res, 200, 'Password reset successful', data);
  } catch (e) { next(e); }
};

// ─── User Management ───────────────────────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const data = await adminService.getUsers(req.query, req.admin);
    sendSuccess(res, 200, 'Users fetched', data);
  } catch (e) { next(e); }
};

const createUser = async (req, res, next) => {
  try {
    const data = await adminService.createUser(req.body, req.admin);
    sendSuccess(res, 201, 'User created successfully', data);
  } catch (e) { next(e); }
};

const getUserById = async (req, res, next) => {
  try {
    const data = await adminService.getUserById(req.params.id, req.admin);
    sendSuccess(res, 200, 'User fetched', data);
  } catch (e) { next(e); }
};

const suspendUser = async (req, res, next) => {
  try {
    const data = await adminService.suspendUser(req.params.id, req.admin);
    sendSuccess(res, 200, 'User suspended', data);
  } catch (e) { next(e); }
};

const activateUser = async (req, res, next) => {
  try {
    const data = await adminService.activateUser(req.params.id, req.admin);
    sendSuccess(res, 200, 'User activated', data);
  } catch (e) { next(e); }
};

const banUser = async (req, res, next) => {
  try {
    const data = await adminService.banUser(req.params.id, req.admin);
    sendSuccess(res, 200, 'User banned', data);
  } catch (e) { next(e); }
};

const verifyUser = async (req, res, next) => {
  try {
    const data = await adminService.verifyUser(req.params.id, req.admin);
    sendSuccess(res, 200, 'User verified', data);
  } catch (e) { next(e); }
};

const resetUserPassword = async (req, res, next) => {
  try {
    const data = await adminService.resetUserPassword(req.params.id, req.admin);
    sendSuccess(res, 200, 'Password reset successful', data);
  } catch (e) { next(e); }
};

// ─── Ride Management ───────────────────────────────────────────────────────
const getRides = async (req, res, next) => {
  try {
    const data = await adminService.getRides(req.query, req.admin);
    sendSuccess(res, 200, 'Rides fetched', data);
  } catch (e) { next(e); }
};

const getRideById = async (req, res, next) => {
  try {
    const data = await adminService.getRideById(req.params.id, req.admin);
    sendSuccess(res, 200, 'Ride fetched', data);
  } catch (e) { next(e); }
};

const deleteRide = async (req, res, next) => {
  try {
    await adminService.deleteRide(req.params.id, req.admin);
    sendSuccess(res, 200, 'Ride deleted');
  } catch (e) { next(e); }
};

const cancelRide = async (req, res, next) => {
  try {
    const data = await adminService.cancelRide(req.params.id, req.admin);
    sendSuccess(res, 200, 'Ride cancelled', data);
  } catch (e) { next(e); }
};

const completeRide = async (req, res, next) => {
  try {
    const data = await adminService.completeRide(req.params.id, req.admin);
    sendSuccess(res, 200, 'Ride completed', data);
  } catch (e) { next(e); }
};

// ─── Request Management ────────────────────────────────────────────────────
const getRequests = async (req, res, next) => {
  try {
    const data = await adminService.getRequests(req.query, req.admin);
    sendSuccess(res, 200, 'Requests fetched', data);
  } catch (e) { next(e); }
};

const approveRequest = async (req, res, next) => {
  try {
    const data = await adminService.approveRequest(req.params.id, req.admin);
    sendSuccess(res, 200, 'Request approved', data);
  } catch (e) { next(e); }
};

const rejectRequest = async (req, res, next) => {
  try {
    const data = await adminService.rejectRequest(req.params.id, req.admin);
    sendSuccess(res, 200, 'Request rejected', data);
  } catch (e) { next(e); }
};

const cancelRequest = async (req, res, next) => {
  try {
    const data = await adminService.cancelRequest(req.params.id, req.admin);
    sendSuccess(res, 200, 'Request cancelled', data);
  } catch (e) { next(e); }
};

// ─── Chat Management ───────────────────────────────────────────────────────
const getChats = async (req, res, next) => {
  try {
    const data = await adminService.getChats(req.query, req.admin);
    sendSuccess(res, 200, 'Chats fetched', data);
  } catch (e) { next(e); }
};

const getChatMessages = async (req, res, next) => {
  try {
    const data = await adminService.getChatMessages(req.params.id, req.admin);
    sendSuccess(res, 200, 'Messages fetched', data);
  } catch (e) { next(e); }
};

const deleteMessage = async (req, res, next) => {
  try {
    await adminService.deleteMessage(req.params.id, req.admin);
    sendSuccess(res, 200, 'Message deleted');
  } catch (e) { next(e); }
};

const deleteConversation = async (req, res, next) => {
  try {
    await adminService.deleteConversation(req.params.id, req.admin);
    sendSuccess(res, 200, 'Conversation deleted');
  } catch (e) { next(e); }
};

const muteUser = async (req, res, next) => {
  try {
    const data = await adminService.muteUser(req.params.id, req.admin);
    sendSuccess(res, 200, 'User muted', data);
  } catch (e) { next(e); }
};

const unmuteUser = async (req, res, next) => {
  try {
    const data = await adminService.unmuteUser(req.params.id, req.admin);
    sendSuccess(res, 200, 'User unmuted', data);
  } catch (e) { next(e); }
};

const blockUser = async (req, res, next) => {
  try {
    const data = await adminService.blockUser(req.params.id, req.admin);
    sendSuccess(res, 200, 'User blocked', data);
  } catch (e) { next(e); }
};

// ─── Announcements / Notifications ─────────────────────────────────────────
const getAnnouncements = async (req, res, next) => {
  try {
    const data = await adminService.getAnnouncements(req.query, req.admin);
    sendSuccess(res, 200, 'Announcements fetched', data);
  } catch (e) { next(e); }
};

const createAnnouncement = async (req, res, next) => {
  try {
    const data = await adminService.createAnnouncement(req.body, req.admin);
    sendSuccess(res, 201, 'Announcement created', data);
  } catch (e) { next(e); }
};

const updateAnnouncement = async (req, res, next) => {
  try {
    const data = await adminService.updateAnnouncement(req.params.id, req.body, req.admin);
    sendSuccess(res, 200, 'Announcement updated', data);
  } catch (e) { next(e); }
};

const deleteAnnouncement = async (req, res, next) => {
  try {
    await adminService.deleteAnnouncement(req.params.id, req.admin);
    sendSuccess(res, 200, 'Announcement deleted');
  } catch (e) { next(e); }
};

// ─── User Notifications ────────────────────────────────────────────────────
const sendNotification = async (req, res, next) => {
  try {
    const data = await adminService.sendUserNotification(req.body, req.admin);
    sendSuccess(res, 201, 'Notification sent', data);
  } catch (e) { next(e); }
};

const sendBulkNotifications = async (req, res, next) => {
  try {
    const data = await adminService.sendBulkNotifications(req.body, req.admin);
    sendSuccess(res, 201, 'Bulk notifications sent', data);
  } catch (e) { next(e); }
};

const getUserNotifications = async (req, res, next) => {
  try {
    const data = await adminService.getUserNotifications(req.query, req.admin);
    sendSuccess(res, 200, 'Notifications fetched', data);
  } catch (e) { next(e); }
};

// ─── Reports ───────────────────────────────────────────────────────────────
const getReports = async (req, res, next) => {
  try {
    const data = await adminService.getReports(req.query, req.admin);
    sendSuccess(res, 200, 'Reports fetched', data);
  } catch (e) { next(e); }
};

const resolveReport = async (req, res, next) => {
  try {
    const data = await adminService.resolveReport(req.params.id, req.admin);
    sendSuccess(res, 200, 'Report resolved', data);
  } catch (e) { next(e); }
};

const closeReport = async (req, res, next) => {
  try {
    const data = await adminService.closeReport(req.params.id, req.admin);
    sendSuccess(res, 200, 'Report closed', data);
  } catch (e) { next(e); }
};

const deleteReport = async (req, res, next) => {
  try {
    await adminService.deleteReport(req.params.id, req.admin);
    sendSuccess(res, 200, 'Report deleted');
  } catch (e) { next(e); }
};

// ─── Home Management - Banners ─────────────────────────────────────────────
const getBanners = async (req, res, next) => {
  try {
    const data = await adminService.getBanners();
    sendSuccess(res, 200, 'Banners fetched', data);
  } catch (e) { next(e); }
};

const createBanner = async (req, res, next) => {
  try {
    const data = await adminService.createBanner(req.body);
    sendSuccess(res, 201, 'Banner created', data);
  } catch (e) { next(e); }
};

const updateBanner = async (req, res, next) => {
  try {
    const data = await adminService.updateBanner(req.params.id, req.body);
    sendSuccess(res, 200, 'Banner updated', data);
  } catch (e) { next(e); }
};

const deleteBanner = async (req, res, next) => {
  try {
    await adminService.deleteBanner(req.params.id);
    sendSuccess(res, 200, 'Banner deleted');
  } catch (e) { next(e); }
};

// ─── Home Management - Carousel ────────────────────────────────────────────
const getCarouselItems = async (req, res, next) => {
  try {
    const data = await adminService.getCarouselItems();
    sendSuccess(res, 200, 'Carousel items fetched', data);
  } catch (e) { next(e); }
};

const createCarouselItem = async (req, res, next) => {
  try {
    const data = await adminService.createCarouselItem(req.body);
    sendSuccess(res, 201, 'Carousel item created', data);
  } catch (e) { next(e); }
};

const updateCarouselItem = async (req, res, next) => {
  try {
    const data = await adminService.updateCarouselItem(req.params.id, req.body);
    sendSuccess(res, 200, 'Carousel item updated', data);
  } catch (e) { next(e); }
};

const deleteCarouselItem = async (req, res, next) => {
  try {
    await adminService.deleteCarouselItem(req.params.id);
    sendSuccess(res, 200, 'Carousel item deleted');
  } catch (e) { next(e); }
};

// ─── Home Management - Featured Cards ──────────────────────────────────────
const getFeaturedCards = async (req, res, next) => {
  try {
    const data = await adminService.getFeaturedCards();
    sendSuccess(res, 200, 'Featured cards fetched', data);
  } catch (e) { next(e); }
};

const createFeaturedCard = async (req, res, next) => {
  try {
    const data = await adminService.createFeaturedCard(req.body);
    sendSuccess(res, 201, 'Featured card created', data);
  } catch (e) { next(e); }
};

const updateFeaturedCard = async (req, res, next) => {
  try {
    const data = await adminService.updateFeaturedCard(req.params.id, req.body);
    sendSuccess(res, 200, 'Featured card updated', data);
  } catch (e) { next(e); }
};

const deleteFeaturedCard = async (req, res, next) => {
  try {
    await adminService.deleteFeaturedCard(req.params.id);
    sendSuccess(res, 200, 'Featured card deleted');
  } catch (e) { next(e); }
};

// ─── Activity Logs ─────────────────────────────────────────────────────────
const getActivityLogs = async (req, res, next) => {
  try {
    const data = await adminService.getActivityLogs(req.query, req.admin);
    sendSuccess(res, 200, 'Activity logs fetched', data);
  } catch (e) { next(e); }
};

// ─── System Settings ───────────────────────────────────────────────────────
const getSystemSettings = async (req, res, next) => {
  try {
    const data = await adminService.getSystemSettings();
    sendSuccess(res, 200, 'Settings fetched', data);
  } catch (e) { next(e); }
};

const updateSystemSetting = async (req, res, next) => {
  try {
    const data = await adminService.updateSystemSetting(req.params.key, req.body.value);
    sendSuccess(res, 200, 'Setting updated', data);
  } catch (e) { next(e); }
};

// ─── Analytics ─────────────────────────────────────────────────────────────
const getAnalytics = async (req, res, next) => {
  try {
    const data = await adminService.getAnalytics(req.query, req.admin);
    sendSuccess(res, 200, 'Analytics fetched', data);
  } catch (e) { next(e); }
};

// ─── Storage ───────────────────────────────────────────────────────────────
const getStorageStats = async (req, res, next) => {
  try {
    const data = await adminService.getStorageStats();
    sendSuccess(res, 200, 'Storage stats fetched', data);
  } catch (e) { next(e); }
};

const cleanupStorage = async (req, res, next) => {
  try {
    const data = await adminService.cleanupStorage(req.body.daysOld || 30);
    sendSuccess(res, 200, 'Storage cleaned up', data);
  } catch (e) { next(e); }
};

// ─── Security ──────────────────────────────────────────────────────────────
const getSecurityLogs = async (req, res, next) => {
  try {
    const data = await adminService.getSecurityLogs(req.query);
    sendSuccess(res, 200, 'Security logs fetched', data);
  } catch (e) { next(e); }
};

// ─── Database Stats ────────────────────────────────────────────────────────
const getDatabaseStats = async (req, res, next) => {
  try {
    const data = await adminService.getDatabaseStats();
    sendSuccess(res, 200, 'Database stats fetched', data);
  } catch (e) { next(e); }
};

// ─── API Monitor ───────────────────────────────────────────────────────────
const getApiMonitorStats = async (req, res, next) => {
  try {
    const data = await adminService.getApiMonitorStats();
    sendSuccess(res, 200, 'API monitor stats fetched', data);
  } catch (e) { next(e); }
};

module.exports = {
  getAdminDashboard,
  getDomains, createDomain, updateDomain, deleteDomain,
  getAdmins, createAdmin, updateAdmin, deleteAdmin, suspendAdmin, activateAdmin, resetAdminPassword,
  getUsers, getUserById, createUser, suspendUser, activateUser, banUser, verifyUser, resetUserPassword,
  getRides, getRideById, deleteRide, cancelRide, completeRide,
  getRequests, approveRequest, rejectRequest, cancelRequest,
  getChats, getChatMessages, deleteMessage, deleteConversation, muteUser, unmuteUser, blockUser,
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  sendNotification, sendBulkNotifications, getUserNotifications,
  getReports, resolveReport, closeReport, deleteReport,
  getBanners, createBanner, updateBanner, deleteBanner,
  getCarouselItems, createCarouselItem, updateCarouselItem, deleteCarouselItem,
  getFeaturedCards, createFeaturedCard, updateFeaturedCard, deleteFeaturedCard,
  getActivityLogs,
  getSystemSettings, updateSystemSetting,
  getAnalytics,
  getStorageStats, cleanupStorage,
  getSecurityLogs,
  getDatabaseStats,
  getApiMonitorStats,
};