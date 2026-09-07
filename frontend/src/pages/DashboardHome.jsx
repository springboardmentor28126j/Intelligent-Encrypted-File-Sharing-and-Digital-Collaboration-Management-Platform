import React, { useState, useEffect } from 'react';
import { getFilesAndFolders } from '../services/fileService';

function DashboardHome() {
  const [recentFiles, setRecentFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentFiles = async () => {
      try {
        const data = await getFilesAndFolders(null, 'all', '');
        // Sort by id descending (assuming newer files have higher ids) and take top 5
        const sortedFiles = (data.files || []).sort((a, b) => b.id - a.id).slice(0, 5);
        setRecentFiles(sortedFiles);
      } catch (err) {
        console.error("Failed to load recent files", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecentFiles();
  }, []);

  return (
    <div style={styles.container}>
      {/* Header Section */}
      <div style={styles.header}>
        <h1 style={styles.greeting}>Welcome, Vickey</h1>
        <p style={styles.subtitle}>Your vault is healthy — every file below is encrypted at rest.</p>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={{ ...styles.card, ...styles.secureCard }}>
          <div style={styles.circularProgress}>96%<br/><span style={{ fontSize: '10px' }}>encrypted</span></div>
          <div>
            <div style={styles.cardBadge}>🛡️ AES-256 Vault</div>
            <h3 style={styles.cardTitle}>All systems secure</h3>
            <p style={styles.cardText}>Files stored keys rotated 3 days ago.</p>
          </div>
        </div>
        <div style={styles.card}>
          <p style={styles.cardLabel}>Active shares</p>
          <h2 style={styles.cardNumber}>32</h2>
          <p style={styles.cardSubText}>⬆ 6 created this week</p>
        </div>
        <div style={styles.card}>
          <p style={styles.cardLabel}>Links expiring soon</p>
          <h2 style={styles.cardNumber}>4</h2>
          <p style={{ ...styles.cardSubText, color: '#d97706' }}>⏱ within 48 hours</p>
        </div>
        <div style={styles.card}>
          <p style={styles.cardLabel}>Downloads today</p>
          <h2 style={styles.cardNumber}>117</h2>
          <p style={styles.cardSubText}>✓ all verified access</p>
        </div>
      </div>

      {/* Bottom Content Split */}
      <div style={styles.bottomLayout}>
        {/* Recent Files Table */}
        <div style={styles.recentFilesSection}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Recent files</h3>
            <div style={styles.tabs}>
              <span style={styles.activeTab}>All</span>
              <span style={styles.inactiveTab}>Shared</span>
              <span style={styles.inactiveTab}>Mine</span>
            </div>
          </div>
          
          {loading ? (
            <p style={{ padding: '20px' }}>Loading files...</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.thn}>Name</th>
                  <th style={styles.th}>Encryption</th>
                  <th style={styles.th}>Modified</th>
                </tr>
              </thead>
              <tbody>
                {recentFiles.map(file => (
                  <tr key={file.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.fileCell}>
                        <span style={styles.fileIcon}>📄</span>
                        <div>
                          <div style={styles.fileName}>{file.original_filename || file.original_name}</div>
                          <div style={styles.fileSize}>{(file.file_size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.encryptionBadge}>🛡️ AES-256</span>
                    </td>
                    <td style={styles.td}>Just now</td>
                  </tr>
                ))}
                {recentFiles.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                      No files found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Sidebar Widgets */}
        <div style={styles.widgetsSection}>
          

          <div style={styles.auditCard}>
            <h3 style={styles.sectionTitle}>Audit log</h3>
            <div style={styles.auditList}>
              <div style={styles.auditItem}>
                <div style={styles.auditDot}></div>
                <div>
                  <p style={styles.auditLogText}><strong>User</strong> uploaded new document</p>
                  <p style={styles.auditTime}>2h ago • encrypted on upload</p>
                </div>
              </div>
              <div style={styles.auditItem}>
                <div style={styles.auditDot}></div>
                <div>
                  <p style={styles.auditLogText}><strong>System</strong> rotated encryption keys</p>
                  <p style={styles.auditTime}>1d ago • automated</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: '24px' },
  header: { display: 'flex', flexDirection: 'column', gap: '4px' },
  greeting: { fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 },
  subtitle: { fontSize: '14px', color: '#64748b', margin: 0 },
  
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' },
  card: { backgroundColor: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' },
  secureCard: { flexDirection: 'row', alignItems: 'center', gap: '16px', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  circularProgress: { width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#10b981', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', border: '4px solid #d1fae5' },
  cardBadge: { color: '#059669', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' },
  cardTitle: { margin: 0, fontSize: '16px', color: '#064e3b' },
  cardText: { margin: 0, fontSize: '12px', color: '#047857' },
  
  cardLabel: { margin: 0, fontSize: '13px', color: '#64748b', fontWeight: '500' },
  cardNumber: { margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#1e293b' },
  cardSubText: { margin: 0, fontSize: '12px', color: '#10b981', fontWeight: '600' },
  
  bottomLayout: { display: 'flex', gap: '24px', flexWrap: 'wrap' },
  recentFilesSection: { flex: '2', minWidth: '400px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' },
  widgetsSection: { flex: '1', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '20px' },
  
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  sectionTitle: { margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#1e293b' },
  tabs: { display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '4px' },
  activeTab: { padding: '4px 12px', backgroundColor: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', color: '#1e293b', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  inactiveTab: { padding: '4px 12px', fontSize: '13px', color: '#64748b', cursor: 'pointer' },
  
  table: { width: '100%', borderCollapse: 'collapse' },
   thn: { textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #e2e8f0', fontWeight: '600' },
  th: { padding: '12px 16px', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #e2e8f0', fontWeight: '600' },
  tr: { borderBottom: '1px solid #e2e8f0' },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  fileCell: { display: 'flex', alignItems: 'center', gap: '12px' },
  fileIcon: { fontSize: '24px' },
  fileName: { fontSize: '14px', fontWeight: '600', color: '#1e293b' },
  fileSize: { fontSize: '12px', color: '#94a3b8' },
  encryptionBadge: { display: 'inline-block', padding: '4px 8px', backgroundColor: '#f0fdf4', color: '#10b981', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #bbf7d0' },
  
  alertCard: { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '20px' },
  alertHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  alertTitle: { color: '#b91c1c', fontWeight: 'bold', fontSize: '14px' },
  alertText: { color: '#991b1b', fontSize: '13px', marginBottom: '16px' },
  alertActions: { display: 'flex', gap: '8px' },
  lockBtn: { backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
  reviewBtn: { backgroundColor: 'transparent', color: '#1e293b', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
  
  auditCard: { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', flex: 1 },
  auditList: { display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' },
  auditItem: { display: 'flex', gap: '12px', alignItems: 'flex-start' },
  auditDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '6px' },
  auditLogText: { margin: 0, fontSize: '13px', color: '#334155' },
  auditTime: { margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }
};

export default DashboardHome;
