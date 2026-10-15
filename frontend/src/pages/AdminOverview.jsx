import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import api, { getErrorMessage } from '../services/api'
import { Notice, Stat } from '../components/common'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / (1024 ** index)).toFixed(2)} ${units[index]}`
}

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

export default function AdminOverview() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [activity, setActivity] = useState([])
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    api.get('/admin/overview')
      .then(response => {
        setData(response.data)
        setActivity(response.data.recent_activity || [])
      })
      .catch(requestError => setError(getErrorMessage(requestError)))
  }, [])

  if (error) return <Notice error={error} />
  if (!data) return <p className="muted">Loading platform overview...</p>

  const stats = data.stats || {}
  const userChart = [
    { name: 'Active', value: stats.active_users || 0, color: '#2e5b4b' },
    { name: 'Inactive', value: Math.max((stats.total_users || 0) - (stats.active_users || 0), 0), color: '#d9a441' },
  ]
  const roleChart = [
    { name: 'Admins', value: data.role_counts?.admin || 0, color: '#d9f27c' },
    { name: 'Users', value: data.role_counts?.user || 0, color: '#8eb69b' },
  ]

  async function loadMore() {
    setLoadingMore(true)
    try {
      const response = await api.get('/admin/activity', { params: { offset: activity.length, limit: 10 } })
      setActivity(current => [...current, ...response.data])
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoadingMore(false)
    }
  }
  return (
    <>
      <section className="welcome">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h2>Welcome to the admin overview</h2>
          <p className="muted">Monitor users, files, storage, and security activity across TrustShare.</p>
        </div>
        <Link className="primary" to="/admin">Manage users</Link>
      </section>
      <div className="stats">
        <Stat label="Total users" value={stats.total_users ?? 0} />
        <Stat label="Active users" value={stats.active_users ?? 0} />
        <Stat label="Total files" value={stats.total_files ?? 0} />
        <Stat label="Storage used" value={formatBytes(stats.storage_used)} />
      </div>
      <div className="admin-chart-grid">
        {[['Account status', userChart], ['Role distribution', roleChart]].map(([title, chart]) => (
          <section className="panel admin-chart-panel" key={title}>
            <h3>{title}</h3>
            <div className="admin-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chart} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={4}>
                    {chart.map(item => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="admin-chart-legend">{chart.map(item => <span key={item.name}><i style={{ background: item.color }} />{item.name}: {item.value}</span>)}</div>
          </section>
        ))}
      </div>
      <section className="panel admin-activity-panel">
        <div className="panel-title">
          <h3>Recent platform activity</h3>
          <span className="muted">{stats.total_activity ?? 0} total records</span>
        </div>
        {activity.length ? (
          <div className="activity-list">
            {activity.map(item => (
              <div className="activity-item" key={item.id}>
                <span className="dot" />
                <span>
                  <strong>{item.action.replace(/_/g, ' ')}</strong>
                  <small>{item.user_name} · {item.description}</small>
                </span>
                <small>{formatDateTime(item.created_at)}</small>
              </div>
            ))}
            {activity.length < stats.total_activity && <button className="secondary-button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading...' : 'Load more activity'}</button>}
          </div>
        ) : <p className="empty">No platform activity yet.</p>}
      </section>
    </>
  )
}
