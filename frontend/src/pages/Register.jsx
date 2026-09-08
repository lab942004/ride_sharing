import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { authAPI } from '../services/api'
import { useToast } from '../context/ToastContext'
import { AuthLayout } from './Login'
import { usePageMeta } from '../hooks/usePageMeta'
import { SUPPORT_EMAIL } from '../config/site'

const STORAGE_KEY = 'rideshare_signup_wizard'

/**
 * SIGNUP WIZARD (multi-organization):
 *  Step 0: Account type — organization vs general
 *  Step 1: Email + OTP verification
 *  Step 2: Complete profile (name, ID, phone with +91 prefix, pic, password)
 */
export default function Register() {
  usePageMeta({
    title: 'Create Account',
    description:
      'Sign up for RideShare — choose an organization or general account, verify your email with an OTP, then complete your profile to start sharing rides.',
    keywords: 'sign up, create account, ride share registration, carpool signup, join rideshare',
    path: '/register',
  })

  const toast = useToast()

  // Restore wizard state across reloads (OTP itself is short-lived server-side)
  const saved = (() => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
  })()

  const [step, setStep] = useState(saved.step ?? 0)
  const [accountType, setAccountType] = useState(saved.accountType ?? null)
  const [email, setEmail] = useState(saved.email ?? '')
  const [otpSent, setOtpSent] = useState(Boolean(saved.otpSent))
  const [otp, setOtp] = useState('')
  const [domainNotice, setDomainNotice] = useState(null)
  const [isGmail, setIsGmail] = useState(false)
  const [assignedSequence, setAssignedSequence] = useState(null)
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [form, setForm] = useState({
    name: '',
    identifier: '', // roll no / employee ID (organization branch only)
    phone: '', // digits only — +91 is a fixed display prefix
    password: '',
    confirmPassword: '',
  })
  const [profilePicFile, setProfilePicFile] = useState(null)
  const [profilePicPreview, setProfilePicPreview] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Persist wizard state
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, accountType, email, otpSent }))
  }, [step, accountType, email, otpSent])

  // Resend-OTP cooldown timer
  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const set = (k) => (e) => {
    let v = e.target.value
    if (k === 'phone') v = v.replace(/\D/g, '').slice(0, 10)
    if (k === 'identifier') v = v.trim()
    setForm((f) => ({ ...f, [k]: v }))
  }

  // Generic handler for fields that carry their own `name` attribute
  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  /* ── Step 0: account type selection ── */
  const chooseAccountType = (type) => {
    setAccountType(type)
    setStep(1)
  }

  /* ── Step 1: Send OTP ── */
  const handleSendOtp = async (e) => {
    e.preventDefault()
    setEmailError('')
    if (!email) { setEmailError('Enter your email address'); return }
    try {
      setLoading(true)
      await authAPI.sendOtp(email, accountType)
      setOtpSent(true)
      setDomainNotice(null)
      setResendIn(30)
      toast.success('OTP sent! Check your inbox.')
    } catch (err) {
      const res = err.response
      if (res?.status === 422 && res.data?.code === 'DOMAIN_NOT_REGISTERED') {
        setDomainNotice(res.data.message)
      } else if (res?.status === 409) {
        setEmailError(res.data?.message || 'This email is already registered.')
      } else {
        toast.error(res?.data?.message || 'Failed to send OTP')
      }
    } finally {
      setLoading(false)
    }
  }

  /* ── Step 1: Verify OTP ── */
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otp || otp.length < 4) { toast.error('Enter a valid OTP'); return }
    try {
      setLoading(true)
      const { data } = await authAPI.verifyOtp(email, otp)
      setIsGmail(Boolean(data?.data?.isGmail))
      setStep(2)
      toast.success('Email verified!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'OTP verification failed')
    } finally {
      setLoading(false)
    }
  }

  /* ── Step 2: Create account ── */
  const handleRegister = async (e) => {
    e.preventDefault()
    const { name, identifier, phone, password, confirmPassword } = form
    if (!name.trim()) { toast.error('Please enter your name'); return }
    if (!isGmail && !identifier.trim()) { toast.error('Please enter your roll number / employee ID'); return }
    if (phone.length !== 10) { toast.error('Enter a valid 10-digit phone number'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('email', email)
      formData.append('accountType', accountType || 'general')
      formData.append('name', name)
      if (!isGmail) formData.append('identifier', identifier)
      formData.append('phone', phone)
      formData.append('password', password)
      if (profilePicFile) formData.append('profilePic', profilePicFile)

      const { data } = await authAPI.register(formData)
      const user = data?.data?.user
      if (user?.identifierType === 'SEQUENCE' && user?.identifier) {
        // gmail user — show their immutable RideShare ID before they log in
        setAssignedSequence(user.identifier)
      }
      toast.success('Account created!')
      sessionStorage.removeItem(STORAGE_KEY)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const resendOtp = async () => {
    if (resendIn > 0) return
    try {
      setLoading(true)
      await authAPI.sendOtp(email, accountType)
      setResendIn(30)
      toast.success('OTP resent!')
    } catch {
      toast.error('Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleProfilePicChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setProfilePicFile(file)
  }

  const clearProfilePic = () => setProfilePicFile(null)

  useEffect(() => {
    if (!profilePicFile) { setProfilePicPreview(''); return }
    const previewUrl = URL.createObjectURL(profilePicFile)
    setProfilePicPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [profilePicFile])

  /* ── Step 0 UI: Account type ── */
  if (step === 0) {
    return (
      <AuthLayout title="Create New Account">
        <img src="/logo.png" alt="RideShare logo" className="h-16 w-16 mx-auto mb-4 rounded-2xl object-cover shadow-sm" />
        <p className="text-sm text-muted text-center mb-5">How would you like to join?</p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => chooseAccountType('organization')}
            className="w-full text-left p-4 rounded-xl border-2 border-amber-200 bg-white hover:border-primary hover:shadow-btn transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">🏛️</span>
              <div>
                <p className="font-bold text-charcoal">I belong to an organization</p>
                <p className="text-sm text-muted mt-0.5">
                  College / company email, e.g. <span className="font-mono">you@yourcollege.edu</span>
                </p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => chooseAccountType('general')}
            className="w-full text-left p-4 rounded-xl border-2 border-amber-200 bg-white hover:border-primary hover:shadow-btn transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">👤</span>
              <div>
                <p className="font-bold text-charcoal">General user</p>
                <p className="text-sm text-muted mt-0.5">
                  Any email — including <span className="font-mono">gmail.com</span>
                </p>
              </div>
            </div>
          </button>
        </div>
        <div className="text-center mt-5">
          <Link to="/login" className="text-sm text-primary hover:text-primary-dark transition-colors">
            Already have an account? Log in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  /* ── Step 1 UI: Email + OTP ── */
  if (step === 1) {
    return (
      <AuthLayout title={otpSent ? 'Verify OTP' : 'Enter your email'}>
        <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-5">
          {otpSent ? (
            <>
              <p className="text-sm text-muted text-center -mt-4">
                OTP sent to <span className="font-semibold text-charcoal">{email}</span>
              </p>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="OTP"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="input-field tracking-[0.5em] text-center text-xl font-mono pr-20"
                />
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={loading || resendIn > 0}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-semibold hover:text-primary-dark disabled:opacity-50"
                >
                  {resendIn > 0 ? `${resendIn}s` : 'resend'}
                </button>
              </div>
            </>
          ) : (
            <>
              {domainNotice && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
                  {domainNotice}{' '}
                  {SUPPORT_EMAIL && (
                    <>Contact the admin at{' '}
                      <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline">{SUPPORT_EMAIL}</a>.
                    </>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-charcoal mb-2">
                  {accountType === 'organization' ? 'Organization Email' : 'Email Address'}
                </label>
                <input
                  type="email"
                  placeholder={accountType === 'organization' ? 'you@yourcollege.edu' : 'you@example.com'}
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailError('') }}
                  className="input-field-cream"
                  autoComplete="email"
                />
                {emailError ? <p className="mt-2 text-sm text-red-600">{emailError}</p> : null}
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base disabled:opacity-60"
          >
            {loading ? 'Please wait...' : otpSent ? 'Verify' : 'Send OTP'}
          </button>

          <button
            type="button"
            onClick={() => { if (otpSent) { setOtpSent(false); setOtp('') } else setStep(0) }}
            className="w-full text-sm text-muted hover:text-charcoal text-center transition-colors"
          >
            ← Back
          </button>
        </form>
      </AuthLayout>
    )
  }

  /* ── Success: account created (shows the immutable RideShare ID for
        sequence-type users so they know their assigned number) ── */
  if (assignedSequence) {
    return (
      <AuthLayout title="Account Created!">
        <div className="text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <p className="text-sm text-muted">
            Your account has been created successfully.
          </p>
          <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl p-5">
            <p className="text-xs text-muted uppercase tracking-wide">Your RideShare ID</p>
            <p className="font-mono text-3xl font-bold text-primary mt-1">#{assignedSequence}</p>
            <p className="text-xs text-muted mt-2">
              This number is permanent and cannot be changed. Use it to identify yourself on rides.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="btn-primary w-full py-3 text-base"
          >
            Continue to Login
          </button>
        </div>
      </AuthLayout>
    )
  }

  /* ── Step 2 UI: Complete Profile ── */
  return (
    <AuthLayout title="Complete Profile">
      <form onSubmit={handleRegister} className="space-y-4">
                <p className="text-sm text-muted text-center -mt-4 mb-1">
          ✓ <span className="text-green-600 font-medium">{email}</span> verified
          {isGmail && assignedSequence && (
            <span className="block text-xs mt-1">
              Your RideShare ID: <strong>#{assignedSequence}</strong>
            </span>
          )}
        </p>

        {/* Name */}
        <input
          name="name"
          type="text"
          placeholder="NAME"
          value={form.name}
          onChange={set('name')}
          className="input-field-cream"
          autoComplete="name"
        />

        {/* Roll no / Employee ID — hidden entirely for gmail users (§5):
            gmail accounts get an immutable server-generated sequence number. */}
        {!isGmail && (
          <input
            name="identifier"
            type="text"
            placeholder="ROLL NO. / EMPLOYEE ID"
            value={form.identifier}
            onChange={set('identifier')}
            className="input-field-cream"
          />
        )}

        {/* Phone with fixed, non-editable +91 prefix */}
        <div>
          <div className="flex items-stretch">
            <span className="flex items-center px-3 rounded-l-lg bg-amber-100 text-charcoal font-bold border-2 border-r-0 border-slate-200 select-none">
              +91
            </span>
            <input
              name="phone"
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              value={form.phone}
              onChange={set('phone')}
              className="input-field-cream rounded-l-none border-l-0 flex-1"
              autoComplete="tel-national"
            />
          </div>
          <p className="text-xs text-muted mt-1">We've already added +91 for you.</p>
        </div>

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
