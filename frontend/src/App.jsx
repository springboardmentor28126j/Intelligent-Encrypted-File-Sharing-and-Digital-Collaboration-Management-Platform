import React, { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  // =====================================================
  // AUTH STATE
  // =====================================================

  const [page, setPage] = useState("login");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [user, setUser] = useState(null);

  const [token, setToken] = useState(
    localStorage.getItem("trustshare_token") || ""
  );

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // =====================================================
  // FILE STATE
  // =====================================================

  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  // =====================================================
  // PROFILE MENU
  // =====================================================

  const [profileOpen, setProfileOpen] = useState(false);

  // =====================================================
  // DELETE POPUP
  // =====================================================

  const [deletePopup, setDeletePopup] = useState({
    open: false,
    fileId: null,
    fileName: "",
  });

  // =====================================================
  // THEME
  // =====================================================

  const [theme, setTheme] = useState(
    localStorage.getItem("trustshare_theme") || "light"
  );

  useEffect(() => {
    localStorage.setItem("trustshare_theme", theme);

    if (theme === "system") {
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

      document.documentElement.setAttribute(
        "data-theme",
        systemDark ? "dark" : "light"
      );
    } else {
      document.documentElement.setAttribute(
        "data-theme",
        theme
      );
    }
  }, [theme]);

  // =====================================================
  // GET CURRENT USER
  // =====================================================

  useEffect(() => {
    if (token) {
      getCurrentUser();
    }
  }, []);

  async function getCurrentUser() {
    try {
      const response = await fetch(`${API_URL}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        logout();
        return;
      }

      const data = await response.json();

      setUser(data);
      setPage("dashboard");

      loadFiles(data.user_id);
    } catch (error) {
      console.error("Current user error:", error);
    }
  }

  // =====================================================
  // REGISTER
  // =====================================================

  async function register(e) {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("username", username);
      formData.append("email", email);
      formData.append("password", password);

      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setMessage(
          "Registration successful. Please login."
        );

        setUsername("");
        setEmail("");
        setPassword("");

        setTimeout(() => {
          setMessage("");
          setPage("login");
        }, 1500);
      } else {
        setMessage(data.message);
      }
    } catch (error) {
      console.error("Registration error:", error);
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOGIN
  // =====================================================

  async function login(e) {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const formData = new URLSearchParams();

      formData.append("email", email);
      formData.append("password", password);

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem(
          "trustshare_token",
          data.access_token
        );

        setToken(data.access_token);

        const loggedUser = {
          user_id: data.user_id,
          username: data.username,
          email: data.email,
          role: data.role,
        };

        setUser(loggedUser);

        setEmail("");
        setPassword("");
        setMessage("");

        setPage("dashboard");

        loadFiles(data.user_id);
      } else {
        setMessage(data.message);
      }
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // RESET PASSWORD
  // =====================================================

  async function resetPassword(e) {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("email", resetEmail);
      formData.append("new_password", newPassword);

      const response = await fetch(
        `${API_URL}/reset-password`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      setMessage(data.message);

      if (data.success) {
        setResetEmail("");
        setNewPassword("");

        setTimeout(() => {
          setMessage("");
          setPage("login");
        }, 1800);
      }
    } catch (error) {
      console.error(
        "Reset password error:",
        error
      );

      setMessage(
        "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOAD FILES
  // =====================================================

  async function loadFiles(userId = user?.user_id) {
    if (!userId || !token) return;

    try {
      const response = await fetch(
        `${API_URL}/files/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      setFiles(data);
    } catch (error) {
      console.error(
        "Load files error:",
        error
      );
    }
  }

  // =====================================================
  // FILE SELECT
  // =====================================================

  function handleFileSelect(e) {
    const file = e.target.files[0];

    if (file) {
      setSelectedFile(file);
      setMessage("");
    }
  }

  // =====================================================
  // UPLOAD FILE
  // =====================================================

  async function uploadFile() {
    if (!selectedFile) {
      setMessage(
        "Please select a file first."
      );

      return;
    }

    if (!user) {
      setMessage(
        "Please login first."
      );

      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();

      formData.append(
        "user_id",
        user.user_id
      );

      formData.append(
        "file",
        selectedFile
      );

      const response = await fetch(
        `${API_URL}/upload`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },

          body: formData,
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage(
          "File uploaded successfully."
        );

        setSelectedFile(null);

        const fileInput =
          document.getElementById(
            "fileInput"
          );

        if (fileInput) {
          fileInput.value = "";
        }

        loadFiles();
      } else {
        setMessage(data.message);
      }
    } catch (error) {
      console.error(
        "Upload error:",
        error
      );

      setMessage(
        "Unable to upload file."
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // DOWNLOAD FILE
  // =====================================================

  async function downloadFile(
    fileId,
    filename
  ) {
    try {
      const response = await fetch(
        `${API_URL}/download/${fileId}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        alert(
          "Unable to download file."
        );

        return;
      }

      const blob =
        await response.blob();

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        url
      );
    } catch (error) {
      console.error(
        "Download error:",
        error
      );

      alert(
        "Unable to download file."
      );
    }
  }

  // =====================================================
  // OPEN DELETE POPUP
  // =====================================================

  function openDeletePopup(
    fileId,
    fileName
  ) {
    setDeletePopup({
      open: true,
      fileId: fileId,
      fileName: fileName,
    });
  }

  // =====================================================
  // CLOSE DELETE POPUP
  // =====================================================

  function closeDeletePopup() {
    setDeletePopup({
      open: false,
      fileId: null,
      fileName: "",
    });
  }

  // =====================================================
  // CONFIRM DELETE
  // =====================================================

  async function confirmDelete() {
    const fileId =
      deletePopup.fileId;

    if (!fileId) {
      closeDeletePopup();
      return;
    }

    try {
      const response =
        await fetch(
          `${API_URL}/files/${fileId}`,
          {
            method: "DELETE",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (
        response.ok &&
        data.success
      ) {
        setFiles(
          (previousFiles) =>
            previousFiles.filter(
              (file) =>
                file.id !== fileId
            )
        );

        closeDeletePopup();

        setMessage(
          "File deleted successfully."
        );
      } else {
        alert(
          data.detail ||
            data.message ||
            "Failed to delete file."
        );

        closeDeletePopup();
      }
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      alert(
        "Unable to connect to the server."
      );

      closeDeletePopup();
    }
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  function logout() {
    localStorage.removeItem(
      "trustshare_token"
    );

    setToken("");
    setUser(null);
    setFiles([]);
    setSelectedFile(null);

    setProfileOpen(false);

    setPage("login");

    setEmail("");
    setPassword("");

    setMessage("");
  }

  // =====================================================
  // NAVIGATION
  // =====================================================

  function navigateTo(targetPage) {
    setPage(targetPage);

    setProfileOpen(false);

    setMessage("");

    if (
      targetPage === "files" &&
      user
    ) {
      loadFiles();
    }
  }

  // =====================================================
  // USER FIRST LETTER
  // =====================================================

  const userInitial =
    user?.username
      ?.charAt(0)
      ?.toUpperCase() || "U";

  // =====================================================
  // LOGIN PAGE
  // =====================================================

  if (
    !user &&
    page === "login"
  ) {
    return (
      <div className="app">

        <div className="auth-card">

          <div className="logo">
            🔐
          </div>

          <h1>
            TrustShare
          </h1>

          <p className="subtitle">
            Secure File Sharing &
            Collaboration
          </p>

          <h2>
            Welcome
          </h2>

          <form onSubmit={login}>

            <input
              id="loginEmail"
              name="email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              autoComplete="email"
              required
            />

            <input
              id="loginPassword"
              name="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="forgot-button"
              onClick={() => {
                setMessage("");
                setPage("reset");
              }}
            >
              Forgot Password?
            </button>

            <button
              className="main-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Logging in..."
                : "Login"}
            </button>

          </form>

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          <p className="bottom-text">

            Don't have an account?

            <button
              className="link-button"
              onClick={() => {
                setMessage("");
                setPage("register");
              }}
            >
              Register
            </button>

          </p>

        </div>

      </div>
    );
  }

  // =====================================================
  // REGISTER PAGE
  // =====================================================

  if (
    !user &&
    page === "register"
  ) {
    return (
      <div className="app">

        <div className="auth-card">

          <div className="logo">
            🔐
          </div>

          <h1>
            TrustShare
          </h1>

          <p className="subtitle">
            Create your secure account
          </p>

          <h2>
            Create Account
          </h2>

          <form onSubmit={register}>

            <input
              id="registerUsername"
              name="username"
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value
                )
              }
              autoComplete="username"
              required
            />

            <input
              id="registerEmail"
              name="email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              autoComplete="email"
              required
            />

            <input
              id="registerPassword"
              name="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              autoComplete="new-password"
              required
            />

            <button
              className="main-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Creating Account..."
                : "Register"}
            </button>

          </form>

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          <p className="bottom-text">

            Already have an account?

            <button
              className="link-button"
              onClick={() => {
                setMessage("");
                setPage("login");
              }}
            >
              Login
            </button>

          </p>

        </div>

      </div>
    );
  }

  // =====================================================
  // RESET PASSWORD PAGE
  // =====================================================

  if (
    !user &&
    page === "reset"
  ) {
    return (
      <div className="app">

        <div className="auth-card">

          <div className="logo">
            🔑
          </div>

          <h1>
            Reset Password
          </h1>

          <p className="forgot-description">
            Enter your registered email
            address and create a new
            password.
          </p>

          <form
            onSubmit={resetPassword}
          >

            <input
              id="resetEmail"
              name="email"
              type="email"
              placeholder="Registered email"
              value={resetEmail}
              onChange={(e) =>
                setResetEmail(
                  e.target.value
                )
              }
              autoComplete="email"
              required
            />

            <input
              id="newPassword"
              name="new_password"
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) =>
                setNewPassword(
                  e.target.value
                )
              }
              autoComplete="new-password"
              required
            />

            <button
              className="main-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Resetting..."
                : "Reset Password"}
            </button>

          </form>

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          <button
            className="link-button full-link"
            onClick={() => {
              setMessage("");
              setPage("login");
            }}
          >
            ← Back to Login
          </button>

        </div>

      </div>
    );
  }

  // =====================================================
  // MAIN APPLICATION
  // =====================================================

  return (
    <div className="dashboard">

      {/* =================================================
          NAVBAR
      ================================================= */}

      <nav className="navbar">

        <div className="brand-area">

          <div className="brand-logo">
            🔐
          </div>

          <div className="brand">
            TrustShare
          </div>

        </div>

        <div className="nav-right">

          <div className="profile-wrapper">

            {/* USERNAME + FIRST LETTER */}

            <button
              className="profile-button"
              onClick={() =>
                setProfileOpen(
                  !profileOpen
                )
              }
              title="Account menu"
            >

              <span className="profile-letter">
                {userInitial}
              </span>

              <span className="profile-username">
                {user?.username}
              </span>

              <span className="profile-arrow">
                ▾
              </span>

            </button>

            {/* =================================================
                PROFILE MENU
            ================================================= */}

            {profileOpen && (

              <div className="profile-menu">

                <div className="menu-user">

                  <div className="menu-avatar">
                    {userInitial}
                  </div>

                  <div>
                    <strong>
                      {user?.username}
                    </strong>

                    <small>
                      {user?.email}
                    </small>
                  </div>

                </div>

                <div className="menu-divider"></div>

                <button
                  onClick={() =>
                    navigateTo(
                      "dashboard"
                    )
                  }
                >
                  🏠 Dashboard
                </button>

                <button
                  onClick={() =>
                    navigateTo(
                      "files"
                    )
                  }
                >
                  📁 My Files
                </button>

                <button
                  onClick={() =>
                    navigateTo(
                      "profile"
                    )
                  }
                >
                  👤 My Profile
                </button>

                <button
                  onClick={() =>
                    navigateTo(
                      "settings"
                    )
                  }
                >
                  ⚙ Settings
                </button>

                <div className="menu-divider"></div>

                <button
                  className="logout-menu-button"
                  onClick={logout}
                >
                  🚪 Logout
                </button>

              </div>

            )}

          </div>

        </div>

      </nav>

      {/* =================================================
          DASHBOARD
      ================================================= */}

      {page === "dashboard" && (

        <main className="dashboard-container">

          <section className="welcome-section">

            <div>

              <div className="welcome-small">
                TRUSTSHARE SECURE PLATFORM
              </div>

              <h2>
                Welcome,{" "}
                <span>
                  {user?.username}
                </span>
              </h2>

              <p>
                Manage and securely store
                your files in one place.
              </p>

            </div>

            <div className="security-status">

              <span className="status-dot"></span>

              Secure

            </div>

          </section>

          {/* =================================================
              STATISTICS
          ================================================= */}

          <section className="stats-grid">

            <div className="stat-card">

              <div className="stat-icon">
                📁
              </div>

              <div>

                <span className="stat-number">
                  {files.length}
                </span>

                <span className="stat-label">
                  Total Files
                </span>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon">
                🔐
              </div>

              <div>

                <span className="stat-number">
                  Protected
                </span>

                <span className="stat-label">
                  File Security
                </span>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon">
                👤
              </div>

              <div>

                <span className="stat-number">
                  Active
                </span>

                <span className="stat-label">
                  Account Status
                </span>

              </div>

            </div>

          </section>

          {/* =================================================
              SINGLE UPLOAD SECTION
          ================================================= */}

          <section className="upload-card">

            <div className="section-header">

              <div className="section-icon">
                ☁️
              </div>

              <div>

                <h3>
                  Upload a File
                </h3>

                <p>
                  Securely upload your
                  files to TrustShare.
                </p>

              </div>

            </div>

            <div className="upload-zone">

              <div className="upload-big-icon">
                ☁️
              </div>

              <h4>
                Choose a file
              </h4>

              <p>
                Select a file from your
                computer.
              </p>

              <label
                htmlFor="fileInput"
                className="browse-button"
              >
                Browse Files
              </label>

              <input
                id="fileInput"
                name="file"
                type="file"
                className="hidden-file-input"
                onChange={
                  handleFileSelect
                }
              />

            </div>

            {selectedFile && (

              <div className="selected-file">

                <span>
                  📄
                </span>

                <div>

                  <strong>
                    {selectedFile.name}
                  </strong>

                  <small>
                    {(
                      selectedFile.size /
                      1024
                    ).toFixed(1)} KB
                  </small>

                </div>

              </div>

            )}

            <button
              className="upload-button"
              onClick={uploadFile}
              disabled={
                !selectedFile ||
                loading
              }
            >
              {loading
                ? "Uploading..."
                : "Upload File"}
            </button>

            {message && (

              <div className="dashboard-message">
                {message}
              </div>

            )}

          </section>

        </main>

      )}

      {/* =================================================
          MY FILES
      ================================================= */}

      {page === "files" && (

        <main className="dashboard-container">

          <section className="page-heading">

            <div className="welcome-small">
              FILE MANAGEMENT
            </div>

            <h2>
              My Files
            </h2>

            <p>
              View, download and manage
              your uploaded files.
            </p>

          </section>

          <section className="files-card">

            {files.length === 0 ? (

              <div className="empty-files">

                <div className="empty-icon">
                  📂
                </div>

                <h3>
                  No Files Yet
                </h3>

                <p>
                  You haven't uploaded
                  any files yet.
                </p>

                <button
                  className="main-button small-button"
                  onClick={() =>
                    navigateTo(
                      "dashboard"
                    )
                  }
                >
                  Upload Your First File
                </button>

              </div>

            ) : (

              <div className="file-list">

                {files.map((file) => (

                  <div
                    className="file-item"
                    key={file.id}
                  >

                    <div className="file-info">

                      <div className="file-icon">
                        📄
                      </div>

                      <div>

                        <strong>
                          {file.filename}
                        </strong>

                        <span>
                          File ID: {file.id}
                        </span>

                      </div>

                    </div>

                    <div className="file-actions">

                      <button
                        className="download-button"
                        onClick={() =>
                          downloadFile(
                            file.id,
                            file.filename
                          )
                        }
                      >
                        ⬇ Download
                      </button>

                      <button
                        className="delete-button"
                        onClick={() =>
                          openDeletePopup(
                            file.id,
                            file.filename
                          )
                        }
                      >
                        🗑 Delete
                      </button>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </section>

        </main>

      )}

      {/* =================================================
          MY PROFILE
      ================================================= */}

      {page === "profile" && (

        <main className="dashboard-container">

          <section className="page-heading">

            <div className="welcome-small">
              ACCOUNT
            </div>

            <h2>
              My Profile
            </h2>

            <p>
              View your TrustShare account
              information.
            </p>

          </section>

          <section className="profile-card">

            <div className="large-profile-icon">
              {userInitial}
            </div>

            <h2>
              {user?.username}
            </h2>

            <p className="profile-role">
              {user?.role}
            </p>

            <div className="profile-details">

              <div className="detail-row">

                <span>
                  User ID
                </span>

                <strong>
                  {user?.user_id}
                </strong>

              </div>

              <div className="detail-row">

                <span>
                  Username
                </span>

                <strong>
                  {user?.username}
                </strong>

              </div>

              <div className="detail-row">

                <span>
                  Email
                </span>

                <strong>
                  {user?.email}
                </strong>

              </div>

              <div className="detail-row">

                <span>
                  Account Role
                </span>

                <strong>
                  {user?.role}
                </strong>

              </div>

              <div className="detail-row">

                <span>
                  Status
                </span>

                <strong className="active-status">
                  ● Active
                </strong>

              </div>

            </div>

          </section>

        </main>

      )}

      {/* =================================================
          SETTINGS
      ================================================= */}

      {page === "settings" && (

        <main className="dashboard-container">

          <section className="page-heading">

            <div className="welcome-small">
              PREFERENCES
            </div>

            <h2>
              Settings
            </h2>

            <p>
              Customize your TrustShare
              experience.
            </p>

          </section>

          <section className="settings-card">

            {/* THEME */}

            <div className="settings-section">

              <div className="settings-icon">
                🎨
              </div>

              <div className="settings-content">

                <h3>
                  Theme
                </h3>

                <p>
                  Choose how TrustShare
                  looks on your device.
                </p>

                <div className="theme-options">

                  <button
                    className={`theme-option ${
                      theme === "light"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setTheme("light")
                    }
                  >
                    ☀️ Light
                  </button>

                  <button
                    className={`theme-option ${
                      theme === "dark"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setTheme("dark")
                    }
                  >
                    🌙 Dark
                  </button>

                  <button
                    className={`theme-option ${
                      theme === "system"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setTheme("system")
                    }
                  >
                    💻 System
                  </button>

                </div>

              </div>

            </div>

            <div className="settings-divider"></div>

            {/* SECURITY */}

            <div className="settings-section">

              <div className="settings-icon">
                🔐
              </div>

              <div className="settings-content">

                <h3>
                  Security
                </h3>

                <p>
                  Your account is protected
                  using authentication and
                  secure access tokens.
                </p>

                <div className="security-setting">

                  <span>
                    Account Security
                  </span>

                  <strong>
                    Protected
                  </strong>

                </div>

              </div>

            </div>

            <div className="settings-divider"></div>

            {/* STORAGE */}

            <div className="settings-section">

              <div className="settings-icon">
                💾
              </div>

              <div className="settings-content">

                <h3>
                  Storage
                </h3>

                <p>
                  Manage your uploaded
                  TrustShare files.
                </p>

                <div className="storage-info">

                  <span>
                    Total Files
                  </span>

                  <strong>
                    {files.length}
                  </strong>

                </div>

              </div>

            </div>

            <div className="settings-divider"></div>

            {/* ACCOUNT */}

            <div className="settings-section">

              <div className="settings-icon">
                👤
              </div>

              <div className="settings-content">

                <h3>
                  Account
                </h3>

                <p>
                  You are currently signed
                  in as{" "}
                  <strong>
                    {user?.email}
                  </strong>
                </p>

                <button
                  className="logout-settings-button"
                  onClick={logout}
                >
                  🚪 Logout
                </button>

              </div>

            </div>

          </section>

        </main>

      )}

      {/* =================================================
          DELETE CONFIRMATION POPUP
      ================================================= */}

      {deletePopup.open && (

        <div
          className="modal-overlay"
          onClick={closeDeletePopup}
        >

          <div
            className="delete-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="delete-modal-icon">
              🗑️
            </div>

            <h2>
              Delete File?
            </h2>

            <p>
              Are you sure you want to
              delete this file?
            </p>

            <div className="delete-file-name">
              📄{" "}
              <span>
                {deletePopup.fileName}
              </span>
            </div>

            <p className="delete-warning">
              This action cannot be undone.
            </p>

            <div className="modal-actions">

              <button
                className="cancel-delete-button"
                onClick={closeDeletePopup}
              >
                Cancel
              </button>

              <button
                className="confirm-delete-button"
                onClick={confirmDelete}
              >
                🗑 Delete
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;