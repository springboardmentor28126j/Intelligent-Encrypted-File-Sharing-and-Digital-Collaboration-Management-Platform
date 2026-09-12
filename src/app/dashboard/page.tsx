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
  shareWithUser,
  getSharedWithMe,
  downloadSharedWithMeFile,
  revokeShareLink,
  getFileDetails,
  getSystemHealth,
  UserOut,
  FileSummary,
  StorageStats,
  FileMetadata,
  HealthStatus,
  SharedWithMeFile,
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

  // Tab State: 'my_files' | 'shared_with_me'
  const [activeTab, setActiveTab] = useState<"my_files" | "shared_with_me">("my_files");

  // Files & Stats state
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedWithMeFile[]>([]);
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

  // Share Modal state
  const [selectedFileForShare, setSelectedFileForShare] = useState<FileMetadata | null>(null);
  const [shareMode, setShareMode] = useState<"link" | "user">("link");
  const [shareDuration, setShareDuration] = useState<ShareDuration>("24h");
  const [sharePermission, setSharePermission] = useState<SharePermission>("can_download");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [generatedShareUrl, setGeneratedShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Details & Delete Modals state
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
      const [filesData, sharedData, statsData, healthData] = await Promise.all([
        listFiles(searchTerm, selectedCategory),
        getSharedWithMe().catch(() => []),
        getFileStats(),
        getSystemHealth().catch(() => null),
      ]);
      setFiles(filesData);
      setSharedWithMe(sharedData);
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
      setUploadSuccess(`"${uploaded.original_name}" encrypted with AES-256-GCM and stored securely!`);
      setFileDescription("");
      await refreshAllData();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ── Download Handlers ───────────────────────────────────────────────────────
  const handleDownload = async (file: FileSummary) => {
    try {
      await downloadFile(file.id, file.original_name);
      await refreshAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Download failed.");
    }
  };

  const handleDownloadShared = async (shared: SharedWithMeFile) => {
    if (!shared.can_download) {
      alert("This file is marked View Only. Direct downloading is restricted.");
      return;
    }
    try {
      await downloadSharedWithMeFile(shared.share_id, shared.original_name);
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
    setRecipientEmail("");
    setShareFeedback(null);
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
    setShareFeedback(null);

    try {
      if (shareMode === "link") {
        const shareRes = await createShareLink(selectedFileForShare.id, {
          duration: shareDuration,
          permission: sharePermission,
        });
        const fullUrl = `${window.location.origin}${shareRes.share_url}`;
        setGeneratedShareUrl(fullUrl);
      } else {
        if (!recipientEmail || !recipientEmail.includes("@")) {
          alert("Please enter a valid recipient email address.");
          setSharingLoading(false);
          return;
        }
        await shareWithUser(selectedFileForShare.id, {
          recipient_email: recipientEmail.trim(),
          permission: sharePermission,
          duration: shareDuration,
        });
        setShareFeedback(`Successfully shared with ${recipientEmail.trim()}!`);
        setRecipientEmail("");
      }

      const updatedMeta = await getFileDetails(selectedFileForShare.id);
      setSelectedFileForShare(updatedMeta);
      await refreshAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create share grant.");
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
    } catch {
      alert("Could not load file metadata.");
    }
  };

  // ── Loading Screen ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-center">
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 1rem", borderWidth: 3 }} />
          <p className="text-muted">Initializing secure cryptographic vault…</p>
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
            <div className={`health-pill ${health?.postgres.connected ? "healthy" : "resilient"}`} title="PostgreSQL & Encryption Schema">
              <span className="health-dot" />
              <span>PostgreSQL</span>
            </div>
            <div className={`health-pill ${health?.mongodb.connected ? "healthy" : "resilient"}`} title="MongoDB Metadata Cache">
              <span className="health-dot" />
              <span>MongoDB</span>
            </div>
            <div className={`health-pill ${health?.redis.connected ? "healthy" : "resilient"}`} title="Redis Token Revocation">
              <span className="health-dot" />
              <span>Redis</span>
            </div>
            <div className="health-pill healthy" title="AES-256-GCM Server-Side Envelope Encryption">
              <span className="health-dot" />
              <span>AES-256-GCM</span>
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
            Encrypted with unique DEKs
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
            {stats?.total_storage_mb || 0} MB in secure storage
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
            Links & user grants
          </div>
        </div>

        <div className="card" style={{ padding: "1.5rem" }}>
          <div className="text-muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>
            🔒 Encryption Standard
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-success)", marginTop: "0.35rem" }}>
            AES-256-GCM
          </div>
          <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
            Authenticated + Envelope KEK
          </div>
        </div>
      </div>

      {/* ── Secure File Upload Section ──────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: "2.5rem", padding: "1.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>📤</span> AES-256 Server-Side Encrypted Upload
          </h2>
          <span className="badge badge-admin" style={{ fontSize: "0.75rem" }}>
            🔐 Zero-Knowledge Server Encryption
          </span>
        </div>

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
          <div className="dropzone-icon">🔒</div>
          <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, marginBottom: "0.25rem" }}>
            {uploading ? "Encrypting & Storing Ciphertext…" : "Drag and drop your file here, or click to browse"}
          </h3>
          <p className="text-muted" style={{ fontSize: "var(--font-size-xs)" }}>
            Automatically encrypted with AES-256-GCM before reaching cloud storage (up to 50MB)
          </p>

          {/* Progress Bar */}
          {uploading && (
            <div style={{ maxWidth: 400, margin: "1.5rem auto 0" }}>
              <div className="progress-container">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--color-brand-primary)" }}>
                <span>Encrypting payload & storing in object vault…</span>
                <span>{uploadProgress}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── View Navigation Tabs ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "1rem", borderBottom: "1px solid var(--color-border)", marginBottom: "1.5rem" }}>
        <button
          onClick={() => setActiveTab("my_files")}
          style={{
            padding: "0.75rem 1.25rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "my_files" ? "2px solid var(--color-brand-primary)" : "2px solid transparent",
            color: activeTab === "my_files" ? "var(--color-text-primary)" : "var(--color-text-muted)",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
          }}
        >
          📁 My Encrypted Files ({files.length})
        </button>

        <button
          onClick={() => setActiveTab("shared_with_me")}
          style={{
            padding: "0.75rem 1.25rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "shared_with_me" ? "2px solid var(--color-brand-primary)" : "2px solid transparent",
            color: activeTab === "shared_with_me" ? "var(--color-text-primary)" : "var(--color-text-muted)",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>📥 Shared with Me</span>
          {sharedWithMe.length > 0 && (
            <span className="badge badge-admin" style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}>
              {sharedWithMe.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: My Encrypted Files ─────────────────────────────────────────── */}
      {activeTab === "my_files" && (
        <div>
          {/* File Management & Search Toolbar */}
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
                Encrypted Vault ({files.length})
              </h2>

              {/* Search Box */}
              <div style={{ display: "flex", gap: "0.75rem", flex: "1 1 300px", maxWidth: "450px" }}>
                <input
                  id="file-search-input"
                  type="text"
                  className="form-input"
                  placeholder="🔍 Search encrypted files…"
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

          {/* Files Table */}
          <div className="data-table-container">
            {files.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem 1.5rem" }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📭</div>
                <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "0.5rem" }}>
                  No encrypted files found
                </h3>
                <p className="text-muted" style={{ fontSize: "var(--font-size-sm)", maxWidth: "400px", margin: "0 auto" }}>
                  {searchTerm || selectedCategory !== "all"
                    ? "Try clearing your search query or switching categories."
                    : "Upload a file using the dropzone above to encrypt and store it securely."}
                </p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Security</th>
                    <th>Size</th>
                    <th>Uploaded</th>
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
                        <span className="badge badge-admin" style={{ fontSize: "0.7rem", background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                          🔒 AES-256-GCM
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
                            title="Decrypt & download file"
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
                            title="Cryptographic properties & metadata"
                          >
                            ℹ️
                          </button>

                          {/* Delete */}
                          <button
                            className="action-btn delete"
                            onClick={() => setDeleteModalFile(file)}
                            title="Delete file permanently"
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
        </div>
      )}

      {/* ── TAB 2: Shared with Me ────────────────────────────────────────────── */}
      {activeTab === "shared_with_me" && (
        <div>
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, marginBottom: "0.5rem" }}>
              Files Shared with You ({sharedWithMe.length})
            </h2>
            <p className="text-muted" style={{ fontSize: "var(--font-size-sm)" }}>
              Access files that other TrustShare users have explicitly granted you permission to view or download.
            </p>
          </div>

          <div className="data-table-container">
            {sharedWithMe.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem 1.5rem" }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📬</div>
                <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "0.5rem" }}>
                  No shared files yet
                </h3>
                <p className="text-muted" style={{ fontSize: "var(--font-size-sm)", maxWidth: "400px", margin: "0 auto" }}>
                  When other TrustShare users share encrypted files with your email ({user.email}), they will appear here.
                </p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Shared By</th>
                    <th>Permission</th>
                    <th>Size</th>
                    <th>Expires</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sharedWithMe.map((item) => (
                    <tr key={item.share_id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span style={{ fontSize: "1.4rem" }}>
                            {CATEGORY_ICONS[item.category] || "📁"}
                          </span>
                          <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                            {item.original_name}
                          </span>
                        </div>
                      </td>
                      <td style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                        {item.owner_email}
                      </td>
                      <td>
                        {item.can_download ? (
                          <span className="badge badge-admin" style={{ fontSize: "0.75rem", background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>
                            📥 Downloadable
                          </span>
                        ) : (
                          <span className="badge" style={{ fontSize: "0.75rem", background: "rgba(234,179,8,0.15)", color: "#eab308" }}>
                            👁️ View Only
                          </span>
                        )}
                      </td>
                      <td style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>
                        {formatBytes(item.file_size)}
                      </td>
                      <td style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                        {item.expires_at ? (
                          item.is_expired ? (
                            <span style={{ color: "#ef4444" }}>Expired</span>
                          ) : (
                            new Date(item.expires_at).toLocaleDateString()
                          )
                        ) : (
                          "Never"
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {item.can_download && !item.is_expired ? (
                          <button
                            className="btn btn-primary"
                            style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                            onClick={() => handleDownloadShared(item)}
                          >
                            📥 Download
                          </button>
                        ) : (
                          <span className="text-muted" style={{ fontSize: "0.8rem" }}>
                            {item.is_expired ? "Expired" : "Restricted"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Share File ───────────────────────────────────────────────── */}
      {selectedFileForShare && (
        <div className="modal-overlay" onClick={() => setSelectedFileForShare(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedFileForShare(null)}>
              ✕
            </button>
            <h3 style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, marginBottom: "0.25rem" }}>
              Secure Sharing & Access Control
            </h3>
            <p className="text-muted" style={{ fontSize: "var(--font-size-sm)", marginBottom: "1.25rem" }}>
              File: &quot;{selectedFileForShare.original_name}&quot; (AES-256-GCM Encrypted)
            </p>

            {/* Share Mode Switcher */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
              <button
                className={`filter-chip ${shareMode === "link" ? "active" : ""}`}
                style={{ flex: 1, textAlign: "center" }}
                onClick={() => {
                  setShareMode("link");
                  setShareFeedback(null);
                }}
              >
                🔗 Temporary Link
              </button>
              <button
                className={`filter-chip ${shareMode === "user" ? "active" : ""}`}
                style={{ flex: 1, textAlign: "center" }}
                onClick={() => {
                  setShareMode("user");
                  setGeneratedShareUrl(null);
                }}
              >
                👤 Specific User Grant
              </button>
            </div>

            {/* Generated Link Feedback Box */}
            {generatedShareUrl && (
              <div
                style={{
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: "var(--radius-md)",
                  padding: "1rem",
                  marginBottom: "1.25rem",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-brand-primary)", marginBottom: "0.5rem", textTransform: "uppercase" }}>
                  Active Temporary Link
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
                    {copied ? "Copied! ✓" : "Copy"}
                  </button>
                </div>
              </div>
            )}

            {shareFeedback && (
              <div className="alert alert-success animate-fade-in" style={{ marginBottom: "1.25rem" }}>
                <span>✓</span>
                <span>{shareFeedback}</span>
              </div>
            )}

            {/* Recipient Email (if User Mode) */}
            {shareMode === "user" && (
              <div className="form-group">
                <label className="form-label">Recipient User Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="recipient@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
            )}

            {/* Duration Selector */}
            <div className="form-group">
              <label className="form-label">Access Expiration</label>
              <select
                className="form-input"
                value={shareDuration}
                onChange={(e) => setShareDuration(e.target.value as ShareDuration)}
                style={{ cursor: "pointer" }}
              >
                <option value="1h">1 Hour</option>
                <option value="24h">24 Hours (Default)</option>
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
                <option value="can_download">Allow Decrypted Download</option>
                <option value="view_only">View Only (Restricted Download)</option>
              </select>
            </div>

            {/* Action Button */}
            <button
              onClick={handleGenerateShare}
              disabled={sharingLoading}
              className="btn btn-primary"
              style={{ width: "100%", marginBottom: "1.5rem" }}
            >
              {sharingLoading
                ? "Securing & Creating Grant…"
                : shareMode === "link"
                ? "Generate Temporary Link →"
                : "Grant User Access →"}
            </button>

            {/* Active Shares List */}
            {selectedFileForShare.shares.length > 0 && (
              <div>
                <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-secondary)", marginBottom: "0.75rem" }}>
                  Active Shares ({selectedFileForShare.shares.length})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "200px", overflowY: "auto" }}>
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
                          {s.recipient_email ? `👤 ${s.recipient_email}` : "🔗 Public Link"} •{" "}
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
                          title="Revoke access immediately"
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
              Cryptographic & File Metadata
            </h3>
            <p className="text-muted" style={{ fontSize: "var(--font-size-sm)", marginBottom: "1.5rem" }}>
              Verified properties stored in PostgreSQL & Cloud Object Vault.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.85rem" }}>
              {[
                { label: "Original Filename", value: detailsModalFile.original_name },
                { label: "Encryption Standard", value: "AES-256-GCM (Authenticated Envelope Encryption)" },
                { label: "Storage Backend", value: detailsModalFile.storage_backend === "s3" ? "AWS S3 Private Object Bucket" : "Secure Local Encrypted Vault" },
                { label: "Storage Key (Ciphertext)", value: detailsModalFile.stored_name },
                { label: "File Size", value: `${detailsModalFile.file_size} bytes (${formatBytes(detailsModalFile.file_size)})` },
                { label: "Content Type", value: detailsModalFile.content_type },
                { label: "Owner Email", value: detailsModalFile.owner_email },
                { label: "SHA-256 Integrity Hash", value: detailsModalFile.sha256_hash },
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
                      fontFamily: item.label.includes("Hash") || item.label.includes("Key") ? "monospace" : "inherit",
                      wordBreak: "break-all",
                      color: item.label.includes("Encryption") ? "var(--color-success)" : "var(--color-text-primary)",
                      fontWeight: item.label.includes("Encryption") ? 600 : 400,
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: "1rem" }}>
              🔒 <em>Security Guarantee: Plaintext files and private encryption keys are never stored permanently on disk or returned through API endpoints.</em>
            </p>

            <button
              onClick={() => setDetailsModalFile(null)}
              className="btn btn-secondary"
              style={{ width: "100%", marginTop: "1rem" }}
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
              This will remove the ciphertext from cloud storage and revoke all associated share links.
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
