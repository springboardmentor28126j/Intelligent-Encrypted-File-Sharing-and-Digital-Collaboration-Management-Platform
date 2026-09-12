import React, { useState, useEffect } from 'react';
import { getSharedLinks, revokeSharedLink, getSharedLinkLogs, updateSharedLink } from '../services/shareService';

function SharedLinksPage() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLogs, setSelectedLogs] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  const fetchLinks = async () => {
    try {
      const data = await getSharedLinks();
      setLinks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  // Close dropdown when clicking anywhere outside
  useEffect(() => {
    const handleDocumentClick = () => {
      setOpenMenuId(null);
    };
    window.addEventListener('click', handleDocumentClick);
    return () => window.removeEventListener('click', handleDocumentClick);
  }, []);

  const handleRevoke = async (id) => {
    if (window.confirm("Are you sure you want to revoke this link?")) {
      try {
        await revokeSharedLink(id);
        fetchLinks();
      } catch (err) {
        alert("Failed to revoke link");
      }
    }
  };

  const handleViewLogs = async (id) => {
    try {
      const logs = await getSharedLinkLogs(id);
      setSelectedLogs(logs);
    } catch (err) {
      alert("Failed to fetch logs");
    }
  };

  const handleUpdatePermission = async (id, newPermission) => {
    try {
      await updateSharedLink(id, newPermission);
      fetchLinks();
    } catch (err) {
      alert("Failed to update permission");
    }
  };

  if (loading) return <div style={styles.container}>Loading shared files & links...</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>🔗 Shared Files & Links</h2>
      <p style={styles.subtitle}>Track and manage all your actively shared files, internal collaborators, and public links.</p>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>File Name</th>
              <th style={styles.th}>Shared To / Recipient</th>
              <th style={styles.th}>Permission</th>
              <th style={styles.th}>Expires At</th>
              <th style={styles.th}>Created</th>
              <th style={{ ...styles.th, textAlign: 'center', width: '80px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => {
              const isMenuOpen = openMenuId === link.id;
              return (
                <tr key={link.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>📄</span>
                      <strong>{link.file_name}</strong>
                    </div>
                  </td>
                  <td style={styles.td}>
                    {link.shared_to ? (
                      <span style={styles.sharedToBadge}>
                        {link.shared_to}
                      </span>
                    ) : (
                      <span style={styles.publicBadge}>🌐 Public Link</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <select 
                      value={link.permission} 
                      onChange={(e) => handleUpdatePermission(link.id, e.target.value)}
                      style={link.permission === 'view_only' ? styles.badgeWarn : styles.badgeSuccess}
                      title="Click to switch permission"
                    >
                      <option value="view_only">👁️ View Only</option>
                      <option value="can_download">⬇️ Can Download</option>
                    </select>
                  </td>
                  <td style={styles.td}>
                    {link.expires_at ? new Date(link.expires_at).toLocaleString() : 'Never'}
                  </td>
                  <td style={styles.td}>{new Date(link.created_at).toLocaleDateString()}</td>
                  <td style={{ ...styles.td, textAlign: 'center', position: 'relative' }}>
                    <button
                      style={isMenuOpen ? styles.threeDotsBtnActive : styles.threeDotsBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(isMenuOpen ? null : link.id);
                      }}
                      title="Actions menu"
                    >
                      ⋮
                    </button>

                    {/* Action Dropdown Menu */}
                    {isMenuOpen && (
                      <div style={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
                        <button
                          style={styles.dropdownItem}
                          onClick={() => {
                            setOpenMenuId(null);
                            navigator.clipboard.writeText(`${window.location.origin}/s/${link.token}`);
                            alert("Share link copied to clipboard!");
                          }}
                        >
                          <span style={styles.dropdownIcon}>🔗</span> Copy Link
                        </button>
                        <button
                          style={styles.dropdownItem}
                          onClick={() => {
                            setOpenMenuId(null);
                            handleViewLogs(link.id);
                          }}
                        >
                          <span style={styles.dropdownIcon}>📊</span> Activity Logs
                        </button>
                        <div style={styles.dropdownDivider} />
                        <button
                          style={{ ...styles.dropdownItem, ...styles.dropdownItemDanger }}
                          onClick={() => {
                            setOpenMenuId(null);
                            handleRevoke(link.id);
                          }}
                        >
                          <span style={styles.dropdownIcon}>❌</span> Revoke Access
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {links.length === 0 && (
              <tr>
                <td colSpan="6" style={styles.emptyText}>No shared files or links found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Logs Modal */}
      {selectedLogs && (
        <div style={styles.overlay} onClick={() => setSelectedLogs(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.header}>
              <h3 style={styles.title}>Activity Logs</h3>
              <button onClick={() => setSelectedLogs(null)} style={styles.closeIconBtn}>✕</button>
            </div>
            <hr style={styles.divider} />
            <div style={styles.logsContainer}>
              {selectedLogs.length === 0 ? (
                <p style={styles.emptyText}>No activity recorded yet.</p>
              ) : (
                selectedLogs.map((log) => (
                  <div key={log.id} style={styles.logItem}>
                    <div style={styles.logHeader}>
                      <span style={log.action === 'viewed' ? styles.actionView : styles.actionDownload}>
                        {log.action.toUpperCase()}
                      </span>
                      <span style={styles.logTime}>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div style={styles.logDetails}>
                      <strong>IP:</strong> {log.ip_address || 'Unknown'} | <strong>Device:</strong> {log.user_agent ? log.user_agent.substring(0, 50) + '...' : 'Unknown'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '24px', borderRadius: '12px', minHeight: '100%' },
  pageTitle: { margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold', color: '#1e293b' },
  subtitle: { color: '#64748b', fontSize: '14px', marginBottom: '24px' },
  tableContainer: { border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'visible', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minHeight: '280px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '16px', fontSize: '13px', color: '#64748b', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '600' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '16px', fontSize: '14px', color: '#334155', verticalAlign: 'middle' },
  emptyText: { textAlign: 'center', padding: '36px', color: '#94a3b8' },

  badgeWarn: { backgroundColor: '#fef3c7', color: '#92400e', padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #fde68a', outline: 'none', cursor: 'pointer' },
  badgeSuccess: { backgroundColor: '#d1fae5', color: '#065f46', padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #a7f3d0', outline: 'none', cursor: 'pointer' },
  sharedToBadge: { backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', border: '1px solid #bfdbfe', display: 'inline-block', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  publicBadge: { backgroundColor: '#f8fafc', color: '#64748b', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', border: '1px solid #e2e8f0', fontStyle: 'italic' },
  
  threeDotsBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#475569',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease'
  },
  threeDotsBtnActive: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid #3b82f6',
    backgroundColor: '#eff6ff',
    cursor: 'pointer',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#2563eb',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dropdownMenu: {
    position: 'absolute',
    right: '12px',
    top: '48px',
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    padding: '6px',
    zIndex: 999,
    minWidth: '150px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    textAlign: 'left'
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#334155',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'background-color 0.15s'
  },
  dropdownItemDanger: {
    color: '#dc2626'
  },
  dropdownIcon: {
    fontSize: '14px',
    display: 'inline-block',
    width: '16px'
  },
  dropdownDivider: {
    height: '1px',
    backgroundColor: '#f1f5f9',
    margin: '4px 0'
  },

  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, backdropFilter: 'blur(2px)' },
  modal: { backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', width: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#1e293b' },
  closeIconBtn: { background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' },
  divider: { margin: '16px 0', border: 'none', borderBottom: '1px solid #e2e8f0' },
  logsContainer: { overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' },
  logItem: { padding: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' },
  logHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  actionView: { backgroundColor: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' },
  actionDownload: { backgroundColor: '#dcfce3', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' },
  logTime: { fontSize: '12px', color: '#64748b' },
  logDetails: { fontSize: '12px', color: '#475569' }
};

export default SharedLinksPage;
