import React, { useState, useEffect } from 'react';
import {
  createSharedLink,
  searchUsers,
  createInternalShare,
  getFileShares,
  revokeInternalShare,
  updateInternalShare
} from '../services/shareService';

function ShareModal({ file, onClose }) {
  const [activeTab, setActiveTab] = useState('user'); // 'user' or 'link'

  // User-to-User State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermission, setUserPermission] = useState('view_only');
  const [userShareLoading, setUserShareLoading] = useState(false);
  const [userShareSuccess, setUserShareSuccess] = useState('');
  const [userShareError, setUserShareError] = useState('');
  const [existingShares, setExistingShares] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Public Link State
  const [linkPermission, setLinkPermission] = useState('view_only');
  const [expiry, setExpiry] = useState('never');
  const [sharedTo, setSharedTo] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  // Fetch users this file is already shared with
  const loadExistingShares = async () => {
    if (!file) return;
    setLoadingExisting(true);
    try {
      const data = await getFileShares(file.id);
      setExistingShares(data);
    } catch (err) {
      console.error("Failed to load existing shares", err);
    } finally {
      setLoadingExisting(false);
    }
  };

  useEffect(() => {
    if (file) {
      loadExistingShares();
      // Load initial user suggestions
      fetchUsers('');
    }
  }, [file]);

  // Search users by name or email
  const fetchUsers = async (query) => {
    setIsSearching(true);
    try {
      const results = await searchUsers(query);
      setSearchResults(results);
    } catch (err) {
      console.error("Error searching users:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search on input change
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setUserShareSuccess('');
    setUserShareError('');
    fetchUsers(val);
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchQuery('');
    setSearchResults([]);
    setUserShareError('');
  };

  const handleShareWithUser = async () => {
    if (!selectedUser) {
      setUserShareError("Please select a user to share with.");
      return;
    }

    setUserShareLoading(true);
    setUserShareError('');
    setUserShareSuccess('');

    try {
      await createInternalShare(file.id, selectedUser.id, userPermission);
      setUserShareSuccess(`Shared successfully with ${selectedUser.name}!`);
      setSelectedUser(null);
      await loadExistingShares();
    } catch (err) {
      const errMsg = err.response?.data?.detail || "Failed to share file with user";
      setUserShareError(errMsg);
    } finally {
      setUserShareLoading(false);
    }
  };

  const handleRevokeUserShare = async (accessId) => {
    if (!window.confirm("Revoke access for this user?")) return;
    try {
      await revokeInternalShare(accessId);
      await loadExistingShares();
    } catch (err) {
      alert("Failed to revoke access");
    }
  };

  const handleUpdateUserPermission = async (accessId, newPermission) => {
    try {
      await updateInternalShare(accessId, newPermission);
      setUserShareSuccess(`Permission updated to ${newPermission === 'can_download' ? 'Can Download' : 'View Only'}!`);
      await loadExistingShares();
    } catch (err) {
      alert("Failed to update user permission");
    }
  };

  // Public Link Generation
  const handleGenerateLink = async () => {
    setLinkLoading(true);
    try {
      const data = await createSharedLink(file.id, linkPermission, expiry, sharedTo);
      const publicUrl = `${window.location.origin}/s/${data.token}`;
      setGeneratedLink(publicUrl);
    } catch (err) {
      alert("Failed to create share link");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    alert("Link copied to clipboard!");
  };

  if (!file) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleGroup}>
            <span style={styles.headerIcon}>🔗</span>
            <h3 style={styles.title} title={file.original_filename || file.stored_filename}>
              Share "{file.original_filename || file.stored_filename}"
            </h3>
          </div>
          <button onClick={onClose} style={styles.closeIconBtn} title="Close">✕</button>
        </div>

        {/* Navigation Tabs */}
        <div style={styles.tabContainer}>
          <button
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'user' ? styles.activeTabBtn : {})
            }}
            onClick={() => setActiveTab('user')}
          >
            👤 Share with User
          </button>
          <button
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'link' ? styles.activeTabBtn : {})
            }}
            onClick={() => setActiveTab('link')}
          >
            🌐 Public Link
          </button>
        </div>

        {/* Tab 1: User to User Share */}
        {activeTab === 'user' && (
          <div style={styles.tabContent}>
            {userShareSuccess && (
              <div style={styles.successBanner}>
                {userShareSuccess}
              </div>
            )}
            {userShareError && (
              <div style={styles.errorBanner}>
                {userShareError}
              </div>
            )}

            {/* Selected User Card or Search Input */}
            {!selectedUser ? (
              <div style={styles.searchSection}>
                <label style={styles.label}>Search User (Name or Gmail / Email)</label>
                <div style={styles.searchBox}>
                  <span style={styles.searchIcon}>🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Type name or email (e.g. rahul, gmail.com)..."
                    style={styles.searchInput}
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} style={styles.clearSearchBtn}>✕</button>
                  )}
                </div>

                {/* Dropdown Results */}
                {searchResults.length > 0 && (
                  <div style={styles.userList}>
                    {searchResults.map((u) => (
                      <div
                        key={u.id}
                        style={styles.userItem}
                        onClick={() => handleSelectUser(u)}
                      >
                        <div style={styles.avatar}>
                          {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                        </div>
                        <div style={styles.userInfo}>
                          <div style={styles.userName}>{u.name}</div>
                          <div style={styles.userEmail}>{u.email}</div>
                        </div>
                        <button style={styles.selectUserBtn}>Select</button>
                      </div>
                    ))}
                  </div>
                )}

                {isSearching && <div style={styles.hintText}>Searching users...</div>}
                {!isSearching && searchResults.length === 0 && searchQuery && (
                  <div style={styles.hintText}>No user found matching "{searchQuery}"</div>
                )}
              </div>
            ) : (
              <div style={styles.selectedUserCard}>
                <div style={styles.avatar}>
                  {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : selectedUser.email.charAt(0).toUpperCase()}
                </div>
                <div style={styles.userInfo}>
                  <div style={styles.userName}>{selectedUser.name}</div>
                  <div style={styles.userEmail}>{selectedUser.email}</div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  style={styles.changeUserBtn}
                  title="Choose a different user"
                >
                  Change
                </button>
              </div>
            )}

            {/* Permission Selector */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Permission</label>
              <select
                style={styles.select}
                value={userPermission}
                onChange={(e) => setUserPermission(e.target.value)}
              >
                <option value="view_only">👁️ View Only (Read Only)</option>
                <option value="can_download">⬇️ Can Download & View</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              style={{
                ...styles.primaryBtn,
                opacity: !selectedUser || userShareLoading ? 0.6 : 1,
                cursor: !selectedUser || userShareLoading ? 'not-allowed' : 'pointer'
              }}
              onClick={handleShareWithUser}
              disabled={!selectedUser || userShareLoading}
            >
              {userShareLoading ? "Sharing..." : "Share File with User"}
            </button>

            {/* Already Shared With List */}
            <div style={styles.existingSection}>
              <h4 style={styles.existingTitle}>
                People with access ({existingShares.length})
              </h4>
              {loadingExisting && <div style={styles.hintText}>Loading access list...</div>}
              {!loadingExisting && existingShares.length === 0 && (
                <div style={styles.noSharesText}>Not shared with any users yet.</div>
              )}
              {!loadingExisting && existingShares.length > 0 && (
                <div style={styles.existingList}>
                  {existingShares.map((s) => (
                    <div key={s.id} style={styles.existingItem}>
                      <div style={styles.avatarSmall}>
                        {s.shared_with_name ? s.shared_with_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div style={styles.existingInfo}>
                        <div style={styles.existingName}>{s.shared_with_name || 'User'}</div>
                        <div style={styles.existingEmail}>{s.shared_with_email}</div>
                      </div>
                      <select
                        value={s.permission}
                        onChange={(e) => handleUpdateUserPermission(s.id, e.target.value)}
                        style={s.permission === 'can_download' ? styles.badgeSuccessSelect : styles.badgeWarnSelect}
                        title="Change permission for this user"
                      >
                        <option value="view_only">👁️ View Only</option>
                        <option value="can_download">⬇️ Download</option>
                      </select>
                      <button
                        onClick={() => handleRevokeUserShare(s.id)}
                        style={styles.revokeBtn}
                        title="Remove Access"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Public Link Generation */}
        {activeTab === 'link' && (
          <div style={styles.tabContent}>
            {!generatedLink ? (
              <div style={styles.form}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Shared To / Recipient (Optional)</label>
                  <input
                    type="text"
                    value={sharedTo}
                    onChange={(e) => setSharedTo(e.target.value)}
                    placeholder="e.g. John Doe, client@company.com, or Marketing Team"
                    style={styles.textInput}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Permissions</label>
                  <select
                    style={styles.select}
                    value={linkPermission}
                    onChange={(e) => setLinkPermission(e.target.value)}
                  >
                    <option value="view_only">👁️ View Only (No Download)</option>
                    <option value="can_download">⬇️ Can Download</option>
                  </select>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Link Expiry</label>
                  <select
                    style={styles.select}
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                  >
                    <option value="1">1 Hour</option>
                    <option value="24">24 Hours</option>
                    <option value="168">7 Days</option>
                    <option value="never">Never Expire</option>
                  </select>
                </div>

                <button
                  style={styles.primaryBtn}
                  onClick={handleGenerateLink}
                  disabled={linkLoading}
                >
                  {linkLoading ? "Generating Link..." : "Generate Public Link"}
                </button>
              </div>
            ) : (
              <div style={styles.resultContainer}>
                <p style={styles.successText}>✅ Link generated successfully!</p>
                <div style={styles.linkBox}>
                  <input
                    type="text"
                    readOnly
                    value={generatedLink}
                    style={styles.linkInput}
                  />
                  <button style={styles.copyBtn} onClick={handleCopyLink}>Copy</button>
                </div>
                <div style={styles.noticeBox}>
                  <p style={styles.noticeText}>
                    {sharedTo && (
                      <><strong>Shared To:</strong> {sharedTo}<br /></>
                    )}
                    <strong>Permission:</strong> {linkPermission === 'view_only' ? 'View Only' : 'Can Download'}<br />
                    <strong>Expires:</strong> {expiry === 'never' ? 'Never' : `In ${expiry} hours`}
                  </p>
                </div>
                <button
                  onClick={() => setGeneratedLink('')}
                  style={styles.secondaryBtn}
                >
                  Create Another Link
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1200
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    width: '460px',
    maxWidth: '92vw',
    maxHeight: '88vh',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid #f1f5f9'
  },
  headerTitleGroup: { display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' },
  headerIcon: { fontSize: '18px' },
  title: {
    margin: 0,
    fontSize: '16px',
    color: '#0f172a',
    fontWeight: '700',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  closeIconBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '18px',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '6px',
    transition: 'color 0.2s'
  },

  tabContainer: {
    display: 'flex',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc'
  },
  tabBtn: {
    flex: 1,
    padding: '12px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '14px',
    fontWeight: '600',
    color: '#64748b',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s'
  },
  activeTabBtn: {
    color: '#2563eb',
    borderBottom: '2px solid #2563eb',
    backgroundColor: '#ffffff'
  },

  tabContent: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto'
  },

  successBanner: {
    backgroundColor: '#ecfdf5',
    color: '#047857',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    border: '1px solid #a7f3d0'
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    border: '1px solid #fecaca'
  },

  searchSection: { display: 'flex', flexDirection: 'column', gap: '8px' },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '4px 12px',
    backgroundColor: '#ffffff',
    gap: '8px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
  },
  searchIcon: { fontSize: '14px', color: '#94a3b8' },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    color: '#1e293b',
    padding: '8px 0'
  },
  clearSearchBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '14px'
  },

  userList: {
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    maxHeight: '180px',
    overflowY: 'auto',
    backgroundColor: '#ffffff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
  },
  userItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    gap: '12px',
    borderBottom: '1px solid #f1f5f9',
    cursor: 'pointer',
    transition: 'background-color 0.15s'
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontWeight: '700',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '14px',
    flexShrink: 0
  },
  userInfo: { flex: 1, overflow: 'hidden' },
  userName: { fontSize: '13px', fontWeight: '600', color: '#1e293b' },
  userEmail: { fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  selectUserBtn: {
    padding: '6px 12px',
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },

  selectedUserCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '10px',
    gap: '12px'
  },
  changeUserBtn: {
    padding: '6px 12px',
    backgroundColor: '#ffffff',
    color: '#15803d',
    border: '1px solid #86efac',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },

  hintText: { fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' },

  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '600', color: '#475569' },
  select: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    outline: 'none',
    fontSize: '14px',
    color: '#1e293b',
    backgroundColor: '#ffffff'
  },

  primaryBtn: {
    padding: '12px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'background-color 0.2s',
    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
  },
  secondaryBtn: {
    padding: '10px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px'
  },

  existingSection: {
    marginTop: '10px',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '14px'
  },
  existingTitle: { margin: '0 0 10px 0', fontSize: '13px', fontWeight: '700', color: '#334155' },
  noSharesText: { fontSize: '12px', color: '#94a3b8' },
  existingList: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto' },
  existingItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #f1f5f9'
  },
  avatarSmall: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#6366f1',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  existingInfo: { flex: 1, overflow: 'hidden' },
  existingName: { fontSize: '12px', fontWeight: '600', color: '#1e293b' },
  existingEmail: { fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  badgeSuccess: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  badgeWarn: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  badgeSuccessSelect: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
    padding: '4px 6px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    border: '1px solid #86efac',
    outline: 'none',
    cursor: 'pointer'
  },
  badgeWarnSelect: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '4px 6px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    border: '1px solid #fde68a',
    outline: 'none',
    cursor: 'pointer'
  },
  textInput: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    outline: 'none',
    fontSize: '14px',
    color: '#1e293b',
    backgroundColor: '#ffffff'
  },
  revokeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: '4px 6px'
  },

  resultContainer: { display: 'flex', flexDirection: 'column', gap: '16px' },
  successText: { margin: 0, color: '#10b981', fontWeight: 'bold', fontSize: '14px', textAlign: 'center' },
  linkBox: { display: 'flex', gap: '8px' },
  linkInput: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f8fafc',
    fontSize: '13px',
    color: '#475569'
  },
  copyBtn: {
    padding: '10px 16px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px'
  },
  noticeBox: {
    backgroundColor: '#f1f5f9',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  },
  noticeText: { margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.5' }
};

export default ShareModal;
