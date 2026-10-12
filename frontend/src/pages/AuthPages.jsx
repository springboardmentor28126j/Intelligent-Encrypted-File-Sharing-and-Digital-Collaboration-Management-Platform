import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Notice, PasswordField } from '../components/common'

const RECOVERY_KEYS = {
  email: 'trustshare_recovery_email',
  otpExpiresAt: 'trustshare_recovery_otp_expires_at',
  resetToken: 'trustshare_recovery_reset_token',
}

function clearRecoverySession() {
  Object.values(RECOVERY_KEYS).forEach(key => sessionStorage.removeItem(key))
}

function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-art">
        <span className="brand-mark">T</span>
        <h1>Your files,<br /><em>kept close.</em></h1>
        <p>A calm, private home for the documents that matter.</p>
      </div>
      <div className="auth-panel">
        <div className="auth-logo"><span className="brand-mark">T</span><strong>TrustShare</strong></div>
        {children}
      </div>
    </div>
  )
}

function isMfaChallengeError(error) {
  const message = getErrorMessage(error).toLowerCase()
  return message.includes('mfa') || message.includes('totp') || message.includes('two-factor')
}

export function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [totpCode, setTotpCode] = useState('')
  const [mfaStep, setMfaStep] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (countdown <= 0) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setError('')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [countdown])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  async function submit(event) {
    event.preventDefault()
    if (countdown > 0) return

    setError('')

    if (mfaStep) {
      if (!/^\d{6}$/.test(totpCode)) {
        setError('Enter the 6-digit code from your Authenticator app.')
        return
      }
    }

    setLoading(true)

    try {
      await login(form.email, form.password, mfaStep ? totpCode : undefined)
      navigate('/dashboard')
    } catch (e) {
      const detail = e.response?.data?.detail

      if (e.response?.status === 429) {
        const retrySeconds =
          typeof detail === 'object' && detail.retry_after_seconds
            ? detail.retry_after_seconds
            : 900
        setCountdown(retrySeconds)
      } else if (!mfaStep && isMfaChallengeError(e)) {
        setMfaStep(true)
        setTotpCode('')
        setError('')
      } else if (mfaStep && isMfaChallengeError(e)) {
        setError('Invalid or expired MFA code. Please enter the current code from your Authenticator app.')
      } else {
        setError(getErrorMessage(e))
      }
    } finally {
      setLoading(false)
    }
  }

  function backToPassword() {
    setMfaStep(false)
    setTotpCode('')
    setError('')
  }

  const lockoutNotice = countdown > 0 
    ? `Too many failed attempts. Account locked for ${formatTime(countdown)}.` 
    : error

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={submit}>
        <span className="eyebrow">TRUSTSHARE</span>
        {mfaStep ? (
          <>
            <h2>Two-Factor Authentication</h2>
            <p className="muted">Enter the 6-digit code from your Authenticator app.</p>
            <Notice error={lockoutNotice} />
            <label>
              Authenticator code
              <input
                required
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength="6"
                disabled={countdown > 0 || loading}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <button 
              className="primary full" 
              type="submit" 
              disabled={countdown > 0 || loading}
            >
              {loading ? 'Verifying...' : countdown > 0 ? `Locked (${formatTime(countdown)})` : 'Verify & Sign In'}
            </button>
            <button className="center-link" type="button" onClick={backToPassword} disabled={countdown > 0}>
              Back
            </button>
          </>
        ) : (
          <>
            <h2>Welcome back</h2>
            <p className="muted">Sign in to continue to your workspace.</p>
            <Notice error={lockoutNotice} />
            <label>
              Email
              <input 
                required 
                type="email" 
                disabled={countdown > 0 || loading}
                value={form.email} 
                onChange={e => setForm({ ...form, email: e.target.value })} 
              />
            </label>
            <PasswordField 
              label="Password" 
              disabled={countdown > 0 || loading}
              value={form.password} 
              onChange={e => setForm({ ...form, password: e.target.value })} 
            />
            <button 
              className="primary full" 
              disabled={countdown > 0 || loading}
            >
              {loading ? 'Signing in...' : countdown > 0 ? `Locked (${formatTime(countdown)})` : 'Sign in'}
            </button>
            <Link className="center-link" to="/forgot-password">Forgot password?</Link>
            <p className="switch">New to TrustShare? <Link to="/register">Create account</Link></p>
          </>
        )}
      </form>
    </AuthLayout>
  )
}

export function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm_password: '' })
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      await api.post('/auth/register', form)
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={submit}>
        <span className="eyebrow">TRUSTSHARE</span>
        <h2>Create your account</h2>
        <p className="muted">Start organizing your secure workspace.</p>
        <Notice error={error} />
        <label>Full name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <PasswordField label="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <PasswordField label="Confirm password" value={form.confirm_password} onChange={e => setForm({ ...form, confirm_password: e.target.value })} />
        <button className="primary full">Create account</button>
        <p className="switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthLayout>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      const otpExpiresAt = Date.now() + (data.expires_in_seconds * 1000)
      sessionStorage.setItem(RECOVERY_KEYS.email, email)
      sessionStorage.setItem(RECOVERY_KEYS.otpExpiresAt, String(otpExpiresAt))
      sessionStorage.removeItem(RECOVERY_KEYS.resetToken)
      navigate('/verify-otp', { state: { email, otpExpiresAt } })
    } catch (x) {
      setError(getErrorMessage(x))
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={submit}>
        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h2>Reset your password</h2>
        <p className="muted">Enter your email to receive a six-digit OTP.</p>
        <Notice error={error} />
        <label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <button className="primary full">Send OTP</button>
        <Link className="center-link" to="/login">Back to login</Link>
      </form>
    </AuthLayout>
  )
}

export function VerifyOTP() {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(0)
  const [sending, setSending] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const email = location.state?.email || sessionStorage.getItem(RECOVERY_KEYS.email) || ''

  useEffect(() => {
    const expiresAt = Number(location.state?.otpExpiresAt || sessionStorage.getItem(RECOVERY_KEYS.otpExpiresAt) || 0)
    setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))
  }, [location.state?.otpExpiresAt])

  useEffect(() => {
    if (remaining <= 0) return
    const timer = setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [remaining])

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  async function submit(e) {
    e.preventDefault()
    if (remaining <= 0) return setError('This OTP has expired. Request a new code.')
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp })
      sessionStorage.setItem(RECOVERY_KEYS.resetToken, data.reset_token)
      navigate('/reset-password', { state: { resetToken: data.reset_token } })
    } catch (x) {
      setError(getErrorMessage(x))
    }
  }

  async function resend() {
    if (!email || sending) return
    setSending(true)
    setError('')
    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      setOtp('')
      const otpExpiresAt = Date.now() + ((data.expires_in_seconds || 0) * 1000)
      sessionStorage.setItem(RECOVERY_KEYS.otpExpiresAt, String(otpExpiresAt))
      setRemaining(Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000)))
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={submit}>
        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h2>Verify your OTP</h2>
        <p className="muted">Enter the six-digit code sent to your email.</p>
        <Notice error={error} />
        <label>OTP<input className="otp-input" required pattern="[0-9]{6}" maxLength="6" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
        <div className={`otp-timer ${remaining === 0 ? 'expired' : ''}`}>
          {remaining > 0 ? `Code expires in ${formatTime(remaining)}` : 'Code expired'}
        </div>
        <button className="primary full" disabled={remaining === 0}>Verify OTP</button>
        <button className="center-link" type="button" onClick={resend} disabled={sending || remaining > 0}>
          {sending ? 'Sending...' : remaining > 0 ? 'Resend available after expiry' : 'Send a new code'}
        </button>
        {!email && <Link className="center-link" to="/forgot-password">Request an OTP</Link>}
      </form>
    </AuthLayout>
  )
}

export function ResetPassword() {
  const [form, setForm] = useState({ token: '', new_password: '', confirm_password: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const resetToken = location.state?.resetToken || sessionStorage.getItem(RECOVERY_KEYS.resetToken) || ''

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.new_password !== form.confirm_password) return setError('Passwords do not match.')
    try {
      const { data } = await api.post('/auth/reset-password', { token: form.token || resetToken, new_password: form.new_password })
      setMessage(data.message)
      clearRecoverySession()
      setTimeout(() => navigate('/login'), 900)
    } catch (x) {
      setError(getErrorMessage(x))
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={submit}>
        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h2>Choose a new password</h2>
        <Notice error={error} success={message} />
        <PasswordField label="New password" value={form.new_password} onChange={e => setForm({ ...form, new_password: e.target.value })} />
        <PasswordField label="Confirm password" value={form.confirm_password} onChange={e => setForm({ ...form, confirm_password: e.target.value })} />
        <button className="primary full">Reset password</button>
      </form>
    </AuthLayout>
  )
}