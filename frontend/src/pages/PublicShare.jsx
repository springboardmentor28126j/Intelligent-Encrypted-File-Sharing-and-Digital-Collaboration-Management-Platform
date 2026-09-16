import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'
import { Notice } from '../components/common'

export default function PublicShare() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Tracks which token has already initiated an automated download
  const fetchedTokenRef = useRef(null)

  useEffect(() => {
    // Guard against React StrictMode's dev double-mount
    if (fetchedTokenRef.current === token) {
      return
    }

    fetchedTokenRef.current = token
    fetchSharedFile()
  }, [token])

  async function fetchSharedFile() {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/share-links/${token}`, {
        responseType: 'blob',
      })

      // Extract filename from header if available, or use fallback
      const disposition = response.headers['content-disposition'] || ''
      let filename = 'downloaded-file'
      const match = disposition.match(/filename\*=UTF-8''(.+)/) || disposition.match(/filename="?(.+?)"?$/)
      if (match && match[1]) {
        filename = decodeURIComponent(match[1])
      }

      // Trigger standard browser download
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)

      setSuccess(`Your download for "${filename}" started automatically!`)
    } catch (err) {
      // If backend returns 404 / 410 / 422 / 500
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text()
        try {
          const json = JSON.parse(text)
          setError(json.detail || 'This secure link is invalid or has expired.')
        } catch {
          setError('This secure link is invalid or has expired.')
        }
      } else {
        setError(getErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f6f1', padding: '20px' }}>
      <div className="panel" style={{ maxWidth: '460px', width: '100%', textAlign: 'center', padding: '36px' }}>
        <span className="brand-mark" style={{ margin: '0 auto 16px' }}>T</span>
        <h2>TrustShare File Download</h2>

        <div style={{ margin: '20px 0' }}>
          <Notice error={error} success={success} />
        </div>

        {loading && <p className="muted">Validating secure link and preparing download...</p>}

        {error && (
          <div style={{ marginTop: '20px' }}>
            <p className="muted" style={{ fontSize: '14px', marginBottom: '16px' }}>
              The link you used may have expired, exceeded its download limit, or access was revoked by the file owner.
            </p>
            <Link to="/login" className="primary">Go to Login</Link>
          </div>
        )}

        {success && (
          <div style={{ marginTop: '20px' }}>
            <button type="button" className="ghost-button" onClick={fetchSharedFile}>
              Click here if your download did not start
            </button>
          </div>
        )}
      </div>
    </div>
  )
}