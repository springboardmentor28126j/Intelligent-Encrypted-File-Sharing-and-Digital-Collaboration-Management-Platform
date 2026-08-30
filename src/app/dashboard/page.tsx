"use client";

import { useEffect, useState, useRef, ChangeEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCurrentUser,
  logoutUser,
  listFiles,
  getFileStats,
  uploadFile,
  downloadFile,
  deleteFile,
  createShareLink,
  revokeShareLink,
  getFileDetails,
  getSystemHealth,
  UserOut,
  FileSummary,
  StorageStats,
  FileMetadata,
  HealthStatus,
  ShareDuration,
  SharePermission,
} from "@/lib/api";

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const CATEGORY_ICONS: Record<string, string> = {
  pdf: "📕",
  document: "📄",
  image: "🖼️",
  spreadsheet: "📊",
  presentation: "📽️",
  archive: "🗄️",
  other: "📁",
};

export default function DashboardPage() {
  const router = useRouter();

  // User & System state
  const [user, setUser] = useState<UserOut | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Files & Stats state
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [fileDescription, setFileDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [selectedFileForShare, setSelectedFileForShare] = useState<FileMetadata | null>(null);
  const [shareDuration, setShareDuration] = useState<ShareDuration>("24h");
  const [sharePermission, setSharePermission] = useState<SharePermission>("can_download");
  const [generatedShareUrl, setGeneratedShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);

  const [detailsModalFile, setDetailsModalFile] = useState<FileMetadata | null>(null);
  const [deleteModalFile, setDeleteModalFile] = useState<FileSummary | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // ── Initial Load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
        await refreshAllData();
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  // Periodic health check & filter query trigger
  useEffect(() => {
    if (user) {
      fetchFilesOnly();
    }
  }, [searchTerm, selectedCategory]);

  const refreshAllData = async () => {
    setRefreshing(true);
    try {
      const [filesData, statsData, healthData] = await Promise.all([
        listFiles(searchTerm, selectedCategory),
        getFileStats(),
        getSystemHealth().catch(() => null),
      ]);
      setFiles(filesData);
      setStats(statsData);
      if (healthData) setHealth(healthData);
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchFilesOnly = async () => {
    try {
      const filesData = await listFiles(searchTerm, selectedCategory);
      setFiles(filesData);
    } catch (e) {
      console.error(e);
    }
  };

  // ── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logoutUser();
    router.push("/login");
  };

  // ── Upload Handlers ─────────────────────────────────────────────────────────
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processUpload(e.target.files[0]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const processUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(null);

    // Client-side quick size validation (50MB)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File exceeds the maximum allowed size of 50MB.");
      setUploading(false);
      return;
    }

    try {
      const uploaded = await uploadFile(file, fileDescription, (percent) => {
        setUploadProgress(percent);
      });
      setUploadSuccess(`"${uploaded.original_name}" uploaded and encrypted successfully!`);
      setFileDescription("");
      await refreshAllData();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ── Download Handler ────────────────────────────────────────────────────────
  const handleDownload = async (file: FileSummary) => {
    try {
      await downloadFile(file.id, file.original_name);
      // update list to reflect incremented download count
      await refreshAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Download failed.");
    }
  };

  // ── Delete Handler ──────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteModalFile) return;
    setDeletingLoading(true);
    try {
      await deleteFile(deleteModalFile.id);
      setDeleteModalFile(null);
      await refreshAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingLoading(false);
    }
  };

  // ── Share Handlers ──────────────────────────────────────────────────────────
  const openShareModal = async (fileSummary: FileSummary) => {
    setGeneratedShareUrl(null);
    setCopied(false);
    try {
      const fullMeta = await getFileDetails(fileSummary.id);
      setSelectedFileForShare(fullMeta);
    } catch {
      alert("Could not load file share details.");
    }
  };

  const handleGenerateShare = async () => {
    if (!selectedFileForShare) return;
    setSharingLoading(true);
    try {
      const shareRes = await createShareLink(selectedFileForShare.id, {
        duration: shareDuration,
        permission: sharePermission,
      });

      const fullUrl = `${window.location.origin}${shareRes.share_url}`;
      setGeneratedShareUrl(fullUrl);

      // Refresh modal's file shares
      const updatedMeta = await getFileDetails(selectedFileForShare.id);
      setSelectedFileForShare(updatedMeta);
      await refreshAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create share link.");
    } finally {
      setSharingLoading(false);
    }
  };

  const handleRevokeShare = async (shareToken: string) => {
    if (!selectedFileForShare) return;
    try {
      await revokeShareLink(selectedFileForShare.id, shareToken);
      const updatedMeta = await getFileDetails(selectedFileForShare.id);
      setSelectedFileForShare(updatedMeta);
      if (generatedShareUrl?.includes(shareToken)) {
        setGeneratedShareUrl(null);
      }
      await refreshAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to revoke share link.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Details Modal ───────────────────────────────────────────────────────────
  const openDetailsModal = async (fileSummary: FileSummary) => {
    try {
      const fullMeta = await getFileDetails(fileSummary.id);
      setDetailsModalFile(fullMeta);
    } catch (e) {
      alert("Could not load file metadata.");
    }
  };

  // ── Loading Screen ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-center">
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 1rem", borderWidth: 3 }} />
          <p className="text-muted">Loading secure workspace…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ── UI Render ───────────────────────────────────────────────────────────────
  return (
    <div className="container" style={{ paddingTop: "1.5rem", paddingBottom: "5rem" }}>
      {/* ── Top Navigation Bar ────────────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 0",
          borderBottom: "1px solid var(--color-border)",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <Link href="/" className="logo">
            <span className="logo-icon">🛡️</span>
            <span className="logo-text">TrustShare</span>
          </Link>

          {/* System Health Indicators */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <div className={`health-pill ${health?.postgres.connected ? "healthy" : "resilient"}`} title="PostgreSQL User & Role DB">
              <span className="health-dot" />
              <span>PostgreSQL</span>
            </div>
            <div className={`health-pill ${health?.mongodb.connected ? "healthy" : "resilient"}`} title="MongoDB File Metadata Storage">
              <span className="health-dot" />
              <span>MongoDB</span>
            </div>
            <div className={`health-pill ${health?.redis.connected ? "healthy" : "resilient"}`} title="Redis Token Blacklist & Cache">
              <span className="health-dot" />
              <span>Redis</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span className={`badge badge-${user.role}`}>
            {user.role === "admin" ? "⚙️ Admin" : "👤 User"}
          </span>
          <span className="text-muted" style={{ fontSize: "var(--font-size-sm)" }}>
            {user.email}
          </span>
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* ── Storage Analytics Metric Cards ─────────────────────────────────── */}
      <div
        className="stagger-children"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
          marginBottom: "2rem",
        }}
      >
        <div className="card" style={{ padding: "1.5rem" }}>
          <div className="text-muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>
            📁 Total Files
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800 }}>{stats?.total_files || 0}</div>
          <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
            Stored in MongoDB & disk
          </div>
        </div>

        <div className="card" style={{ padding: "1.5rem" }}>
          <div className="text-muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>
            💾 Storage Consumption
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--color-brand-accent)" }}>
            {formatBytes(stats?.total_bytes || 0)}
          </div>
          <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
            {stats?.total_storage_mb || 0} MB utilized
          </div>
        </div>

        <div className="card" style={{ padding: "1.5rem" }}>
          <div className="text-muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>
            🔗 Active Shares
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--color-brand-primary)" }}>
            {stats?.active_shares || 0}
          </div>
          <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
            Public links generated
          </div>
        </div>

        <div className="card" style={{ padding: "1.5rem" }}>
          <div className="text-muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>
            🔒 Security Level
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--color-success)", marginTop: "0.35rem" }}>
            Active & Verified
          </div>
          <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
            SHA-256 + Redis Revocation
          </div>
        </div>
      </div>

      {/* ── Secure File Upload Section ──────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: "2.5rem", padding: "1.75rem" }}>
        <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>📤</span> Secure File Upload
        </h2>

        {/* Upload feedback alerts */}
        {uploadSuccess && (
          <div className="alert alert-success animate-fade-in" style={{ marginBottom: "1rem" }}>
            <span>✓</span>
            <span>{uploadSuccess}</span>
          </div>
        )}
        {uploadError && (
          <div className="alert alert-error animate-fade-in" style={{ marginBottom: "1rem" }}>
            <span>✕</span>
            <span>{uploadError}</span>
          </div>
        )}

        {/* Drag & Drop Dropzone */}
        <div
          id="file-dropzone"
          className={`dropzone ${isDragging ? "drag-active" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            style={{ display: "none" }}
            disabled={uploading}
          />
          <div className="dropzone-icon">☁️</div>
          <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, marginBottom: "0.25rem" }}>
            {uploading ? "Uploading & Encrypting File…" : "Drag and drop your file here, or click to browse"}
          </h3>
          <p className="text-muted" style={{ fontSize: "var(--font-size-xs)" }}>
            Supports PDF, DOCX, Images (PNG/JPG/WEBP), Spreadsheets, Archives up to 50MB
          </p>

          {/* Progress Bar */}
          {uploading && (
            <div style={{ maxWidth: 400, margin: "1.5rem auto 0" }}>
              <div className="progress-container">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--color-brand-primary)" }}>
                <span>Streaming & calculating SHA-256 checksum…</span>
                <span>{uploadProgress}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── File Management & Search Toolbar ────────────────────────────────── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: 700 }}>
            File Repository ({files.length})
          </h2>

          {/* Search Box */}
          <div style={{ display: "flex", gap: "0.75rem", flex: "1 1 300px", maxWidth: "450px" }}>
            <input
              id="file-search-input"
              type="text"
              className="form-input"
              placeholder="🔍 Search files by name, type, or notes…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: "0.6rem 1rem", fontSize: "0.9rem" }}
            />
            <button
              onClick={refreshAllData}
              className="btn btn-secondary"
              title="Refresh files"
              style={{ padding: "0.6rem 1rem", width: "auto" }}
            >
              {refreshing ? "…" : "🔄"}
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All Files" },
            { id: "pdf", label: "📕 PDFs" },
            { id: "document", label: "📄 Documents" },
            { id: "image", label: "🖼️ Images" },
            { id: "spreadsheet", label: "📊 Spreadsheets" },
            { id: "archive", label: "🗄️ Archives" },
          ].map((cat) => (
            <button
              key={cat.id}
              className={`filter-chip ${selectedCategory === cat.id ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Files Table ────────────────────────────────────────────────────── */}
      <div className="data-table-container">
        {files.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 1.5rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📭</div>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "0.5rem" }}>
              No files found
            </h3>
            <p className="text-muted" style={{ fontSize: "var(--font-size-sm)", maxWidth: "400px", margin: "0 auto" }}>
              {searchTerm || selectedCategory !== "all"
                ? "Try clearing your search query or switching categories."
                : "Upload your first file using the dropzone above to start sharing securely."}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Category</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Owner</th>
                <th>Shares</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontSize: "1.4rem" }}>
                        {CATEGORY_ICONS[file.category] || "📁"}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                          {file.original_name}
                        </div>
                        {file.description && (
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                            {file.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`cat-badge cat-${file.category}`}>
                      {file.category}
                    </span>
                  </td>
                  <td style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>
                    {formatBytes(file.file_size)}
                  </td>
                  <td style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                    {new Date(file.upload_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                    {file.owner_email.split("@")[0]}
                  </td>
                  <td>
                    {file.shares_count > 0 ? (
                      <span className="badge badge-admin" style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem" }}>
                        🔗 {file.shares_count} active
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>None</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                      {/* Download */}
                      <button
                        className="action-btn"
                        onClick={() => handleDownload(file)}
                        title="Download file"
                      >
                        📥
                      </button>

                      {/* Share */}
                      <button
                        className="action-btn share"
                        onClick={() => openShareModal(file)}
                        title="Share file"
                      >
                        🔗 Share
                      </button>

                      {/* Details */}
                      <button
                        className="action-btn"
                        onClick={() => openDetailsModal(file)}
                        title="File metadata & hash"
                      >
                        ℹ️
                      </button>

                      {/* Delete */}
                      <button
                        className="action-btn delete"
                        onClick={() => setDeleteModalFile(file)}
                        title="Delete file"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal: Share File ───────────────────────────────────────────────── */}
      {selectedFileForShare && (
        <div className="modal-overlay" onClick={() => setSelectedFileForShare(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedFileForShare(null)}>
              ✕
            </button>
            <h3 style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, marginBottom: "0.25rem" }}>
              Share File
            </h3>
            <p className="text-muted" style={{ fontSize: "var(--font-size-sm)", marginBottom: "1.5rem" }}>
              Generate a secure, time-limited link for &quot;{selectedFileForShare.original_name}&quot;.
            </p>

            {/* Generated Link Feedback Box */}
            {generatedShareUrl && (
              <div
                style={{
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: "var(--radius-md)",
                  padding: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-brand-primary)", marginBottom: "0.5rem", textTransform: "uppercase" }}>
                  Active Share Link
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    readOnly
                    value={generatedShareUrl}
                    className="form-input"
                    style={{ padding: "0.5rem", fontSize: "0.85rem", background: "rgba(0,0,0,0.3)" }}
                  />
                  <button
                    onClick={() => copyToClipboard(generatedShareUrl)}
                    className="btn btn-primary"
                    style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", width: "auto" }}
                  >
                    {copied ? "Copied! ✓" : "Copy Link"}
                  </button>
                </div>
              </div>
            )}

            {/* Duration Selector */}
            <div className="form-group">
              <label className="form-label">Link Expiration</label>
              <select
                className="form-input"
                value={shareDuration}
                onChange={(e) => setShareDuration(e.target.value as ShareDuration)}
                style={{ cursor: "pointer" }}
              >
                <option value="1h">1 Hour</option>
                <option value="24h">24 Hours (Recommended)</option>
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
                <option value="never">Never (Persistent)</option>
              </select>
            </div>

            {/* Permissions Selector */}
            <div className="form-group">
              <label className="form-label">Access Permission</label>
              <select
                className="form-input"
                value={sharePermission}
                onChange={(e) => setSharePermission(e.target.value as SharePermission)}
                style={{ cursor: "pointer" }}
              >
                <option value="can_download">Allow Direct Download</option>
                <option value="view_only">View Only (Restrict Download)</option>
              </select>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateShare}
              disabled={sharingLoading}
              className="btn btn-primary"
              style={{ width: "100%", marginBottom: "1.5rem" }}
            >
              {sharingLoading ? "Generating Secure Token…" : "Generate New Link →"}
            </button>

            {/* Active Shares List */}
            {selectedFileForShare.shares.length > 0 && (
              <div>
                <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-secondary)", marginBottom: "0.75rem" }}>
                  Active Links ({selectedFileForShare.shares.length})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {selectedFileForShare.shares.map((s) => (
                    <div
                      key={s.share_token}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.6rem 0.75rem",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>
                          {s.permission === "can_download" ? "📥 Downloadable" : "👁️ View Only"}
                        </div>
                        <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                          {s.expires_at
                            ? `Expires: ${new Date(s.expires_at).toLocaleString()}`
                            : "Never expires"} • {s.download_count} downloads
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          onClick={() => copyToClipboard(`${window.location.origin}${s.share_url}`)}
                          className="action-btn"
                          title="Copy link"
                        >
                          📋
                        </button>
                        <button
                          onClick={() => handleRevokeShare(s.share_token)}
                          className="action-btn delete"
                          title="Revoke link"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: File Details ─────────────────────────────────────────────── */}
      {detailsModalFile && (
        <div className="modal-overlay" onClick={() => setDetailsModalFile(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setDetailsModalFile(null)}>
              ✕
            </button>
            <h3 style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, marginBottom: "0.25rem" }}>
              File Metadata
            </h3>
            <p className="text-muted" style={{ fontSize: "var(--font-size-sm)", marginBottom: "1.5rem" }}>
              Cryptographic and MongoDB stored properties.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.85rem" }}>
              {[
                { label: "Original Filename", value: detailsModalFile.original_name },
                { label: "File ID (MongoDB)", value: detailsModalFile.id },
                { label: "Storage Key (Disk)", value: detailsModalFile.stored_name },
                { label: "Content Type", value: detailsModalFile.content_type },
                { label: "Exact Size", value: `${detailsModalFile.file_size} bytes (${formatBytes(detailsModalFile.file_size)})` },
                { label: "Owner Email", value: detailsModalFile.owner_email },
                { label: "Total Downloads", value: detailsModalFile.download_count },
                { label: "SHA-256 Checksum", value: detailsModalFile.sha256_hash },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: "0.6rem 0",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <div className="text-muted" style={{ fontSize: "0.75rem", marginBottom: "0.2rem" }}>
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontFamily: item.label.includes("Hash") || item.label.includes("Key") || item.label.includes("ID") ? "monospace" : "inherit",
                      wordBreak: "break-all",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setDetailsModalFile(null)}
              className="btn btn-secondary"
              style={{ width: "100%", marginTop: "1.5rem" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Delete Confirmation ─────────────────────────────────────── */}
      {deleteModalFile && (
        <div className="modal-overlay" onClick={() => setDeleteModalFile(null)}>
          <div className="modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "0.5rem", color: "#f87171" }}>
              Confirm File Deletion
            </h3>
            <p className="text-muted" style={{ fontSize: "var(--font-size-sm)", marginBottom: "1.5rem" }}>
              Are you sure you want to permanently delete &quot;<strong>{deleteModalFile.original_name}</strong>&quot;?
              This will remove the file from storage and revoke all associated share links.
            </p>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                onClick={() => setDeleteModalFile(null)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
                disabled={deletingLoading}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="btn btn-primary"
                style={{ flex: 1, background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
                disabled={deletingLoading}
              >
                {deletingLoading ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
