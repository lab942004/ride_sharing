import { getAccessToken, setAccessToken, clearAccessToken } from './tokenStore';

const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE;
  }

  getToken() {
    return getAccessToken();
  }

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const config = {
      credentials: 'include', // send/receive the httpOnly admin refresh-token cookie
      ...options,
      headers,
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        // Try token refresh on 401
        if (response.status === 401 && endpoint !== '/admin/auth/refresh' && endpoint !== '/admin/auth/login') {
          const refreshed = await this.refreshToken();
          if (refreshed) {
            headers.Authorization = `Bearer ${this.getToken()}`;
            const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, { ...config, headers });
            const retryData = await retryResponse.json();
            if (!retryResponse.ok) {
              throw new Error(retryData.message || 'Request failed');
            }
            return retryData;
          }
          // Refresh failed, logout
          clearAccessToken();
          window.location.href = '/login';
          throw new Error('Session expired');
        }
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      if (error.message === 'Session expired') throw error;
      throw new Error(error.message || 'Network error');
    }
  }

  async refreshToken() {
    try {
      const response = await fetch(`${this.baseUrl}/admin/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // refresh token comes from the httpOnly cookie
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) return false;

      setAccessToken(data.data.accessToken);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Auth ────────────────────────────────────────────────────────
  async login(email, password) {
    const result = await this.request('/admin/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (result?.data?.accessToken) setAccessToken(result.data.accessToken);
    return result;
  }

  async logout() {
    try {
      return await this.request('/admin/auth/logout', {
        method: 'POST',
        body: {},
      });
    } finally {
      clearAccessToken();
    }
  }

  async getProfile() {
    return this.request('/admin/auth/profile');
  }

  async updateProfile(data) {
    return this.request('/admin/auth/profile', {
      method: 'PUT',
      body: data,
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/admin/auth/change-password', {
      method: 'PUT',
      body: { currentPassword, newPassword },
    });
  }

  // ─── Dashboard ───────────────────────────────────────────────────
  async getDashboard() {
    return this.request('/admin/dashboard');
  }

  // ─── Domains ─────────────────────────────────────────────────────
  async getDomains() {
    return this.request('/admin/domains');
  }

  async createDomain(data) {
    return this.request('/admin/domains', {
      method: 'POST',
      body: data,
    });
  }

  async updateDomain(id, data) {
    return this.request(`/admin/domains/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteDomain(id) {
    return this.request(`/admin/domains/${id}`, {
      method: 'DELETE',
    });
  }

  // ─── Admins ──────────────────────────────────────────────────────
  async getAdmins(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/admins?${query}`);
  }

  async createAdmin(data) {
    return this.request('/admin/admins', {
      method: 'POST',
      body: data,
    });
  }

  async updateAdmin(id, data) {
    return this.request(`/admin/admins/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteAdmin(id) {
    return this.request(`/admin/admins/${id}`, {
      method: 'DELETE',
    });
  }

  async suspendAdmin(id) {
    return this.request(`/admin/admins/${id}/suspend`, { method: 'PUT' });
  }

  async activateAdmin(id) {
    return this.request(`/admin/admins/${id}/activate`, { method: 'PUT' });
  }

  async resetAdminPassword(id, newPassword) {
    return this.request(`/admin/admins/${id}/reset-password`, {
      method: 'PUT',
      body: { newPassword },
    });
  }

  // ─── Users ───────────────────────────────────────────────────────
  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/users?${query}`);
  }

  async createUser(data) {
    return this.request('/admin/users', {
      method: 'POST',
      body: data,
    });
  }

  async getUserById(id) {
    return this.request(`/admin/users/${id}`);
  }

  async suspendUser(id) {
    return this.request(`/admin/users/${id}/suspend`, { method: 'PUT' });
  }

  async activateUser(id) {
    return this.request(`/admin/users/${id}/activate`, { method: 'PUT' });
  }

  async banUser(id) {
    return this.request(`/admin/users/${id}/ban`, { method: 'PUT' });
  }

  async verifyUser(id) {
    return this.request(`/admin/users/${id}/verify`, { method: 'PUT' });
  }

  async resetUserPassword(id) {
    return this.request(`/admin/users/${id}/reset-password`, { method: 'PUT' });
  }

  async muteUser(id) {
    return this.request(`/admin/users/${id}/mute`, { method: 'PUT' });
  }

  async unmuteUser(id) {
    return this.request(`/admin/users/${id}/unmute`, { method: 'PUT' });
  }

  async blockUser(id) {
    return this.request(`/admin/users/${id}/block`, { method: 'PUT' });
  }

  // ─── Rides ───────────────────────────────────────────────────────
  async getRides(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/rides?${query}`);
  }

  async getRideById(id) {
    return this.request(`/admin/rides/${id}`);
  }

  async deleteRide(id) {
    return this.request(`/admin/rides/${id}`, { method: 'DELETE' });
  }

  async cancelRide(id) {
    return this.request(`/admin/rides/${id}/cancel`, { method: 'PUT' });
  }

  async completeRide(id) {
    return this.request(`/admin/rides/${id}/complete`, { method: 'PUT' });
  }

  // ─── Requests ────────────────────────────────────────────────────
  async getRequests(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/requests?${query}`);
  }

  async approveRequest(id) {
    return this.request(`/admin/requests/${id}/approve`, { method: 'PUT' });
  }

  async rejectRequest(id) {
    return this.request(`/admin/requests/${id}/reject`, { method: 'PUT' });
  }

  async cancelRequest(id) {
    return this.request(`/admin/requests/${id}/cancel`, { method: 'PUT' });
  }

  // ─── Chats ───────────────────────────────────────────────────────
  async getChats(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/chats?${query}`);
  }

  async getChatMessages(id) {
    return this.request(`/admin/chats/${id}/messages`);
  }

  async deleteMessage(id) {
    return this.request(`/admin/messages/${id}`, { method: 'DELETE' });
  }

  async deleteConversation(id) {
    return this.request(`/admin/chats/${id}`, { method: 'DELETE' });
  }

  // ─── Announcements ──────────────────────────────────────────────
  async getAnnouncements(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/announcements?${query}`);
  }

  async createAnnouncement(data) {
    return this.request('/admin/announcements', {
      method: 'POST',
      body: data,
    });
  }

  async updateAnnouncement(id, data) {
    return this.request(`/admin/announcements/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteAnnouncement(id) {
    return this.request(`/admin/announcements/${id}`, { method: 'DELETE' });
  }

  // ─── User Notifications ─────────────────────────────────────────
  async sendNotification(data) {
    return this.request('/admin/notifications/send', {
      method: 'POST',
      body: data,
    });
  }

  async sendBulkNotifications(data) {
    return this.request('/admin/notifications/bulk', {
      method: 'POST',
      body: data,
    });
  }

  async getUserNotifications(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/notifications?${query}`);
  }

  // ─── Reports ─────────────────────────────────────────────────────
  async getReports(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/reports?${query}`);
  }

  async resolveReport(id) {
    return this.request(`/admin/reports/${id}/resolve`, { method: 'PUT' });
  }

  async closeReport(id) {
    return this.request(`/admin/reports/${id}/close`, { method: 'PUT' });
  }

  async deleteReport(id) {
    return this.request(`/admin/reports/${id}`, { method: 'DELETE' });
  }

  // ─── Banners ─────────────────────────────────────────────────────
  async getBanners() {
    return this.request('/admin/banners');
  }

  async createBanner(data) {
    return this.request('/admin/banners', {
      method: 'POST',
      body: data,
    });
  }

  async updateBanner(id, data) {
    return this.request(`/admin/banners/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteBanner(id) {
    return this.request(`/admin/banners/${id}`, { method: 'DELETE' });
  }

  // ─── Carousel ────────────────────────────────────────────────────
  async getCarouselItems() {
    return this.request('/admin/carousel');
  }

  async createCarouselItem(data) {
    return this.request('/admin/carousel', {
      method: 'POST',
      body: data,
    });
  }

  async updateCarouselItem(id, data) {
    return this.request(`/admin/carousel/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteCarouselItem(id) {
    return this.request(`/admin/carousel/${id}`, { method: 'DELETE' });
  }

  // ─── Featured Cards ──────────────────────────────────────────────
  async getFeaturedCards() {
    return this.request('/admin/featured-cards');
  }

  async createFeaturedCard(data) {
    return this.request('/admin/featured-cards', {
      method: 'POST',
      body: data,
    });
  }

  async updateFeaturedCard(id, data) {
    return this.request(`/admin/featured-cards/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteFeaturedCard(id) {
    return this.request(`/admin/featured-cards/${id}`, { method: 'DELETE' });
  }

  // ─── Activity Logs ──────────────────────────────────────────────
  async getActivityLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/activity-logs?${query}`);
  }

  // ─── System Settings ────────────────────────────────────────────
  async getSystemSettings() {
    return this.request('/admin/settings');
  }

  async updateSystemSetting(key, value) {
    return this.request(`/admin/settings/${key}`, {
      method: 'PUT',
      body: { value },
    });
  }

  // ─── Analytics ──────────────────────────────────────────────────
  async getAnalytics(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/analytics?${query}`);
  }

  // ─── Storage ────────────────────────────────────────────────────
  async getStorageStats() {
    return this.request('/admin/storage');
  }

  async cleanupStorage(daysOld = 30) {
    return this.request('/admin/storage/cleanup', {
      method: 'POST',
      body: { daysOld },
    });
  }

  // ─── Security ───────────────────────────────────────────────────
  async getSecurityLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/security/logs?${query}`);
  }

  // ─── Database ───────────────────────────────────────────────────
  async getDatabaseStats() {
    return this.request('/admin/database/stats');
  }

  // ─── API Monitor ────────────────────────────────────────────────
  async getApiMonitorStats() {
    return this.request('/admin/api-monitor');
  }
}

export const api = new ApiClient();
export default api;