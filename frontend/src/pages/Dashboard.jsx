import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Dashboard.css";

function Icon({ name, size = 20 }) {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    folder: (
      <>
        <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="M7 9l5-5 5 5" />
        <path d="M5 20h14" />
      </>
    ),
    share: (
      <>
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M8.3 10.8l7.4-3.7M8.3 13.2l7.4 3.7" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3l7 3v5c0 4.7-2.8 7.9-7 10-4.2-2.1-7-5.3-7-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    file: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v5h4M9 13h6M9 17h6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: (
      <path d="M5 12l4 4L19 6" />
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="M13 6l6 6-6 6" />
      </>
    ),
    logout: (
      <>
        <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
        <path d="M14 8l4 4-4 4" />
        <path d="M18 12H9" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function Dashboard() {
  const navigate = useNavigate();

  const [files, setFiles] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    const loadDashboard = async () => {
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        };

        const [filesResponse, sharedResponse] =
          await Promise.all([
            axios.get(
              "http://127.0.0.1:8000/files/",
              config
            ),
            axios.get(
              "http://127.0.0.1:8000/share/received",
              config
            ),
          ]);

        setFiles(filesResponse.data.files || []);
        setSharedFiles(
          sharedResponse.data.files || []
        );
      } catch (error) {
        console.error(
          "Dashboard loading failed:",
          error
        );

        if (error.response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user");
          navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [token, navigate]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const encryptedFiles = files.filter(
    (file) => file.encrypted
  );

  const totalSize = files.reduce(
    (total, file) => total + (file.size || 0),
    0
  );

  const formatSize = (bytes) => {
    if (!bytes || bytes <= 0) return "0 KB";

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(
      bytes /
      (1024 * 1024 * 1024)
    ).toFixed(1)} GB`;
  };

  const getFileType = (filename = "") => {
    const extension =
      filename.split(".").pop()?.toLowerCase();

    const types = {
      pdf: "PDF",
      doc: "DOC",
      docx: "DOC",
      xls: "XLS",
      xlsx: "XLS",
      ppt: "PPT",
      pptx: "PPT",
      csv: "CSV",
      zip: "ZIP",
      jpg: "IMG",
      jpeg: "IMG",
      png: "IMG",
    };

    return types[extension] || "FILE";
  };

  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="dashboard-page">

      {/* MOBILE OVERLAY */}

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`dashboard-sidebar ${
          sidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-top">

          <div className="dashboard-brand">
            <div className="dashboard-logo">
              <Icon name="shield" size={22} />
            </div>

            <div>
              <div className="brand-name">
                TrustShare
              </div>

              <div className="brand-subtitle">
                SECURE COLLABORATION
              </div>
            </div>
          </div>

          <nav className="dashboard-nav">

            <button
              className="nav-item active"
              onClick={() =>
                navigate("/dashboard")
              }
            >
              <Icon name="dashboard" />
              <span>Dashboard</span>
            </button>

            <button
              className="nav-item"
              onClick={() => navigate("/files")}
            >
              <Icon name="folder" />
              <span>My Files</span>
            </button>

            <button
              className="nav-item"
              onClick={() => navigate("/upload")}
            >
              <Icon name="upload" />
              <span>Upload File</span>
            </button>

            <button
              className="nav-item"
              onClick={() => navigate("/shared")}
            >
              <Icon name="share" />
              <span>Shared Files</span>
            </button>

          </nav>
        </div>

        <div className="sidebar-bottom">

          <div className="sidebar-security">
            <div className="security-mini-icon">
              <Icon name="shield" size={17} />
            </div>

            <div>
              <div className="security-mini-label">
                SECURITY STATUS
              </div>

              <div className="security-mini-status">
                <span className="online-dot" />
                Protected
              </div>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            <Icon name="logout" size={18} />
            <span>Sign out</span>
          </button>

        </div>
      </aside>

      {/* MAIN */}

      <main className="dashboard-main">

        {/* TOP BAR */}

        <header className="dashboard-header">

          <button
            className="mobile-menu"
            onClick={() =>
              setSidebarOpen(!sidebarOpen)
            }
          >
            <Icon name="menu" size={21} />
          </button>

          <div className="header-copy">
            <div className="header-eyebrow">
              SECURE WORKSPACE
            </div>

            <h1>
              {getGreeting()},{" "}
              {user?.username || "User"}
            </h1>

            <p>
              Manage your files, sharing and
              security from one place.
            </p>
          </div>

          <div className="header-profile">

            <div className="profile-avatar">
              {(user?.username || "U")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="profile-details">
              <strong>
                {user?.username || "User"}
              </strong>

              <span>
                {user?.email ||
                  "user@example.com"}
              </span>
            </div>

          </div>

        </header>

        {loading ? (

          <div className="dashboard-loading">
            <div className="loading-spinner" />

            <strong>
              Securing your workspace
            </strong>

            <span>
              Loading your encrypted files...
            </span>
          </div>

        ) : (

          <>

            {/* SECURITY HERO */}

            <section className="security-hero">

              <div className="hero-content">

                <div className="hero-status">
                  <span className="hero-status-dot" />
                  Protection active
                </div>

                <h2>
                  Your files are protected.
                </h2>

                <p>
                  Files uploaded to TrustShare
                  are encrypted before cloud
                  storage.
                </p>

                <div className="hero-features">

                  <span>
                    <Icon name="lock" size={14} />
                    AES-256-GCM
                  </span>

                  <span>
                    <Icon name="shield" size={14} />
                    Secure storage
                  </span>

                  <span>
                    <Icon name="share" size={14} />
                    Controlled access
                  </span>

                </div>

              </div>

              <div className="hero-visual">

                <div className="hero-ring ring-one" />
                <div className="hero-ring ring-two" />

                <div className="hero-lock">
                  <Icon name="lock" size={34} />
                </div>

              </div>

            </section>

            {/* STATS */}

            <section className="dashboard-stats">

              <div
                className="stat-card"
                onClick={() => navigate("/files")}
              >
                <div className="stat-icon">
                  <Icon name="folder" />
                </div>

                <div className="stat-label">
                  TOTAL FILES
                </div>

                <div className="stat-value">
                  {files.length}
                </div>

                <div className="stat-note">
                  Files in your workspace
                </div>
              </div>

              <div
                className="stat-card"
                onClick={() =>
                  navigate("/shared")
                }
              >
                <div className="stat-icon">
                  <Icon name="share" />
                </div>

                <div className="stat-label">
                  SHARED WITH YOU
                </div>

                <div className="stat-value">
                  {sharedFiles.length}
                </div>

                <div className="stat-note">
                  Available shared files
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <Icon name="lock" />
                </div>

                <div className="stat-label">
                  ENCRYPTED FILES
                </div>

                <div className="stat-value">
                  {encryptedFiles.length}
                </div>

                <div className="stat-note">
                  AES-256-GCM protected
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <Icon name="folder" />
                </div>

                <div className="stat-label">
                  STORAGE USED
                </div>

                <div className="stat-value storage-value">
                  {formatSize(totalSize)}
                </div>

                <div className="stat-note">
                  Across your files
                </div>
              </div>

            </section>

            {/* MAIN GRID */}

            <section className="dashboard-grid">

              {/* RECENT FILES */}

              <div className="dashboard-panel files-panel">

                <div className="panel-header">

                  <div>
                    <div className="panel-title">
                      Recent files
                    </div>

                    <div className="panel-subtitle">
                      Your latest files in TrustShare
                    </div>
                  </div>

                  <button
                    className="view-button"
                    onClick={() =>
                      navigate("/files")
                    }
                  >
                    View all
                    <Icon name="arrow" size={14} />
                  </button>

                </div>

                {files.length === 0 ? (

                  <div className="empty-files">

                    <div className="empty-file-icon">
                      <Icon name="folder" size={27} />
                    </div>

                    <h3>
                      Your workspace is empty
                    </h3>

                    <p>
                      Upload your first file and
                      TrustShare will encrypt it
                      before storage.
                    </p>

                    <button
                      className="primary-button"
                      onClick={() =>
                        navigate("/upload")
                      }
                    >
                      <Icon name="upload" size={16} />
                      Upload your first file
                    </button>

                  </div>

                ) : (

                  <div className="file-list">

                    {files
                      .slice(0, 5)
                      .map((file, index) => (

                        <div
                          className="file-row"
                          key={
                            file.storage_path ||
                            file.filename ||
                            index
                          }
                        >

                          <div className="file-type">
                            {getFileType(
                              file.filename
                            )}
                          </div>

                          <div className="file-details">

                            <div className="file-name">
                              {file.filename}
                            </div>

                            <div className="file-meta">
                              {formatSize(file.size)}
                              <span>•</span>
                              Recently uploaded
                            </div>

                          </div>

                          {file.encrypted && (
                            <div className="encrypted-badge">
                              <Icon
                                name="lock"
                                size={11}
                              />
                              Encrypted
                            </div>
                          )}

                          <Icon
                            name="arrow"
                            size={15}
                          />

                        </div>

                      ))}

                  </div>

                )}

              </div>

              {/* RIGHT SIDE */}

              <div className="dashboard-right">

                {/* QUICK ACTIONS */}

                <div className="dashboard-panel">

                  <div className="panel-header">

                    <div>
                      <div className="panel-title">
                        Quick actions
                      </div>

                      <div className="panel-subtitle">
                        Jump into your workspace
                      </div>
                    </div>

                  </div>

                  <div className="quick-actions">

                    <button
                      className="quick-action primary-action"
                      onClick={() =>
                        navigate("/upload")
                      }
                    >
                      <div className="quick-icon">
                        <Icon
                          name="upload"
                          size={19}
                        />
                      </div>

                      <div>
                        <strong>
                          Upload file
                        </strong>

                        <span>
                          Encrypt & store
                        </span>
                      </div>

                      <Icon
                        name="arrow"
                        size={14}
                      />
                    </button>

                    <button
                      className="quick-action"
                      onClick={() =>
                        navigate("/files")
                      }
                    >
                      <div className="quick-icon">
                        <Icon
                          name="folder"
                          size={19}
                        />
                      </div>

                      <div>
                        <strong>
                          My files
                        </strong>

                        <span>
                          Manage your files
                        </span>
                      </div>

                      <Icon
                        name="arrow"
                        size={14}
                      />
                    </button>

                    <button
                      className="quick-action"
                      onClick={() =>
                        navigate("/shared")
                      }
                    >
                      <div className="quick-icon">
                        <Icon
                          name="share"
                          size={19}
                        />
                      </div>

                      <div>
                        <strong>
                          Shared files
                        </strong>

                        <span>
                          Files shared with you
                        </span>
                      </div>

                      <Icon
                        name="arrow"
                        size={14}
                      />
                    </button>

                  </div>

                </div>

                {/* SECURITY CARD */}

                <div className="security-card">

                  <div className="security-card-header">

                    <div className="security-card-icon">
                      <Icon
                        name="shield"
                        size={20}
                      />
                    </div>

                    <div>
                      <strong>
                        Security status
                      </strong>

                      <span>
                        Your workspace is protected
                      </span>
                    </div>

                    <div className="protected-pill">
                      Protected
                    </div>

                  </div>

                  <div className="security-checks">

                    <div>
                      <span>
                        AES-256-GCM encryption
                      </span>

                      <Icon
                        name="check"
                        size={15}
                      />
                    </div>

                    <div>
                      <span>
                        Encrypted cloud storage
                      </span>

                      <Icon
                        name="check"
                        size={15}
                      />
                    </div>

                    <div>
                      <span>
                        Controlled file access
                      </span>

                      <Icon
                        name="check"
                        size={15}
                      />
                    </div>

                    <div>
                      <span>
                        Share expiration
                      </span>

                      <Icon
                        name="check"
                        size={15}
                      />
                    </div>

                  </div>

                </div>

              </div>

            </section>

          </>
        )}

      </main>
    </div>
  );
}

export default Dashboard;