import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useToast } from '../context/ToastContext'
import { AuthLayout } from './Login'

/**
 * REGISTRATION FLOW (prompt-first, not Figma):
 *  Step 1: Enter email → Send OTP
 *  Step 2: Verify OTP
 *  Step 3: Fill remaining details → Register
 */
export default function Register() {
  const [step, setStep] = useState(1) // 1=email, 2=otp, 3=details
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [form, setForm] = useState({ name: '', rollNo: '', phone: '', password: '', confirmPassword: '' })
  const [profilePicFile, setProfilePicFile] = useState(null)
  const [profilePicPreview, setProfilePicPreview] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const toast = useToast()
  const navigate = useNavigate()

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  /* ── Step 1: Send OTP ── */
  const handleSendOtp = async (e) => {
    e.preventDefault()
    setEmailError('')
    if (!email) {
      setEmailError('Enter your college email')
      return
    }
    if (!email.endsWith('@nitkkr.ac.in')) && (!email.endWith('@gmail.com')) {
      setEmailError('Only @nitkkr.ac.in & @gmail.com emails are allowed')
      return
    }
    try {
      setLoading(true)
      await authAPI.sendOtp(email)
      toast.success('OTP sent to your email!')
      setStep(2)
    } catch (err) {
      const message = err.response?.data?.message
      if (err.response?.status === 409) {
        setEmailError(message || 'This email is already registered.')
      } else {
        toast.error(message || 'Failed to send OTP')
      }
    } finally {
      setLoading(false)
    }
  }

  /* ── Step 2: Verify OTP ── */
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otp || otp.length < 4) { toast.error('Enter a valid OTP'); return }
    try {
      setLoading(true)
      await authAPI.verifyOtp(email, otp)
      toast.success('Email verified! Fill your details.')
      setStep(3)
    } catch (err) {
      toast.error(err.response?.data?.message || 'OTP verification failed')
    } finally {
      setLoading(false)
    }
  }

  /* ── Step 3: Complete Registration ── */
  const handleProfilePicChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setProfilePicFile(file)
  }

  const clearProfilePic = () => {
    setProfilePicFile(null)
  }

  useEffect(() => {
    if (!profilePicFile) {
      setProfilePicPreview('')
      return
    }

    const previewUrl = URL.createObjectURL(profilePicFile)
    setProfilePicPreview(previewUrl)

    return () => URL.revokeObjectURL(previewUrl)
  }, [profilePicFile])

  const handleRegister = async (e) => {
    e.preventDefault()
    const { name, rollNo, phone, password, confirmPassword } = form
    if (!name || !rollNo || !phone || !password) { toast.error('Please fill all fields'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('email', email)
      formData.append('name', name)
      formData.append('rollNo', rollNo)
      formData.append('phone', phone)
      formData.append('password', password)
      if (profilePicFile) formData.append('profilePic', profilePicFile)

      await authAPI.register(formData)
      toast.success('Account created! Please log in.')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const resendOtp = async () => {
    try {
      setLoading(true)
      await authAPI.sendOtp(email)
      toast.success('OTP resent!')
    } catch {
      toast.error('Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  /* ── Step 1 UI ── */
  if (step === 1) {
    return (
      <AuthLayout title="Create New Account">
        <form onSubmit={handleSendOtp} className="space-y-5">
          <p className="text-sm text-muted text-center -mt-4 mb-2">
            Enter your college email to get started
          </p>
          <div>
            <label className="block text-sm font-bold text-charcoal mb-2">College Email</label>
            <input
              type="email"
              placeholder="yourname@nitkkr.ac.in"
              value={email}
              onChange={e => {
                setEmail(e.target.value)
                setEmailError('')
              }}
              className="input-field-cream"
              autoComplete="email"
            />
            {emailError ? (
              <p className="mt-2 text-sm text-red-600">{emailError}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base disabled:opacity-60"
          >
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>

          <div className="text-center">
            <Link to="/login" className="text-sm text-primary hover:text-primary-dark transition-colors">
              Already have an account? Log in
            </Link>
          </div>
        </form>
      </AuthLayout>
    )
  }

  /* ── Step 2 UI ── */
  if (step === 2) {
    return (
      <AuthLayout title="Verify OTP">
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <p className="text-sm text-muted text-center -mt-4">
            OTP sent to <span className="font-semibold text-charcoal">{email}</span>
          </p>

          <div className="relative">
            <input
              type="text"
              maxLength={6}
              placeholder="OTP"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              className="input-field tracking-[0.5em] text-center text-xl font-mono pr-20"
            />
            <button
              type="button"
              onClick={resendOtp}
              disabled={loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-semibold hover:text-primary-dark"
            >
              resend
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base disabled:opacity-60"
          >
            {loading ? 'Verifying...' : 'Next'}
          </button>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-full text-sm text-muted hover:text-charcoal text-center transition-colors"
          >
            ← Change email
          </button>
        </form>
      </AuthLayout>
    )
  }

  /* ── Step 3 UI ── */
  return (
    <AuthLayout title="Complete Profile">
      <form onSubmit={handleRegister} className="space-y-4">
        <p className="text-sm text-muted text-center -mt-4 mb-1">
          ✓ <span className="text-green-600 font-medium">{email}</span> verified
        </p>

        {[
          { name: 'name', placeholder: 'NAME', type: 'text' },
          { name: 'rollNo', placeholder: 'ROLL NO.', type: 'text' },
          { name: 'phone', placeholder: 'Phone number', type: 'tel' },
        ].map(field => (
          <input
            key={field.name}
            name={field.name}
            type={field.type}
            placeholder={field.placeholder}
            value={form[field.name]}
            onChange={handleChange}
            className="input-field-cream"
            autoComplete={field.name}
          />
        ))}

        <div>
          <label className="block text-sm font-bold text-charcoal mb-2">Profile Photo</label>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <label className="btn-outline text-sm py-2 px-4 cursor-pointer">
                Choose photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePicChange}
                  className="hidden"
                />
              </label>
              <span className="text-sm text-muted">
                {profilePicFile ? profilePicFile.name : 'Optional, upload a profile picture'}
              </span>
            </div>
            {profilePicPreview ? (
              <div className="flex items-center gap-3">
                <img
                  src={profilePicPreview}
                  alt="Profile preview"
                  className="h-24 w-24 rounded-full object-cover border border-slate-200 shadow-sm"
                />
                <button
                  type="button"
                  onClick={clearProfilePic}
                  className="btn-outline text-xs px-3 py-2"
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Password with visibility toggle and requirements */}
        <div>
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="input-field-cream pr-10"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            className="relative -mt-10 float-right mr-3 text-gray-500 hover:text-gray-700"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10a9.97 9.97 0 012.175-5.7M6.36 6.36A9.953 9.953 0 0112 5c5.523 0 10 4.477 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>

          <div className="mt-2 text-sm text-muted space-y-1">
            <PasswordRequirements password={form.password} />
          </div>
        </div>

        {/* Confirm password with toggle */}
        <div>
          <input
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            className="input-field-cream pr-10"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(s => !s)}
            className="relative -mt-10 float-right mr-3 text-gray-500 hover:text-gray-700"
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            {showConfirmPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10a9.97 9.97 0 012.175-5.7M6.36 6.36A9.953 9.953 0 0112 5c5.523 0 10 4.477 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 text-base mt-2 disabled:opacity-60"
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>
    </AuthLayout>
  )
}

function PasswordRequirements({ password }) {
  const checks = {
    length: password?.length >= 6,
    number: /\d/.test(password || ''),
    upper: /[A-Z]/.test(password || ''),
    lower: /[a-z]/.test(password || ''),
  }

  return (
    <ul className="text-xs space-y-1">
      <li className={`${checks.length ? 'text-green-600' : 'text-muted'}`}>● At least 6 characters</li>
      <li className={`${checks.number ? 'text-green-600' : 'text-muted'}`}>● Contains a number</li>
      <li className={`${checks.upper ? 'text-green-600' : 'text-muted'}`}>● Contains an uppercase letter</li>
      <li className={`${checks.lower ? 'text-green-600' : 'text-muted'}`}>● Contains a lowercase letter</li>
    </ul>
  )
}
