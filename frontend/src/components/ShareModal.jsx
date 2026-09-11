import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../services/api'

export default function ShareModal({ file, onClose, onShare, onGenerateLink, onRevokeLink, existingShares = [] }) {
  const [recipients, setRecipients] = useState([])
  const [emailInput, setEmailInput] = useState('')
  const [permission, setPermission] = useState('VIEWER')
  const [secureLink, setSecureLink] = useState(null)
  const [expiration, setExpiration] = useState('never')
  const [linkError, setLinkError] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [managedShares, setManagedShares] = useState(existingShares)
  const [editingShareId, setEditingShareId] = useState(null)
  const [editingPermission, setEditingPermission] = useState('VIEWER')
  const [shareManagementError, setShareManagementError] = useState('')

  useEffect(() => {
    setRecipients([])
    setEmailInput('')
    setPermission('VIEWER')
    setSecureLink(null)
    setExpiration('never')
    setLinkError('')
    setLinkCopied(false)
  }, [file])

  useEffect(() => {
    setManagedShares(existingShares)
    setEditingShareId(null)
    setShareManagementError('')
  }, [existingShares])

  function parseEmails(value) {
    return [...new Set(value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))]
  }

  function addRecipients() {
    const values = parseEmails(emailInput)
    if (!values.length) return
    setRecipients((current) => {
      const existing = new Set(current.map((item) => item.email))
      const next = [...current]
      for (const email of values) {
        if (!existing.has(email)) {
          next.push({ id: `${email}-${Date.now()}-${Math.random()}`, email })
          existing.add(email)
        }
      }
      return next
    })
    setEmailInput('')
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
      event.preventDefault()
      addRecipients()
    }
  }

  function removeRecipient(email) {
    setRecipients((current) => current.filter((item) => item.email !== email))
  }

  async function generateLink() {
    setLinkBusy(true)
    setLinkError('')
    try {
      setSecureLink(await onGenerateLink(expiration))
    } catch (error) {
      setLinkError(getErrorMessage(error))
    } finally {
      setLinkBusy(false)
    }
  }

  async function revokeLink() {
    setLinkBusy(true)
    setLinkError('')
    try {
      await onRevokeLink(secureLink.id)
      setSecureLink(null)
    } catch (error) {
      setLinkError(getErrorMessage(error))
    } finally {
      setLinkBusy(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(secureLink.share_url)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 1800)
    } catch {
      setLinkError('The link could not be copied. Please copy it manually.')
    }
  }

  function beginEditShare(share) {
    setEditingShareId(share.id)
    setEditingPermission(share.permission)
    setShareManagementError('')
  }

  function cancelEditShare() {
    setEditingShareId(null)
    setShareManagementError('')
  }

  async function saveSharePermission(share) {
    try {
      const response = await api.patch(`/files/${file.id}/shares/${share.id}`, { permission: editingPermission })
      setManagedShares((current) =>
        current.map((item) => (item.id === share.id ? { ...item, ...response.data, permission: editingPermission } : item))
      )
      setEditingShareId(null)
      setShareManagementError('')
    } catch (error) {
      setShareManagementError(getErrorMessage(error))
    }
  }

  async function removeShare(share) {
    if (!window.confirm(`Remove access for ${share.user_email}?`)) return
    try {
      await api.delete(`/files/${file.id}/shares/${share.id}`)
      setManagedShares((current) => current.filter((item) => item.id !== share.id))
      setShareManagementError('')
    } catch (error) {
      setShareManagementError(getErrorMessage(error))
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="small-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h2>Share "{file.original_filename}"</h2>
        
        {/* Email Sharing */}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!recipients.length) return
            onShare({ recipients: recipients.map((item) => item.email), permission })
          }}
        >
          <label>Recipients</label>
          <div className="share-chip-stack">
            {recipients.map((item) => (
              <span className="share-chip" key={item.id}>
                <span>{item.email}</span>
                <button
                  type="button"
                  className="chip-remove"
                  aria-label={`Remove ${item.email}`}
                  onClick={() => removeRecipient(item.email)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="share-input-row">
            <input
              type="text"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add email and press Enter"
            />
          </div>
          <button type="button" className="ghost-button" onClick={addRecipients}>
            + Add
          </button>

          <label>
            Permission
            <select value={permission} onChange={(event) => setPermission(event.target.value)}>
              <option value="VIEWER">Viewer</option>
              <option value="EDITOR">Editor</option>
            </select>
          </label>

          <div className="modal-buttons">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={!recipients.length}>
              Share
            </button>
          </div>
        </form>

        {/* 4C: Secure Link with Expiration */}
        <section className="secure-link-section">
          <h3>Secure Link</h3>
          {secureLink ? (
            <>
              {secureLink.expires_at && (
                <p className="muted" style={{ fontSize: '13px', margin: '4px 0 10px' }}>
                  Expires: {new Date(secureLink.expires_at).toLocaleString()}
                </p>
              )}
              <div className="secure-link-row">
                <input readOnly value={secureLink.share_url} aria-label="Generated secure link" />
                <button type="button" className="ghost-button" onClick={copyLink}>
                  {linkCopied ? 'Copied! ✓' : 'Copy Link'}
                </button>
              </div>
              <button type="button" className="link-button danger-text" disabled={linkBusy} onClick={revokeLink}>
                Revoke link
              </button>
            </>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={{ margin: 0 }}>
                Expires in
                <select value={expiration} onChange={(e) => setExpiration(e.target.value)}>
                  <option value="never">Never</option>
                  <option value="1m">1 minute (Quick Test)</option>
                  <option value="1h">1 hour</option>
                  <option value="1d">1 day</option>
                  <option value="7d">7 days</option>
                </select>
              </label>
              <button type="button" className="primary" disabled={linkBusy} onClick={generateLink}>
                {linkBusy ? 'Generating...' : 'Generate Secure Link'}
              </button>
            </div>
          )}
          {linkError && <p className="notice error">{linkError}</p>}
        </section>

        {/* Managed Shares List */}
        {managedShares.length > 0 && (
          <div className="share-list">
            <h3>People with access</h3>
            {managedShares.map((share) => (
              <div className="share-row" key={share.id}>
                <span>
                  <strong>{share.user_name}</strong>
                  <small>{share.user_email}</small>
                  {editingShareId === share.id ? (
                    <label>
                      Permission
                      <select value={editingPermission} onChange={(event) => setEditingPermission(event.target.value)}>
                        <option value="VIEWER">Viewer</option>
                        <option value="EDITOR">Editor</option>
                      </select>
                    </label>
                  ) : (
                    <span className="permission-pill">{share.permission}</span>
                  )}
                </span>
                {editingShareId === share.id ? (
                  <span>
                    <button type="button" className="ghost-button" onClick={() => saveSharePermission(share)}>
                      Save
                    </button>
                    <button type="button" className="link-button" onClick={cancelEditShare}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span>
                    <button type="button" className="ghost-button" onClick={() => beginEditShare(share)}>
                      Edit Permission
                    </button>
                    <button type="button" className="link-button danger-text" onClick={() => removeShare(share)}>
                      Remove Access
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {shareManagementError && <p className="notice error">{shareManagementError}</p>}
      </div>
    </div>
  )
}