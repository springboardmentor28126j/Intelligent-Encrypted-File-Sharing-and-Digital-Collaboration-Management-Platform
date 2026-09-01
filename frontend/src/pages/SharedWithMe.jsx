import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../services/api'
import FilePreview from '../components/FilePreview'
import { Notice } from '../components/common'

export default function SharedWithMe() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    api.get('/files/shared-with-me')
      .then(r => setItems(r.data))
      .catch(e => setError(getErrorMessage(e)))
  }, [])

  async function openPreview(file) {
    const previewable = file.file_type === 'application/pdf' || file.file_type.startsWith('image/') || file.file_type.startsWith('audio/') || file.file_type.startsWith('video/')
    if (!previewable) return setPreview({ ...file, previewUrl: '' })
    try {
      const response = await api.get(`/files/${file.id}/download`, { responseType: 'blob' })
      setPreview({ ...file, previewUrl: URL.createObjectURL(response.data) })
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  async function download(file) {
    try {
      const response = await api.get(`/files/${file.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = file.original_filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  return <><section className="panel"><div className="panel-title"><h2>Shared with me</h2></div><Notice error={error} />{items.length ? <div className="table">{items.map(file => <div className="file-row managed-file-row" key={file.id}><span className="file-type-icon">{file.original_filename.split('.').pop()?.toUpperCase() || 'FILE'}</span><div className="file-summary"><strong>{file.original_filename}</strong><small>Shared by {file.owner_name} · Permission: {file.permission}</small></div><div className="file-actions"><button type="button" className="dots-button" onClick={() => openPreview(file)}>◉</button><button type="button" className="dots-button" onClick={() => download(file)}>↓</button></div></div>)}</div> : <p className="empty">No files shared with you yet.</p>}</section>{preview && <FilePreview file={preview} onClose={() => { if (preview.previewUrl) URL.revokeObjectURL(preview.previewUrl); setPreview(null) }} onDownload={() => download(preview)} />}</>
}