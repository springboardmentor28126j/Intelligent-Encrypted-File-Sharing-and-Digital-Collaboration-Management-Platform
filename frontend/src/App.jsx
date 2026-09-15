import "./App.css";
import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("trustshare_token")
  );

  const [user, setUser] = useState(null);

  const [authMode, setAuthMode] = useState("login");

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [files, setFiles] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [sharedByMe, setSharedByMe] = useState([]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [shareUserId, setShareUserId] = useState("");
  const [expiry, setExpiry] = useState("");

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    if (token) {
      loadUser();
    }
  }, [token]);

  useEffect(() => {
    if (token && user) {
      loadDashboard();
    }
  }, [token, user]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const showSuccess = (message) => {
    setError("");
    setSuccess(message);

    setTimeout(() => {
      setSuccess("");
    }, 4000);
  };

  const showError = (message) => {
    setSuccess("");
    setError(message);
  };

  const apiRequest = async (endpoint, options = {}) => {
    const headers = {
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
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
        `Request failed with status ${response.status}`;

      throw new Error(message);
    }

    return data;
  };

  const loadUser = async () => {
    try {
      const data = await apiRequest("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("trustshare_token");
      setToken(null);
      setUser(null);
    }
  };

  const loadDashboard = async () => {
    try {
      const [filesData, receivedData, sentData] = await Promise.all([
        apiRequest("/files/"),
        apiRequest("/files/shared-with-me"),
        apiRequest("/files/shared-by-me"),
      ]);

      setFiles(filesData?.files || []);
      setSharedWithMe(receivedData || []);
      setSharedByMe(sentData || []);
    } catch (err) {
      showError(err.message);
    }
  };

  const handleAuthChange = (event) => {
    const { name, value } = event.target;

    setAuthForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    clearMessages();

    if (!authForm.email || !authForm.password) {
      showError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Invalid email or password."
        );
      }

      localStorage.setItem(
        "trustshare_token",
        data.access_token
      );

      setToken(data.access_token);

      setAuthForm({
        name: "",
        email: "",
        password: "",
      });
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    clearMessages();

    if (!authForm.name.trim()) {
      showError("Please enter your name.");
      return;
    }

    if (!authForm.email.trim()) {
      showError("Please enter your email.");
      return;
    }

    if (authForm.password.length < 6) {
      showError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: authForm.name.trim(),
            email: authForm.email.trim(),
            password: authForm.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Registration failed."
        );
      }

      setAuthMode("login");

      setAuthForm({
        name: "",
        email: authForm.email,
        password: "",
      });

      showSuccess(
        "Account created successfully. You can now sign in."
      );
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("trustshare_token");

    setToken(null);
    setUser(null);
    setFiles([]);
    setSharedWithMe([]);
    setSharedByMe([]);

    clearMessages();
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    clearMessages();

    const MAX_SIZE = 10 * 1024 * 1024;

    if (file.size > MAX_SIZE) {
      showError(
        "File is too large. Maximum allowed size is 10 MB."
      );
      event.target.value = "";
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();

      formData.append("uploaded_file", file);

      const response = await fetch(
        `${API_URL}/files/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "File upload failed."
        );
      }

      showSuccess(
        `${file.name} uploaded and encrypted successfully.`
      );

      await loadDashboard();
    } catch (err) {
      showError(err.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDownload = async (fileId, filename) => {
    clearMessages();

    try {
      const response = await fetch(
        `${API_URL}/files/${fileId}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let message = "Unable to download file.";

        try {
          const data = await response.json();
          message = data?.detail || message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = filename;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(downloadUrl);

      showSuccess("File downloaded successfully.");
    } catch (err) {
      showError(err.message);
    }
  };

  const handleDelete = async (fileId, filename) => {
    const confirmed = window.confirm(
      `Delete "${filename}" permanently?`
    );

    if (!confirmed) {
      return;
    }

    clearMessages();

    try {
      await apiRequest(`/files/${fileId}`, {
        method: "DELETE",
      });

      showSuccess("File deleted successfully.");

      await loadDashboard();
    } catch (err) {
      showError(err.message);
    }
  };

  const handleShare = async (event) => {
    event.preventDefault();

    clearMessages();

    if (!selectedFile) {
      showError("Please select a file to share.");
      return;
    }

    if (!shareUserId) {
      showError("Please enter the recipient User ID.");
      return;
    }

    const recipientId = Number(shareUserId);

    if (!Number.isInteger(recipientId) || recipientId <= 0) {
      showError("User ID must be a valid positive number.");
      return;
    }

    if (user && recipientId === user.id) {
      showError("You cannot share a file with yourself.");
      return;
    }

    let expiresAt = null;

    if (expiry) {
      const expiryDate = new Date(expiry);

      if (Number.isNaN(expiryDate.getTime())) {
        showError("Please select a valid expiration time.");
        return;
      }

      if (expiryDate <= new Date()) {
        showError(
          "Expiration time must be in the future."
        );
        return;
      }

      expiresAt = expiryDate.toISOString();
    }

    try {
      setLoading(true);

      await apiRequest("/files/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_id: selectedFile.id,
          shared_with_user_id: recipientId,
          permission: "view",
          expires_at: expiresAt,
        }),
      });

      showSuccess(
        `${selectedFile.filename} shared successfully.`
      );

      setSelectedFile(null);
      setShareUserId("");
      setExpiry("");

      await loadDashboard();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (shareId) => {
    const confirmed = window.confirm(
      "Revoke access to this file?"
    );

    if (!confirmed) {
      return;
    }

    clearMessages();

    try {
      await apiRequest(`/files/share/${shareId}`, {
        method: "DELETE",
      });

      showSuccess(
        "File sharing access revoked successfully."
      );

      await loadDashboard();
    } catch (err) {
      showError(err.message);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) {
      return "0 Bytes";
    }

    if (!bytes) {
      return "Unknown size";
    }

    const units = [
      "Bytes",
      "KB",
      "MB",
      "GB",
    ];

    const index = Math.floor(
      Math.log(bytes) / Math.log(1024)
    );

    return `${(
      bytes /
      Math.pow(1024, index)
    ).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "—";
    }

    return new Date(dateValue).toLocaleString();
  };

  const isExpired = (dateValue) => {
    if (!dateValue) {
      return false;
    }

    return new Date(dateValue) <= new Date();
  };

  const getInitials = () => {
    if (!user?.name) {
      return "U";
    }

    return user.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const renderLogo = () => (
    <div className="logo-mark">
      <svg
        width="25"
        height="25"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 3L19 6V11.5C19 16.3 16.1 19.7 12 21C7.9 19.7 5 16.3 5 11.5V6L12 3Z"
          fill="white"
          fillOpacity="0.18"
          stroke="white"
          strokeWidth="1.5"
        />
        <path
          d="M9.2 12.1L11.2 14.1L15.2 10"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );

  const renderSecurityIcon = (type) => {
    if (type === "lock") {
      return (
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
        >
          <rect
            x="5"
            y="10"
            width="14"
            height="10"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M8 10V7a4 4 0 0 1 8 0v3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    }

    if (type === "share") {
      return (
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="18"
            cy="5"
            r="2.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle
            cx="6"
            cy="12"
            r="2.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle
            cx="18"
            cy="19"
            r="2.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M8.2 10.8L15.7 6.5M8.2 13.2L15.7 17.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      );
    }

    if (type === "shield") {
      return (
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M12 3L19 6V11.5C19 16.3 16.1 19.7 12 21C7.9 19.7 5 16.3 5 11.5V6L12 3Z"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M9.2 12.1L11.2 14.1L15.2 10"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    return (
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="8.5"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M12 7V12L15 14"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  };

  if (!token || !user) {
    const isLogin = authMode === "login";

    return (
      <div className="app">
        <div className="auth-page">
          <section className="auth-brand">
            <div className="brand-content">
              <div className="brand-logo">
                {renderLogo()}

                <div className="brand-name">
                  TrustShare
                </div>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  marginBottom: "20px",
                  borderRadius: "999px",
                  border:
                    "1px solid rgba(129,140,248,0.2)",
                  background:
                    "rgba(99,102,241,0.08)",
                  color: "#c7d2fe",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.3px",
                }}
              >
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: "#818cf8",
                    boxShadow:
                      "0 0 10px rgba(129,140,248,0.8)",
                  }}
                />
                SECURE COLLABORATION PLATFORM
              </div>

              <h1 className="brand-tagline">
                Your files.
                <br />
                <span>Your control.</span>
              </h1>

              <p className="brand-description">
                Securely store, encrypt, share and
                collaborate on your files with complete
                control over who can access them.
              </p>

              <div className="security-points">
                <div className="security-point">
                  <span className="security-icon">
                    {renderSecurityIcon("lock")}
                  </span>
                  <span>
                    Encrypted file storage
                  </span>
                </div>

                <div className="security-point">
                  <span className="security-icon">
                    {renderSecurityIcon("share")}
                  </span>
                  <span>
                    Controlled file sharing
                  </span>
                </div>

                <div className="security-point">
                  <span className="security-icon">
                    {renderSecurityIcon("shield")}
                  </span>
                  <span>
                    JWT-secured access
                  </span>
                </div>

                <div className="security-point">
                  <span className="security-icon">
                    {renderSecurityIcon("clock")}
                  </span>
                  <span>
                    Time-limited permissions
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="auth-panel">
            <div className="auth-card">
              <div className="auth-card-header">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "22px",
                  }}
                >
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "12px",
                      background:
                        "rgba(99,102,241,0.12)",
                      color: "#a5b4fc",
                    }}
                  >
                    {renderSecurityIcon(
                      isLogin ? "lock" : "shield"
                    )}
                  </div>

                  <div
                    style={{
                      color: "#475569",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    TRUSTSHARE
                  </div>
                </div>

                <h1>
                  {isLogin
                    ? "Welcome back"
                    : "Create your account"}
                </h1>

                <p>
                  {isLogin
                    ? "Sign in to securely manage and share your files."
                    : "Join TrustShare and take control of your secure collaboration."}
                </p>
              </div>

              {error && (
                <div className="alert alert-error">
                  {error}
                </div>
              )}

              {success && (
                <div className="alert alert-success">
                  {success}
                </div>
              )}

              <form
                className="auth-form"
                onSubmit={
                  isLogin
                    ? handleLogin
                    : handleRegister
                }
              >
                {!isLogin && (
                  <div className="form-group">
                    <label htmlFor="name">
                      FULL NAME
                    </label>

                    <input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Enter your full name"
                      value={authForm.name}
                      onChange={handleAuthChange}
                      autoComplete="name"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="email">
                    EMAIL ADDRESS
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={authForm.email}
                    onChange={handleAuthChange}
                    autoComplete="email"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">
                    PASSWORD
                  </label>

                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder={
                      isLogin
                        ? "Enter your password"
                        : "At least 6 characters"
                    }
                    value={authForm.password}
                    onChange={handleAuthChange}
                    autoComplete={
                      isLogin
                        ? "current-password"
                        : "new-password"
                    }
                  />
                </div>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? isLogin
                      ? "Signing in..."
                      : "Creating account..."
                    : isLogin
                    ? "Sign in securely"
                    : "Create secure account"}
                </button>
              </form>

              <div className="auth-switch">
                {isLogin ? (
                  <>
                    Don't have an account?{" "}
                    <button
                      className="link-button"
                      type="button"
                      onClick={() => {
                        clearMessages();
                        setAuthMode("register");
                      }}
                    >
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      className="link-button"
                      type="button"
                      onClick={() => {
                        clearMessages();
                        setAuthMode("login");
                      }}
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "7px",
                  marginTop: "22px",
                  color: "#475569",
                  fontSize: "11px",
                }}
              >
                <span>
                  {renderSecurityIcon("shield")}
                </span>
                Protected by secure authentication
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const totalShared = sharedByMe.length;
  const receivedCount = sharedWithMe.length;
  const expiredCount = sharedWithMe.filter((share) =>
    isExpired(share.expires_at)
  ).length;

  return (
    <div className="app">
      <div className="dashboard">
        <nav className="navbar">
          <div className="navbar-brand">
            <div className="navbar-logo">
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M12 3L19 6V11.5C19 16.3 16.1 19.7 12 21C7.9 19.7 5 16.3 5 11.5V6L12 3Z"
                  stroke="white"
                  strokeWidth="1.7"
                />
                <path
                  d="M9.2 12.1L11.2 14.1L15.2 10"
                  stroke="white"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            TrustShare
          </div>

          <div className="navbar-right">
            <div className="user-info">
              <div className="user-avatar">
                {getInitials()}
              </div>

              <div className="user-details">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
            </div>

            <button
              className="logout-button"
              onClick={logout}
            >
              Sign out
            </button>
          </div>
        </nav>

        <main className="dashboard-container">
          <div className="page-heading">
            <div
              style={{
                color: "#818cf8",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "1px",
                marginBottom: "8px",
              }}
            >
              SECURE WORKSPACE
            </div>

            <h1>
              Good to see you, {user.name.split(" ")[0]}.
            </h1>

            <p>
              Manage your files and collaboration securely
              from one place.
            </p>
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              {success}
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">
                MY FILES
              </div>

              <div className="stat-value">
                {files.length}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                SHARED BY ME
              </div>

              <div className="stat-value">
                {totalShared}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                SHARED WITH ME
              </div>

              <div className="stat-value">
                {receivedCount}
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header">
              <div>
                <h2>Upload a file</h2>
                <p>
                  Your uploaded file is encrypted before
                  being stored.
                </p>
              </div>
            </div>

            <div className="upload-area">
              <label className="upload-label">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12 16V4M12 4L7 9M12 4L17 9"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5 20H19"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>

                {uploading
                  ? "Encrypting & uploading..."
                  : "Choose a file"}

                <input
                  className="file-input"
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>

              <p className="upload-text">
                Maximum file size: 10 MB
              </p>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header">
              <div>
                <h2>My Files</h2>
                <p>
                  Files owned and managed by you.
                </p>
              </div>
            </div>

            {files.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📁</div>
                No files uploaded yet.
              </div>
            ) : (
              <div className="file-list">
                {files.map((file) => (
                  <div
                    className="file-row"
                    key={file.id}
                  >
                    <div className="file-info">
                      <div className="file-name">
                        🔒 {file.filename}
                      </div>

                      <div className="file-meta">
                        {formatSize(file.file_size)}
                        {" • "}
                        {file.content_type ||
                          "Unknown type"}
                        {" • "}
                        {formatDate(
                          file.uploaded_at
                        )}
                      </div>
                    </div>

                    <div className="file-actions">
                      <button
                        className="action-button primary"
                        onClick={() =>
                          handleDownload(
                            file.id,
                            file.filename
                          )
                        }
                      >
                        Download
                      </button>

                      <button
                        className="action-button"
                        onClick={() =>
                          setSelectedFile(file)
                        }
                      >
                        Share
                      </button>

                      <button
                        className="action-button danger"
                        onClick={() =>
                          handleDelete(
                            file.id,
                            file.filename
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedFile && (
            <div className="section-card">
              <div className="section-header">
                <div>
                  <h2>Share File</h2>
                  <p>
                    Sharing:{" "}
                    <strong>
                      {selectedFile.filename}
                    </strong>
                  </p>
                </div>

                <button
                  className="action-button"
                  onClick={() => {
                    setSelectedFile(null);
                    setShareUserId("");
                    setExpiry("");
                  }}
                >
                  Cancel
                </button>
              </div>

              <form
                className="share-form"
                onSubmit={handleShare}
              >
                <div className="form-group">
                  <label>
                    RECIPIENT USER ID
                  </label>

                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 3"
                    value={shareUserId}
                    onChange={(event) =>
                      setShareUserId(
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label>
                    EXPIRATION (OPTIONAL)
                  </label>

                  <input
                    type="datetime-local"
                    value={expiry}
                    onChange={(event) =>
                      setExpiry(event.target.value)
                    }
                  />
                </div>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "auto",
                    padding: "0 22px",
                  }}
                >
                  {loading
                    ? "Sharing..."
                    : "Share securely"}
                </button>
              </form>
            </div>
          )}

          <div className="section-card">
            <div className="section-header">
              <div>
                <h2>Shared By Me</h2>
                <p>
                  Manage files you have shared with
                  other users.
                </p>
              </div>
            </div>

            {sharedByMe.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔗</div>
                You haven't shared any files yet.
              </div>
            ) : (
              <div className="file-list">
                {sharedByMe.map((share) => {
                  const expired = isExpired(
                    share.expires_at
                  );

                  return (
                    <div
                      className="file-row"
                      key={share.id}
                    >
                      <div className="file-info">
                        <div className="file-name">
                          🔗 File #{share.file_id}
                        </div>

                        <div className="file-meta">
                          User ID:{" "}
                          {share.shared_with_user_id}
                          {" • "}
                          Permission:{" "}
                          {share.permission}
                          {" • "}
                          {share.expires_at
                            ? `Expires: ${formatDate(
                                share.expires_at
                              )}`
                            : "No expiration"}
                        </div>

                        {expired && (
                          <div className="file-meta expired">
                            Access expired
                          </div>
                        )}
                      </div>

                      <div className="file-actions">
                        <button
                          className="action-button danger"
                          onClick={() =>
                            handleRevoke(
                              share.id
                            )
                          }
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="section-card">
            <div className="section-header">
              <div>
                <h2>Shared With Me</h2>
                <p>
                  Files other users have shared with
                  you.
                </p>
              </div>
            </div>

            {sharedWithMe.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📥</div>
                No files have been shared with you.
              </div>
            ) : (
              <div className="file-list">
                {sharedWithMe.map((share) => {
                  const expired = isExpired(
                    share.expires_at
                  );

                  return (
                    <div
                      className="file-row"
                      key={share.id}
                    >
                      <div className="file-info">
                        <div className="file-name">
                          {expired ? "⛔" : "📥"}{" "}
                          {share.filename}
                        </div>

                        <div className="file-meta">
                          Shared by{" "}
                          <strong>
                            {share.owner_name}
                          </strong>
                          {" • "}
                          Permission:{" "}
                          {share.permission}
                        </div>

                        <div className="file-meta">
                          {share.expires_at
                            ? expired
                              ? "Access expired"
                              : `Expires: ${formatDate(
                                  share.expires_at
                                )}`
                            : "No expiration"}
                        </div>
                      </div>

                      <div className="file-actions">
                        {expired ? (
                          <button
                            className="action-button"
                            disabled
                            style={{
                              opacity: 0.45,
                              cursor:
                                "not-allowed",
                            }}
                          >
                            Expired
                          </button>
                        ) : (
                          <button
                            className="action-button primary"
                            onClick={() =>
                              handleDownload(
                                share.file_id,
                                share.filename
                              )
                            }
                          >
                            Download
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "20px",
              color: "#475569",
              fontSize: "11px",
            }}
          >
            <span>
              {renderSecurityIcon("shield")}
            </span>

            TrustShare • Secure collaboration
            workspace • Encrypted storage
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;