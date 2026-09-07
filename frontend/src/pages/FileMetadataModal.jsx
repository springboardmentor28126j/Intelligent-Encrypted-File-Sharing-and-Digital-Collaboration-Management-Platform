import React from 'react';

function FileMetadataModal({ file, onClose }) {
  if (!file) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>📄 File Metadata</h3>
          <button onClick={onClose} style={styles.closeIconBtn}>✕</button>
        </div>
        <hr style={styles.divider} />
        
        <div style={styles.detailsContainer}>
          <div style={styles.detailRow}>
            <span style={styles.label}>Name:</span>
            <span style={styles.value}>{file.original_filename || file.original_name}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.label}>Category:</span>
            <span style={styles.valueBadge}>{file.category ? file.category.toUpperCase() : 'OTHER'}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.label}>MIME Type:</span>
            <span style={styles.value}>{file.file_type || file.mime_type || 'Unknown'}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.label}>Size:</span>
            <span style={styles.value}>{(file.file_size / 1024).toFixed(2)} KB</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.label}>Uploaded At:</span>
            <span style={styles.value}>
              {file.uploaded_at || file.created_at ? new Date(file.uploaded_at || file.created_at).toLocaleString() : 'Unknown'}
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.label}>Encryption:</span>
            <span >null</span>
          </div>
        </div>

        <button onClick={onClose} style={styles.closeBtn}>Close</button>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', width: '380px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: 'bold' },
  closeIconBtn: { background: 'transparent', border: 'none', fontSize: '16px', color: '#64748b', cursor: 'pointer', padding: '4px' },
  divider: { margin: '0', border: 'none', borderBottom: '1px solid #e2e8f0' },
  detailsContainer: { display: 'flex', flexDirection: 'column', gap: '12px' },
  detailRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  label: { fontSize: '13px', color: '#64748b', fontWeight: '600', minWidth: '90px' },
  value: { fontSize: '13px', color: '#334155', wordBreak: 'break-all', textAlign: 'right' },
  valueBadge: { fontSize: '11px', color: '#475569', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' },
  encryptionBadge: { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', backgroundColor: '#f0fdf4', color: '#10b981', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #bbf7d0' },
  closeBtn: { marginTop: '8px', padding: '10px 16px', backgroundColor: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s ease' }
};

export default FileMetadataModal;