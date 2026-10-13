import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Notifications.css';

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const email = localStorage.getItem('email');
      if (!email) return;
      const res = await axios.get(`https://trustshare-backend-lhed.onrender.com/notifications?email=${encodeURIComponent(email)}`);
      setNotifications(res.data);
    } catch (err) {
      console.log('Error fetching notifications');
    }
  };

  const markAllRead = async () => {
    try {
      const email = localStorage.getItem('email');
      if (!email) return;
      await axios.post('https://trustshare-backend-lhed.onrender.com/notifications/read-all', { email });
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.log('Error marking notifications read');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const formatTime = (t) => {
    if (!t) return '';
    try {
      const iso = typeof t === 'string' && !/(Z|[+-]\d\d:?\d\d)$/.test(t) ? `${t}Z` : t;
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return t;
    }
  };

  return (
    <div className="notifications-wrapper">
      <button 
        className="notification-bell-btn"
        onClick={() => {
          setShowPopup(!showPopup);
          if (!showPopup && unreadCount > 0) {
            markAllRead();
          }
        }}
      >
        🔔
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {showPopup && (
        <div className="notifications-popup">
          <div className="notifications-header">
            <h3>Notifications</h3>
            <span className="close-notif" onClick={() => setShowPopup(false)}>✕</span>
          </div>
          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">No notifications yet</div>
            ) : (
              notifications.map((n, idx) => (
                <div key={idx} className={`notification-item ${n.is_read ? '' : 'unread'}`}>
                  <p>{n.message}</p>
                  <span className="notif-time">{formatTime(n.timestamp)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Notifications;