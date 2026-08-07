const express = require('express');
const router = express.Router();

const {
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
} = require('../controllers/admin.controller');

const { adminProtect, restrictTo } = require('../middleware/adminAuth.middleware');
const { bulkNotificationLimiter } = require('../middleware/rateLimit.middleware');

// All admin routes require authentication
router.use(adminProtect);

// ─── Dashboard ────────────────────────────────────────────────────────────
router.get('/dashboard', getAdminDashboard);

// ─── Domain Management (Super Admin only) ────────────────────────────────
router.get('/domains', restrictTo('SUPER_ADMIN'), getDomains);
router.post('/domains', restrictTo('SUPER_ADMIN'), createDomain);
router.put('/domains/:id', restrictTo('SUPER_ADMIN'), updateDomain);
router.delete('/domains/:id', restrictTo('SUPER_ADMIN'), deleteDomain);

// ─── Admin Management (Super Admin only) ─────────────────────────────────
router.get('/admins', restrictTo('SUPER_ADMIN'), getAdmins);
router.post('/admins', restrictTo('SUPER_ADMIN'), createAdmin);
router.put('/admins/:id', restrictTo('SUPER_ADMIN'), updateAdmin);
router.delete('/admins/:id', restrictTo('SUPER_ADMIN'), deleteAdmin);
router.put('/admins/:id/suspend', restrictTo('SUPER_ADMIN'), suspendAdmin);
router.put('/admins/:id/activate', restrictTo('SUPER_ADMIN'), activateAdmin);
router.put('/admins/:id/reset-password', restrictTo('SUPER_ADMIN'), resetAdminPassword);

// ─── User Management ─────────────────────────────────────────────────────
router.get('/users', getUsers);
router.post('/users', restrictTo('SUPER_ADMIN'), createUser);
router.get('/users/:id', getUserById);
router.put('/users/:id/suspend', suspendUser);
router.put('/users/:id/activate', activateUser);
router.put('/users/:id/ban', restrictTo('SUPER_ADMIN'), banUser);
router.put('/users/:id/verify', verifyUser);
router.put('/users/:id/reset-password', resetUserPassword);
router.put('/users/:id/mute', muteUser);
router.put('/users/:id/unmute', unmuteUser);
router.put('/users/:id/block', restrictTo('SUPER_ADMIN'), blockUser);

// ─── Ride Management ─────────────────────────────────────────────────────
router.get('/rides', getRides);
router.get('/rides/:id', getRideById);
router.delete('/rides/:id', deleteRide);
router.put('/rides/:id/cancel', cancelRide);
router.put('/rides/:id/complete', completeRide);

// ─── Request Management ──────────────────────────────────────────────────
router.get('/requests', getRequests);
router.put('/requests/:id/approve', approveRequest);
router.put('/requests/:id/reject', rejectRequest);
router.put('/requests/:id/cancel', cancelRequest);

// ─── Chat Management ─────────────────────────────────────────────────────
router.get('/chats', getChats);
router.get('/chats/:id/messages', getChatMessages);
router.delete('/messages/:id', deleteMessage);
router.delete('/chats/:id', deleteConversation);

// ─── Announcements ───────────────────────────────────────────────────────
router.get('/announcements', getAnnouncements);
router.post('/announcements', createAnnouncement);
router.put('/announcements/:id', updateAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

// ─── User Notifications ──────────────────────────────────────────────────
router.post('/notifications/send', sendNotification);
router.post('/notifications/bulk', bulkNotificationLimiter, sendBulkNotifications);
router.get('/notifications', getUserNotifications);

// ─── Reports ─────────────────────────────────────────────────────────────
router.get('/reports', getReports);
router.put('/reports/:id/resolve', resolveReport);
router.put('/reports/:id/close', closeReport);
router.delete('/reports/:id', deleteReport);

// ─── Home Management - Banners ────────────────────────────────────────────
router.get('/banners', getBanners);
router.post('/banners', restrictTo('SUPER_ADMIN'), createBanner);
router.put('/banners/:id', restrictTo('SUPER_ADMIN'), updateBanner);
router.delete('/banners/:id', restrictTo('SUPER_ADMIN'), deleteBanner);

// ─── Home Management - Carousel ──────────────────────────────────────────
router.get('/carousel', getCarouselItems);
router.post('/carousel', restrictTo('SUPER_ADMIN'), createCarouselItem);
router.put('/carousel/:id', restrictTo('SUPER_ADMIN'), updateCarouselItem);
router.delete('/carousel/:id', restrictTo('SUPER_ADMIN'), deleteCarouselItem);

// ─── Home Management - Featured Cards ────────────────────────────────────
router.get('/featured-cards', getFeaturedCards);
router.post('/featured-cards', restrictTo('SUPER_ADMIN'), createFeaturedCard);
router.put('/featured-cards/:id', restrictTo('SUPER_ADMIN'), updateFeaturedCard);
router.delete('/featured-cards/:id', restrictTo('SUPER_ADMIN'), deleteFeaturedCard);

// ─── Activity Logs ───────────────────────────────────────────────────────
router.get('/activity-logs', restrictTo('SUPER_ADMIN'), getActivityLogs);

// ─── System Settings ─────────────────────────────────────────────────────
router.get('/settings', restrictTo('SUPER_ADMIN'), getSystemSettings);
router.put('/settings/:key', restrictTo('SUPER_ADMIN'), updateSystemSetting);

// ─── Analytics ───────────────────────────────────────────────────────────
router.get('/analytics', getAnalytics);

// ─── Storage ─────────────────────────────────────────────────────────────
router.get('/storage', restrictTo('SUPER_ADMIN'), getStorageStats);
router.post('/storage/cleanup', restrictTo('SUPER_ADMIN'), cleanupStorage);

// ─── Security ────────────────────────────────────────────────────────────
router.get('/security/logs', restrictTo('SUPER_ADMIN'), getSecurityLogs);

// ─── Database ────────────────────────────────────────────────────────────
router.get('/database/stats', restrictTo('SUPER_ADMIN'), getDatabaseStats);

// ─── API Monitor ─────────────────────────────────────────────────────────
router.get('/api-monitor', restrictTo('SUPER_ADMIN'), getApiMonitorStats);

module.exports = router;
