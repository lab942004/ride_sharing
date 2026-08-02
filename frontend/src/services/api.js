import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// Handle 401 — refresh token
api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refreshToken')
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh })
        const newToken = data.data?.accessToken || data.accessToken
        localStorage.setItem('accessToken', newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch {
        localStorage.clear()
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
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  getMe: () => api.get('/auth/me'),
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

// Chat — backend routes: /chats/:requestId  /chats/:requestId/messages
export const chatAPI = {
  getChatInfo: (requestId) => api.get(`/chats/${requestId}`),
  getMessages: (requestId, page = 1) => api.get(`/chats/${requestId}/messages`, { params: { page } }),
  sendMessage: (requestId, text) => api.post(`/chats/${requestId}/messages`, { text }),
}
