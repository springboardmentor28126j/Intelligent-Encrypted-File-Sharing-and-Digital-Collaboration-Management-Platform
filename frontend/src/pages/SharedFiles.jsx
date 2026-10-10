import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function SharedFiles() {
  const navigate = useNavigate();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");
  const [search, setSearch] = useState("");

  const token = localStorage.getItem("access_token");
  const user = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    const fetchSharedFiles = async () => {
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const response = await axios.get(
          `${API_URL}/share/received`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setFiles(response.data.files || []);
      } catch (err) {
        console.error("Failed to load shared files:", err);

        if (err.response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user");
          navigate("/login");
        } else {
          setError("Failed to load shared files.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSharedFiles();
  }, [token, navigate]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const getFilename = (storagePath) => {
    if (!storagePath) {
      return "Unknown file";
    }

    const storedName = storagePath.split("/").pop();

    const parts = storedName.split("_");

    return parts.length > 1
      ? parts.slice(1).join("_")
      : storedName;
  };

  const getFileIcon = (filename) => {
    const extension = filename?.split(".").pop()?.toLowerCase();

    const icons = {
      pdf: "📕",
      doc: "📘",
      docx: "📘",
      txt: "📄",
      xls: "📗",
      xlsx: "📗",
      csv: "📊",
      ppt: "📙",
      pptx: "📙",
      jpg: "🖼️",
      jpeg: "🖼️",
      png: "🖼️",
      gif: "🖼️",
      zip: "🗜️",
      rar: "🗜️",
      js: "💻",
      jsx: "💻",
      py: "🐍",
      html: "🌐",
      css: "🎨",
    };

    return icons[extension] || "📄";
  };

  const getExpirationText = (expiresAt) => {
    if (!expiresAt) {
      return "Permanent";
    }

    const expiration = new Date(expiresAt);
    const now = new Date();

    if (expiration <= now) {
      return "Expired";
    }

    const difference = expiration.getTime() - now.getTime();

    const hours = Math.floor(
      difference / (1000 * 60 * 60)
    );

    if (hours < 1) {
      const minutes = Math.floor(
        difference / (1000 * 60)
      );

      return `${Math.max(minutes, 1)} min left`;
    }

    if (hours < 24) {
      return `${hours} hr${hours === 1 ? "" : "s"} left`;
    }

    const days = Math.floor(hours / 24);

    return `${days} day${days === 1 ? "" : "s"} left`;
  };

  const handleDownload = async (file) => {
    if (!token) {
      navigate("/login");
      return;
    }

    if (file.permission !== "download") {
      alert(
        "Download permission has not been granted for this file."
      );
      return;
    }

    try {
      setDownloading(file.share_id);

      const response = await axios.get(
        `${API_URL}/share/download/${file.share_id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;
      link.download = getFilename(file.storage_path);

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(
        "Shared file download failed:",
        err
      );

      if (err.response?.status === 403) {
        alert(
          "Access denied. The shared file may have expired or been revoked."
        );
      } else if (err.response?.status === 401) {
        alert(
          "Your login session has expired. Please login again."
        );

        localStorage.removeItem("access_token");
        localStorage.removeItem("user");

        navigate("/login");
      } else {
        alert("Failed to download the shared file.");
      }
    } finally {
      setDownloading("");
    }
  };

  const filteredFiles = files.filter((file) =>
    getFilename(file.storage_path)
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const downloadCount = files.filter(
    (file) => file.permission === "download"
  ).length;

  const viewOnlyCount = files.filter(
    (file) => file.permission === "view"
  ).length;

  if (loading) {
    return (
      <div className="ts-loading-page">
        <style>{`
          .ts-loading-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8fafc;
            font-family: Inter, system-ui, sans-serif;
            color: #475569;
          }

          .ts-loading-box {
            text-align: center;
          }

          .ts-spinner {
            width: 45px;
            height: 45px;
            border: 4px solid #e2e8f0;
            border-top-color: #6366f1;
            border-radius: 50%;
            animation: ts-spin 0.8s linear infinite;
            margin: 0 auto 16px;
          }

          @keyframes ts-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>

        <div className="ts-loading-box">
          <div className="ts-spinner"></div>
          <strong>Loading shared files...</strong>
          <div style={{
            marginTop: "6px",
            fontSize: "11px",
            color: "#94a3b8"
          }}>
            Checking your secure access
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ts-shared-page">

      <style>{`
        * {
          box-sizing: border-box;
        }

        .ts-shared-page {
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
          background: rgba(255,255,255,0.09);
          color: white;
          transform: translateX(2px);
        }

        .ts-nav button.ts-active {
          box-shadow: inset 3px 0 0 #818cf8;
        }

        .ts-sidebar-bottom {
          margin-top: auto;
        }

        .ts-security-mini {
          padding: 15px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
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
            0 0 10px rgba(34,197,94,0.7);
        }

        .ts-logout {
          width: 100%;
        }

        .ts-logout:hover {
          background: rgba(239,68,68,0.12);
          color: #fca5a5;
        }

        /* =========================
           MAIN
        ========================= */

        .ts-shared-main {
          flex: 1;
          min-width: 0;
          padding: 35px;
        }

        .ts-top-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 28px;
        }

        .ts-title-area h1 {
          margin: 0;
          font-size: clamp(25px, 3vw, 34px);
          letter-spacing: -1px;
        }

        .ts-title-area p {
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
          background: rgba(255,255,255,0.85);
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
            0 8px 20px rgba(15,23,42,0.08);
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
        }

        .ts-profile:hover .ts-profile-logout {
          color: #ef4444;
        }

        /* =========================
           HERO
        ========================= */

        .ts-shared-hero {
          background:
            linear-gradient(
              135deg,
              #312e81,
              #4f46e5 55%,
              #7c3aed
            );
          border-radius: 22px;
          padding: 26px 28px;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          position: relative;
          overflow: hidden;
          margin-bottom: 22px;
          box-shadow:
            0 15px 35px rgba(79,70,229,0.20);
        }

        .ts-shared-hero::after {
          content: "";
          position: absolute;
          width: 210px;
          height: 210px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 50%;
          right: 90px;
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
          padding: 6px 10px;
          border-radius: 20px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.16);
          font-size: 10px;
          margin-bottom: 10px;
        }

        .ts-shared-hero h2 {
          margin: 0;
          font-size: 22px;
        }

        .ts-shared-hero p {
          margin: 6px 0 0;
          color: #ddd6fe;
          font-size: 12px;
        }

        .ts-hero-icon {
          width: 72px;
          height: 72px;
          border-radius: 21px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
          background: rgba(255,255,255,0.11);
          border: 1px solid rgba(255,255,255,0.16);
          position: relative;
          z-index: 1;
        }

        /* =========================
           STATS
        ========================= */

        .ts-shared-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }

        .ts-stat {
          background: rgba(255,255,255,0.86);
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 17px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: 0.2s ease;
        }

        .ts-stat:hover {
          transform: translateY(-2px);
          border-color: #c7d2fe;
          box-shadow:
            0 10px 25px rgba(15,23,42,0.06);
        }

        .ts-stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          background: #eef2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .ts-stat-label {
          color: #94a3b8;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        .ts-stat-value {
          margin-top: 3px;
          font-size: 18px;
          font-weight: 750;
        }

        /* =========================
           TOOLBAR
        ========================= */

        .ts-toolbar {
          background: rgba(255,255,255,0.88);
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 12px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .ts-search {
          flex: 1;
          position: relative;
        }

        .ts-search-icon {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 13px;
        }

        .ts-search input {
          width: 100%;
          height: 40px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0 13px 0 36px;
          outline: none;
          font-size: 11px;
          background: #f8fafc;
        }

        .ts-search input:focus {
          border-color: #a5b4fc;
          background: white;
          box-shadow:
            0 0 0 3px rgba(99,102,241,0.08);
        }

        .ts-result-count {
          color: #64748b;
          font-size: 10px;
          white-space: nowrap;
        }

        /* =========================
           ERROR
        ========================= */

        .ts-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 13px 16px;
          border-radius: 12px;
          margin-bottom: 18px;
          font-size: 11px;
        }

        /* =========================
           FILE LIST
        ========================= */

        .ts-file-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ts-file-row {
          background: rgba(255,255,255,0.9);
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 15px 17px;
          display: grid;
          grid-template-columns:
            minmax(220px, 1.6fr)
            135px
            150px
            180px;
          align-items: center;
          gap: 15px;
          box-shadow:
            0 5px 18px rgba(15,23,42,0.03);
          transition: 0.2s ease;
        }

        .ts-file-row:hover {
          transform: translateY(-1px);
          border-color: #c7d2fe;
          box-shadow:
            0 10px 25px rgba(15,23,42,0.06);
        }

        .ts-file-main {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .ts-file-icon {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          border-radius: 12px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
        }

        .ts-file-info {
          min-width: 0;
        }

        .ts-file-name {
          font-size: 12px;
          font-weight: 720;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ts-file-path {
          margin-top: 4px;
          color: #94a3b8;
          font-size: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* =========================
           META
        ========================= */

        .ts-meta-label {
          color: #94a3b8;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ts-meta-value {
          margin-top: 5px;
          font-size: 10px;
          font-weight: 650;
        }

        /* =========================
           PERMISSIONS
        ========================= */

        .ts-permission {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 9px;
          border-radius: 8px;
          font-size: 8px;
          font-weight: 700;
        }

        .ts-permission-download {
          background: #ecfdf5;
          color: #15803d;
        }

        .ts-permission-view {
          background: #fff7ed;
          color: #c2410c;
        }

        .ts-expiration-active {
          color: #475569;
        }

        .ts-expiration-never {
          color: #15803d;
        }

        /* =========================
           ACTION
        ========================= */

        .ts-action {
          display: flex;
          justify-content: flex-end;
        }

        .ts-download {
          border: 1px solid #e0e7ff;
          background: #eef2ff;
          color: #4f46e5;
          padding: 9px 12px;
          border-radius: 9px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
          transition: 0.2s ease;
        }

        .ts-download:hover:not(:disabled) {
          background: #e0e7ff;
          transform: translateY(-1px);
        }

        .ts-download:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .ts-view-only {
          padding: 9px 12px;
          border-radius: 9px;
          background: #f8fafc;
          color: #94a3b8;
          border: 1px solid #e2e8f0;
          font-size: 9px;
          font-weight: 650;
        }

        /* =========================
           EMPTY
        ========================= */

        .ts-empty {
          background: rgba(255,255,255,0.88);
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 70px 25px;
          text-align: center;
        }

        .ts-empty-icon {
          font-size: 48px;
          margin-bottom: 13px;
        }

        .ts-empty h2 {
          margin: 0;
          font-size: 18px;
        }

        .ts-empty p {
          margin: 7px 0 0;
          color: #94a3b8;
          font-size: 11px;
        }

        /* =========================
           FOOTER
        ========================= */

        .ts-footer {
          text-align: center;
          color: #94a3b8;
          font-size: 9px;
          margin-top: 22px;
        }

        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 1050px) {

          .ts-file-row {
            grid-template-columns: 1fr 1fr;
          }

          .ts-action {
            justify-content: flex-start;
          }
        }

        @media (max-width: 760px) {

          .ts-shared-page {
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

          .ts-shared-main {
            padding: 20px 15px;
          }

          .ts-top-header {
            align-items: flex-start;
          }

          .ts-profile {
            display: none;
          }

          .ts-shared-hero {
            padding: 22px;
          }

          .ts-hero-icon {
            width: 58px;
            height: 58px;
            font-size: 27px;
          }

          .ts-shared-stats {
            grid-template-columns: 1fr;
          }

          .ts-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .ts-file-row {
            grid-template-columns: 1fr;
          }

          .ts-action {
            justify-content: flex-start;
          }
        }

        @media (max-width: 500px) {

          .ts-shared-hero h2 {
            font-size: 19px;
          }

          .ts-file-row {
            padding: 14px;
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
            className="ts-active"
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

      <main className="ts-shared-main">

        {/* HEADER */}

        <header className="ts-top-header">

          <div className="ts-title-area">

            <h1>
              Shared Files 🔗
            </h1>

            <p>
              Files securely shared with your account.
            </p>

          </div>

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

        {/* ERROR */}

        {error && (
          <div className="ts-error">
            ❌ {error}
          </div>
        )}

        {/* HERO */}

        <section className="ts-shared-hero">

          <div className="ts-hero-content">

            <div className="ts-hero-badge">
              <span>●</span>
              SECURE SHARED ACCESS
            </div>

            <h2>
              Files shared with you 🔐
            </h2>

            <p>
              Access-controlled files protected by TrustShare.
            </p>

          </div>

          <div className="ts-hero-icon">
            🔗
          </div>

        </section>

        {/* STATS */}

        <section className="ts-shared-stats">

          <div className="ts-stat">

            <div className="ts-stat-icon">
              🔗
            </div>

            <div>

              <div className="ts-stat-label">
                Shared With You
              </div>

              <div className="ts-stat-value">
                {files.length}
              </div>

            </div>

          </div>

          <div className="ts-stat">

            <div className="ts-stat-icon">
              ⬇️
            </div>

            <div>

              <div className="ts-stat-label">
                Download Access
              </div>

              <div className="ts-stat-value">
                {downloadCount}
              </div>

            </div>

          </div>

          <div className="ts-stat">

            <div className="ts-stat-icon">
              👁️
            </div>

            <div>

              <div className="ts-stat-label">
                View Only
              </div>

              <div className="ts-stat-value">
                {viewOnlyCount}
              </div>

            </div>

          </div>

        </section>

        {/* SEARCH */}

        {files.length > 0 && (

          <div className="ts-toolbar">

            <div className="ts-search">

              <span className="ts-search-icon">
                🔎
              </span>

              <input
                type="text"
                placeholder="Search shared files..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />

            </div>

            <div className="ts-result-count">
              Showing {filteredFiles.length} of{" "}
              {files.length} files
            </div>

          </div>

        )}

        {/* EMPTY */}

        {!error &&
          files.length === 0 && (

            <div className="ts-empty">

              <div className="ts-empty-icon">
                🔗
              </div>

              <h2>
                No shared files yet
              </h2>

              <p>
                Files shared with your account
                will appear here.
              </p>

            </div>

          )}

        {/* NO SEARCH RESULTS */}

        {!error &&
          files.length > 0 &&
          filteredFiles.length === 0 && (

            <div className="ts-empty">

              <div className="ts-empty-icon">
                🔎
              </div>

              <h2>
                No matching files
              </h2>

              <p>
                Try searching with another file name.
              </p>

            </div>

          )}

        {/* FILE LIST */}

        {filteredFiles.length > 0 && (

          <div className="ts-file-list">

            {filteredFiles.map((file) => {

              const filename =
                getFilename(file.storage_path);

              const isDownloading =
                downloading === file.share_id;

              const expirationText =
                getExpirationText(file.expires_at);

              return (

                <div
                  className="ts-file-row"
                  key={file.share_id}
                >

                  {/* FILE */}

                  <div className="ts-file-main">

                    <div className="ts-file-icon">
                      {getFileIcon(filename)}
                    </div>

                    <div className="ts-file-info">

                      <div className="ts-file-name">
                        {filename}
                      </div>

                      <div className="ts-file-path">
                        {file.storage_path}
                      </div>

                    </div>

                  </div>

                  {/* PERMISSION */}

                  <div>

                    <div className="ts-meta-label">
                      Permission
                    </div>

                    <div className="ts-meta-value">

                      {file.permission === "download" ? (

                        <span
                          className="
                            ts-permission
                            ts-permission-download
                          "
                        >
                          ⬇ Download
                        </span>

                      ) : (

                        <span
                          className="
                            ts-permission
                            ts-permission-view
                          "
                        >
                          👁 View Only
                        </span>

                      )}

                    </div>

                  </div>

                  {/* EXPIRATION */}

                  <div>

                    <div className="ts-meta-label">
                      Access
                    </div>

                    <div
                      className={
                        `ts-meta-value ${
                          file.expires_at
                            ? "ts-expiration-active"
                            : "ts-expiration-never"
                        }`
                      }
                    >
                      {file.expires_at
                        ? `⏰ ${expirationText}`
                        : "∞ Permanent"}
                    </div>

                  </div>

                  {/* ACTION */}

                  <div className="ts-action">

                    {file.permission === "download" ? (

                      <button
                        className="ts-download"
                        onClick={() =>
                          handleDownload(file)
                        }
                        disabled={isDownloading}
                      >
                        {isDownloading
                          ? "⏳ Downloading..."
                          : "⬇ Download File"}
                      </button>

                    ) : (

                      <div className="ts-view-only">
                        👁 View permission only
                      </div>

                    )}

                  </div>

                </div>

              );
            })}

          </div>

        )}

        {/* FOOTER */}

        <div className="ts-footer">
          🔒 Shared files remain protected by
          TrustShare access controls
        </div>

      </main>

    </div>
  );
}

export default SharedFiles;