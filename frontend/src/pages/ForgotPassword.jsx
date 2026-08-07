import { useState } from 'react'
import { useNavigate } from 'react-router'
import { authAPI } from '../services/api'
import { useToast } from '../context/ToastContext'
import { AuthLayout } from './Login'

export default function ForgotPassword() {
  const [step, setStep] = useState(1) // 1=email, 2=otp+newpassword
  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [email, setEmail] = useState('') // actual email for reset
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!emailOrPhone) { toast.error('Enter your email'); return }
    try {
      setLoading(true)
      await authAPI.forgotPassword(emailOrPhone)
      // Store the value as email for the reset step
      setEmail(emailOrPhone)
      toast.success('OTP sent! Check your email.')
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    if (!otp) { toast.error('Enter the OTP'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    try {
      setLoading(true)
      await authAPI.resetPassword(email, otp, password)
      toast.success('Password changed successfully!')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  if (step === 2) {
    return (
      <AuthLayout title="Change Password">
        <form onSubmit={handleReset} className="space-y-4">
          <p className="text-sm text-muted text-center -mt-4 mb-2">
            OTP sent to <span className="font-semibold text-charcoal">{email}</span>
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="OTP verify"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              className="input-field tracking-widest text-center font-mono pr-16"
              maxLength={6}
            />
            <button
              type="button"
              onClick={handleSendOtp}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-semibold"
            >
              resend
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-field pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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
          </div>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="input-field pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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
            className="btn-primary w-full py-3 text-base disabled:opacity-60"
          >
            {loading ? 'Changing...' : 'Change Password'}
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-full text-sm text-muted hover:text-charcoal text-center"
          >
            ← Back
          </button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Forget Password">
      <form onSubmit={handleSendOtp} className="space-y-5">
        <input
          type="text"
          placeholder="Email/ Phone No."
          value={emailOrPhone}
          onChange={e => setEmailOrPhone(e.target.value)}
          className="input-field"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 text-base disabled:opacity-60"
        >
          {loading ? 'Sending...' : 'Send OTP'}
        </button>
      </form>
    </AuthLayout>
  )
}
