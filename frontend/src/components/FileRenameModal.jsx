import { useEffect, useState } from 'react'

export default function FileRenameModal({ file, onClose, onSave }) {
  // Separate filename and extension
  const lastDotIndex = file.original_filename.lastIndexOf('.')
  const originalBase = lastDotIndex !== -1 ? file.original_filename.slice(0, lastDotIndex) : file.original_filename
  const extension = lastDotIndex !== -1 ? file.original_filename.slice(lastDotIndex) : ''

  const [nameWithoutExt, setNameWithoutExt] = useState(originalBase)

  useEffect(() => {
    const dotIndex = file.original_filename.lastIndexOf('.')
    setNameWithoutExt(dotIndex !== -1 ? file.original_filename.slice(0, dotIndex) : file.original_filename)
  }, [file])

  function handleSubmit(event) {
    event.preventDefault()
    // Automatically re-attaches the original extension
    const finalFullName = `${nameWithoutExt.trim()}${extension}`
    onSave(finalFullName)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="small-modal"
        role="dialog"
        aria-modal="true"
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
      >
        <h2>Rename file</h2>
        <label>
          File name
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              autoFocus
              required
              style={{ flex: 1 }}
              value={nameWithoutExt}
              onChange={e => setNameWithoutExt(e.target.value)}
            />
            {extension && <strong style={{ color: '#697872' }}>{extension}</strong>}
          </div>
        </label>
        <div className="modal-buttons">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Save</button>
        </div>
      </form>
    </div>
  )
}