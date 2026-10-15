import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'
import { Notice } from '../components/common'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / (1024 ** index)).toFixed(2)} ${units[index]}`
}

export default function Admin() {
  const [overview, setOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function load() {
    Promise.all([api.get('/admin/overview'), api.get('/admin/users')])
      .then(([overviewResponse, usersResponse]) => {
        setOverview(overviewResponse.data)
        setUsers(usersResponse.data)
        setError('')
      })
      .catch(requestError => setError(getErrorMessage(requestError)))
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleStatus(user) {
    if (!window.confirm(`${user.is_active ? 'Deactivate' : 'Activate'} ${user.email}?`)) return
    try {
      await api.patch(`/admin/users/${user.id}/status`, { is_active: !user.is_active })
      load()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    }
  }

  async function toggleRole(user) {
    const nextRole = user.role === 'admin' ? 'user' : 'admin'
    if (!window.confirm(`Change ${user.email} role to ${nextRole}?`)) return
    try {
      await api.patch(`/admin/users/${user.id}/role`, { role: nextRole })
      load()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    }
  }

  async function updateQuota(user) {
    const currentGb = (user.storage_quota / (1024 ** 3)).toFixed(2)
    const value = window.prompt(`Storage quota in GB for ${user.email}`, currentGb)
    if (value === null) return
    const quotaGb = Number(value)
    if (!Number.isFinite(quotaGb) || quotaGb <= 0) {
      setError('Enter a valid quota greater than 0 GB.')
      return
    }
    try {
      await api.patch(`/admin/users/${user.id}/quota`, { storage_quota: Math.round(quotaGb * (1024 ** 3)) })
      load()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    }
  }

  async function downloadAllActivity() {
    try {
      const response = await api.get('/admin/activity/export', {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'trustshare-all-activity.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    }
  }

  if (!overview && !error) return <p className="muted">Loading administration...</p>

  return (
    <>
      <Notice error={error} />
      <section className="panel">
        <div className="panel-title"><div><h3>Manage users</h3><span className="muted">{users.length} accounts</span></div><button className="secondary-button" onClick={downloadAllActivity}>Download all CSV</button></div>
        <div className="table admin-user-table">
          {users.map(user => (
            <div className="file-row" key={user.id}>
              <span className="file-icon">{user.role === 'admin' ? 'A' : 'U'}</span>
              <span><strong>{user.name}</strong><small>{user.email}</small></span>
              <span><small>{user.role}</small><small>{user.is_active ? 'Active' : 'Inactive'} · {formatBytes(user.used_storage)} / {formatBytes(user.storage_quota)}</small></span>
              <button className="admin-action-button" onClick={() => navigate(`/admin/users/${user.id}/activity`)}>
                View activity
              </button>
              <button className="admin-action-button" onClick={() => toggleRole(user)} disabled={user.id === overview?.admin?.id}>
                {user.role === 'admin' ? 'Make user' : 'Make admin'}
              </button>
              <button className="admin-action-button danger" onClick={() => toggleStatus(user)} disabled={user.id === overview?.admin?.id}>
                {user.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button className="admin-action-button" onClick={() => updateQuota(user)}>
                Set quota
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
