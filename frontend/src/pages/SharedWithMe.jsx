import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../services/api'
import FileActions from '../components/FileActions'
import FilePreview from '../components/FilePreview'
import FileRenameModal from '../components/FileRenameModal'
import { Notice } from '../components/common'

export default function SharedWithMe() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [preview, setPreview] = useState(null)
  const [renameFile, setRenameFile] = useState(null)

  useEffect(() => {
    api.get('/files/shared-with-me')
      .then(r => setItems(r.data))
      .catch(e => setError(getErrorMessage(e)))
  }, [])

  async function openPreview(file) {
    const previewable =
      file.file_type === 'application/pdf' ||
      file.file_type?.startsWith('image/') ||
      file.file_type?.startsWith('audio/') ||
      file.file_type?.startsWith('video/')
    if (!previewable) return setPreview({ ...file, previewUrl: '' })
    try {
      const response = await api.get(`/files/${file.id}/download`, { responseType: 'blob' })
      setPreview({ ...file, previewUrl: URL.createObjectURL(response.data) })
      setError('')
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
      setError('')
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  async function rename(name) {
  try {
    // Some share endpoints return file_id as the primary target ID
    const targetId = renameFile.file_id || renameFile.id;
    const response = await api.put(`/files/${targetId}`, { original_filename: name });
    
    setItems(current =>
      current.map(item =>
        (item.file_id === response.data.id || item.id === response.data.id)
          ? { ...item, original_filename: response.data.original_filename }
          : item
      )
    );
    setRenameFile(null);
    setError('');
    setSuccess('File renamed successfully.');
  } catch (e) {
    setError(getErrorMessage(e));
    setSuccess('');
  }
}

  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <h2>Shared with me</h2>
        </div>
        <Notice error={error} success={success} />
        {items.length ? (
          <div className="table">
            {items.map(file => {
              const isEditor = file.permission?.toUpperCase() === 'EDITOR'

              return (
                <div className="file-row managed-file-row" key={file.id}>
                  <span className="file-type-icon">
                    {file.original_filename.split('.').pop()?.toUpperCase() || 'FILE'}
                  </span>
                  <div className="file-summary">
                    <strong>{file.original_filename}</strong>
                    <small>Shared by {file.owner_name} | Permission: {file.permission}</small>
                  </div>
                  <FileActions
                    file={file}
                    onOpen={openPreview}
                    onDownload={download}
                    /* Pass onRename only if the role is EDITOR */
                    onRename={isEditor ? setRenameFile : undefined}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <p className="empty">No files shared with you yet.</p>
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
    </>
  )
}