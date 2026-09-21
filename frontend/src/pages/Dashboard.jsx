import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import api, { getErrorMessage } from '../services/api'
import { ActivityList, FileTable, Notice, Panel, Stat } from '../components/common'
import { useAuth } from '../context/AuthContext'

const CATEGORY_COLORS = ['#2e5b4b', '#4a7c59', '#73956f', '#8eb69b', '#b3cbb9', '#d2ded5']

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

      {/* Storage Analytics Section */}
      <section className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3>Storage Analytics</h3>
          <span style={{ fontSize: '13px', color: '#687770', fontWeight: 600 }}>
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
          marginBottom: '24px',
        }}>
          <div style={{
            width: `${Math.max(percentage, 2)}%`,
            height: '100%',
            background: percentage > 85 ? '#d9534f' : '#2e5b4b',
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* Category Header */}
        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#687770', display: 'block', marginBottom: '14px' }}>
          Category Distribution
        </span>

        {/* Donut Chart & Category Cards Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: categories.length > 0 ? '220px 1fr' : '1fr', gap: '24px', alignItems: 'center' }}>
          {/* Visual Donut Chart */}
          <div style={{ width: '100%', height: '180px' }}>
            {categories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="size_bytes"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={75}
                    paddingAngle={4}
                  >
                    {categories.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [formatBytes(value), name]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#9ba6a1', fontSize: '13px' }}>
                No files stored
              </div>
            )}
          </div>

          {/* Category Detail Cards */}
          {categories.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
              {categories.map((cat, index) => (
                <div
                  key={cat.category}
                  style={{
                    background: '#f8faf7',
                    border: '1px solid #e2e8e0',
                    borderLeft: `4px solid ${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}`,
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px', color: '#182522' }}>{cat.category}</strong>
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
        </div>
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