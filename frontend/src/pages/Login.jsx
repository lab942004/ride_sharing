import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

/* ── Shared auth layout — creamy background with illustrated decorations ── */
export function AuthLayout({ children, title }) {
  return (
    <div className="min-h-screen flex items-stretch">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/3 bg-cream-dark items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-8 w-28 h-28 rounded-full bg-primary/10" />
          <div className="absolute bottom-20 right-6 w-40 h-40 rounded-full bg-primary/5" />
          <div className="absolute top-1/2 left-1/4 w-16 h-16 rounded-full bg-amber-200/40" />
        </div>
        {/* Car SVG illustration */}
        <svg viewBox="0 0 320 420" className="w-64 h-64 opacity-80" fill="none">
          {/* Road */}
          <ellipse cx="160" cy="380" rx="140" ry="18" fill="#E5C879" opacity="0.4"/>
          {/* Car body */}
          <rect x="60" y="250" width="200" height="80" rx="18" fill="#D97706" opacity="0.85"/>
          <rect x="80" y="200" width="160" height="70" rx="14" fill="#F59E0B" opacity="0.9"/>
          {/* Windows */}
          <rect x="92" y="210" width="60" height="45" rx="8" fill="#DBEAFE" opacity="0.6"/>
          <rect x="165" y="210" width="60" height="45" rx="8" fill="#DBEAFE" opacity="0.6"/>
          {/* Wheels */}
          <circle cx="105" cy="335" r="28" fill="#1C1C1C" opacity="0.7"/>
          <circle cx="215" cy="335" r="28" fill="#1C1C1C" opacity="0.7"/>
          <circle cx="105" cy="335" r="14" fill="#6B7280" opacity="0.5"/>
          <circle cx="215" cy="335" r="14" fill="#6B7280" opacity="0.5"/>
          {/* Lamp post */}
          <rect x="270" y="100" width="6" height="220" rx="3" fill="#92400E" opacity="0.6"/>
          <ellipse cx="273" cy="100" rx="16" ry="10" fill="#FCD34D" opacity="0.7"/>
          {/* Trees */}
          <circle cx="40" cy="180" r="35" fill="#6EE7B7" opacity="0.5"/>
          <rect x="36" y="215" width="8" height="40" rx="4" fill="#92400E" opacity="0.4"/>
          <circle cx="290" cy="150" r="28" fill="#A7F3D0" opacity="0.4"/>
        </svg>
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="font-display text-2xl font-bold text-charcoal">RideShare</p>
          <p className="text-muted text-sm mt-1">NIT Kurukshetra</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-bold text-charcoal text-center mb-8">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { toast.error('Please fill all fields'); return }
    try {
      setLoading(true)
      const res = await authAPI.login(form.email, form.password)
      const d = res.data.data || res.data
      const { user, accessToken } = d
      login(user, accessToken)
      toast.success(`Welcome back, ${user.name}!`)
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Ride Share">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-charcoal mb-2">Email</label>
          <input
            name="email"
            type="email"
            placeholder="Enter Email"
            value={form.email}
            onChange={handleChange}
            className="input-field"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-charcoal mb-2">Password</label>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter Password"
              value={form.password}
              onChange={handleChange}
              className="input-field pr-10"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10a9.97 9.97 0 012.175-5.7M6.36 6.36A9.953 9.953 0 0112 5c5.523 0 10 4.477 10 10 0 1.29-.246 2.52-.696 3.66M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 text-base mt-2 disabled:opacity-60"
        >
          {loading ? 'Logging in...' : 'Log In'}
        </button>

        <div className="text-center">
          <Link to="/forgot-password" className="text-sm text-charcoal hover:text-primary transition-colors">
            Forgot Password
          </Link>
        </div>

        <div className="text-center">
          <Link to="/register" className="text-sm text-primary hover:text-primary-dark transition-colors">
            New here? Create an account
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}

export { AuthLayout as default_layout }
