import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'
import { Notice, formatBytes } from '../components/common'
import FileActions from '../components/FileActions'
import FilePreview from '../components/FilePreview'
import FileRenameModal from '../components/FileRenameModal'
import FileTypeIcon from '../components/FileTypeIcon'
import ShareModal from '../components/ShareModal'

export default function MyFiles() {
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [query, setQuery] = useState({ search: '', category: '', folder_id: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [preview, setPreview] = useState(null)
  const [renameFile, setRenameFile] = useState(null)
  const [shareFile, setShareFile] = useState(null)
  const [shares, setShares] = useState([])

  const loadFiles = () => {
    const params = {}
    if (query.search) params.search = query.search
    if (query.category) params.category = query.category
    if (query.folder_id) params.folder_id = Number(query.folder_id)
    api.get('/files', { params })
      .then(r => {
        setFiles(r.data)
        setError('')
      })
      .catch(e => setError(getErrorMessage(e)))
  }

  useEffect(() => {
    loadFiles()
    api.get('/folders')
      .then(r => setFolders(r.data))
      .catch(e => setError(getErrorMessage(e)))
  }, [query.search, query.category, query.folder_id])

  useEffect(() => {
    if (!shareFile) return
    api.get(`/files/${shareFile.id}/shares`)
      .then(r => setShares(r.data))
      .catch(() => setShares([]))
  }, [shareFile])

  async function download(file) {
    try {
      const response = await api.get(`/files/${file.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = file.original_filename
      link.click()
      URL.revokeObjectURL(url)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e))
      setSuccess('')
    }
  }

  async function openPreview(file) {
    const previewable = file.file_type === 'application/pdf' || file.file_type.startsWith('image/') || file.file_type.startsWith('audio/') || file.file_type.startsWith('video/')
    if (!previewable) return setPreview({ ...file, previewUrl: '' })
    try {
      const response = await api.get(`/files/${file.id}/download`, { responseType: 'blob' })
      setPreview({ ...file, previewUrl: URL.createObjectURL(response.data) })
      setError('')
    } catch (e) {
      setError(getErrorMessage(e))
      setSuccess('')
    }
  }

  async function remove(file) {
    if (!window.confirm('Are you sure you want to delete this file?')) return
    try {
      await api.delete(`/files/${file.id}`)
      setFiles(current => current.filter(item => item.id !== file.id))
      setError('')
      setSuccess('File deleted successfully.')
    } catch (e) {
      setError(getErrorMessage(e))
      setSuccess('')
    }
  }

  async function rename(name) {
    try {
      const response = await api.put(`/files/${renameFile.id}`, { original_filename: name })
      setFiles(current => current.map(item => item.id === response.data.id ? response.data : item))
      setRenameFile(null)
      setError('')
      setSuccess('File renamed successfully.')
    } catch (e) {
      setError(getErrorMessage(e))
      setSuccess('')
    }
  }

  async function share({ recipients, permission }) {
    try {
      const response = await api.post(`/files/${shareFile.id}/share`, { emails: recipients, permission })
      setShares(current => [response.data, ...current.filter(item => item.id !== response.data.id)])
      setShareFile(null)
      setError('')
      setSuccess('File shared successfully.')
    } catch (e) {
      setError(getErrorMessage(e))
      setSuccess('')
    }
  }

  async function generateLink(options = {}) {
    const response = await api.post(`/files/${shareFile.id}/share-links`, options)
    return response.data
  }

  async function revokeLink(linkId) {
    await api.delete(`/files/${shareFile.id}/share-links/${linkId}`)
  }

  return (
    <>
      <div className="toolbar">
        <input
          placeholder="Search by filename..."
          value={query.search}
          onChange={e => setQuery({ ...query, search: e.target.value })}
        />
        <select value={query.category} onChange={e => setQuery({ ...query, category: e.target.value })}>
          <option value="">All categories</option>
          {['Documents', 'Images', 'Videos', 'PDFs', 'Spreadsheets', 'Other'].map(x => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select value={query.folder_id} onChange={e => setQuery({ ...query, folder_id: e.target.value })}>
          <option value="">All folders</option>
          {folders.map(f => (
            <option value={f.id} key={f.id}>{f.name}</option>
          ))}
        </select>
        <Link className="primary" to="/files/upload">+ Upload</Link>
      </div>

      <Notice error={error} success={success} />

      <section className="panel">
        {files.length ? (
          <div className="table">
            {files.map(file => (
              <div className="file-row managed-file-row" key={file.id}>
                <FileTypeIcon file={file} />
                <Link className="file-summary" to={`/files/${file.id}`} title={file.original_filename}>
                  <strong>{file.original_filename}</strong>
                  <small>
                    {file.category}
                    {file.folder_name ? ` / ${file.folder_name}` : ''}
                    {' • '}
                    {formatBytes(file.file_size || file.size)}
                    {' • '}
                    v{file.version}
                  </small>
                </Link>
                <small>{new Date(file.created_at).toLocaleDateString()}</small>
                <FileActions
                  file={file}
                  onOpen={openPreview}
                  onDownload={download}
                  onShare={() => setShareFile(file)}
                  onRename={setRenameFile}
                  onDelete={remove}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">No files yet. Upload your first one.</p>
        )}
      </section>

      {preview && (
        <FilePreview
          file={preview}
          onClose={() => {
            if (preview.previewUrl) URL.revokeObjectURL(preview.previewUrl)
            setPreview(null)
          }}
          onDownload={() => download(preview)}
        />
      )}

      {renameFile && (
        <FileRenameModal
          file={renameFile}
          onClose={() => setRenameFile(null)}
          onSave={rename}
        />
      )}

      {shareFile && (
        <ShareModal
          file={shareFile}
          existingShares={shares}
          onClose={() => setShareFile(null)}
          onShare={share}
          onGenerateLink={generateLink}
          onRevokeLink={revokeLink}
        />
      )}
    </>
  )
}