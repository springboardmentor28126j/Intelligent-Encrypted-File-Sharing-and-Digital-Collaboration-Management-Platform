import { useEffect, useState } from 'react'

export default function FileRenameModal({ file, onClose, onSave }) {
  const [name, setName] = useState(file.original_filename)
  useEffect(() => setName(file.original_filename), [file])
  return <div className="modal-backdrop" onClick={onClose}><form className="small-modal" role="dialog" aria-modal="true" onSubmit={event => { event.preventDefault(); onSave(name) }} onClick={event => event.stopPropagation()}><h2>Rename file</h2><label>File name<input autoFocus required value={name} onChange={event => setName(event.target.value)} /></label><div className="modal-buttons"><button type="button" onClick={onClose}>Cancel</button><button className="primary">Save</button></div></form></div>
}
