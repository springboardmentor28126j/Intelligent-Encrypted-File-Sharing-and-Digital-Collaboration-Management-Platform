import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicFileDetails, downloadPublicFile } from '../services/shareService';

function PublicShareView() {
  const { token } = useParams();
  const [fileDetails, setFileDetails] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const data = await getPublicFileDetails(token);
        setFileDetails(data);
      } catch (err) {
        setError(err.response?.data?.detail || "Link invalid, revoked, or expired.");
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [token]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadPublicFile(token, fileDetails.file_name);
    } catch (err) {
      alert(err.response?.data?.detail || "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div style={styles.center}>Loading secure file...</div>;

  if (error) return (
    <div style={styles.center}>
      <div style={styles.errorCard}>
        <span style={styles.errorIcon}>⚠️</span>
        <h2 style={styles.errorTitle}>Access Denied</h2>
        <p style={styles.errorText}>{error}</p>
      </div>
    </div>
  );

  const renderPreview = () => {
    if (!fileDetails.file_type) return <div style={styles.fileIcon}>📄</div>;

    const previewUrl = `http://localhost:8000/share/public/${token}/preview`;
    
    if (fileDetails.file_type.startsWith('image/')) {
      return (
        <div style={styles.previewContainer}>
          <img src={previewUrl} alt={fileDetails.file_name} style={styles.imagePreview} />
        </div>
      );
    } 
    
    if (fileDetails.file_type === 'application/pdf' || fileDetails.file_type.startsWith('text/')) {
      return (
        <div style={styles.previewContainer}>
          <iframe src={previewUrl} title={fileDetails.file_name} style={styles.iframePreview} />
        </div>
      );
    }

    if (fileDetails.file_type.startsWith('video/')) {
      return (
        <div style={styles.previewContainer}>
          <video src={previewUrl} controls style={styles.videoPreview} />
        </div>
      );
    }

    if (fileDetails.file_type.startsWith('audio/')) {
      return (
        <div style={styles.previewContainer}>
          <audio src={previewUrl} controls style={styles.audioPreview} />
        </div>
      );
    }

    // Fallback for zip, docs, etc. that can't be rendered directly
    return <div style={styles.fileIcon}>📄</div>;
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.brand}>🛡️ TrustShare Secure Link</span>
          {fileDetails.shared_to && (
            <div style={styles.sharedToNotice}>
              👤 Shared for: <strong>{fileDetails.shared_to}</strong>
            </div>
          )}
        </div>
        
        {renderPreview()}
        
        <h2 style={styles.fileName}>{fileDetails.file_name}</h2>
        <p style={styles.fileMeta}>
          {(fileDetails.file_size / 1024).toFixed(2)} KB • Uploaded {new Date(fileDetails.uploaded_at).toLocaleDateString()}
        </p>

        {fileDetails.permission === 'can_download' ? (
          <button style={styles.downloadBtn} onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Downloading...' : '⬇ Download File'}
          </button>
        ) : (
          <div style={styles.viewOnlyBadge}>
            👁️ View Only (Download Restricted)
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8fafc', color: '#475569' },
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f1f5f9', padding: '20px' },
  card: { backgroundColor: '#fff', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '600px', textAlign: 'center', border: '1px solid #e2e8f0', maxWidth: '95vw' },
  header: { marginBottom: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
  brand: { fontSize: '14px', fontWeight: 'bold', color: '#059669', backgroundColor: '#d1fae5', padding: '6px 12px', borderRadius: '20px' },
  sharedToNotice: { fontSize: '13px', color: '#1e40af', backgroundColor: '#eff6ff', padding: '4px 12px', borderRadius: '12px', border: '1px solid #bfdbfe' },
  fileIcon: { fontSize: '64px', margin: '20px 0' },
  previewContainer: { margin: '20px 0', display: 'flex', justifyContent: 'center', width: '100%' },
  imagePreview: { maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0' },
  iframePreview: { width: '100%', height: '400px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc' },
  videoPreview: { maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#000' },
  audioPreview: { width: '100%', outline: 'none' },
  fileName: { fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px', wordBreak: 'break-word' },
  fileMeta: { fontSize: '13px', color: '#64748b', marginBottom: '30px' },
  downloadBtn: { width: '100%', padding: '14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' },
  viewOnlyBadge: { padding: '12px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', border: '1px solid #fde68a' },
  
  errorCard: { backgroundColor: '#fef2f2', padding: '40px', borderRadius: '16px', border: '1px solid #fca5a5', textAlign: 'center', width: '350px' },
  errorIcon: { fontSize: '48px' },
  errorTitle: { color: '#b91c1c', margin: '16px 0 8px 0' },
  errorText: { color: '#7f1d1d' }
};

export default PublicShareView;
