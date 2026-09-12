import React, { useState, useEffect } from 'react';
import { getSharedWithMe } from '../services/shareService';
import { viewFile, downloadFile } from '../services/fileService';

function SharedWithMePage() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchShares = async () => {
    setLoading(true);
    try {
      const data = await getSharedWithMe();
      setShares(data);
    } catch (err) {
      console.error("Failed to fetch shared files:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, []);

  const handleView = async (fileId) => {
    try {
      await viewFile(fileId);
    } catch (err) {
      console.error("Failed to view file:", err);
      const detail = err.response?.data?.detail || err.message || "Failed to view file";
      alert(`Error: ${detail}`);
    }
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      await downloadFile(fileId, fileName);
    } catch (err) {
      console.error("Failed to download file:", err);
      const detail = err.response?.data?.detail || err.message || "Failed to download file";
      alert(`Error: ${detail}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredShares = shares.filter((s) => {
    const term = searchTerm.toLowerCase();
    const fileName = (s.file_name || '').toLowerCase();
    const ownerName = (s.owner_name || '').toLowerCase();
    const ownerEmail = (s.owner_email || '').toLowerCase();
    return fileName.includes(term) || ownerName.includes(term) || ownerEmail.includes(term);
  });

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>👥 Shared With Me</h2>
          <p style={styles.subtitle}>Files that other team members and collaborators have shared with you.</p>
        </div>
        <div style={styles.searchBox}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by file or sender..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={styles.clearBtn}>✕</button>
          )}
        </div>
      </div>

      {/* Content Table */}
      {loading ? (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading shared files...</p>
        </div>
      ) : filteredShares.length === 0 ? (
        <div style={styles.emptyCard}>
          <span style={styles.emptyIcon}>📂</span>
          <h3 style={styles.emptyTitle}>No shared files found</h3>
          <p style={styles.emptySubtitle}>
            {searchTerm
              ? `No files matching "${searchTerm}" were found.`
              : "When someone shares a file directly with your name or email, it will appear here."}
          </p>
          <button onClick={fetchShares} style={styles.refreshBtn}>🔄 Refresh</button>
        </div>
      ) : (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>File Name</th>
                <th style={styles.th}>Shared By</th>
                <th style={styles.th}>Permission</th>
                <th style={styles.th}>Size</th>
                <th style={styles.th}>Shared Date</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShares.map((item) => {
                const canDownload = item.permission === 'can_download';
                return (
                  <tr key={item.id} style={styles.tr}>
                    {/* File Name */}
                    <td style={styles.td}>
                      <div style={styles.fileCell}>
                        <span style={styles.fileIcon}>📄</span>
                        <div>
                          <div style={styles.fileName}>{item.file_name}</div>
                          <div style={styles.fileCategory}>{item.category || item.file_type || 'File'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Shared By */}
                    <td style={styles.td}>
                      <div style={styles.ownerCell}>
                        <div style={styles.avatar}>
                          {item.owner_name ? item.owner_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div style={styles.ownerName}>{item.owner_name}</div>
                          <div style={styles.ownerEmail}>{item.owner_email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Permission */}
                    <td style={styles.td}>
                      <span style={canDownload ? styles.badgeSuccess : styles.badgeWarn}>
                        {canDownload ? '⬇️ Can Download' : '👁️ View Only'}
                      </span>
                    </td>

                    {/* Size */}
                    <td style={styles.td}>{formatFileSize(item.file_size)}</td>

                    {/* Date */}
                    <td style={styles.td}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recently'}
                    </td>

                    {/* Actions */}
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <div style={styles.actionGroup}>
                        <button
                          onClick={() => handleView(item.file_id)}
                          style={styles.viewBtn}
                          title="Preview / View File"
                        >
                          👁️ View
                        </button>
                        {canDownload ? (
                          <button
                            onClick={() => handleDownload(item.file_id, item.file_name)}
                            style={styles.downloadBtn}
                            title="Download File"
                          >
                            ⬇️ Download
                          </button>
                        ) : (
                          <button
                            disabled
                            style={styles.downloadBtnDisabled}
                            title="Download restricted by sender"
                          >
                            🔒 Download
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px'
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: '24px',
    fontWeight: '800',
    color: '#0f172a'
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#64748b'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '6px 14px',
    gap: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    width: '280px'
  },
  searchIcon: { fontSize: '14px', color: '#94a3b8' },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    color: '#1e293b'
  },
  clearBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '14px'
  },

  loadingContainer: {
    padding: '60px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px'
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #2563eb',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: { color: '#64748b', fontSize: '14px' },

  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '60px 24px',
    textAlign: 'center',
    border: '1px dashed #cbd5e1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px'
  },
  emptyIcon: { fontSize: '48px' },
  emptyTitle: { margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' },
  emptySubtitle: { margin: 0, fontSize: '14px', color: '#64748b', maxWidth: '400px' },
  refreshBtn: {
    marginTop: '12px',
    padding: '8px 18px',
    backgroundColor: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer'
  },

  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
  },
  thRow: {
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0'
  },
  th: {
    padding: '14px 18px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
    transition: 'background-color 0.15s'
  },
  td: {
    padding: '14px 18px',
    fontSize: '13px',
    color: '#334155',
    verticalAlign: 'middle'
  },

  fileCell: { display: 'flex', alignItems: 'center', gap: '12px' },
  fileIcon: { fontSize: '24px' },
  fileName: { fontWeight: '600', color: '#0f172a', fontSize: '14px' },
  fileCategory: { fontSize: '12px', color: '#94a3b8', textTransform: 'capitalize' },

  ownerCell: { display: 'flex', alignItems: 'center', gap: '10px' },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontWeight: '700',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  ownerName: { fontWeight: '600', color: '#1e293b', fontSize: '13px' },
  ownerEmail: { fontSize: '11px', color: '#64748b' },

  badgeSuccess: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    border: '1px solid #bbf7d0'
  },
  badgeWarn: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fde68a'
  },

  actionGroup: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
  viewBtn: {
    padding: '6px 12px',
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    border: '1px solid #bfdbfe',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'pointer'
  },
  downloadBtn: {
    padding: '6px 12px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'pointer'
  },
  downloadBtnDisabled: {
    padding: '6px 12px',
    backgroundColor: '#f1f5f9',
    color: '#94a3b8',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'not-allowed'
  }
};

export default SharedWithMePage;
