import { createContext, useContext, useState, useEffect } from 'react'
import { setAccessToken, clearAccessToken } from '../services/tokenStore'
import usePushNotifications from '../hooks/usePushNotifications'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // On app start there is no access token in memory (it never survives a
  // reload by design). Try a silent refresh using the httpOnly cookie; if
  // it succeeds, fetch the current user to restore the session.
  useEffect(() => {
    let cancelled = false

    const restoreSession = async () => {
      try {
        const { authAPI } = await import('../services/api')
        const refreshRes = await authAPI.refresh()
        const accessToken = refreshRes.data.data?.accessToken || refreshRes.data.accessToken
        if (!accessToken) throw new Error('No access token returned')
        setAccessToken(accessToken)

        const meRes = await authAPI.getMe()
        const me = meRes.data.data?.user || meRes.data.data || meRes.data.user
        if (!cancelled) setUser(me)
      } catch {
        clearAccessToken()
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    restoreSession()
    return () => { cancelled = true }
  }, [])

  // Register the service worker + subscribe to web push once we know who's
  // logged in (covers both a fresh login and a restored session on reload).
  // Previously this hook existed but was never called anywhere, so push
  // notifications never actually got set up for any user.
  usePushNotifications(!!user)

  // accessToken is kept in memory only (tokenStore) — the refresh token is
  // an httpOnly cookie the browser manages; neither ever goes in localStorage.
  const login = (userData, accessToken) => {
    setAccessToken(accessToken)
    setUser(userData)
  }

  const logout = async () => {
    try {
      const { authAPI } = await import('../services/api')
      await authAPI.logout().catch(() => {})
    } catch {}
    clearAccessToken()
    setUser(null)
  }

  const updateUser = (userData) => {
    setUser(userData)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
