import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'
import { Notice } from '../components/common'

function formatDateTime(value) {
  return new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function AdminUserActivity() {
  const { userId } = useParams()
  const [user, setUser] = useState(null)
  const [activity, setActivity] = useState([])
  const [error, setError] = useState('')
  const [action, setAction] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const params = { limit: 20, action, start_date: startDate, end_date: endDate }

  async function loadActivity(reset = true) {
    const response = await api.get(`/admin/users/${userId}/activity`, {
      params: { ...params, offset: reset ? 0 : activity.length },
    })
    setActivity(current => reset ? response.data : [...current, ...response.data])
    setHasMore(response.data.length === 20)
  }

  useEffect(() => {
    api.get('/admin/users')
      .then(response => setUser(response.data.find(item => String(item.id) === userId) || null))
      .then(() => loadActivity())
      .catch(requestError => setError(getErrorMessage(requestError)))
  }, [userId, action, startDate, endDate])

  async function loadMore() {
    setLoadingMore(true)
    try {
      await loadActivity(false)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoadingMore(false)
    }
  }

  async function downloadCsv() {
    try {
      const response = await api.get('/admin/activity/export', {
        params: { user_id: userId, action, start_date: startDate, end_date: endDate },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `${user?.email || 'user'}-activity.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    }
  }

  if (error) return <Notice error={error} />
  if (!user) return <p className="muted">Loading user activity...</p>

  return (
    <>
      <section className="welcome">
        <div>
          <span className="eyebrow">USER ACTIVITY</span>
          <h2>{user.name}</h2>
          <p className="muted">{user.email} · {user.role} · {user.is_active ? 'Active' : 'Inactive'}</p>
        </div>
        <Link className="secondary-button" to="/admin">Back to manage users</Link>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h3>Complete activity history</h3>
          <div className="activity-actions"><span className="muted">{activity.length} records</span><button className="secondary-button" onClick={downloadCsv}>Download CSV</button></div>
        </div>
        <div className="admin-filters">
          <label>Action<select value={action} onChange={event => setAction(event.target.value)}><option value="">All actions</option><option value="login">Login</option><option value="upload">Upload</option><option value="download">Download</option><option value="share">Share</option><option value="shared_download">Shared download</option><option value="rename">Rename</option><option value="folder_create">Folder created</option></select></label>
          <label>From<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
          <label>To<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
          <button className="secondary-button" onClick={() => { setAction(''); setStartDate(''); setEndDate('') }}>Clear filters</button>
        </div>
        {activity.length ? (
          <div className="activity-list">
            {activity.map(item => (
              <div className="activity-item" key={item.id}>
                <span className="dot" />
                <span><strong>{item.action.replace(/_/g, ' ')}</strong><small>{item.description}</small></span>
                <small>{formatDateTime(item.created_at)}</small>
              </div>
            ))}
            {hasMore && <button className="secondary-button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading...' : 'Load more activity'}</button>}
          </div>
        ) : <p className="empty">No activity recorded for this user.</p>}
      </section>
    </>
  )
}
