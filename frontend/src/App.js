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
  const [authView, setAuthView] = useState('login'); // login | signup | forgot | reset
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareFileId, setShareFileId] = useState(null);
  const [shareFileName, setShareFileName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [expiryHours, setExpiryHours] = useState(24);
  const [shareResultLink, setShareResultLink] = useState('');

  useEffect(() => {
    if (loggedIn) {
      fetchFiles();
    }
    // eslint-disable-next-line
  }, [loggedIn]);

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
        setMessage('Login successful. Redirecting...');
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('email', email);
        localStorage.setItem('role', response.data.role || 'user');
        localStorage.setItem('name', response.data.name || email.split('@')[0]);
        setTimeout(() => setLoggedIn(true), 400);
      } else {
        setMessage('Account created. You can log in now.');
        setIsLogin(true);
      }
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.detail || 'Something went wrong');
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

  const handleLogout = () => {
    localStorage.clear();
    setLoggedIn(false);
    setEmail('');
    setPassword('');
    setFiles([]);
    setMessage('');
    setActiveTab('files');
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

  const filteredFiles = files.filter((f) =>
    f.filename.toLowerCase().includes(search.toLowerCase())
  );

  const sortedActivity = [...files].sort((a, b) => {
    if (!a.upload_time || !b.upload_time) return 0;
    return new Date(b.upload_time) - new Date(a.upload_time);
  });

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
                  {generatedToken && (
                    <div className="dev-note">
                      <strong>Dev mode:</strong> Your reset code:
                      <div className="token-box mono">{generatedToken}</div>
                    </div>
                  )}
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
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
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

            <div className="card">
              <h3>Recent activity</h3>
              {sortedActivity.length === 0 ? (
                <div className="empty-state">No activity yet — upload a file to see it here.</div>
              ) : (
                sortedActivity.map((f) => (
                  <div className="activity-item" key={f.id}>
                    <div className="activity-dot">{getFileIcon(f.filename)}</div>
                    <div>
                      <div className="activity-text">
                        <span className="mono">{f.owner_email}</span> uploaded <span className="mono">{f.filename}</span>
                      </div>
                      <div className="activity-time">{formatTime(f.upload_time)}</div>
                    </div>
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
                  <div className="settings-value">Not enabled</div>
                </div>
                <span className="badge-soon">Coming soon</span>
              </div>
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