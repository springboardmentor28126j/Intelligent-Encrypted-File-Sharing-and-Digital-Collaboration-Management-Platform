import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../services/api'
import { Notice } from '../components/common'

const ACTION_OPTIONS = [
  ['', 'All Actions'],
  ['upload', 'Uploads'],
  ['download', 'Downloads'],
  ['shared_download', 'Shared Downloads'],
  ['share', 'File Shared'],
  ['share_update', 'Permission Changed'],
  ['share_remove', 'Access Removed'],
  ['share_link_create', 'Link Created'],
  ['share_link_revoke', 'Link Revoked'],
  ['share_link_download', 'Link Download'],
  ['login', 'Logins'],
]

export default function Activity() {
  const [items, setItems] = useState([])
  const [actionFilter, setActionFilter] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const params = {}
    if (actionFilter) params.action = actionFilter
    if (search) params.search = search
    api.get('/activity', { params })
      .then((response) => {
        setItems(response.data)
        setError('')
      })
      .catch((err) => setError(getErrorMessage(err)))
  }, [actionFilter, search])

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Activity & Audit Logs</h2>
      </div>
      <Notice error={error} />
      <div className="toolbar">
        <input
          placeholder="Search activity description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          {ACTION_OPTIONS.map(([value, label]) => (
            <option value={value} key={label}>{label}</option>
          ))}
        </select>
      </div>
      {items.length ? (
        <div className="activity-list">
          {items.map((item) => (
            <div className="activity-item" key={item.id}>
              <span className="dot" />
              <span>
                <strong style={{ textTransform: 'capitalize' }}>
                  {item.action.replace(/_/g, ' ')}
                </strong>
                <small>{item.description}</small>
                {item.ip_address ? <small>IP: {item.ip_address}</small> : null}
              </span>
              <small style={{ color: '#7d8a84' }}>
                {new Date(item.created_at.endsWith('Z') ? item.created_at : `${item.created_at}Z`).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                })}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">No activity records match your criteria.</p>
      )}
    </section>
  )
}