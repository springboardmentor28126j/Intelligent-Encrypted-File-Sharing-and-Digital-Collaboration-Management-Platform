import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

function formatNotificationTime(dateStr) {
  if (!dateStr) return ''
  // Append 'Z' if missing so JS treats raw FastAPI timestamp as UTC
  const formattedStr = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`
  const date = new Date(formattedStr)
  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function NotificationTypeIcon({ type }) {
  switch (type) {
    case 'file_share':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      )
    case 'download':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )
    case 'security_alert':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )
    case 'link_expired':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 14 14" />
        </svg>
      )
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
  }
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications')
      if (response.data) {
        setNotifications(response.data.notifications || [])
        setUnreadCount(response.data.unread_count || 0)
      }
    } catch {
      // Ignore background fetch error
    }
  }

  useEffect(() => {
    fetchNotifications()
    const timer = setInterval(fetchNotifications, 20000)
    const handleUpdate = () => fetchNotifications()
    window.addEventListener('notifications-updated', handleUpdate)

    return () => {
      clearInterval(timer)
      window.removeEventListener('notifications-updated', handleUpdate)
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications()
    }
    setIsOpen(!isOpen)
  }

  const handleNotificationClick = async (item) => {
    if (!item.is_read) {
      try {
        await api.patch(`/notifications/${item.id}/read`)
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
        window.dispatchEvent(new CustomEvent('notifications-updated'))
      } catch {
        // Ignore failure
      }
    }

    setIsOpen(false)

    // Route dynamically based on notification event
    if (item.type === 'file_share') {
      navigate('/shared-with-me')
    } else {
      navigate('/notifications')
    }
  }

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return
    try {
      setLoading(true)
      await api.post('/notifications/read-all')
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
      window.dispatchEvent(new CustomEvent('notifications-updated'))
    } catch {
      // Ignore failure
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="notification-bell-container" ref={containerRef}>
      <button
        type="button"
        className="notification-bell-btn"
        aria-label="Notifications"
        aria-expanded={isOpen}
        onClick={handleToggle}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge" aria-label={`${unreadCount} unread notifications`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-popover">
          <div className="notification-popover-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                className="mark-all-read-btn"
                onClick={handleMarkAllRead}
                disabled={loading}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="notification-popover-body">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <span className="notification-empty-icon">🔔</span>
                <p>No notifications yet.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`notification-item ${!item.is_read ? 'unread' : 'read'}`}
                  onClick={() => handleNotificationClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(item)}
                >
                  <div className={`notification-icon ${item.type || 'default'}`}>
                    <NotificationTypeIcon type={item.type} />
                  </div>
                  <div className="notification-text">
                    <div className="notification-title-bar">
                      <strong className="notification-title">{item.title}</strong>
                      <span className="notification-timestamp">
                        {formatNotificationTime(item.created_at)}
                      </span>
                    </div>
                    <p className="notification-message">{item.message}</p>
                  </div>
                  {!item.is_read && <span className="notification-unread-dot" title="Unread" />}
                </div>
              ))
            )}
          </div>

          <div className="notification-popover-footer">
            <button
              type="button"
              className="view-all-notifications-btn"
              onClick={() => {
                setIsOpen(false)
                navigate('/notifications')
              }}
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}