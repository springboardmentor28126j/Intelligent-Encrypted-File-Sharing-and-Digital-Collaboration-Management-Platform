import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('files');
  const [authView, setAuthView] = useState('login');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareFileId, setShareFileId] = useState(null);
  const [shareFileName, setShareFileName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [expiryHours, setExpiryHours] = useState(24);
  const [shareResultLink, setShareResultLink] = useState('');
  const [activityLogs, setActivityLogs] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaLoginEmail, setMfaLoginEmail] = useState('');
  const [mfaLoginCode, setMfaLoginCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(localStorage.getItem('mfa_enabled') === 'true');
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaSetupCode, setMfaSetupCode] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });

  const [shareLinks, setShareLinks] = useState([]);

  useEffect(() => {
    if (loggedIn) {
      fetchFiles();
    }
    // eslint-disable-next-line
  }, [loggedIn]);

  useEffect(() => {
    if (loggedIn && activeTab === 'activity') {
      fetchActivityLog();
    }
    // eslint-disable-next-line
  }, [loggedIn, activeTab]);

  useEffect(() => {
    if (loggedIn && activeTab === 'analytics') {
      fetchAnalytics();
    }
    // eslint-disable-next-line
  }, [loggedIn, activeTab]);

  useEffect(() => {
    if (loggedIn && activeTab === 'settings') {
      fetchShareLinks();
    }
    // eslint-disable-next-line
  }, [loggedIn, activeTab]);

  const fetchFiles = async () => {
    try {
      const userEmail = localStorage.getItem('email');
      const userRole = localStorage.getItem('role');
      const response = await axios.get(
        `http://127.0.0.1:8000/files?email=${encodeURIComponent(userEmail)}&role=${encodeURIComponent(userRole)}`
      );
      setFiles(response.data);
    } catch (error) {
      console.log('Error fetching files');
    }
  };

  const fetchActivityLog = async () => {
    try {
      const userEmail = localStorage.getItem('email');
      const userRole = localStorage.getItem('role');
      const response = await axios.get(
        `http://127.0.0.1:8000/activity-log?email=${encodeURIComponent(userEmail)}&role=${encodeURIComponent(userRole)}`
      );
      setActivityLogs(response.data);
    } catch (error) {
      console.log('Error fetching activity log');
    }
  };

  const fetchAnalytics = async () => {
    try {
      const userEmail = localStorage.getItem('email');
      const userRole = localStorage.getItem('role');
      const response = await axios.get(
        `http://127.0.0.1:8000/analytics?email=${encodeURIComponent(userEmail)}&role=${encodeURIComponent(userRole)}`
      );
      setAnalytics(response.data);
    } catch (error) {
      console.log('Error fetching analytics');
    }
  };

  const fetchShareLinks = async () => {
    try {
      const userEmail = localStorage.getItem('email');
      const userRole = localStorage.getItem('role');
      const res = await axios.get(
        `http://127.0.0.1:8000/share-links?email=${encodeURIComponent(userEmail)}&role=${encodeURIComponent(userRole)}`
      );
      setShareLinks(res.data);
    } catch (error) {
      console.log('Error fetching share links');
    }
  };

  const handleRevokeShareLink = async (token) => {
    if (!window.confirm('Revoke this share link? It will stop working immediately.')) return;
    try {
      const userEmail = localStorage.getItem('email');
      const userRole = localStorage.getItem('role');
      await axios.delete(
        `http://127.0.0.1:8000/share-links/${token}?email=${encodeURIComponent(userEmail)}&role=${encodeURIComponent(userRole)}`
      );
      setMessage('Share link revoked');
      setIsError(false);
      fetchShareLinks();
    } catch (error) {
      setIsError(true);
      setMessage('Failed to revoke link');
    }
  };

  const checkPasswordStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score, label: 'Weak', color: '#e94560' };
    if (score <= 3) return { score, label: 'Medium', color: '#f5a623' };
    return { score, label: 'Strong', color: '#2dd4bf' };
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setIsError(false);
    try {
      const url = isLogin
        ? 'http://127.0.0.1:8000/login'
        : 'http://127.0.0.1:8000/signup';

      const payload = isLogin
        ? { email, password }
        : { name, email, password, role };

      const response = await axios.post(url, payload);

      if (isLogin) {
        if (response.data.mfa_required) {
          setMfaRequired(true);
          setMfaLoginEmail(response.data.email);
          setIsError(false);
          setMessage(response.data.message);
          return;
        }
        setMessage('Login successful. Redirecting...');
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('email', email);
        localStorage.setItem('role', response.data.role || 'user');
        localStorage.setItem('name', response.data.name || email.split('@')[0]);
        localStorage.setItem('mfa_enabled', 'false');
        setMfaEnabled(false);
        setTimeout(() => setLoggedIn(true), 400);
      } else {
        setMessage('Account created. You can log in now.');
        setIsLogin(true);
        setPasswordStrength({ score: 0, label: '', color: '' });
      }
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.detail || 'Something went wrong');
    }
  };

  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    setIsError(false);
    try {
      const response = await axios.post('http://127.0.0.1:8000/verify-mfa', {
        email: mfaLoginEmail,
        code: mfaLoginCode,
      });
      setMessage('Login successful. Redirecting...');
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('email', mfaLoginEmail);
      localStorage.setItem('role', response.data.role || 'user');
      localStorage.setItem('name', response.data.name || mfaLoginEmail.split('@')[0]);
      localStorage.setItem('mfa_enabled', 'true');
      setMfaEnabled(true);
      setTimeout(() => {
        setMfaRequired(false);
        setMfaLoginCode('');
        setLoggedIn(true);
      }, 400);
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.detail || 'Invalid or expired code');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsError(false);
    try {
      const response = await axios.post('http://127.0.0.1:8000/forgot-password', { email });
      setGeneratedToken(response.data.reset_token);
      setMessage(response.data.message);
      setAuthView('reset');
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.detail || 'Something went wrong');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsError(false);
    try {
      const response = await axios.post('http://127.0.0.1:8000/reset-password', {
        token: resetToken,
        new_password: newPassword,
      });
      setMessage(response.data.message);
      setIsError(false);
      setTimeout(() => {
        setAuthView('login');
        setResetToken('');
        setNewPassword('');
        setGeneratedToken('');
      }, 1500);
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.detail || 'Invalid or expired token');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setIsError(true);
      setMessage('Choose a file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('owner_email', localStorage.getItem('email'));

    try {
      const res = await axios.post('http://127.0.0.1:8000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setIsError(false);
      setMessage(res.data.message || 'File uploaded successfully');
      setSelectedFile(null);
      fetchFiles();
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.detail || 'File upload failed');
    }
  };

  const handleDelete = async (fileId, filename) => {
    if (!window.confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    try {
      const userEmail = localStorage.getItem('email');
      const userRole = localStorage.getItem('role');
      await axios.delete(
        `http://127.0.0.1:8000/files/${fileId}?email=${encodeURIComponent(userEmail)}&role=${encodeURIComponent(userRole)}`
      );
      setMessage('File deleted successfully');
      setIsError(false);
      fetchFiles();
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.detail || 'Failed to delete file');
    }
  };

  const handleDownload = (fileId) => {
    const userEmail = localStorage.getItem('email');
    const userRole = localStorage.getItem('role');
    window.open(
      `http://127.0.0.1:8000/download/${fileId}?email=${encodeURIComponent(userEmail)}&role=${encodeURIComponent(userRole)}`,
      '_blank'
    );
  };

  const openShareModal = (fileId, filename) => {
    setShareFileId(fileId);
    setShareFileName(filename);
    setRecipientEmail('');
    setExpiryHours(24);
    setShareResultLink('');
    setShowShareModal(true);
  };

  const closeShareModal = () => {
    setShowShareModal(false);
  };

  const handleGenerateShareLink = async () => {
    if (!recipientEmail) {
      setIsError(true);
      setMessage('Enter a recipient email');
      return;
    }
    const ownerEmail = localStorage.getItem('email');
    const ownerRole = localStorage.getItem('role');
    try {
      const res = await axios.post(`http://127.0.0.1:8000/share/${shareFileId}`, {
        email: ownerEmail,
        role: ownerRole,
        recipient_email: recipientEmail,
        expiry_hours: expiryHours,
      });
      setShareResultLink(res.data.share_url);
      setIsError(false);
      setMessage(res.data.message);
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.detail || 'Failed to create share link');
    }
  };

  const handleMfaEnableRequest = async () => {
    try {
      const userEmail = localStorage.getItem('email');
      const res = await axios.post('http://127.0.0.1:8000/mfa/enable-request', { email: userEmail });
      setIsError(false);
      setMessage(res.data.message);
      setShowMfaSetup(true);
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.detail || 'Failed to send verification code');
    }
  };

  const handleMfaEnableConfirm = async () => {
    try {
      const userEmail = localStorage.getItem('email');
      const res = await axios.post('http://127.0.0.1:8000/mfa/enable-confirm', {
        email: userEmail,
        code: mfaSetupCode,
      });
      setIsError(false);
      setMessage(res.data.message);
      setMfaEnabled(true);
      localStorage.setItem('mfa_enabled', 'true');
      setShowMfaSetup(false);
      setMfaSetupCode('');
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.detail || 'Invalid or expired code');
    }
  };

  const handleMfaDisable = async () => {
    try {
      const userEmail = localStorage.getItem('email');
      const res = await axios.post('http://127.0.0.1:8000/mfa/disable', { email: userEmail });
      setIsError(false);
      setMessage(res.data.message);
      setMfaEnabled(false);
      localStorage.setItem('mfa_enabled', 'false');
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.detail || 'Failed to disable two-factor authentication');
    }
  };

  const handleDownloadReport = async () => {
    try {
      const userEmail = localStorage.getItem('email');
      const userRole = localStorage.getItem('role');
      const res = await axios.get(
        `http://127.0.0.1:8000/report?email=${encodeURIComponent(userEmail)}&role=${encodeURIComponent(userRole)}&days=7`
      );
      const report = res.data;

      let csv = `TrustShare Activity & Security Report\n`;
      csv += `Generated by,${report.generated_by}\n`;
      csv += `Generated at,${new Date(report.generated_at).toLocaleString()}\n`;
      csv += `Period,Last ${report.period_days} days\n`;
      csv += `Total events,${report.total_events}\n\n`;

      csv += `Summary\n`;
      csv += `Action,Count\n`;
      csv += `Uploads,${report.summary.file_upload}\n`;
      csv += `Downloads,${report.summary.file_download}\n`;
      csv += `Deletes,${report.summary.file_delete}\n`;
      csv += `Share links created,${report.summary.share_link_created}\n`;
      csv += `Shared file accesses,${report.summary.shared_file_access}\n`;
      csv += `Suspicious activities,${report.summary.suspicious_activity}\n\n`;

      if (report.suspicious_details.length > 0) {
        csv += `Suspicious Activity Details\n`;
        csv += `User,Reason,Timestamp\n`;
        report.suspicious_details.forEach((d) => {
          csv += `${d.performed_by},"${d.reason}",${new Date(d.timestamp).toLocaleString()}\n`;
        });
      }

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TrustShare_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setIsError(false);
      setMessage('Report downloaded successfully');
    } catch (error) {
      setIsError(true);
      setMessage('Failed to generate report');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setLoggedIn(false);
    setEmail('');
    setPassword('');
    setFiles([]);
    setActivityLogs([]);
    setAnalytics(null);
    setShareLinks([]);
    setMessage('');
    setActiveTab('files');
    setMfaEnabled(false);
    setMfaRequired(false);
    setMfaLoginCode('');
    setShowMfaSetup(false);
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return '🖼️';
    if (['pdf'].includes(ext)) return '📕';
    if (['doc', 'docx'].includes(ext)) return '📄';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    if (['zip', 'rar'].includes(ext)) return '🗜️';
    return '📁';
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'file_upload': return 'uploaded';
      case 'file_download': return 'downloaded';
      case 'file_delete': return 'deleted';
      case 'share_link_created': return 'created a share link for';
      case 'shared_file_access': return 'accessed via share link';
      case 'share_link_revoked': return 'revoked a share link';
      case 'suspicious_activity': return 'triggered a suspicious activity alert';
      case 'mfa_enabled': return 'enabled two-factor authentication';
      case 'mfa_disabled': return 'disabled two-factor authentication';
      default: return action;
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'file_upload': return '⬆️';
      case 'file_download': return '⬇️';
      case 'file_delete': return '🗑️';
      case 'share_link_created': return '🔗';
      case 'shared_file_access': return '📤';
      case 'share_link_revoked': return '🚫';
      case 'suspicious_activity': return '⚠️';
      case 'mfa_enabled': return '🔐';
      case 'mfa_disabled': return '🔓';
      default: return '📄';
    }
  };

  const formatTime = (t) => {
    if (!t) return 'Unknown time';
    try {
      return new Date(t).toLocaleString();
    } catch {
      return t;
    }
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const filteredFiles = files.filter((f) =>
    f.filename.toLowerCase().includes(search.toLowerCase())
  );

  const suspiciousCount = activityLogs.filter((log) => log.action === 'suspicious_activity').length;

  // ---------- MFA VERIFICATION SCREEN ----------
  if (!loggedIn && mfaRequired) {
    return (
      <div className="auth-page">
        <div className="auth-brand">
          <div className="brand-mark">
            <div className="brand-lock">🔒</div>
            <div className="brand-name">TrustShare</div>
          </div>
          <h1>Share files.<br /><span className="accent">Not your privacy.</span></h1>
          <div className="brand-features">
            <div className="brand-feature"><span className="dot" />AES-256 encryption</div>
            <div className="brand-feature"><span className="dot" />Role-based access</div>
            <div className="brand-feature"><span className="dot" />Full audit trail</div>
          </div>
        </div>

        <div className="auth-form-side">
          <div className="auth-card">
            <h2>Two-factor verification</h2>
            <p className="subtitle">Enter the code sent to {mfaLoginEmail}</p>
            <form onSubmit={handleVerifyMfa}>
              <div className="field-group">
                <label>Verification code</label>
                <input
                  type="text"
                  placeholder="Enter code"
                  value={mfaLoginCode}
                  onChange={(e) => setMfaLoginCode(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary">Verify &amp; Log In</button>
            </form>
            {message && (
              <div className={`auth-message ${isError ? 'error' : ''}`}>{message}</div>
            )}
            <p className="auth-switch">
              <span onClick={() => { setMfaRequired(false); setMfaLoginCode(''); setMessage(''); }}>Back to login</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------- LOGIN / SIGNUP PAGE ----------
  if (!loggedIn) {
    return (
      <div className="auth-page">
        <div className="auth-brand">
          <div className="brand-mark">
            <div className="brand-lock">🔒</div>
            <div className="brand-name">TrustShare</div>
          </div>
          <h1>Share files.<br /><span className="accent">Not your privacy.</span></h1>
          <div className="brand-features">
            <div className="brand-feature"><span className="dot" />AES-256 encryption</div>
            <div className="brand-feature"><span className="dot" />Role-based access</div>
            <div className="brand-feature"><span className="dot" />Full audit trail</div>
          </div>
        </div>

        <div className="auth-form-side">
          <div className="auth-card">
              {authView === 'forgot' ? (
                <>
                  <h2>Forgot password</h2>
                  <p className="subtitle">Enter your email and we'll generate a reset code</p>
                  <form onSubmit={handleForgotPassword}>
                    <div className="field-group">
                      <label>Email</label>
                      <input
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="btn-primary">Send reset code</button>
                  </form>
                  {message && (
                    <div className={`auth-message ${isError ? 'error' : ''}`}>{message}</div>
                  )}
                  <p className="auth-switch">
                    <span onClick={() => { setAuthView('login'); setMessage(''); }}>Back to login</span>
                  </p>
                </>
              ) : authView === 'reset' ? (
                <>
                  <h2>Reset password</h2>
                  <p className="subtitle">Enter the code and your new password</p>
                  <form onSubmit={handleResetPassword}>
                    <div className="field-group">
                      <label>Reset code</label>
                      <input
                        type="text"
                        placeholder="Enter code"
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        required
                      />
                    </div>
                    <div className="field-group">
                      <label>New password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="btn-primary">Reset password</button>
                  </form>
                  {message && (
                    <div className={`auth-message ${isError ? 'error' : ''}`}>{message}</div>
                  )}
                  <p className="auth-switch">
                    <span onClick={() => { setAuthView('login'); setMessage(''); }}>Back to login</span>
                  </p>
                </>
              ) : (
                <>
                  <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
                  <p className="subtitle">
                    {isLogin ? 'Log in to access your files' : 'Start sharing files securely'}
                  </p>

                  <form onSubmit={handleAuthSubmit}>
                    {!isLogin && (
                      <div className="field-group">
                        <label>Full name</label>
                        <input
                          type="text"
                          placeholder="Divya Prakash"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </div>
                    )}
                    <div className="field-group">
                      <label>Email</label>
                      <input
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="field-group">
                      <label>Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (!isLogin) setPasswordStrength(checkPasswordStrength(e.target.value));
                        }}
                        required
                      />
                      {!isLogin && password && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ height: '4px', background: '#253256', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${(passwordStrength.score / 5) * 100}%`,
                              background: passwordStrength.color,
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                          <div style={{ fontSize: '12px', color: passwordStrength.color, marginTop: '4px' }}>
                            {passwordStrength.label}
                          </div>
                        </div>
                      )}
                    </div>

                    {isLogin && (
                      <div className="forgot-link">
                        <span onClick={() => { setAuthView('forgot'); setMessage(''); }}>Forgot password?</span>
                      </div>
                    )}

                    {!isLogin && (
                      <div className="field-group">
                        <label>Account type</label>
                        <select value={role} onChange={(e) => setRole(e.target.value)}>
                          <option value="user">Standard user</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    )}

                    <button type="submit" className="btn-primary">
                      {isLogin ? 'Log In' : 'Create Account'}
                    </button>
                  </form>

                  {message && (
                    <div className={`auth-message ${isError ? 'error' : ''}`}>{message}</div>
                  )}

                  <p className="auth-switch">
                    {isLogin ? "Don't have an account? " : 'Already have an account? '}
                    <span onClick={() => { setIsLogin(!isLogin); setMessage(''); }}>
                      {isLogin ? 'Sign up' : 'Log in'}
                    </span>
                  </p>
                </>
              )}
            </div>
        </div>
      </div>
    );
  }

  // ---------- DASHBOARD ----------
  const userEmail = localStorage.getItem('email');
  const userRole = localStorage.getItem('role') || 'user';
  const userName = localStorage.getItem('name') || userEmail;
  const initials = userName.substring(0, 2).toUpperCase();

  return (
    <div className="dash-layout">
      <div className="sidebar">
        <div className="brand-mark">
          <div className="brand-lock">🔒</div>
          <div className="brand-name">TrustShare</div>
        </div>

        <div
          className={`nav-item ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          📁 My Files
        </div>
        <div
          className={`nav-item ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          📊 Activity Log
          {suspiciousCount > 0 && activeTab !== 'activity' && (
            <span className="nav-badge">{suspiciousCount}</span>
          )}
        </div>
        <div
          className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 Analytics
        </div>
        <div
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </div>

        <div className="sidebar-footer">
          <div className="avatar-chip">{initials}</div>
          <div className="sidebar-footer-info">
            <div className="fname">{userName}</div>
            <span className={`role-badge ${userRole}`}>{userRole}</span>
          </div>
        </div>
      </div>

      <div className="dash-main">
        {activeTab === 'files' && (
          <>
            <div className="dash-topbar">
              <div>
                <h1>Your Files</h1>
                <div className="welcome">Manage and share your encrypted files</div>
              </div>
              <button className="btn-logout" onClick={handleLogout}>Log out</button>
            </div>

            <div className="stat-row">
              <div className="stat-card">
                <div className="stat-value">{files.length}</div>
                <div className="stat-label">Total files</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">AES-256</div>
                <div className="stat-label">Encryption standard</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{userRole}</div>
                <div className="stat-label">Access level</div>
              </div>
            </div>

            <div className="card">
              <h3>Upload a file</h3>
              <form onSubmit={handleFileUpload}>
                <div className={`upload-zone ${selectedFile ? 'has-file' : ''}`}>
                  <label className="upload-label" htmlFor="file-input">Choose file</label>
                  <input
                    id="file-input"
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                  />
                  {selectedFile ? (
                    <div className="filename mono">{selectedFile.name}</div>
                  ) : (
                    <div className="hint">No file selected yet</div>
                  )}
                  <div style={{ marginTop: '16px' }}>
                    <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                      Upload &amp; Encrypt
                    </button>
                  </div>
                </div>
              </form>
              {message && (
                <div className={`auth-message ${isError ? 'error' : ''}`} style={{ marginTop: '16px' }}>
                  {message}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header-row">
                <h3 style={{ margin: 0 }}>File vault ({filteredFiles.length})</h3>
                <input
                  className="search-input"
                  placeholder="Search files..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {filteredFiles.length === 0 ? (
                <div className="empty-state">
                  {files.length === 0 ? 'No files uploaded yet — upload your first file above.' : 'No files match your search.'}
                </div>
              ) : (
                <table className="files-table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Uploaded by</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <div className="file-name-cell">
                            <div className="file-icon">{getFileIcon(f.filename)}</div>
                            <div>
                              <div className="name">{f.filename}</div>
                              <div className="file-meta mono">
                                {formatSize(f.file_size)} · {formatTime(f.upload_time)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="owner-cell mono">{f.owner_email}</td>
                        <td>
                          <div className="file-actions">
                            <button className="icon-btn" onClick={() => handleDownload(f.id)}>Download</button>
                            <button className="icon-btn" onClick={() => openShareModal(f.id, f.filename)}>Share</button>
                            <button className="icon-btn danger" onClick={() => handleDelete(f.id, f.filename)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeTab === 'activity' && (
          <>
            <div className="dash-topbar">
              <div>
                <h1>Activity Log</h1>
                <div className="welcome">Recent file activity across your account</div>
              </div>
              <button className="btn-logout" onClick={handleLogout}>Log out</button>
            </div>

            {suspiciousCount > 0 && (
              <div className="alert-banner">
                ⚠️ {suspiciousCount} suspicious {suspiciousCount === 1 ? 'activity' : 'activities'} detected — review below
              </div>
            )}

            <div className="card">
              <h3>Recent activity</h3>
              {activityLogs.length === 0 ? (
                <div className="empty-state">No activity yet — upload, download, share, or delete a file to see it here.</div>
              ) : (
                activityLogs.map((log) => {
                  const isSuspicious = log.action === 'suspicious_activity';
                  return (
                    <div
                      className={`activity-item ${isSuspicious ? 'activity-alert' : ''}`}
                      key={log._id}
                    >
                      <div className="activity-dot">{getActionIcon(log.action)}</div>
                      <div>
                        {isSuspicious ? (
                          <div className="activity-text">
                            <span className="mono">{log.performed_by}</span> {getActionLabel(log.action)}
                            {log.reason && <div className="activity-reason">{log.reason}</div>}
                          </div>
                        ) : (
                          <div className="activity-text">
                            <span className="mono">{log.performed_by}</span> {getActionLabel(log.action)} <span className="mono">{log.filename}</span>
                            {log.recipient_email && (
                              <> with <span className="mono">{log.recipient_email}</span></>
                            )}
                          </div>
                        )}
                        <div className="activity-time">{formatTime(log.timestamp)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {activeTab === 'analytics' && analytics && (
          <>
            <div className="dash-topbar">
              <div>
                <h1>Analytics</h1>
                <div className="welcome">Storage usage and activity overview</div>
              </div>
              <button className="btn-logout" onClick={handleLogout}>Log out</button>
            </div>

            <div className="analytics-grid">
              <div className="analytics-card">
                <div className="value">{analytics.total_files}</div>
                <div className="label">Total Files</div>
              </div>
              <div className="analytics-card">
                <div className="value">{formatBytes(analytics.total_storage_bytes)}</div>
                <div className="label">Storage Used</div>
              </div>
              <div className="analytics-card">
                <div className="value">{analytics.total_uploads}</div>
                <div className="label">Total Uploads</div>
              </div>
              <div className="analytics-card danger">
                <div className="value">{analytics.suspicious_count}</div>
                <div className="label">Suspicious Events</div>
              </div>
            </div>

            <div className="stat-row">
              <div className="stat-card">
                <div className="stat-value">{analytics.total_downloads}</div>
                <div className="stat-label">Downloads</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{analytics.total_shares}</div>
                <div className="stat-label">Share Links Created</div>
              </div>
            </div>

            <div className="card">
              <h3>File Types</h3>
              {Object.keys(analytics.type_breakdown).length === 0 ? (
                <div className="empty-state">No files uploaded yet.</div>
              ) : (
                Object.entries(analytics.type_breakdown).map(([type, count]) => {
                  const maxCount = Math.max(...Object.values(analytics.type_breakdown));
                  const percent = (count / maxCount) * 100;
                  return (
                    <div className="bar-row" key={type}>
                      <div className="bar-label">{type}</div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${percent}%` }}></div>
                      </div>
                      <div className="bar-count">{count}</div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="card">
              <h3>Top Uploaders</h3>
              {analytics.top_uploaders.length === 0 ? (
                <div className="empty-state">No uploads yet.</div>
              ) : (
                analytics.top_uploaders.map((u, idx) => (
                  <div className="uploader-row" key={u.email}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div className="uploader-rank">{idx + 1}</div>
                      <div className="mono" style={{ fontSize: '13px' }}>{u.email}</div>
                    </div>
                    <div className="mono" style={{ fontSize: '13px', color: '#2DD4BF' }}>{u.count} files</div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'settings' && (
          <>
            <div className="dash-topbar">
              <div>
                <h1>Settings</h1>
                <div className="welcome">Your account details</div>
              </div>
              <button className="btn-logout" onClick={handleLogout}>Log out</button>
            </div>

            <div className="card">
              <h3>Account information</h3>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Name</div>
                  <div className="settings-value">{userName}</div>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Email</div>
                  <div className="settings-value mono">{userEmail}</div>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Access level</div>
                  <div className="settings-value">
                    <span className={`role-badge ${userRole}`}>{userRole}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3>Security</h3>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Password</div>
                  <div className="settings-value">••••••••</div>
                </div>
                <span className="badge-soon">Change password — coming soon</span>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Two-factor authentication</div>
                  <div className="settings-value">{mfaEnabled ? 'Enabled' : 'Not enabled'}</div>
                </div>
                {mfaEnabled ? (
                  <button className="btn-secondary" onClick={handleMfaDisable}>Disable</button>
                ) : (
                  <button className="btn-primary" style={{ width: 'auto', padding: '9px 18px' }} onClick={handleMfaEnableRequest}>
                    Enable
                  </button>
                )}
              </div>

              {showMfaSetup && (
                <div style={{ marginTop: '16px' }}>
                  <div className="field-group">
                    <label>Verification code (sent to your email)</label>
                    <input
                      type="text"
                      placeholder="Enter code"
                      value={mfaSetupCode}
                      onChange={(e) => setMfaSetupCode(e.target.value)}
                    />
                  </div>
                  <button className="btn-primary" style={{ width: 'auto', padding: '9px 18px' }} onClick={handleMfaEnableConfirm}>
                    Confirm code
                  </button>
                </div>
              )}

              {message && (
                <div className={`auth-message ${isError ? 'error' : ''}`} style={{ marginTop: '16px' }}>
                  {message}
                </div>
              )}
            </div>

            <div className="card">
              <h3>Reports</h3>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Activity & Security Report</div>
                  <div className="settings-value">Last 7 days summary as CSV</div>
                </div>
                <button className="btn-primary" style={{ width: 'auto', padding: '9px 18px' }} onClick={handleDownloadReport}>
                  Download Report
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Active Share Links ({shareLinks.length})</h3>
              {shareLinks.length === 0 ? (
                <div className="empty-state">No active share links.</div>
              ) : (
                shareLinks.map((s) => (
                  <div className="settings-row" key={s.share_token}>
                    <div>
                      <div className="settings-label">{s.filename}</div>
                      <div className="settings-value mono" style={{ fontSize: '12px' }}>
                        Shared with {s.recipient_email} · Expires {formatTime(s.expires_at)}
                      </div>
                    </div>
                    <button className="icon-btn danger" onClick={() => handleRevokeShareLink(s.share_token)}>
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {showShareModal && (
        <div className="modal-overlay" onClick={closeShareModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Share file</h2>
              <span className="modal-close" onClick={closeShareModal}>✕</span>
            </div>
            <p className="subtitle">Send a secure, time-limited link by email</p>

            <div className="modal-file-chip">
              <div className="name">{shareFileName}</div>
            </div>

            <div className="field-group">
              <label>RECIPIENT EMAIL</label>
              <input
                type="email"
                placeholder="friend@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label>LINK EXPIRES IN</label>
              <select value={expiryHours} onChange={(e) => setExpiryHours(Number(e.target.value))}>
                <option value={1}>1 hour</option>
                <option value={24}>24 hours</option>
                <option value={72}>3 days</option>
                <option value={168}>7 days</option>
              </select>
            </div>

            {shareResultLink && (
              <div className="dev-note">
                <strong>Dev mode:</strong> Email sending isn't wired up yet — copy this link manually:
                <div className="token-box mono">{shareResultLink}</div>
              </div>
            )}

            {message && (
              <div className={`auth-message ${isError ? 'error' : ''}`}>{message}</div>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeShareModal}>Cancel</button>
              <button className="btn-primary" onClick={handleGenerateShareLink}>Generate &amp; Send Link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;