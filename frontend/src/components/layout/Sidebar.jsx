import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../../services/api'

export default function Sidebar({ unreadCount: externalUnreadCount }) {
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(externalUnreadCount ?? 0)

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/notifications?limit=1')
      if (response.data && response.data.unread_count !== undefined) {
        setUnreadCount(response.data.unread_count)
      }
    } catch {
      // Ignore background fetch errors
    }
  }

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 15000)
    const handleUpdate = () => fetchUnreadCount()
    window.addEventListener('notifications-updated', handleUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener('notifications-updated', handleUpdate)
    }
  }, [])

  useEffect(() => {
    if (externalUnreadCount !== undefined) {
      setUnreadCount(externalUnreadCount)
    }
  }, [externalUnreadCount])

  const links = [
    { path: '/dashboard', label: 'Overview' },
    { path: '/files', label: 'My files' },
    { path: '/files/upload', label: 'Upload file' },
    { path: '/shared-with-me', label: 'Shared with me' },
    {
      path: '/notifications',
      label: 'Notifications',
      isNotification: true,
    },
    { path: '/folders', label: 'Folders' },
    { path: '/activity', label: 'Activity' },
    { path: '/profile', label: 'Profile' },
    { path: '/security', label: 'Security' },
  ]

  return (
    <aside className="app-sidebar">
      <Link className="brand" to="/dashboard">
        <span className="brand-mark">T</span> TrustShare
      </Link>
      <p className="eyebrow">PERSONAL WORKSPACE</p>
      <nav>
        {links.map(({ path, label, isNotification }) => {
          const isActive = location.pathname === path
          return (
            <Link
              key={path}
              to={path}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span>{label}</span>
              {isNotification && unreadCount > 0 && (
                <span className="sidebar-badge" aria-label={`${unreadCount} unread notifications`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}