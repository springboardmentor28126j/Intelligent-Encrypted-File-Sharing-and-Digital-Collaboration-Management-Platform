import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'
import { ActivityList, FileTable, Notice, Panel, Stat } from '../components/common'
import { useAuth } from '../context/AuthContext'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/dashboard')
      .then((r) => setData(r.data))
      .catch((e) => setError(getErrorMessage(e)))
  }, [])

  if (error) return <Notice error={error} />
  if (!data) return <p className="muted">Loading your workspace...</p>

  const storageUsed = data.stats?.storage_used || 0
  const storageLimit = data.stats?.storage_limit || (100 * 1024 * 1024)
  const percentage = data.stats?.storage_percentage ?? (
    storageLimit ? Math.min(Number(((storageUsed / storageLimit) * 100).toFixed(2)), 100) : 0
  )
  const categories = data.category_breakdown || []

  return (
    <>
      <section className="welcome">
        <div>
          <span className="eyebrow">GOOD TO SEE YOU</span>
          <h2>{user?.name ? `Welcome, ${user.name}` : 'Welcome'}</h2>
          <p className="muted">Everything you need is in one secure place.</p>
        </div>
        <Link className="primary" to="/files/upload">+ Upload file</Link>
      </section>

      {/* 4 Stat Cards */}
      <div className="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <Stat label="Total files" value={data.stats?.total_files ?? 0} />
        <Stat label="Storage used" value={formatBytes(storageUsed)} />
        <Stat label="Folders" value={data.stats?.total_folders ?? 0} />
        <Stat label="Uploads (7d)" value={data.stats?.recent_uploads_count ?? 0} />
      </div>

      {/* Storage Analytics & Category Distribution */}
      <section className="panel" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Storage Analytics</h3>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#2e5b4b' }}>
            {formatBytes(storageUsed)} of {formatBytes(storageLimit)} ({percentage}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: '8px',
          background: '#e9ede8',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '20px',
        }}>
          <div style={{
            width: `${Math.max(percentage, 2)}%`,
            height: '100%',
            background: percentage > 85 ? '#d9534f' : '#2e5b4b',
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* Category Cards */}
        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#687770', display: 'block', marginBottom: '12px' }}>
          Category Distribution
        </span>
        {categories.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
            {categories.map((cat) => (
              <div
                key={cat.category}
                style={{
                  background: '#f8faf7',
                  border: '1px solid #e2e8e0',
                  borderRadius: '8px',
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '14px', color: '#182522' }}>{cat.category}</strong>
                  <span style={{ fontSize: '12px', color: '#2e5b4b', fontWeight: 600 }}>
                    {formatBytes(cat.size_bytes)}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#7d8a84', marginTop: '4px' }}>
                  {cat.count} {cat.count === 1 ? 'file' : 'files'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: '13px', margin: 0 }}>No files categorized yet.</p>
        )}
      </section>

      {/* Security Quick Link */}
      <section className="panel form-panel" style={{ marginBottom: '24px' }}>
        <div className="panel-title">
          <h3>Security</h3>
          <Link to="/security">Manage MFA</Link>
        </div>
        <p className="muted">Add an extra layer of security to your TrustShare account using an authenticator app.</p>
      </section>

      {/* Two Column Grid */}
      <div className="two-col">
        <Panel title="Recent files" action="/files">
          <FileTable files={data.recent_files} />
        </Panel>
        <Panel title="Recent activity" action="/activity">
          <ActivityList items={data.recent_activity} />
        </Panel>
      </div>
    </>
  )
}