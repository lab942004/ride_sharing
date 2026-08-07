// import { io } from 'socket.io-client'

// let socket = null

// export function getSocket() {
//   if (!socket || !socket.connected) {
//     const token = localStorage.getItem('accessToken')
//     socket = io('/', {
//       auth: { token },
//       transports: ['websocket', 'polling'],
//       reconnection: true,
//       reconnectionAttempts: 5,
//       reconnectionDelay: 1000,
//     })

//     socket.on('connect_error', (err) => {
//       console.warn('Socket connection error:', err.message)
//     })
//   }
//   return socket
// }

// export function disconnectSocket() {
//   if (socket) {
//     socket.disconnect()
//     socket = null
//   }
// }


import { io } from 'socket.io-client'
import { getAccessToken } from './tokenStore'

let socket = null

export function getSocket() {
  const token = getAccessToken()

  // reuse existing connected socket
  if (socket && socket.connected) {
    return socket
  }

  const apiUrl = import.meta.env.VITE_API_URL || '/api'
  const backendOrigin = (() => {
    try {
      return new URL(apiUrl, window.location.origin).origin
    } catch {
      return apiUrl.replace(/\/\/+$/, '')
    }
  })()
 
  const socketUrl = backendOrigin.replace(/^http/, 'ws')

  socket = io(socketUrl, {
    path: '/socket.io',
    auth: {
      token,
    },

    transports: ['websocket', 'polling'],

    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,

    withCredentials: true,
  })

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', reason)
  })

  socket.on('connect_error', (err) => {
    console.error('❌ Socket connection error:', err.message)
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}