import "./App.css";
import { useEffect, useState } from "react";
const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";


function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("trustshare_token") || ""
  );

  const [user, setUser] = useState(null);

  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [files, setFiles] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [sharedByMe, setSharedByMe] = useState([]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [shareDuration, setShareDuration] = useState("none");

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activePage, setActivePage] = useState("dashboard");

  const [monitoringDashboard, setMonitoringDashboard] = useState(null);
  const [activity, setActivity] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [storageAnalytics, setStorageAnalytics] = useState(null);
  const [suspiciousActivity, setSuspiciousActivity] = useState([]);
  const [fileReports, setFileReports] = useState(null);

  const [temporaryLinkFile, setTemporaryLinkFile] = useState(null);
  const [temporaryLinkDuration, setTemporaryLinkDuration] = useState("1h");
  const [temporaryLinkResult, setTemporaryLinkResult] = useState("");

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const apiRequest = async (endpoint, options = {}) => {
    const headers = {
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    const response = await fetch(API_URL + endpoint, {
      ...options,
      headers,
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.detail ||
        data?.message ||
        "Request failed with status " + response.status;

      throw new Error(message);
    }

    return data;
  };

  const getExpiryFromDuration = (duration) => {
    if (duration === "none") {
      return null;
    }

    const minutesMap = {
      "5m": 5,
      "15m": 15,
      "1h": 60,
      "6h": 360,
      "24h": 1440,
      "7d": 10080,
    };

    const minutes = minutesMap[duration];

    if (!minutes) {
      return null;
    }

    return new Date(Date.now() + minutes * 60 * 1000).toISOString();
  };

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "—";
    }

    try {
      return new Date(dateValue).toLocaleString();
    } catch {
      return dateValue;
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined) {
      return "—";
    }

    if (bytes === 0) {
      return "0 Bytes";
    }

    const units = ["Bytes", "KB", "MB", "GB", "TB"];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));

    return (
      (bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2) +
      " " +
      units[index]
    );
  };

  const isExpired = (item) => {
    if (!item?.expires_at) {
      return false;
    }

    return new Date(item.expires_at).getTime() <= Date.now();
  };

  const loadUser = async () => {
    try {
      const data = await apiRequest("/auth/me");
      setUser(data);
      return data;
    } catch (err) {
      localStorage.removeItem("trustshare_token");
      setToken("");
      setUser(null);
      throw err;
    }
  };

  const loadFiles = async () => {
    const data = await apiRequest("/files/");
    setFiles(Array.isArray(data) ? data : []);
  };

  const loadSharedFiles = async () => {
    const [received, sent] = await Promise.all([
      apiRequest("/files/shared-with-me"),
      apiRequest("/files/shared-by-me"),
    ]);

    setSharedWithMe(Array.isArray(received) ? received : []);
    setSharedByMe(Array.isArray(sent) ? sent : []);
  };

  const loadMonitoring = async () => {
    try {
      const dashboard = await apiRequest("/monitoring/dashboard");
      setMonitoringDashboard(dashboard);
    } catch {
      setMonitoringDashboard(null);
    }

    try {
      const data = await apiRequest("/monitoring/activity?limit=20");
      setActivity(Array.isArray(data) ? data : data?.activities || []);
    } catch {
      setActivity([]);
    }

    try {
      const data = await apiRequest("/monitoring/alerts");
      setAlerts(Array.isArray(data) ? data : data?.alerts || []);
    } catch {
      setAlerts([]);
    }

    try {
      const data = await apiRequest("/monitoring/notifications");
      setNotifications(
        Array.isArray(data) ? data : data?.notifications || []
      );
    } catch {
      setNotifications([]);
    }

    try {
      const data = await apiRequest("/monitoring/analytics/storage");
      setStorageAnalytics(data);
    } catch {
      setStorageAnalytics(null);
    }

    try {
      const data = await apiRequest("/monitoring/suspicious");
      setSuspiciousActivity(
        Array.isArray(data) ? data : data?.activities || []
      );
    } catch {
      setSuspiciousActivity([]);
    }

    try {
      const data = await apiRequest("/monitoring/reports/files");
      setFileReports(data);
    } catch {
      setFileReports(null);
    }
  };

  const loadAllData = async () => {
    setLoading(true);

    try {
      await Promise.all([loadFiles(), loadSharedFiles(), loadMonitoring()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    const initialize = async () => {
      try {
        await loadUser();
        await loadAllData();
      } catch (err) {
        setError(err.message);
      }
    };

    initialize();
  }, [token]);

  const handleLogin = async (event) => {
    event.preventDefault();
    clearMessages();
    setAuthLoading(true);

    try {
      const data = await fetch(API_URL + "/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginForm),
      });

      let result = null;

      try {
        result = await data.json();
      } catch {
        result = null;
      }

      if (!data.ok) {
        throw new Error(
          result?.detail ||
            result?.message ||
            "Login failed with status " + data.status
        );
      }

      const accessToken = result?.access_token;

      if (!accessToken) {
        throw new Error("Login succeeded but no access token was returned.");
      }

      localStorage.setItem("trustshare_token", accessToken);
      setToken(accessToken);

      setLoginForm({
        email: "",
        password: "",
      });

      setSuccess("Login successful.");
    } catch (err) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    clearMessages();
    setAuthLoading(true);

    try {
      await fetch(API_URL + "/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registerForm),
      }).then(async (response) => {
        let data = null;

        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              data?.message ||
              "Registration failed with status " + response.status
          );
        }

        return data;
      });

      setSuccess("Registration successful. You can now log in.");

      setRegisterForm({
        name: "",
        email: "",
        password: "",
      });

      setAuthMode("login");
    } catch (err) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("trustshare_token");
    setToken("");
    setUser(null);
    setFiles([]);
    setSharedWithMe([]);
    setSharedByMe([]);
    setSelectedFile(null);
    setTemporaryLinkFile(null);
    setTemporaryLinkResult("");
    setActivePage("dashboard");
    clearMessages();
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    clearMessages();
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      await apiRequest("/files/upload", {
        method: "POST",
        body: formData,
      });

      setSuccess(file.name + " uploaded successfully.");

      event.target.value = "";

      await loadFiles();
      await loadMonitoring();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileId, filename) => {
    clearMessages();

    try {
      const response = await fetch(
        API_URL + "/files/" + fileId + "/download",
        {
          headers: {
            Authorization: "Bearer " + token,
          },
        }
      );

      if (!response.ok) {
        let message = "Download failed.";

        try {
          const data = await response.json();
          message = data?.detail || message;
        } catch {
          // Ignore invalid JSON response.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename || "download";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(url);

      setSuccess("Download started.");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (file) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete "' + file.filename + '"?'
    );

    if (!confirmed) {
      return;
    }

    clearMessages();

    try {
      await apiRequest("/files/" + file.id, {
        method: "DELETE",
      });

      setSuccess(file.filename + " deleted successfully.");

      if (selectedFile?.id === file.id) {
        setSelectedFile(null);
      }

      if (temporaryLinkFile?.id === file.id) {
        setTemporaryLinkFile(null);
        setTemporaryLinkResult("");
      }

      await loadFiles();
      await loadSharedFiles();
      await loadMonitoring();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleShare = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setError("Please select a file first.");
      return;
    }

    if (!recipientEmail.trim()) {
      setError("Please enter the recipient email.");
      return;
    }

    clearMessages();

    try {
      const expiresAt = getExpiryFromDuration(shareDuration);

      await apiRequest("/files/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_id: selectedFile.id,
          shared_with_email: recipientEmail.trim(),
          permission: "view",
          expires_at: expiresAt,
        }),
      });

      if (expiresAt) {
        setSuccess(
          "File shared successfully. Access expires on " +
            formatDate(expiresAt) +
            "."
        );
      } else {
        setSuccess("File shared successfully with permanent access.");
      }

      setRecipientEmail("");
      setShareDuration("none");
      setSelectedFile(null);

      await loadSharedFiles();
      await loadMonitoring();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateTemporaryLink = async () => {
    if (!temporaryLinkFile) {
      setError("Please select a file for temporary access.");
      return;
    }

    clearMessages();
    setTemporaryLinkResult("");

    try {
      const expiresAt = getExpiryFromDuration(temporaryLinkDuration);

      if (!expiresAt) {
        setError("Please select a temporary link duration.");
        return;
      }

      const data = await apiRequest("/files/temporary-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_id: temporaryLinkFile.id,
          expires_at: expiresAt,
        }),
      });

      let downloadPath = data?.download_path;

      if (!downloadPath && data?.token) {
        downloadPath = "/files/temporary/" + data.token;
      }

      if (!downloadPath) {
        throw new Error("Temporary link was created but no link was returned.");
      }

      const fullLink = API_URL + downloadPath;

      setTemporaryLinkResult(fullLink);

      setSuccess(
        "Temporary access link created. It expires on " +
          formatDate(expiresAt) +
          "."
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const copyTemporaryLink = async () => {
    if (!temporaryLinkResult) {
      return;
    }

    try {
      await navigator.clipboard.writeText(temporaryLinkResult);
      setSuccess("Temporary link copied to clipboard.");
    } catch {
      setError("Could not copy the link automatically.");
    }
  };

  const handleRefresh = async () => {
    clearMessages();

    try {
      await loadAllData();
      setSuccess("Data refreshed.");
    } catch (err) {
      setError(err.message);
    }
  };

  const renderExpiration = (item) => {
    if (!item?.expires_at) {
      return (
        <span style={styles.permanentBadge}>
          Permanent
        </span>
      );
    }

    const expired = isExpired(item);

    return (
      <span
        style={expired ? styles.expiredBadge : styles.expiringBadge}
      >
        {expired
          ? "Expired"
          : "Expires " + formatDate(item.expires_at)}
      </span>
    );
  };

  const totalStorage = files.reduce(
    (total, file) => total + (file.size_bytes || 0),
    0
  );

  if (!token) {
    return (
      <div style={styles.authPage}>
        <div style={styles.authCard}>
          <div style={styles.logoCircle}>T</div>

          <h1 style={styles.authTitle}>TrustShare</h1>

          <p style={styles.authSubtitle}>
            Secure Collaboration & Encrypted File Sharing
          </p>

          {error && <div style={styles.errorBox}>{error}</div>}
          {success && <div style={styles.successBox}>{success}</div>}

          {authMode === "login" ? (
            <form onSubmit={handleLogin}>
              <div style={styles.formGroup}>
                <label>Email</label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm({
                      ...loginForm,
                      email: event.target.value,
                    })
                  }
                  placeholder="Enter your email"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm({
                      ...loginForm,
                      password: event.target.value,
                    })
                  }
                  placeholder="Enter your password"
                  required
                  style={styles.input}
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                style={styles.primaryButton}
              >
                {authLoading ? "Logging in..." : "Login"}
              </button>

              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setAuthMode("register");
                }}
                style={styles.secondaryButton}
              >
                Create New Account
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div style={styles.formGroup}>
                <label>Name</label>
                <input
                  type="text"
                  value={registerForm.name}
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      name: event.target.value,
                    })
                  }
                  placeholder="Enter your name"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Email</label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      email: event.target.value,
                    })
                  }
                  placeholder="Enter your email"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Password</label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      password: event.target.value,
                    })
                  }
                  placeholder="Create a password"
                  required
                  minLength={6}
                  style={styles.input}
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                style={styles.primaryButton}
              >
                {authLoading ? "Creating..." : "Create Account"}
              </button>

              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setAuthMode("login");
                }}
                style={styles.secondaryButton}
              >
                Back to Login
              </button>
            </form>
          )}

          <div style={styles.securityText}>
            🔒 AES-256-GCM encrypted file storage
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.smallLogo}>T</div>

          <div>
            <h2 style={styles.headerTitle}>TrustShare</h2>
            <div style={styles.headerSubtitle}>
              Secure Collaboration Platform
            </div>
          </div>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.userInfo}>
            <strong>{user?.name || "User"}</strong>
            <span>{user?.email || ""}</span>
          </div>

          <button
            onClick={handleLogout}
            style={styles.logoutButton}
          >
            Logout
          </button>
        </div>
      </header>

      <div style={styles.layout}>
        <aside style={styles.sidebar}>
          <button
            onClick={() => setActivePage("dashboard")}
            style={
              activePage === "dashboard"
                ? styles.activeNavButton
                : styles.navButton
            }
          >
            📊 Dashboard
          </button>

          <button
            onClick={() => setActivePage("files")}
            style={
              activePage === "files"
                ? styles.activeNavButton
                : styles.navButton
            }
          >
            📁 My Files
          </button>

          <button
            onClick={() => setActivePage("shared")}
            style={
              activePage === "shared"
                ? styles.activeNavButton
                : styles.navButton
            }
          >
            🤝 Shared Files
          </button>

          <button
            onClick={() => setActivePage("temporary")}
            style={
              activePage === "temporary"
                ? styles.activeNavButton
                : styles.navButton
            }
          >
            ⏳ Temporary Access
          </button>

          <button
            onClick={() => setActivePage("monitoring")}
            style={
              activePage === "monitoring"
                ? styles.activeNavButton
                : styles.navButton
            }
          >
            📈 Monitoring
          </button>

          <div style={styles.sidebarBottom}>
            <button
              onClick={handleRefresh}
              style={styles.refreshButton}
              disabled={loading}
            >
              🔄 {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </aside>

        <main style={styles.main}>
          {error && (
            <div style={styles.errorBox}>
              <strong>Error:</strong> {error}
              <button
                onClick={() => setError("")}
                style={styles.messageClose}
              >
                ×
              </button>
            </div>
          )}

          {success && (
            <div style={styles.successBox}>
              <strong>Success:</strong> {success}
              <button
                onClick={() => setSuccess("")}
                style={styles.messageClose}
              >
                ×
              </button>
            </div>
          )}

          {activePage === "dashboard" && (
            <>
              <div style={styles.pageHeading}>
                <div>
                  <h1>Dashboard</h1>
                  <p>Welcome back, {user?.name || "User"}.</p>
                </div>
              </div>

              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statIcon}>📁</div>
                  <div>
                    <div style={styles.statNumber}>{files.length}</div>
                    <div style={styles.statLabel}>My Files</div>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statIcon}>🤝</div>
                  <div>
                    <div style={styles.statNumber}>
                      {sharedWithMe.length}
                    </div>
                    <div style={styles.statLabel}>Shared With Me</div>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statIcon}>📤</div>
                  <div>
                    <div style={styles.statNumber}>
                      {sharedByMe.length}
                    </div>
                    <div style={styles.statLabel}>Shared By Me</div>
                  </div>
                </div>

                <div style={styles.statCard}>
                  <div style={styles.statIcon}>💾</div>
                  <div>
                    <div style={styles.statNumber}>
                      {formatBytes(totalStorage)}
                    </div>
                    <div style={styles.statLabel}>Storage Used</div>
                  </div>
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2>Quick Upload</h2>
                    <p>Upload an encrypted file to TrustShare.</p>
                  </div>
                </div>

                <label style={styles.uploadBox}>
                  <span style={styles.uploadIcon}>📤</span>

                  <strong>
                    {uploading
                      ? "Uploading..."
                      : "Click to choose a file"}
                  </strong>

                  <span>
                    Your file will be encrypted before storage.
                  </span>

                  <input
                    type="file"
                    onChange={handleUpload}
                    disabled={uploading}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2>Recent Files</h2>
                    <p>Your latest uploaded files.</p>
                  </div>

                  <button
                    onClick={() => setActivePage("files")}
                    style={styles.smallButton}
                  >
                    View All
                  </button>
                </div>

                {files.length === 0 ? (
                  <div style={styles.emptyState}>
                    No files uploaded yet.
                  </div>
                ) : (
                  <div style={styles.fileList}>
                    {files.slice(0, 5).map((file) => (
                      <div key={file.id} style={styles.fileRow}>
                        <div style={styles.fileMain}>
                          <div style={styles.fileIcon}>📄</div>

                          <div>
                            <strong>{file.filename}</strong>

                            <div style={styles.fileMeta}>
                              {formatBytes(file.size_bytes)} •{" "}
                              {formatDate(file.uploaded_at)}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            handleDownload(file.id, file.filename)
                          }
                          style={styles.smallButton}
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activePage === "files" && (
            <>
              <div style={styles.pageHeading}>
                <div>
                  <h1>My Files</h1>
                  <p>Manage your encrypted files.</p>
                </div>
              </div>

              <div style={styles.card}>
                <label style={styles.uploadBox}>
                  <span style={styles.uploadIcon}>📤</span>

                  <strong>
                    {uploading
                      ? "Uploading..."
                      : "Click to upload a new file"}
                  </strong>

                  <span>
                    Files are encrypted using AES-256-GCM.
                  </span>

                  <input
                    type="file"
                    onChange={handleUpload}
                    disabled={uploading}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2>Uploaded Files</h2>
                    <p>{files.length} file(s)</p>
                  </div>
                </div>

                {files.length === 0 ? (
                  <div style={styles.emptyState}>
                    You have not uploaded any files.
                  </div>
                ) : (
                  <div style={styles.fileList}>
                    {files.map((file) => (
                      <div key={file.id} style={styles.fileRow}>
                        <div style={styles.fileMain}>
                          <div style={styles.fileIcon}>📄</div>

                          <div>
                            <strong>{file.filename}</strong>

                            <div style={styles.fileMeta}>
                              {formatBytes(file.size_bytes)}
                              {" • "}
                              Uploaded {formatDate(file.uploaded_at)}
                            </div>

                            <div style={styles.fileId}>
                              ID: {file.id}
                            </div>
                          </div>
                        </div>

                        <div style={styles.actions}>
                          <button
                            onClick={() =>
                              handleDownload(file.id, file.filename)
                            }
                            style={styles.smallButton}
                          >
                            Download
                          </button>

                          <button
                            onClick={() => {
                              setSelectedFile(file);
                              setActivePage("share");
                            }}
                            style={styles.shareButton}
                          >
                            Share
                          </button>

                          <button
                            onClick={() => {
                              setTemporaryLinkFile(file);
                              setTemporaryLinkResult("");
                              setActivePage("temporary");
                            }}
                            style={styles.tempButton}
                          >
                            Temp Link
                          </button>

                          <button
                            onClick={() => handleDelete(file)}
                            style={styles.deleteButton}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2>Share a File</h2>
                    <p>
                      Share a file with another TrustShare user.
                    </p>
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label>Select File</label>

                  <select
                    value={selectedFile?.id || ""}
                    onChange={(event) => {
                      const file = files.find(
                        (item) => item.id === event.target.value
                      );
                      setSelectedFile(file || null);
                    }}
                    style={styles.input}
                  >
                    <option value="">Select a file</option>

                    {files.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.filename}
                      </option>
                    ))}
                  </select>
                </div>

                <form onSubmit={handleShare}>
                  <div style={styles.formGroup}>
                    <label>Recipient Email</label>

                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(event) =>
                        setRecipientEmail(event.target.value)
                      }
                      placeholder="recipient@example.com"
                      style={styles.input}
                      required
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label>Access Duration</label>

                    <select
                      value={shareDuration}
                      onChange={(event) =>
                        setShareDuration(event.target.value)
                      }
                      style={styles.input}
                    >
                      <option value="none">
                        Permanent Access
                      </option>

                      <option value="5m">5 Minutes</option>
                      <option value="15m">15 Minutes</option>
                      <option value="1h">1 Hour</option>
                      <option value="6h">6 Hours</option>
                      <option value="24h">24 Hours</option>
                      <option value="7d">7 Days</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    style={styles.primaryButton}
                    disabled={!selectedFile}
                  >
                    Share File
                  </button>
                </form>
              </div>
            </>
          )}

          {activePage === "share" && (
            <div style={styles.card}>
              <div style={styles.pageHeading}>
                <div>
                  <h1>Share File</h1>
                  <p>Give another user controlled access.</p>
                </div>
              </div>

              {selectedFile ? (
                <>
                  <div style={styles.selectedFile}>
                    <div style={styles.fileIcon}>📄</div>

                    <div>
                      <strong>{selectedFile.filename}</strong>
                      <div style={styles.fileMeta}>
                        {formatBytes(selectedFile.size_bytes)}
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleShare}>
                    <div style={styles.formGroup}>
                      <label>Recipient Email</label>

                      <input
                        type="email"
                        value={recipientEmail}
                        onChange={(event) =>
                          setRecipientEmail(event.target.value)
                        }
                        placeholder="recipient@example.com"
                        style={styles.input}
                        required
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label>Access Duration</label>

                      <select
                        value={shareDuration}
                        onChange={(event) =>
                          setShareDuration(event.target.value)
                        }
                        style={styles.input}
                      >
                        <option value="none">
                          Permanent Access
                        </option>
                        <option value="5m">5 Minutes</option>
                        <option value="15m">15 Minutes</option>
                        <option value="1h">1 Hour</option>
                        <option value="6h">6 Hours</option>
                        <option value="24h">24 Hours</option>
                        <option value="7d">7 Days</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      style={styles.primaryButton}
                    >
                      Share File
                    </button>
                  </form>
                </>
              ) : (
                <div style={styles.emptyState}>
                  Select a file from My Files first.
                </div>
              )}
            </div>
          )}

          {activePage === "shared" && (
            <>
              <div style={styles.pageHeading}>
                <div>
                  <h1>Shared Files</h1>
                  <p>Manage files shared with you and by you.</p>
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2>Shared With Me</h2>
                    <p>
                      Files other users have shared with your account.
                    </p>
                  </div>
                </div>

                {sharedWithMe.length === 0 ? (
                  <div style={styles.emptyState}>
                    No files have been shared with you.
                  </div>
                ) : (
                  <div style={styles.fileList}>
                    {sharedWithMe.map((item) => {
                      const expired =
                        item.expired || isExpired(item);

                      return (
                        <div key={item.id} style={styles.fileRow}>
                          <div style={styles.fileMain}>
                            <div style={styles.fileIcon}>🤝</div>

                            <div>
                              <strong>{item.filename}</strong>

                              <div style={styles.fileMeta}>
                                Permission:{" "}
                                {item.permission || "view"}
                                {" • "}
                                Shared {formatDate(item.created_at)}
                              </div>

                              <div style={{ marginTop: "8px" }}>
                                {renderExpiration(item)}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              handleDownload(
                                item.file_id,
                                item.filename
                              )
                            }
                            disabled={expired}
                            style={
                              expired
                                ? styles.disabledButton
                                : styles.smallButton
                            }
                          >
                            {expired ? "Expired" : "Download"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2>Shared By Me</h2>
                    <p>
                      Files you have shared with other users.
                    </p>
                  </div>
                </div>

                {sharedByMe.length === 0 ? (
                  <div style={styles.emptyState}>
                    You have not shared any files.
                  </div>
                ) : (
                  <div style={styles.fileList}>
                    {sharedByMe.map((item) => (
                      <div key={item.id} style={styles.fileRow}>
                        <div style={styles.fileMain}>
                          <div style={styles.fileIcon}>📤</div>

                          <div>
                            <strong>{item.filename}</strong>

                            <div style={styles.fileMeta}>
                              To: {item.shared_with_email}
                            </div>

                            <div style={styles.fileMeta}>
                              Permission:{" "}
                              {item.permission || "view"}
                              {" • "}
                              Shared {formatDate(item.created_at)}
                            </div>

                            <div style={{ marginTop: "8px" }}>
                              {renderExpiration(item)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activePage === "temporary" && (
            <>
              <div style={styles.pageHeading}>
                <div>
                  <h1>Temporary Access</h1>
                  <p>
                    Create a secure link that automatically expires.
                  </p>
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2>Create Temporary Link</h2>
                    <p>
                      Anyone with the generated link can download
                      the file until it expires.
                    </p>
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label>Select File</label>

                  <select
                    value={temporaryLinkFile?.id || ""}
                    onChange={(event) => {
                      const file = files.find(
                        (item) => item.id === event.target.value
                      );

                      setTemporaryLinkFile(file || null);
                      setTemporaryLinkResult("");
                    }}
                    style={styles.input}
                  >
                    <option value="">Select a file</option>

                    {files.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.filename}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label>Link Duration</label>

                  <select
                    value={temporaryLinkDuration}
                    onChange={(event) =>
                      setTemporaryLinkDuration(event.target.value)
                    }
                    style={styles.input}
                  >
                    <option value="5m">5 Minutes</option>
                    <option value="15m">15 Minutes</option>
                    <option value="1h">1 Hour</option>
                    <option value="6h">6 Hours</option>
                    <option value="24h">24 Hours</option>
                    <option value="7d">7 Days</option>
                  </select>
                </div>

                <button
                  onClick={handleCreateTemporaryLink}
                  disabled={!temporaryLinkFile}
                  style={
                    temporaryLinkFile
                      ? styles.primaryButton
                      : styles.disabledButton
                  }
                >
                  🔗 Create Temporary Link
                </button>

                {temporaryLinkResult && (
                  <div style={styles.linkResult}>
                    <label>Temporary Download Link</label>

                    <div style={styles.linkRow}>
                      <input
                        type="text"
                        value={temporaryLinkResult}
                        readOnly
                        style={styles.input}
                      />

                      <button
                        onClick={copyTemporaryLink}
                        style={styles.smallButton}
                      >
                        Copy
                      </button>
                    </div>

                    <p style={styles.warningText}>
                      ⚠️ Anyone who has this link can download the
                      file until the expiration time.
                    </p>
                  </div>
                )}
              </div>

              <div style={styles.card}>
                <h2>How Temporary Access Works</h2>

                <div style={styles.steps}>
                  <div style={styles.step}>
                    <div style={styles.stepNumber}>1</div>
                    <div>
                      <strong>Select a file</strong>
                      <p>
                        Choose one of your encrypted files.
                      </p>
                    </div>
                  </div>

                  <div style={styles.step}>
                    <div style={styles.stepNumber}>2</div>
                    <div>
                      <strong>Choose expiration</strong>
                      <p>
                        Set how long the temporary link should
                        remain valid.
                      </p>
                    </div>
                  </div>

                  <div style={styles.step}>
                    <div style={styles.stepNumber}>3</div>
                    <div>
                      <strong>Share the link</strong>
                      <p>
                        Send the generated link to the intended
                        recipient.
                      </p>
                    </div>
                  </div>

                  <div style={styles.step}>
                    <div style={styles.stepNumber}>4</div>
                    <div>
                      <strong>Automatic expiration</strong>
                      <p>
                        The backend rejects the link after its
                        expiration time.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activePage === "monitoring" && (
            <>
              <div style={styles.pageHeading}>
                <div>
                  <h1>Monitoring</h1>
                  <p>
                    Security activity and system information.
                  </p>
                </div>
              </div>

              {monitoringDashboard && (
                <div style={styles.statsGrid}>
                  {Object.entries(monitoringDashboard)
                    .slice(0, 4)
                    .map(([key, value]) => (
                      <div style={styles.statCard} key={key}>
                        <div style={styles.statIcon}>📊</div>

                        <div>
                          <div style={styles.statNumber}>
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value)}
                          </div>

                          <div style={styles.statLabel}>
                            {key
                              .replaceAll("_", " ")
                              .replace(/\b\w/g, (letter) =>
                                letter.toUpperCase()
                              )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              <div style={styles.monitorGrid}>
                <div style={styles.card}>
                  <h2>Recent Activity</h2>

                  {activity.length === 0 ? (
                    <div style={styles.emptyState}>
                      No recent activity.
                    </div>
                  ) : (
                    <div style={styles.monitorList}>
                      {activity.map((item, index) => (
                        <div
                          key={item.id || index}
                          style={styles.monitorItem}
                        >
                          <div>
                            <strong>
                              {item.action ||
                                item.event ||
                                item.activity ||
                                "Activity"}
                            </strong>

                            <div style={styles.fileMeta}>
                              {item.description ||
                                item.message ||
                                ""}
                            </div>
                          </div>

                          <span style={styles.monitorDate}>
                            {formatDate(
                              item.created_at ||
                                item.timestamp ||
                                item.occurred_at
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={styles.card}>
                  <h2>Alerts</h2>

                  {alerts.length === 0 ? (
                    <div style={styles.emptyState}>
                      No alerts.
                    </div>
                  ) : (
                    <div style={styles.monitorList}>
                      {alerts.map((item, index) => (
                        <div
                          key={item.id || index}
                          style={styles.alertItem}
                        >
                          <strong>
                            {item.title ||
                              item.alert_type ||
                              "Security Alert"}
                          </strong>

                          <p>
                            {item.message ||
                              item.description ||
                              JSON.stringify(item)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={styles.card}>
                  <h2>Notifications</h2>

                  {notifications.length === 0 ? (
                    <div style={styles.emptyState}>
                      No notifications.
                    </div>
                  ) : (
                    <div style={styles.monitorList}>
                      {notifications.map((item, index) => (
                        <div
                          key={item.id || index}
                          style={styles.monitorItem}
                        >
                          <div>
                            <strong>
                              {item.title ||
                                item.type ||
                                "Notification"}
                            </strong>

                            <div style={styles.fileMeta}>
                              {item.message ||
                                item.description ||
                                ""}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={styles.card}>
                  <h2>Suspicious Activity</h2>

                  {suspiciousActivity.length === 0 ? (
                    <div style={styles.emptyState}>
                      No suspicious activity detected.
                    </div>
                  ) : (
                    <div style={styles.monitorList}>
                      {suspiciousActivity.map((item, index) => (
                        <div
                          key={item.id || index}
                          style={styles.alertItem}
                        >
                          <strong>
                            {item.action ||
                              item.event ||
                              "Suspicious Activity"}
                          </strong>

                          <p>
                            {item.description ||
                              item.message ||
                              JSON.stringify(item)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.card}>
                <h2>Storage Analytics</h2>

                {storageAnalytics ? (
                  <pre style={styles.jsonBox}>
                    {JSON.stringify(storageAnalytics, null, 2)}
                  </pre>
                ) : (
                  <div style={styles.emptyState}>
                    Storage analytics are not available.
                  </div>
                )}
              </div>

              <div style={styles.card}>
                <h2>File Report</h2>

                {fileReports ? (
                  <pre style={styles.jsonBox}>
                    {JSON.stringify(fileReports, null, 2)}
                  </pre>
                ) : (
                  <div style={styles.emptyState}>
                    File report is not available.
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  authPage: {
    minHeight: "100vh",
    background: "#0f172a",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
    fontFamily: "Arial, sans-serif",
  },

  authCard: {
    width: "100%",
    maxWidth: "430px",
    background: "#ffffff",
    borderRadius: "20px",
    padding: "40px",
    boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
  },

  logoCircle: {
    width: "64px",
    height: "64px",
    borderRadius: "18px",
    background: "#2563eb",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "32px",
    fontWeight: "bold",
    margin: "0 auto 20px",
  },

  authTitle: {
    textAlign: "center",
    margin: "0",
    fontSize: "32px",
    color: "#111827",
  },

  authSubtitle: {
    textAlign: "center",
    color: "#64748b",
    marginBottom: "30px",
    lineHeight: 1.5,
  },

  securityText: {
    textAlign: "center",
    marginTop: "24px",
    fontSize: "13px",
    color: "#64748b",
  },

  app: {
    minHeight: "100vh",
    background: "#f1f5f9",
    fontFamily: "Arial, sans-serif",
    color: "#0f172a",
  },

  header: {
    height: "72px",
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 28px",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  smallLogo: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    background: "#2563eb",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
    fontWeight: "bold",
  },

  headerTitle: {
    margin: 0,
    fontSize: "19px",
  },

  headerSubtitle: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "2px",
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
  },

  userInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    fontSize: "13px",
  },

  logoutButton: {
    border: "none",
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "10px 16px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: "600",
  },

  layout: {
    display: "flex",
    minHeight: "calc(100vh - 72px)",
  },

  sidebar: {
    width: "230px",
    background: "#0f172a",
    padding: "24px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  navButton: {
    border: "none",
    background: "transparent",
    color: "#cbd5e1",
    padding: "13px 15px",
    borderRadius: "9px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "14px",
  },

  activeNavButton: {
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    padding: "13px 15px",
    borderRadius: "9px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
  },

  sidebarBottom: {
    marginTop: "auto",
  },

  refreshButton: {
    width: "100%",
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#e2e8f0",
    padding: "12px",
    borderRadius: "9px",
    cursor: "pointer",
  },

  main: {
    flex: 1,
    padding: "30px",
    maxWidth: "1500px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },

  pageHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },

  card: {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "24px",
    marginBottom: "22px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "16px",
    marginBottom: "22px",
  },

  statCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  statIcon: {
    fontSize: "28px",
  },

  statNumber: {
    fontSize: "24px",
    fontWeight: "700",
  },

  statLabel: {
    color: "#64748b",
    fontSize: "13px",
    marginTop: "3px",
  },

  uploadBox: {
    minHeight: "150px",
    border: "2px dashed #93c5fd",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    cursor: "pointer",
    background: "#eff6ff",
    color: "#334155",
  },

  uploadIcon: {
    fontSize: "32px",
  },

  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  fileRow: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "15px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
  },

  fileMain: {
    display: "flex",
    alignItems: "center",
    gap: "13px",
    minWidth: 0,
  },

  fileIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "10px",
    background: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "21px",
    flexShrink: 0,
  },

  fileMeta: {
    color: "#64748b",
    fontSize: "12px",
    marginTop: "5px",
  },

  fileId: {
    color: "#94a3b8",
    fontSize: "10px",
    marginTop: "5px",
    wordBreak: "break-all",
  },

  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px",
    justifyContent: "flex-end",
  },

  primaryButton: {
    width: "100%",
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    padding: "12px 18px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: "600",
    marginTop: "8px",
  },

  secondaryButton: {
    width: "100%",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    padding: "12px 18px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: "600",
    marginTop: "10px",
  },

  smallButton: {
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    padding: "9px 13px",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },

  shareButton: {
    border: "none",
    background: "#7c3aed",
    color: "#ffffff",
    padding: "9px 13px",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },

  tempButton: {
    border: "none",
    background: "#0891b2",
    color: "#ffffff",
    padding: "9px 13px",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },

  deleteButton: {
    border: "none",
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "9px 13px",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },

  disabledButton: {
    border: "none",
    background: "#cbd5e1",
    color: "#64748b",
    padding: "9px 13px",
    borderRadius: "7px",
    cursor: "not-allowed",
    fontSize: "12px",
    fontWeight: "600",
  },

  formGroup: {
    marginBottom: "17px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "12px",
    marginTop: "7px",
    fontSize: "14px",
    outline: "none",
    background: "#ffffff",
  },

  errorBox: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "13px 16px",
    borderRadius: "9px",
    marginBottom: "18px",
  },

  successBox: {
    background: "#f0fdf4",
    color: "#166534",
    border: "1px solid #bbf7d0",
    padding: "13px 16px",
    borderRadius: "9px",
    marginBottom: "18px",
  },

  messageClose: {
    float: "right",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "18px",
    color: "inherit",
  },

  emptyState: {
    padding: "35px 15px",
    textAlign: "center",
    color: "#64748b",
    border: "1px dashed #cbd5e1",
    borderRadius: "10px",
  },

  selectedFile: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "15px",
    borderRadius: "10px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    marginBottom: "22px",
  },

  permanentBadge: {
    display: "inline-block",
    background: "#dcfce7",
    color: "#166534",
    padding: "5px 9px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "600",
  },

  expiredBadge: {
    display: "inline-block",
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "5px 9px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "600",
  },

  expiringBadge: {
    display: "inline-block",
    background: "#fef3c7",
    color: "#92400e",
    padding: "5px 9px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "600",
  },

  linkResult: {
    marginTop: "25px",
    padding: "18px",
    background: "#f0fdfa",
    border: "1px solid #99f6e4",
    borderRadius: "10px",
  },

  linkRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },

  warningText: {
    color: "#92400e",
    fontSize: "12px",
    marginBottom: 0,
  },

  steps: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    marginTop: "20px",
  },

  step: {
    display: "flex",
    gap: "14px",
    alignItems: "flex-start",
  },

  stepNumber: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    background: "#2563eb",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    flexShrink: 0,
  },

  monitorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "20px",
  },

  monitorList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "15px",
  },

  monitorItem: {
    padding: "12px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
  },

  monitorDate: {
    color: "#64748b",
    fontSize: "11px",
    whiteSpace: "nowrap",
  },

  alertItem: {
    padding: "13px",
    borderRadius: "8px",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
  },

  jsonBox: {
    background: "#0f172a",
    color: "#e2e8f0",
    padding: "16px",
    borderRadius: "8px",
    overflowX: "auto",
    fontSize: "12px",
  },
};

export default App;