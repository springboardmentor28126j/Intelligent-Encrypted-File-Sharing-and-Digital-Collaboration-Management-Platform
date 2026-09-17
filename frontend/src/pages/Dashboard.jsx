import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function Dashboard() {
  const navigate = useNavigate();

  const [files, setFiles] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [loading, setLoading] = useState(true);

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

        const [filesResponse, sharedResponse] = await Promise.all([
          axios.get("http://127.0.0.1:8000/files/", config),
          axios.get("http://127.0.0.1:8000/share/received", config),
        ]);

        setFiles(filesResponse.data.files || []);
        setSharedFiles(sharedResponse.data.files || []);
      } catch (error) {
        console.error("Dashboard loading failed:", error);

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

  const encryptedFiles = files.filter((file) => file.encrypted);

  const formatSize = (bytes) => {
    if (!bytes || bytes <= 0) return "0 KB";

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="ts-dashboard">

      <style>{`
        * {
          box-sizing: border-box;
        }

        .ts-dashboard {
          min-height: 100vh;
          display: flex;
          background:
            radial-gradient(
              circle at 80% 0%,
              rgba(99, 102, 241, 0.12),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              #f8fafc 0%,
              #eef2ff 100%
            );
          color: #172033;
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        /* =========================
           SIDEBAR
        ========================= */

        .ts-sidebar {
          width: 250px;
          min-height: 100vh;
          background: #111827;
          color: white;
          padding: 25px 18px;
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
        }

        .ts-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 5px 10px 35px;
        }

        .ts-logo {
          width: 42px;
          height: 42px;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
          font-weight: 800;
          background: linear-gradient(
            135deg,
            #6366f1,
            #8b5cf6
          );
          box-shadow:
            0 8px 25px rgba(99, 102, 241, 0.35);
        }

        .ts-brand h2 {
          margin: 0;
          font-size: 21px;
          letter-spacing: -0.5px;
        }

        .ts-brand small {
          display: block;
          color: #94a3b8;
          font-size: 10px;
          margin-top: 2px;
        }

        .ts-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ts-nav button,
        .ts-logout {
          border: 0;
          background: transparent;
          color: #cbd5e1;
          text-align: left;
          padding: 13px 14px;
          border-radius: 10px;
          font-size: 14px;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .ts-nav button:hover,
        .ts-nav button.ts-active {
          background: rgba(255, 255, 255, 0.09);
          color: white;
          transform: translateX(2px);
        }

        .ts-nav button.ts-active {
          box-shadow:
            inset 3px 0 0 #818cf8;
        }

        .ts-sidebar-bottom {
          margin-top: auto;
        }

        .ts-security-mini {
          padding: 15px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 12px;
        }

        .ts-security-mini-title {
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 7px;
        }

        .ts-security-mini-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
        }

        .ts-green-dot {
          width: 8px;
          height: 8px;
          background: #22c55e;
          border-radius: 50%;
          box-shadow:
            0 0 10px rgba(34, 197, 94, 0.7);
        }

        .ts-logout {
          width: 100%;
        }

        .ts-logout:hover {
          background: rgba(239, 68, 68, 0.12);
          color: #fca5a5;
        }

        /* =========================
           MAIN
        ========================= */

        .ts-main {
          flex: 1;
          min-width: 0;
          padding: 35px;
        }

        .ts-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
        }

        .ts-header h1 {
          margin: 0;
          font-size: clamp(25px, 3vw, 34px);
          letter-spacing: -1px;
        }

        .ts-header p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        /* =========================
           PROFILE
        ========================= */

        .ts-profile {
          display: flex;
          align-items: center;
          gap: 11px;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid #e2e8f0;
          padding: 8px 13px 8px 8px;
          border-radius: 40px;
          white-space: nowrap;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .ts-profile:hover {
          border-color: #c7d2fe;
          background: white;
          transform: translateY(-1px);
          box-shadow:
            0 8px 20px rgba(15, 23, 42, 0.08);
        }

        .ts-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          background: linear-gradient(
            135deg,
            #6366f1,
            #8b5cf6
          );
        }

        .ts-profile-name {
          font-size: 13px;
          font-weight: 600;
        }

        .ts-profile-email {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }

        .ts-profile-logout {
          margin-left: 4px;
          font-size: 13px;
          color: #64748b;
          transition: 0.2s ease;
        }

        .ts-profile:hover .ts-profile-logout {
          color: #ef4444;
        }

        /* =========================
           HERO
        ========================= */

        .ts-hero {
          background:
            linear-gradient(
              135deg,
              #312e81,
              #4f46e5 55%,
              #7c3aed
            );
          border-radius: 22px;
          padding: 28px;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          overflow: hidden;
          position: relative;
          margin-bottom: 24px;
          box-shadow:
            0 15px 35px rgba(79, 70, 229, 0.20);
        }

        .ts-hero::after {
          content: "";
          position: absolute;
          width: 230px;
          height: 230px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.12);
          right: 80px;
          top: -110px;
        }

        .ts-hero-content {
          position: relative;
          z-index: 1;
        }

        .ts-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.16);
          padding: 6px 10px;
          border-radius: 20px;
          font-size: 11px;
          margin-bottom: 12px;
        }

        .ts-hero h2 {
          margin: 0;
          font-size: 24px;
        }

        .ts-hero p {
          margin: 7px 0 0;
          color: #ddd6fe;
          font-size: 13px;
        }

        .ts-hero-lock {
          width: 80px;
          height: 80px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          background: rgba(255, 255, 255, 0.11);
          border: 1px solid rgba(255, 255, 255, 0.16);
          position: relative;
          z-index: 1;
        }

        /* =========================
           STATS
        ========================= */

        .ts-stats {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 24px;
        }

        .ts-stat {
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid #e2e8f0;
          border-radius: 17px;
          padding: 19px;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .ts-stat:hover {
          transform: translateY(-3px);
          border-color: #c7d2fe;
          box-shadow:
            0 12px 25px rgba(15, 23, 42, 0.07);
        }

        .ts-stat-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ts-stat-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          background: #eef2ff;
        }

        .ts-stat-label {
          color: #64748b;
          font-size: 12px;
          margin: 14px 0 4px;
        }

        .ts-stat-value {
          font-size: 25px;
          font-weight: 750;
          letter-spacing: -0.7px;
        }

        .ts-stat-note {
          color: #16a34a;
          font-size: 10px;
          margin-top: 5px;
        }

        /* =========================
           CONTENT
        ========================= */

        .ts-content-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1.55fr)
            minmax(280px, 0.9fr);
          gap: 20px;
        }

        .ts-panel {
          background: rgba(255, 255, 255, 0.86);
          border: 1px solid #e2e8f0;
          border-radius: 19px;
          overflow: hidden;
        }

        .ts-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 19px 20px;
          border-bottom: 1px solid #eef2f7;
        }

        .ts-panel-header h3 {
          margin: 0;
          font-size: 16px;
        }

        .ts-panel-header p {
          margin: 4px 0 0;
          font-size: 11px;
          color: #64748b;
        }

        .ts-view-all {
          border: 0;
          background: #eef2ff;
          color: #4f46e5;
          padding: 7px 11px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .ts-view-all:hover {
          background: #e0e7ff;
        }

        /* =========================
           FILES
        ========================= */

        .ts-file-list {
          padding: 7px 10px 12px;
        }

        .ts-file {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 10px;
          border-radius: 12px;
          transition: 0.18s ease;
        }

        .ts-file:hover {
          background: #f8fafc;
        }

        .ts-file-icon {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
          flex-shrink: 0;
        }

        .ts-file-info {
          flex: 1;
          min-width: 0;
        }

        .ts-file-name {
          font-size: 13px;
          font-weight: 650;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ts-file-meta {
          font-size: 10px;
          color: #64748b;
          margin-top: 4px;
        }

        .ts-encrypted-pill {
          font-size: 9px;
          padding: 5px 8px;
          border-radius: 20px;
          background: #ecfdf5;
          color: #15803d;
          white-space: nowrap;
        }

        /* =========================
           EMPTY STATE
        ========================= */

        .ts-empty {
          text-align: center;
          padding: 35px 20px;
        }

        .ts-empty-icon {
          font-size: 35px;
          margin-bottom: 10px;
        }

        .ts-empty h4 {
          margin: 0;
          font-size: 14px;
        }

        .ts-empty p {
          color: #64748b;
          font-size: 11px;
          margin: 6px 0 15px;
        }

        .ts-primary {
          border: 0;
          background: #4f46e5;
          color: white;
          padding: 10px 15px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .ts-primary:hover {
          background: #4338ca;
        }

        /* =========================
           QUICK ACTIONS
        ========================= */

        .ts-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 18px;
        }

        .ts-action {
          border: 1px solid #e2e8f0;
          background: #fff;
          border-radius: 13px;
          padding: 15px 12px;
          text-align: left;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .ts-action:hover {
          border-color: #c7d2fe;
          background: #f8faff;
          transform: translateY(-2px);
        }

        .ts-action-icon {
          font-size: 22px;
          display: block;
          margin-bottom: 8px;
        }

        .ts-action-title {
          font-size: 12px;
          font-weight: 700;
        }

        .ts-action-sub {
          display: block;
          font-size: 9px;
          color: #64748b;
          margin-top: 3px;
        }

        /* =========================
           SECURITY PANEL
        ========================= */

        .ts-security-panel {
          margin-top: 14px;
          padding: 17px;
          border-radius: 14px;
          background:
            linear-gradient(
              135deg,
              #ecfdf5,
              #f0fdf4
            );
          border: 1px solid #bbf7d0;
        }

        .ts-security-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #166534;
        }

        .ts-security-panel p {
          color: #166534;
          font-size: 10px;
          line-height: 1.5;
          margin: 8px 0 0;
        }

        .ts-security-list {
          margin-top: 12px;
          display: grid;
          gap: 7px;
        }

        .ts-security-item {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #166534;
        }

        .ts-check {
          font-weight: 800;
        }

        /* =========================
           LOADING
        ========================= */

        .ts-loading {
          padding: 50px;
          text-align: center;
          color: #64748b;
        }

        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 1000px) {

          .ts-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .ts-content-grid {
            grid-template-columns: 1fr;
          }

        }

        @media (max-width: 760px) {

          .ts-dashboard {
            display: block;
          }

          .ts-sidebar {
            width: 100%;
            min-height: auto;
            height: auto;
            position: relative;
            padding: 14px;
          }

          .ts-brand {
            padding-bottom: 15px;
          }

          .ts-nav {
            flex-direction: row;
            overflow-x: auto;
          }

          .ts-nav button {
            white-space: nowrap;
          }

          .ts-sidebar-bottom {
            display: none;
          }

          .ts-main {
            padding: 20px 15px;
          }

          .ts-header {
            align-items: flex-start;
          }

          .ts-profile {
            display: none;
          }

          .ts-hero {
            padding: 22px;
          }

          .ts-hero-lock {
            width: 58px;
            height: 58px;
            font-size: 27px;
          }

        }

        @media (max-width: 500px) {

          .ts-stats {
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .ts-stat {
            padding: 14px;
          }

          .ts-stat-value {
            font-size: 21px;
          }

          .ts-hero h2 {
            font-size: 19px;
          }

          .ts-actions {
            grid-template-columns: 1fr 1fr;
          }

          .ts-encrypted-pill {
            display: none;
          }

        }

      `}</style>

      {/* =========================
          SIDEBAR
      ========================= */}

      <aside className="ts-sidebar">

        <div className="ts-brand">

          <div className="ts-logo">
            T
          </div>

          <div>
            <h2>TrustShare</h2>
            <small>
              SECURE COLLABORATION
            </small>
          </div>

        </div>

        <nav className="ts-nav">

          <button
            className="ts-active"
            onClick={() => navigate("/dashboard")}
          >
            🏠 Dashboard
          </button>

          <button
            onClick={() => navigate("/files")}
          >
            📁 My Files
          </button>

          <button
            onClick={() => navigate("/upload")}
          >
            ⬆️ Upload File
          </button>

          <button
            onClick={() => navigate("/shared")}
          >
            🔗 Shared Files
          </button>

        </nav>

        <div className="ts-sidebar-bottom">

          <div className="ts-security-mini">

            <div className="ts-security-mini-title">
              SECURITY STATUS
            </div>

            <div className="ts-security-mini-status">

              <span className="ts-green-dot"></span>

              System Protected

            </div>

          </div>

          <button
            className="ts-logout"
            onClick={handleLogout}
          >
            ↪ Logout
          </button>

        </div>

      </aside>

      {/* =========================
          MAIN
      ========================= */}

      <main className="ts-main">

        {/* HEADER */}

        <header className="ts-header">

          <div>

            <h1>
              Welcome back,{" "}
              {user?.username || "User"} 👋
            </h1>

            <p>
              Your secure workspace is ready.
              Manage, protect and share your files.
            </p>

          </div>

          {/* CLICKABLE PROFILE */}

          <div
            className="ts-profile"
            onClick={handleLogout}
            title="Click to logout"
          >

            <div className="ts-avatar">

              {(user?.username || "U")
                .charAt(0)
                .toUpperCase()}

            </div>

            <div>

              <div className="ts-profile-name">
                {user?.username || "User"}
              </div>

              <div className="ts-profile-email">
                {user?.email || "user@example.com"}
              </div>

            </div>

            <span className="ts-profile-logout">
              ↪
            </span>

          </div>

        </header>

        {/* =========================
            CONTENT
        ========================= */}

        {loading ? (

          <div className="ts-panel ts-loading">
            🔐 Securing your workspace...
          </div>

        ) : (

          <>

            {/* SECURITY HERO */}

            <section className="ts-hero">

              <div className="ts-hero-content">

                <div className="ts-hero-badge">

                  <span>●</span>

                  PROTECTION ACTIVE

                </div>

                <h2>
                  Your files are protected 🔐
                </h2>

                <p>
                  AES-256-GCM encryption ·
                  Secure cloud storage ·
                  Controlled access
                </p>

              </div>

              <div className="ts-hero-lock">
                🔒
              </div>

            </section>

            {/* STATS */}

            <section className="ts-stats">

              <div
                className="ts-stat"
                onClick={() => navigate("/files")}
              >

                <div className="ts-stat-top">
                  <span className="ts-stat-icon">
                    📁
                  </span>
                </div>

                <div className="ts-stat-label">
                  TOTAL FILES
                </div>

                <div className="ts-stat-value">
                  {files.length}
                </div>

                <div className="ts-stat-note">
                  Your uploaded files
                </div>

              </div>

              <div
                className="ts-stat"
                onClick={() => navigate("/shared")}
              >

                <div className="ts-stat-top">
                  <span className="ts-stat-icon">
                    🔗
                  </span>
                </div>

                <div className="ts-stat-label">
                  SHARED WITH YOU
                </div>

                <div className="ts-stat-value">
                  {sharedFiles.length}
                </div>

                <div className="ts-stat-note">
                  Active shared files
                </div>

              </div>

              <div className="ts-stat">

                <div className="ts-stat-top">
                  <span className="ts-stat-icon">
                    🔐
                  </span>
                </div>

                <div className="ts-stat-label">
                  ENCRYPTED FILES
                </div>

                <div className="ts-stat-value">
                  {encryptedFiles.length}
                </div>

                <div className="ts-stat-note">
                  AES-256-GCM protected
                </div>

              </div>

              <div className="ts-stat">

                <div className="ts-stat-top">
                  <span className="ts-stat-icon">
                    🛡️
                  </span>
                </div>

                <div className="ts-stat-label">
                  SECURITY
                </div>

                <div className="ts-stat-value">
                  Active
                </div>

                <div className="ts-stat-note">
                  ✓ Protection enabled
                </div>

              </div>

            </section>

            {/* CONTENT GRID */}

            <section className="ts-content-grid">

              {/* RECENT FILES */}

              <div className="ts-panel">

                <div className="ts-panel-header">

                  <div>

                    <h3>
                      Recent Files
                    </h3>

                    <p>
                      Your latest encrypted files
                    </p>

                  </div>

                  <button
                    className="ts-view-all"
                    onClick={() => navigate("/files")}
                  >
                    View all →
                  </button>

                </div>

                {files.length === 0 ? (

                  <div className="ts-empty">

                    <div className="ts-empty-icon">
                      📂
                    </div>

                    <h4>
                      No files yet
                    </h4>

                    <p>
                      Upload your first file
                      to start using TrustShare.
                    </p>

                    <button
                      className="ts-primary"
                      onClick={() => navigate("/upload")}
                    >
                      ⬆ Upload File
                    </button>

                  </div>

                ) : (

                  <div className="ts-file-list">

                    {files
                      .slice(0, 5)
                      .map((file, index) => (

                        <div
                          className="ts-file"
                          key={
                            file.storage_path ||
                            index
                          }
                        >

                          <div className="ts-file-icon">
                            📄
                          </div>

                          <div className="ts-file-info">

                            <div className="ts-file-name">
                              {file.filename}
                            </div>

                            <div className="ts-file-meta">
                              {formatSize(file.size)}
                              {" · "}
                              Uploaded file
                            </div>

                          </div>

                          {file.encrypted && (

                            <span className="ts-encrypted-pill">
                              🔐 Encrypted
                            </span>

                          )}

                        </div>

                      ))}

                  </div>

                )}

              </div>

              {/* RIGHT COLUMN */}

              <div>

                {/* QUICK ACTIONS */}

                <div className="ts-panel">

                  <div className="ts-panel-header">

                    <div>

                      <h3>
                        Quick Actions
                      </h3>

                      <p>
                        Jump into your workspace
                      </p>

                    </div>

                  </div>

                  <div className="ts-actions">

                    <button
                      className="ts-action"
                      onClick={() =>
                        navigate("/upload")
                      }
                    >

                      <span className="ts-action-icon">
                        ⬆️
                      </span>

                      <span className="ts-action-title">
                        Upload
                      </span>

                      <span className="ts-action-sub">
                        Encrypt a new file
                      </span>

                    </button>

                    <button
                      className="ts-action"
                      onClick={() =>
                        navigate("/files")
                      }
                    >

                      <span className="ts-action-icon">
                        📁
                      </span>

                      <span className="ts-action-title">
                        My Files
                      </span>

                      <span className="ts-action-sub">
                        Manage your files
                      </span>

                    </button>

                    <button
                      className="ts-action"
                      onClick={() =>
                        navigate("/shared")
                      }
                    >

                      <span className="ts-action-icon">
                        🔗
                      </span>

                      <span className="ts-action-title">
                        Shared
                      </span>

                      <span className="ts-action-sub">
                        View shared files
                      </span>

                    </button>

                    <button
                      className="ts-action"
                      onClick={() =>
                        navigate("/upload")
                      }
                    >

                      <span className="ts-action-icon">
                        🛡️
                      </span>

                      <span className="ts-action-title">
                        Secure Upload
                      </span>

                      <span className="ts-action-sub">
                        AES-256 protected
                      </span>

                    </button>

                  </div>

                </div>

                {/* SECURITY PANEL */}

                <div className="ts-security-panel">

                  <div className="ts-security-title">
                    🛡️ TrustShare Security
                  </div>

                  <p>
                    Your uploaded files are encrypted
                    before being stored in cloud storage.
                  </p>

                  <div className="ts-security-list">

                    <div className="ts-security-item">
                      <span>
                        AES-256-GCM Encryption
                      </span>

                      <span className="ts-check">
                        ✓
                      </span>
                    </div>

                    <div className="ts-security-item">
                      <span>
                        Encrypted Cloud Storage
                      </span>

                      <span className="ts-check">
                        ✓
                      </span>
                    </div>

                    <div className="ts-security-item">
                      <span>
                        Access Control
                      </span>

                      <span className="ts-check">
                        ✓
                      </span>
                    </div>

                    <div className="ts-security-item">
                      <span>
                        Share Expiration
                      </span>

                      <span className="ts-check">
                        ✓
                      </span>
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