import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../services/authService';
import FileManager from './FileManager';
import DashboardHome from './DashboardHome';

function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  return (
    <div style={styles.appWrapper}>
      {/* Top Navbar */}
      <header style={styles.navbar}>
        <div style={styles.navBrand}>
          {/* Public folder se direct SVG logo image */}
          <img src="/trustshare_logo.svg" alt="TrustShare Logo" style={styles.logoImage} />
          <span style={styles.brandTitle}>TrustShare</span>
        </div>

        <button onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </header>

      <div style={styles.mainContainer}>
        {/* Left Sidebar */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarMenu}>
            <button
              style={{
                ...styles.menuItem,
                ...(activeTab === 'dashboard' ? styles.activeMenuItem : {})
              }}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </button>
            <button
              style={{
                ...styles.menuItem,
                ...(activeTab === 'files' ? styles.activeMenuItem : {})
              }}
              onClick={() => setActiveTab('files')}
            >
              📁 My Files
            </button>
          </div>
        </aside>

        {/* Right Main Content Area */}
        <main style={styles.contentArea}>
          {activeTab === 'dashboard' && <DashboardHome />}
          {activeTab === 'files' && <FileManager />}
        </main>
      </div>
    </div>
  );
}

const styles = {
  appWrapper: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f3f4f6',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden'
  },
  navbar: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '0 24px', 
    height: '60px', 
    backgroundColor: '#ffffff', 
    borderBottom: '1px solid #e5e7eb', 
    width: '100%',
    boxSizing: 'border-box'
  },
  navBrand: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoImage: { width: '33px', height: '33px', objectFit: 'contain' },
  brandTitle: { fontSize: '20px', fontWeight: 'bold', color: '#1e293b' },
  logoutBtn: { backgroundColor: '#ef4444', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' },
  mainContainer: { display: 'flex', flex: 1, width: '100%', overflow: 'hidden' },
  sidebar: { width: '240px', backgroundColor: '#ffffff', borderRight: '1px solid #e5e7eb', padding: '20px 12px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
  sidebarMenu: { display: 'flex', flexDirection: 'column', gap: '8px' },
  menuItem: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', color: '#475569', fontSize: '14px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' },
  activeMenuItem: { backgroundColor: '#eff6ff', color: '#2563eb' },
  contentArea: { flex: 1, padding: '24px', overflowY: 'auto' }
};

export default Dashboard;