import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Notice, PasswordField } from '../components/common'

function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-art">
        <span className="brand-mark">T</span>
        <h1>Your files,<br /><em>kept close.</em></h1>
        <p>A calm, private home for the documents that matter.</p>
      </div>
      {children}
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
      await api.post('/auth/forgot-password', { email })
      navigate('/verify-otp', { state: { email } })
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
  const navigate = useNavigate()
  const email = window.history.state.usr?.email || ''

  async function submit(e) {
    e.preventDefault()
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp })
      navigate('/reset-password', { state: { resetToken: data.reset_token } })
    } catch (x) {
      setError(getErrorMessage(x))
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={submit}>
        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h2>Verify your OTP</h2>
        <p className="muted">Enter the six-digit code sent to your email.</p>
        <Notice error={error} />
        <label>OTP<input required pattern="[0-9]{6}" maxLength="6" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} /></label>
        <button className="primary full">Verify OTP</button>
      </form>
    </AuthLayout>
  )
}

export function ResetPassword() {
  const [form, setForm] = useState({ token: '', new_password: '', confirm_password: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const resetToken = window.history.state.usr?.resetToken || ''

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.new_password !== form.confirm_password) return setError('Passwords do not match.')
    try {
      const { data } = await api.post('/auth/reset-password', { token: form.token || resetToken, new_password: form.new_password })
      setMessage(data.message)
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