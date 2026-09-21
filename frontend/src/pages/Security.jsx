import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import api, { getErrorMessage } from '../services/api'
import { Notice } from '../components/common'
import { useAuth } from '../context/AuthContext'

function digitsOnly(value) {
  return value.replace(/\D/g, '').slice(0, 6)
}

function formatSecretForDisplay(secret) {
  return String(secret || '').replace(/(.{4})/g, '$1 ').trim()
}

function totpValidationMessage(code) {
  if (!code) return 'Enter a 6-digit numeric verification code.'
  if (!/^\d{6}$/.test(code)) return 'The verification code must contain exactly 6 digits.'
  return ''
}

function isInvalidCodeError(error) {
  const status = error.response?.status
  const detail = String(error.response?.data?.detail || '').toLowerCase()
  return status === 400 && (detail.includes('invalid') || detail.includes('mfa code'))
}

function TotpInput({ id, label, value, onChange }) {
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        required
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(digitsOnly(event.target.value))}
      />
    </label>
  )
}

function SetupModal({ otpauthUri, secret, code, error, busy, copied, onCodeChange, onCopy, onVerify, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form
        className="mfa-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mfa-setup-title"
        onSubmit={onVerify}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <h2 id="mfa-setup-title">Set up your authenticator app</h2>
          <button type="button" className="modal-close" aria-label="Cancel MFA setup" onClick={onCancel}>×</button>
        </div>
        <Notice error={error} />
        <div className="qr-frame">
          {otpauthUri ? (
            <QRCodeSVG value={otpauthUri} size={256} level="M" marginSize={4} title="Authenticator setup QR code" />
          ) : null}
        </div>
        <p className="muted center-text">Scan this QR code using Google Authenticator.</p>
        <ol className="mfa-steps">
          <li>Open Google Authenticator.</li>
          <li>Tap +.</li>
          <li>Scan the QR code OR choose &quot;Enter a setup key&quot;.</li>
          <li>Add the TrustShare account.</li>
          <li>Enter the 6-digit code shown by Google Authenticator below.</li>
        </ol>
        <div className="secret-block">
          <p className="muted">Can&apos;t scan the QR code?</p>
          <strong>Secret Key</strong>
          <code className="secret-key">{formatSecretForDisplay(secret)}</code>
          <button type="button" className="ghost-button" onClick={onCopy}>
            {copied ? 'Copied' : 'Copy Secret Key'}
          </button>
        </div>
        <TotpInput id="mfa-enable-code" label="Enter 6-digit verification code" value={code} onChange={onCodeChange} />
        <div className="modal-buttons">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Verifying...' : 'Verify & Enable MFA'}
          </button>
        </div>
      </form>
    </div>
  )
}

function DisableModal({ code, error, busy, onCodeChange, onDisable, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form
        className="small-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mfa-disable-title"
        onSubmit={onDisable}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <h2 id="mfa-disable-title">Disable Multi-Factor Authentication?</h2>
          <button type="button" className="modal-close" aria-label="Cancel" onClick={onCancel}>×</button>
        </div>
        <p className="muted">Disabling MFA will remove the additional verification step from your account.</p>
        <Notice error={error} />
        <TotpInput id="mfa-disable-code" label="Current 6-digit authenticator code" value={code} onChange={onCodeChange} />
        <div className="modal-buttons">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="danger-button" disabled={busy}>
            {busy ? 'Disabling...' : 'Disable MFA'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function Security() {
  const { user, updateUser } = useAuth()
  const [mfaEnabled, setMfaEnabled] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [setupOpen, setSetupOpen] = useState(false)
  const [setupSecret, setSetupSecret] = useState('')
  const [otpauthUri, setOtpauthUri] = useState('')
  const [setupCode, setSetupCode] = useState('')
  const [setupError, setSetupError] = useState('')
  const [setupBusy, setSetupBusy] = useState(false)
  const [enableBusy, setEnableBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [disableCode, setDisableCode] = useState('')
  const [disableError, setDisableError] = useState('')
  const [disableBusy, setDisableBusy] = useState(false)

  const applyStatus = useCallback((enabled) => {
    setMfaEnabled(enabled)
    if (user) updateUser({ ...user, mfa_enabled: enabled })
  }, [updateUser, user])

  const refreshStatus = useCallback(async () => {
    const { data } = await api.get('/auth/mfa/status')
    const enabled = Boolean(data.mfa_enabled)
    applyStatus(enabled)
    return enabled
  }, [applyStatus])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api.get('/auth/mfa/status')
      .then(({ data }) => {
        if (!active) return
        setMfaEnabled(Boolean(data.mfa_enabled))
      })
      .catch((requestError) => {
        if (!active) return
        if (requestError.response?.status === 401) {
          setError('Your session has expired. Please sign in again.')
        } else {
          setError(getErrorMessage(requestError) || 'Unable to load MFA status.')
        }
        setMfaEnabled(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function clearSetupState() {
    setSetupSecret('')
    setOtpauthUri('')
    setSetupCode('')
    setSetupError('')
    setSetupBusy(false)
    setEnableBusy(false)
    setCopied(false)
    setSetupOpen(false)
  }

  function clearDisableState() {
    setDisableCode('')
    setDisableError('')
    setDisableBusy(false)
    setDisableOpen(false)
  }

  async function startSetup() {
    setMessage('')
    setError('')
    setSetupBusy(true)
    try {
      const { data } = await api.post('/auth/mfa/setup')
      setSetupSecret(data.secret || '')
      setOtpauthUri(data.otpauth_uri || '')
      setSetupCode('')
      setSetupError('')
      setCopied(false)
      setSetupOpen(true)
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        setError('Your session has expired. Please sign in again.')
      } else {
        setError(getErrorMessage(requestError) || 'Unable to start MFA setup.')
      }
    } finally {
      setSetupBusy(false)
    }
  }

  async function copySecret() {
    if (!setupSecret) return
    try {
      await navigator.clipboard.writeText(setupSecret)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setSetupError('Could not copy the secret key. Select and copy it manually.')
    }
  }

  async function verifyAndEnable(event) {
    event.preventDefault()
    const validationError = totpValidationMessage(setupCode)
    if (validationError) {
      setSetupError(validationError)
      return
    }
    setSetupError('')
    setEnableBusy(true)
    try {
      await api.post('/auth/mfa/enable', { totp_code: setupCode })
      clearSetupState()
      setMessage('MFA Enabled')
      try {
        await refreshStatus()
      } catch {
        applyStatus(true)
      }
    } catch (requestError) {
      if (isInvalidCodeError(requestError)) {
        setSetupError('Invalid verification code. Please enter the current 6-digit code from your authenticator app.')
      } else if (requestError.response?.status === 401) {
        setSetupError('Your session has expired. Please sign in again.')
      } else {
        setSetupError(getErrorMessage(requestError) || 'Unable to enable MFA.')
      }
    } finally {
      setEnableBusy(false)
    }
  }

  async function disableMfa(event) {
    event.preventDefault()
    const validationError = totpValidationMessage(disableCode)
    if (validationError) {
      setDisableError(validationError)
      return
    }
    setDisableError('')
    setDisableBusy(true)
    try {
      await api.post('/auth/mfa/disable', { totp_code: disableCode })
      clearDisableState()
      setMessage('MFA has been disabled.')
      try {
        await refreshStatus()
      } catch {
        applyStatus(false)
      }
    } catch (requestError) {
      if (isInvalidCodeError(requestError)) {
        setDisableError('Invalid verification code. MFA was not disabled.')
      } else if (requestError.response?.status === 401) {
        setDisableError('Your session has expired. Please sign in again.')
      } else {
        setDisableError(getErrorMessage(requestError) || 'Unable to disable MFA.')
      }
    } finally {
      setDisableBusy(false)
    }
  }

  return (
    <section className="panel form-panel security-card">
      <div className="security-heading">
        <span className="mfa-icon" aria-hidden="true">⛨</span>
        <div>
          <h2>Security</h2>
          <p className="muted">Protect your TrustShare account with extra verification.</p>
        </div>
      </div>
      <Notice error={error} success={message} />
      <div className="mfa-panel">
        <div className="mfa-status-row">
          <div>
            <h3>Multi-Factor Authentication (MFA)</h3>
            <p className="muted">Add an extra layer of security to your TrustShare account using an authenticator app.</p>
          </div>
          <div className="mfa-status-label">
            <span className="muted">MFA Status:</span>
            {loading ? (
              <span className="status-badge">Loading</span>
            ) : mfaEnabled === true ? (
              <span className="status-badge enabled">Enabled</span>
            ) : mfaEnabled === false ? (
              <span className="status-badge disabled">Disabled</span>
            ) : (
              <span className="status-badge">Unavailable</span>
            )}
          </div>
        </div>
        {loading ? <p className="muted">Loading MFA status...</p> : null}
        {!loading && mfaEnabled === true ? (
          <>
            <p>MFA is enabled for your account.</p>
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                setMessage('')
                setDisableError('')
                setDisableCode('')
                setDisableOpen(true)
              }}
            >
              Disable MFA
            </button>
          </>
        ) : null}
        {!loading && mfaEnabled === false ? (
          <button type="button" className="primary" disabled={setupBusy} onClick={startSetup}>
            {setupBusy ? 'Preparing setup...' : 'Enable MFA'}
          </button>
        ) : null}
      </div>
      {setupOpen ? (
        <SetupModal
          otpauthUri={otpauthUri}
          secret={setupSecret}
          code={setupCode}
          error={setupError}
          busy={enableBusy}
          copied={copied}
          onCodeChange={setSetupCode}
          onCopy={copySecret}
          onVerify={verifyAndEnable}
          onCancel={clearSetupState}
        />
      ) : null}
      {disableOpen ? (
        <DisableModal
          code={disableCode}
          error={disableError}
          busy={disableBusy}
          onCodeChange={setDisableCode}
          onDisable={disableMfa}
          onCancel={clearDisableState}
        />
      ) : null}
    </section>
  )
}
