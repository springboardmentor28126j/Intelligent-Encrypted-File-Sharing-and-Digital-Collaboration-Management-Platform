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
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = {}
    if (actionFilter) params.action = actionFilter
    if (search) params.search = search
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate

    setLoading(true)
    api.get('/activity', { params })
      .then((response) => {
        setItems(response.data)
        setError('')
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [actionFilter, search, startDate, endDate])

  const handleExport = async () => {
    try {
      setExporting(true)
      setError('')
      const params = {}
      if (actionFilter) params.action = actionFilter
      if (search) params.search = search
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate

      const response = await api.get('/activity/export', {
        params,
        responseType: 'blob',
      })

      // Extract filename from response headers or construct default
      const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition']
      let filename = `trustshare_activity_report_${new Date().toISOString().slice(0, 10)}.csv`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/)
        if (match && match[1]) filename = match[1]
      }

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const handleClearFilters = () => {
    setActionFilter('')
    setSearch('')
    setStartDate('')
    setEndDate('')
  }

  return (
    <section className="panel activity-panel">
      <div className="activity-header">
        <div>
          <h2>Activity & Audit Logs</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
            Track file shares, downloads, link activity, and security actions
          </p>
        </div>
        <button
          type="button"
          className="primary export-btn"
          onClick={handleExport}
          disabled={exporting}
          title="Export audit report as CSV file"
        >
          {exporting ? (
            <span className="export-btn-content">⏳ Generating CSV...</span>
          ) : (
            <span className="export-btn-content">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Audit Report
            </span>
          )}
        </button>
      </div>

      <Notice error={error} />

      <div className="activity-toolbar">
        <div className="search-box activity-search-box">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search activity description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="activity-filter-group">
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            {ACTION_OPTIONS.map(([value, label]) => (
              <option value={value} key={label}>{label}</option>
            ))}
          </select>

          <div className="date-filter-group">
            <label className="date-input-label">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            <label className="date-input-label">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>

          {(actionFilter || search || startDate || endDate) && (
            <button
              type="button"
              className="ghost-button clear-filters-btn"
              onClick={handleClearFilters}
              title="Reset all filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="activity-loading">Loading activity logs...</div>
      ) : items.length ? (
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