import { useCallback, useEffect, useState } from 'react'
import api from '../services/api'
import { Notice } from '../components/common'

function formatTimestamp(dateStr) {
  if (!dateStr) return ''
  const formattedStr = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`
  const date = new Date(formattedStr)
  if (isNaN(date.getTime())) return dateStr

  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  let relative = ''
  if (diffSec < 60) relative = 'Just now'
  else if (diffMin < 60) relative = `${diffMin}m ago`
  else if (diffHour < 24) relative = `${diffHour}h ago`
  else if (diffDay === 1) relative = 'Yesterday'
  else if (diffDay < 7) relative = `${diffDay}d ago`
  else relative = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const time12h = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `${relative} (${time12h})`
}

function NotificationTypeIcon({ type }) {
  switch (type) {
    case 'file_share':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      )
    case 'download':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )
    case 'security_alert':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )
    case 'link_expired':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 14 14" />
        </svg>
      )
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
  }
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [filter, setFilter] = useState('all') // 'all' | 'unread'
  const [searchQuery, setSearchQuery] = useState('')
  const [notice, setNotice] = useState({ error: '', success: '' })
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null)

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/notifications?limit=100')
      if (response.data) {
        setNotifications(response.data.notifications || [])
        setUnreadCount(response.data.unread_count || 0)
      }
    } catch {
      setNotice({ error: 'Failed to load notifications.', success: '' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const notifyChange = () => {
    window.dispatchEvent(new CustomEvent('notifications-updated'))
  }

  const handleMarkAsRead = async (item, e) => {
    if (e) e.stopPropagation()
    if (item.is_read) return
    try {
      await api.patch(`/notifications/${item.id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
      notifyChange()
    } catch {
      setNotice({ error: 'Failed to mark notification as read.', success: '' })
    }
  }

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return
    try {
      setActionLoading(true)
      await api.post('/notifications/read-all')
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
      setNotice({ error: '', success: 'All notifications marked as read.' })
      notifyChange()
    } catch {
      setNotice({ error: 'Failed to mark all as read.', success: '' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteClick = (item, e) => {
    e.stopPropagation()
    setDeleteConfirmItem(item)
  }

  const confirmDeleteNotification = async () => {
    if (!deleteConfirmItem) return
    try {
      setActionLoading(true)
      await api.delete(`/notifications/${deleteConfirmItem.id}`)
      setNotifications((prev) => prev.filter((n) => n.id !== deleteConfirmItem.id))
      if (!deleteConfirmItem.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
      setNotice({ error: '', success: 'Notification deleted successfully.' })
      notifyChange()
    } catch {
      setNotice({ error: 'Failed to delete notification.', success: '' })
    } finally {
      setActionLoading(false)
      setDeleteConfirmItem(null)
    }
  }

  const handleClearAll = async () => {
    if (notifications.length === 0) return
    if (!window.confirm('Are you sure you want to clear all notification history?')) return
    try {
      setActionLoading(true)
      await api.delete('/notifications')
      setNotifications([])
      setUnreadCount(0)
      setNotice({ error: '', success: 'Notification history cleared.' })
      notifyChange()
    } catch {
      setNotice({ error: 'Failed to clear notifications.', success: '' })
    } finally {
      setActionLoading(false)
    }
  }

  const filteredNotifications = notifications.filter((item) => {
    const matchesFilter = filter === 'all' || (filter === 'unread' && !item.is_read)
    const matchesQuery =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.message.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesQuery
  })

  return (
    <div className="notifications-page">
      <Notice error={notice.error} success={notice.success} />

      <div className="panel notifications-panel">
        <div className="notifications-header">
          <div>
            <h2>Notification Inbox</h2>
            <p className="muted">Manage and view your full notification history</p>
          </div>
          <div className="notifications-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={fetchNotifications}
              disabled={loading || actionLoading}
              title="Refresh notifications"
            >
              🔄 Refresh
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0 || actionLoading}
            >
              ✓ Mark all as read
            </button>
            {notifications.length > 0 && (
              <button
                type="button"
                className="ghost-button danger-ghost"
                onClick={handleClearAll}
                disabled={actionLoading}
              >
                🗑️ Clear history
              </button>
            )}
          </div>
        </div>

        <div className="notifications-toolbar">
          <div className="filter-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All <span className="tab-badge">{notifications.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'unread'}
              className={`filter-tab ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Unread <span className="tab-badge unread">{unreadCount}</span>
            </button>
          </div>

          <div className="search-box">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="notifications-list-container">
          {loading ? (
            <div className="notifications-loading">Loading notifications...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="notification-page-empty">
              <div className="empty-icon-wrapper">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <h3>
                {filter === 'unread'
                  ? 'No unread notifications'
                  : searchQuery
                  ? 'No matching notifications'
                  : 'No notifications yet'}
              </h3>
              <p className="muted">
                {filter === 'unread'
                  ? "You're all caught up! Check back later for updates."
                  : searchQuery
                  ? `No notifications found matching "${searchQuery}".`
                  : 'Notifications regarding your shared files, security alerts, and downloads will appear here.'}
              </p>
            </div>
          ) : (
            <div className="notifications-page-list">
              {filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  className={`notification-page-card ${!item.is_read ? 'unread' : 'read'}`}
                  onClick={() => handleMarkAsRead(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleMarkAsRead(item)}
                >
                  <div className={`notification-page-icon ${item.type || 'default'}`}>
                    <NotificationTypeIcon type={item.type} />
                  </div>

                  <div className="notification-page-content">
                    <div className="notification-page-row">
                      <h4 className="notification-page-title">
                        {!item.is_read && <span className="unread-dot-indicator" title="Unread notification" />}
                        {item.title}
                      </h4>
                      <span className="notification-page-time">
                        {formatTimestamp(item.created_at)}
                      </span>
                    </div>

                    <p className="notification-page-message">{item.message}</p>
                  </div>

                  <div className="notification-page-actions">
                    {!item.is_read && (
                      <button
                        type="button"
                        className="action-icon-btn mark-read"
                        title="Mark as read"
                        onClick={(e) => handleMarkAsRead(item, e)}
                      >
                        ✓
                      </button>
                    )}
                    <button
                      type="button"
                      className="action-icon-btn delete-btn"
                      title="Delete notification"
                      onClick={(e) => handleDeleteClick(item, e)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {deleteConfirmItem && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirmItem(null)}>
          <div className="small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <h3>Delete Notification</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeleteConfirmItem(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <p style={{ margin: '16px 0', color: '#4a5c54', fontSize: '14px', lineHeight: '1.5' }}>
              Are you sure you want to delete notification <strong>"{deleteConfirmItem.title}"</strong>?
            </p>
            <div className="modal-buttons">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={confirmDeleteNotification}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
