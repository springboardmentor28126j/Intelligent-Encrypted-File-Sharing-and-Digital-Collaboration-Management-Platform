import { useEffect, useRef, useState } from 'react'

export default function FileActions({ file, onOpen, onDownload, onRename, onDelete }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  useEffect(() => {
    function close(event) { if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  function choose(action) { setOpen(false); action(file) }
  return <div className="file-actions" ref={menuRef}><button type="button" className="dots-button" aria-label={`Actions for ${file.original_filename}`} aria-expanded={open} onClick={() => setOpen(!open)}>...</button>{open && <div className="file-actions-menu"><button type="button" onClick={() => choose(onOpen)}>Open / Preview</button><button type="button" onClick={() => choose(onDownload)}>Download</button><button type="button" onClick={() => choose(onRename)}>Rename</button><button type="button" className="danger-text" onClick={() => choose(onDelete)}>Delete</button></div>}</div>
}
