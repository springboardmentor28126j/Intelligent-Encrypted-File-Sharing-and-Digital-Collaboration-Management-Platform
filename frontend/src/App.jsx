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
  // SECURE SHARING / PERMISSIONS / TEMPORARY ACCESS
  // =====================================================

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareFile, setShareFile] = useState(null);
  const [sharePermission, setSharePermission] = useState("view");
  const [shareExpiry, setShareExpiry] = useState(24);
  const [maxDownloads, setMaxDownloads] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [existingShares, setExistingShares] = useState([]);
  const [sharesLoading, setSharesLoading] = useState(false);

  // =====================================================
  // SEND FILE PAGE
  // =====================================================

  const [sendShareLink, setSendShareLink] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendMessage, setSendMessage] = useState("");

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
  // SECURE SHARE LINK
  // =====================================================

  function openShareModal(file) {
    setShareFile(file);
    setSharePermission("view");
    setShareExpiry(24);
    setMaxDownloads("");
    setShareLink("");
    setShareMessage("");
    setShareModalOpen(true);
    loadShares(file.id);
  }

  async function loadShares(fileId) {
    setSharesLoading(true);

    try {
      const response = await fetch(`${API_URL}/files/${fileId}/shares`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setExistingShares([]);
        return;
      }

      const data = await response.json();
      setExistingShares(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load share links:", error);
      setExistingShares([]);
    } finally {
      setSharesLoading(false);
    }
  }

  async function revokeShareLink(shareId) {
    try {
      const response = await fetch(`${API_URL}/shares/${shareId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Refresh from the server rather than filtering locally, since
        // the backend is the source of truth for revoked/expired state.
        loadShares(shareFile.id);
      } else {
        const data = await response.json();
        setShareMessage(data.detail || "Unable to revoke this link.");
      }
    } catch (error) {
      console.error("Revoke error:", error);
      setShareMessage("Unable to connect to the server.");
    }
  }

  function closeShareModal() {
    setShareModalOpen(false);
    setShareFile(null);
    setShareLink("");
    setShareMessage("");
  }

  async function createShareLink() {
    if (!shareFile) return;

    if (!shareExpiry || Number(shareExpiry) <= 0) {
      setShareMessage("Please enter a valid expiry time.");
      return;
    }

    if (
      maxDownloads !== "" &&
      (Number(maxDownloads) <= 0 ||
        !Number.isInteger(Number(maxDownloads)))
    ) {
      setShareMessage("Maximum downloads must be a positive whole number.");
      return;
    }

    setShareLoading(true);
    setShareMessage("");
    setShareLink("");

    try {
      const formData = new FormData();
      formData.append("permission", sharePermission);
      formData.append("expires_in_hours", shareExpiry);

      if (maxDownloads !== "") {
        formData.append("max_downloads", maxDownloads);
      }

      const response = await fetch(
        `${API_URL}/files/${shareFile.id}/share`,
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
          data.detail || "Unable to create secure share link."
        );
      }

      const fullShareLink = `${API_URL}${data.share_url}`;
      setShareLink(fullShareLink);
      setShareMessage("Secure share link created successfully.");
      loadShares(shareFile.id);
    } catch (error) {
      setShareMessage(error.message || "Unable to create share link.");
    } finally {
      setShareLoading(false);
    }
  }

  async function copyShareLink() {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setShareMessage("Share link copied to clipboard.");
    } catch (error) {
      setShareMessage("Unable to copy the link.");
    }
  }

  // =====================================================
  // SEND FILE / EMAIL PAGE
  // =====================================================

  function openSendFilePage(link = "") {
    setSendShareLink(link || "");
    setRecipientEmail("");
    setEmailMessage("");
    setSendMessage("");
    setShareModalOpen(false);
    setShareFile(null);
    setShareLink("");
    setPage("send");
    setProfileOpen(false);
  }

  async function copySendLink() {
    if (!sendShareLink) return;

    try {
      await navigator.clipboard.writeText(sendShareLink);
      setSendMessage("Secure link copied to clipboard.");
    } catch (error) {
      setSendMessage("Unable to copy the link.");
    }
  }

  function sendFileByEmail(e) {
    e.preventDefault();
    setSendMessage("");

    const link = sendShareLink.trim();
    const email = recipientEmail.trim();

    if (!link) {
      setSendMessage("Please paste a TrustShare share link.");
      return;
    }

    if (!link.startsWith(`${API_URL}/share/`)) {
      setSendMessage("Please enter a valid TrustShare secure share link.");
      return;
    }

    if (!email) {
      setSendMessage("Please enter the recipient's email address.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setSendMessage("Please enter a valid email address.");
      return;
    }

    const subject = "A secure file has been shared with you - TrustShare";
    const body = `Hello,\n\n${user?.username || "Someone"} has securely shared a file with you through TrustShare.\n\nOpen the secure file link:\n${link}\n\n${emailMessage.trim() || "Please open the link before it expires."}\n\nThis link is protected by the sharing permissions configured by the sender.\n\nRegards,\nTrustShare`;

    const mailtoUrl =
      `mailto:${encodeURIComponent(email)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;
    setSendMessage("Your email application is opening with the secure link.");
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
                      "send"
                    )
                  }
                >
                  📧 Send File
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
                        className="share-button"
                        onClick={() =>
                          openShareModal(file)
                        }
                      >
                        🔗 Share
                      </button>

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
          SEND FILE
      ================================================= */}

      {page === "send" && (
        <main className="dashboard-container">
          <section className="page-heading">
            <div className="welcome-small">
              SECURE SHARING
            </div>
            <h2>Send File</h2>
            <p>Send a TrustShare secure link to another person by email.</p>
          </section>

          <section className="send-file-card">
            <div className="send-file-header">
              <div className="send-file-icon">📧</div>
              <div>
                <h3>Send a Secure File Link</h3>
                <p>Paste your generated TrustShare link and enter the recipient's email address.</p>
              </div>
            </div>

            <form className="send-file-form" onSubmit={sendFileByEmail}>
              <div className="send-form-group">
                <label htmlFor="sendShareLink">TrustShare File Link</label>
                <div className="send-link-row">
                  <input
                    id="sendShareLink"
                    type="url"
                    placeholder="Paste your TrustShare secure link"
                    value={sendShareLink}
                    onChange={(e) => {
                      setSendShareLink(e.target.value);
                      setSendMessage("");
                    }}
                    required
                  />
                  <button
                    type="button"
                    className="copy-link-button"
                    onClick={copySendLink}
                    disabled={!sendShareLink}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>

              <div className="send-form-group">
                <label htmlFor="recipientEmail">Recipient Email</label>
                <input
                  id="recipientEmail"
                  type="email"
                  placeholder="example@gmail.com"
                  value={recipientEmail}
                  onChange={(e) => {
                    setRecipientEmail(e.target.value);
                    setSendMessage("");
                  }}
                  required
                />
              </div>

              <div className="send-form-group">
                <label htmlFor="emailMessage">Message <span>(Optional)</span></label>
                <textarea
                  id="emailMessage"
                  placeholder="Write a short message to the recipient..."
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows="5"
                />
              </div>

              <div className="send-security-note">
                <span>🛡️</span>
                <div>
                  <strong>Secure temporary access</strong>
                  <p>The recipient will receive the TrustShare link. Access is controlled by the permission, expiry time, and download limit configured for that link.</p>
                </div>
              </div>

              {sendMessage && (
                <div
                  className={`send-message ${
                    sendMessage.toLowerCase().includes("opening") ||
                    sendMessage.toLowerCase().includes("copied")
                      ? "success-message"
                      : "error-message"
                  }`}
                >
                  {sendMessage}
                </div>
              )}

              <div className="send-file-actions">
                <button
                  type="button"
                  className="cancel-delete-button"
                  onClick={() => navigateTo("files")}
                >
                  ← Back to My Files
                </button>
                <button type="submit" className="generate-share-button">
                  📧 Send Secure Link
                </button>
              </div>
            </form>
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

      {/* =================================================
          SECURE SHARING MODAL
      ================================================= */}

      {shareModalOpen && (

        <div
          className="modal-overlay"
          onClick={closeShareModal}
        >

          <div
            className="share-modal"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="share-modal-icon">
              🔗
            </div>

            <h2>
              Secure File Sharing
            </h2>

            <p className="share-file-title">
              {shareFile?.filename}
            </p>

            {sharesLoading ? (
              <p className="existing-shares-loading">Loading existing links...</p>
            ) : existingShares.length > 0 ? (
              <div className="existing-shares-list">
                <p className="existing-shares-title">Active share links</p>

                {existingShares.map((share) => (
                  <div className="existing-share-item" key={share.id}>
                    <div className="existing-share-info">
                      <span className={`share-permission-badge ${share.permission}`}>
                        {share.permission === "view" ? "👁️ View" : "⬇ Download"}
                      </span>

                      <span className="existing-share-meta">
                        Expires {new Date(share.expires_at).toLocaleString()}
                        {share.max_downloads
                          ? ` · ${share.download_count}/${share.max_downloads} downloads`
                          : ""}
                        {share.revoked ? " · Revoked" : ""}
                      </span>
                    </div>

                    {!share.revoked && (
                      <button
                        className="revoke-share-button"
                        onClick={() => revokeShareLink(share.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {!shareLink ? (

              <>

                <div className="share-form-group">
                  <label>
                    Permission
                  </label>

                  <div className="permission-options">

                    <label className={`permission-option ${sharePermission === "view" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="sharePermission"
                        value="view"
                        checked={sharePermission === "view"}
                        onChange={(e) => setSharePermission(e.target.value)}
                      />
                      <span>👁️ View Only</span>
                    </label>

                    <label className={`permission-option ${sharePermission === "download" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="sharePermission"
                        value="download"
                        checked={sharePermission === "download"}
                        onChange={(e) => setSharePermission(e.target.value)}
                      />
                      <span>⬇ Download</span>
                    </label>

                  </div>
                </div>

                <div className="share-form-row">

                  <div className="share-form-group">
                    <label htmlFor="shareExpiry">
                      Temporary Access (Hours)
                    </label>
                    <input
                      id="shareExpiry"
                      type="number"
                      min="1"
                      value={shareExpiry}
                      onChange={(e) => setShareExpiry(e.target.value)}
                    />
                  </div>

                  <div className="share-form-group">
                    <label htmlFor="maxDownloads">
                      Max Downloads (Optional)
                    </label>
                    <input
                      id="maxDownloads"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Unlimited"
                      value={maxDownloads}
                      onChange={(e) => setMaxDownloads(e.target.value)}
                    />
                  </div>

                </div>

                <div className="temporary-access-note">
                  <span>🛡️</span>
                  <div>
                    <strong>Temporary and controlled access</strong>
                    <p>
                      The link will expire automatically after the selected time.
                      You can also limit the number of downloads.
                    </p>
                  </div>
                </div>

                {shareMessage && (
                  <div className="share-message error-message">
                    {shareMessage}
                  </div>
                )}

                <div className="modal-actions share-modal-actions">
                  <button
                    className="cancel-delete-button"
                    onClick={closeShareModal}
                    disabled={shareLoading}
                  >
                    Cancel
                  </button>

                  <button
                    className="generate-share-button"
                    onClick={createShareLink}
                    disabled={shareLoading}
                  >
                    {shareLoading ? "Creating..." : "🔐 Generate Secure Link"}
                  </button>
                </div>

              </>

            ) : (

              <>

                <div className="share-success-box">
                  <div className="share-success-icon">
                    ✓
                  </div>
                  <h3>
                    Secure Link Ready
                  </h3>
                  <p>
                    Your file has been configured for secure temporary access.
                  </p>
                </div>

                <div className="share-link-box">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    onFocus={(e) => e.target.select()}
                  />

                  <button
                    className="copy-share-button"
                    onClick={copyShareLink}
                  >
                    📋 Copy
                  </button>
                </div>

                <div className="share-details">
                  <div>
                    <span>Permission</span>
                    <strong>
                      {sharePermission === "view" ? "View Only" : "Download"}
                    </strong>
                  </div>
                  <div>
                    <span>Expires In</span>
                    <strong>{shareExpiry} hour(s)</strong>
                  </div>
                  <div>
                    <span>Maximum Downloads</span>
                    <strong>{maxDownloads || "Unlimited"}</strong>
                  </div>
                </div>

                {shareMessage && (
                  <div className="share-message success-message">
                    {shareMessage}
                  </div>
                )}

                <div className="modal-actions share-modal-actions">
                  <button
                    className="cancel-delete-button"
                    onClick={() => openSendFilePage(shareLink)}
                  >
                    📧 Open Email
                  </button>
                  <button
                    className="generate-share-button"
                    onClick={closeShareModal}
                  >
                    Done
                  </button>
                </div>

              </>

            )}

          </div>

        </div>

      )}

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
