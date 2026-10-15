import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

import Sidebar from './layout/Sidebar'

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export function Protected({ children }) { 
  const { user } = useAuth()
  return user && sessionStorage.getItem('trustshare_token') ? children : <Navigate to="/login" replace />
}

export function PublicOnly({ children }) {
  return children
}

export function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const pageTitles = {
    '/dashboard': 'Overview',
    '/files': 'My files',
    '/files/upload': 'Upload file',
    '/shared-with-me': 'Shared with me',
    '/notifications': 'Notifications',
    '/folders': 'Folders',
    '/activity': 'Activity',
    '/profile': 'Profile',
    '/security': 'Security',
    '/admin': 'Admin panel',
  }

  useEffect(() => { 
    function closeMenu(event) { 
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false) 
    } 
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu) 
  }, [])

  function signOut() { 
    setMenuOpen(false)
    logout()
    navigate('/login', { replace: true }) 
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main>
        <header>
          <div>
            {!location.pathname.startsWith('/admin') && <span className="eyebrow">SECURE FILE SHARING</span>}
            <h1>{location.pathname.startsWith('/admin') ? 'Manage users' : (pageTitles[location.pathname] || 'File details')}</h1>
          </div>
          <div className="header-actions">
            <NotificationBell />
            <div className="profile-menu" ref={menuRef}>
              <button className="avatar" aria-label="Open profile menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
                {user?.name?.[0] || 'U'}
              </button>
              {menuOpen && (
                <div className="profile-popover">
                  <strong>{user?.name}</strong>
                  <small>{user?.email}</small>
                  <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
                  <Link to="/security" onClick={() => setMenuOpen(false)}>Security</Link>
                  <button onClick={signOut}>Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}

export function Notice({ error, success }) { 
  return error ? <p className="notice error">{error}</p> : success ? <p className="notice success">{success}</p> : null 
}

export function PasswordField({ label, value, onChange }) { 
  const [visible, setVisible] = useState(false)
  return (
    <label>
      {label}
      <span className="password-field">
        <input required type={visible ? 'text' : 'password'} value={value} onChange={onChange} />
        <button type="button" className="password-toggle" aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>
          {visible ? '◉' : '◌'}
        </button>
      </span>
    </label>
  ) 
}

export function Stat({ label, value }) { 
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div> 
}

export function Panel({ title, action, children }) { 
  return <section className="panel"><div className="panel-title"><h3>{title}</h3><Link to={action}>View all</Link></div>{children}</section> 
}

export function FileTable({ files }) { 
  return files.length ? (
    <div className="table">
      {files.map(f => (
        <Link to={`/files/${f.id}`} className="file-row" key={f.id}>
          <span className="file-icon">{f.category?.[0] || 'F'}</span>
          <span>
            <strong>{f.original_filename}</strong>
            <small>{f.category} • {formatBytes(f.file_size || f.size)} • v{f.version}</small>
          </span>
          <small>{new Date(f.created_at).toLocaleDateString()}</small>
        </Link>
      ))}
    </div>
  ) : (
    <p className="empty">No files yet. Upload your first one.</p>
  ) 
}

export function ActivityList({ items }) { 
  return items.length ? (
    <div className="activity-list">
      {items.map(item => (
        <div className="activity-item" key={item.id}>
          <span className="dot" />
          <span>
            <strong>{item.action.replace(/_/g, ' ')}</strong>
            <small>{item.description}</small>
          </span>
          <small>{new Date(item.created_at).toLocaleDateString()}</small>
        </div>
      ))}
    </div>
  ) : (
    <p className="empty">Your recent actions will appear here.</p>
  ) 
}