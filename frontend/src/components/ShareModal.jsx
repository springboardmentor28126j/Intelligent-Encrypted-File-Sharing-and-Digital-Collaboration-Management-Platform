import { useEffect, useState } from 'react'

export default function ShareModal({ file, onClose, onShare, existingShares = [] }) {
  const [recipients, setRecipients] = useState([])
  const [emailInput, setEmailInput] = useState('')
  const [permission, setPermission] = useState('VIEWER')

  useEffect(() => {
    setRecipients([])
    setEmailInput('')
    setPermission('VIEWER')
  }, [file])

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

  return <div className="modal-backdrop" onClick={onClose}><div className="small-modal" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><h2>Share "{file.original_filename}"</h2><form onSubmit={(event) => { event.preventDefault(); if (!recipients.length) return; onShare({ recipients: recipients.map((item) => item.email), permission }) }}><label>Recipients</label><div className="share-chip-stack">{recipients.map((item) => <span className="share-chip" key={item.id}><span>{item.email}</span><button type="button" className="chip-remove" aria-label={`Remove ${item.email}`} onClick={() => removeRecipient(item.email)}>×</button></span>)}</div><div className="share-input-row"><input type="text" value={emailInput} onChange={(event) => setEmailInput(event.target.value)} onKeyDown={handleKeyDown} placeholder="Add email and press Enter" /></div><button type="button" className="ghost-button" onClick={addRecipients}>+ Add</button><label>Permission<select value={permission} onChange={event => setPermission(event.target.value)}><option value="VIEWER">Viewer</option><option value="EDITOR">Editor</option></select></label><div className="modal-buttons"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={!recipients.length}>Share</button></div></form>{existingShares.length > 0 && <div className="share-list"><h3>People with access</h3>{existingShares.map(share => <div className="share-row" key={share.id}><span><strong>{share.user_name}</strong><small>{share.user_email}</small></span><span className="permission-pill">{share.permission}</span></div>)}</div>}</div></div>
}
