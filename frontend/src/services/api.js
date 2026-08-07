import axios from 'axios'
import { getAccessToken, setAccessToken, clearAccessToken } from './tokenStore'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send/receive the httpOnly refresh-token cookie
})

// Attach access token from memory (never from localStorage)
api.interceptors.request.use(config => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// Handle 401 — refresh token via httpOnly cookie (no token in the request body)
let refreshPromise = null

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry && !original.url?.includes('/auth/refresh')) {
      original._retry = true
      try {
        // De-dupe concurrent refreshes triggered by multiple in-flight requests
        refreshPromise = refreshPromise || axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
        const { data } = await refreshPromise
        refreshPromise = null
        const newToken = data.data?.accessToken || data.accessToken
        setAccessToken(newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch {
        refreshPromise = null
        clearAccessToken()
        window.location.href = '/#/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api

// Auth
export const authAPI = {
  sendOtp: (email) => api.post('/auth/send-otp', { email }),
  verifyOtp: (email, otp) => api.post('/auth/verify-otp', { email, otp }),
  register: (data) => api.post('/auth/register', data),
  login: (email, password) => api.post('/auth/login', { email, password }),
  forgotPassword: (emailOrPhone) => api.post('/auth/forgot-password', { emailOrPhone }),
  resetPassword: (email, otp, newPassword) => api.post('/auth/reset-password', { email, otp, newPassword }),
  // Refresh token is read from the httpOnly cookie server-side — nothing to pass here
  refresh: () => api.post('/auth/refresh', {}),
  logout: () => api.post('/auth/logout', {}),
  getMe: () => api.get('/auth/me'),
}

// Domains (public — used for signup hints; the backend independently
// re-validates the domain server-side regardless of what this returns)
export const domainsAPI = {
  getAllowed: () => api.get('/domains'),
}

// Profile
export const profileAPI = {
  get: () => api.get('/profile'),
  update: (data) => api.patch('/profile', data),
  changePassword: (data) => api.patch('/profile/change-password', data),
}

// Rides
export const ridesAPI = {
  getAll: (params) => api.get('/rides', { params }),
  create: (data) => api.post('/rides', data),
  delete: (id) => api.delete(`/rides/${id}`),
  getMyRides: () => api.get('/rides/my'),
  getById: (id) => api.get(`/rides/${id}`),
}

// Requests — backend GET /requests returns { incoming, outgoing }
export const requestsAPI = {
  create: (rideId) => api.post('/requests', { rideId }),
  getAll: () => api.get('/requests'),
  updateStatus: (id, status) => api.patch(`/requests/${id}`, { status }),
  sharePhone: (id) => api.patch(`/requests/${id}/share-phone`),
  delete: (id) => api.delete(`/requests/${id}`),
}

// Geocoding — proxied through backend to keep the Mappls API key server-side
export const geocodeAPI = {
  search: (q, viewbox) => api.get('/geocode/search', { params: viewbox ? { q, viewbox } : { q } }),
}

// Chat — backend routes: /chats/:requestId  /chats/:requestId/messages
export const chatAPI = {
  getChatInfo: (requestId) => api.get(`/chats/${requestId}`),
  getMessages: (requestId, page = 1) => api.get(`/chats/${requestId}/messages`, { params: { page } }),
  sendMessage: (requestId, text) => api.post(`/chats/${requestId}/messages`, { text }),
}

// Web Push Notifications
export const pushAPI = {
  getVapidKey: () => api.get('/push/vapid-key'),
  subscribe: (subscription) => api.post('/push/subscribe', subscription),
  unsubscribe: (endpoint) => api.post('/push/unsubscribe', { endpoint }),
}
