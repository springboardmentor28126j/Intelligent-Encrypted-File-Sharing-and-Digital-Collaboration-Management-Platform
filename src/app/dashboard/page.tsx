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
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getAuditLogs,
  getAuditStats,
  getAnalyticsDashboard,
  getSecuritySummary,
  getSecurityEvents,
  getSecurityAlerts,
  updateSecurityAlertStatus,
  getSuspiciousActivities,
  updateSuspiciousActivityStatus,
  getLockedAccounts,
  unlockUserAccount,
  getSecurityAnalytics,
  UserOut,
  FileSummary,
  StorageStats,
  FileMetadata,
  HealthStatus,
  SharedWithMeFile,
  ShareDuration,
  SharePermission,
  NotificationItem,
  AuditLog,
  AuditStats,
  AnalyticsDashboard as AnalyticsData,
  ShareLink,
  SecurityAlert,
  SuspiciousActivity,
  LockedAccount,
  SecuritySummary,
  SecurityAnalytics,
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

  // Tab State: 'my_files' | 'shared_with_me' | 'analytics' | 'notifications' | 'audit'
  const [activeTab, setActiveTab] = useState<"my_files" | "shared_with_me" | "analytics" | "notifications" | "audit">("my_files");

  // Files & Stats state
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedWithMeFile[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Audit Logs & Security Monitoring State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditStatusFilter, setAuditStatusFilter] = useState("all");

  // Milestone 3 Security State
  const [securitySummary, setSecuritySummary] = useState<SecuritySummary | null>(null);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [suspiciousActivities, setSuspiciousActivities] = useState<SuspiciousActivity[]>([]);
  const [lockedAccounts, setLockedAccounts] = useState<LockedAccount[]>([]);
  const [securityAnalytics, setSecurityAnalytics] = useState<SecurityAnalytics | null>(null);
  const [alertFilterStatus, setAlertFilterStatus] = useState("all");
  const [alertFilterSeverity, setAlertFilterSeverity] = useState("all");
  const [unlockingUserId, setUnlockingUserId] = useState<number | null>(null);
  const [securityFeedback, setSecurityFeedback] = useState<string | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(7);

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
  const [generatedShareObj, setGeneratedShareObj] = useState<ShareLink | null>(null);
  const [directEmailInput, setDirectEmailInput] = useState("");
  const [directEmailStatus, setDirectEmailStatus] = useState<string | null>(null);
  const [directEmailLoading, setDirectEmailLoading] = useState(false);
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

  // Refetch when tab changes
  useEffect(() => {
    if (!user) return;
    if (activeTab === "analytics") {
      getAnalyticsDashboard(analyticsDays).then(setAnalyticsData).catch(console.error);
    } else if (activeTab === "notifications") {
      fetchNotifications();
    } else if (activeTab === "audit") {
      fetchSecurityAndAuditData();
    }
  }, [activeTab, analyticsDays, auditActionFilter, auditStatusFilter, alertFilterStatus, alertFilterSeverity]);

  const refreshAllData = async () => {
    setRefreshing(true);
    try {
      const [filesData, sharedData, statsData, healthData, unreadRes] = await Promise.all([
        listFiles(searchTerm, selectedCategory),
        getSharedWithMe().catch(() => []),
        getFileStats(),
        getSystemHealth().catch(() => null),
        getUnreadCount().catch(() => ({ unread_count: 0 })),
      ]);
      setFiles(filesData);
      setSharedWithMe(sharedData);
      setStats(statsData);
      if (healthData) setHealth(healthData);
      setUnreadNotifCount(unreadRes.unread_count);
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

  const fetchNotifications = async () => {
    try {
      const [list, unread] = await Promise.all([
        getNotifications(),
        getUnreadCount(),
      ]);
      setNotifications(list);
      setUnreadNotifCount(unread.unread_count);
    } catch (e) {
      console.error("Failed to load notifications:", e);
    }
  };

  const fetchSecurityAndAuditData = async () => {
    setSecurityLoading(true);
    try {
      const action = auditActionFilter === "all" ? undefined : auditActionFilter;
      const statusF = auditStatusFilter === "all" ? undefined : auditStatusFilter;
      const [logs, statsRes, secSummary, alerts, suspicious, locked, secAnalytics] = await Promise.all([
        getAuditLogs({ action, status_filter: statusF, limit: 100 }),
        getAuditStats().catch(() => null),
        getSecuritySummary().catch(() => null),
        getSecurityAlerts(alertFilterStatus, alertFilterSeverity).catch(() => []),
        getSuspiciousActivities().catch(() => []),
        user?.role === "admin" ? getLockedAccounts().catch(() => []) : Promise.resolve([]),
        getSecurityAnalytics(7).catch(() => null),
      ]);
      setAuditLogs(logs);
      if (statsRes) setAuditStats(statsRes);
      if (secSummary) setSecuritySummary(secSummary);
      setSecurityAlerts(alerts);
      setSuspiciousActivities(suspicious);
      setLockedAccounts(locked);
      if (secAnalytics) setSecurityAnalytics(secAnalytics);
    } catch (e) {
      console.error("Failed to load security & audit data:", e);
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleUnlockAccount = async (userId: number, email: string) => {
    if (!confirm(`Are you sure you want to unlock the account for ${email}?`)) return;
    setUnlockingUserId(userId);
    setSecurityFeedback(null);
    try {
      await unlockUserAccount(userId);
      setSecurityFeedback(`✓ Account for ${email} has been unlocked successfully.`);
      await fetchSecurityAndAuditData();
      await refreshAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to unlock user account.");
    } finally {
      setUnlockingUserId(null);
    }
  };

  const handleUpdateAlertStatus = async (alertId: number, newStatus: "OPEN" | "INVESTIGATING" | "RESOLVED") => {
    try {
      await updateSecurityAlertStatus(alertId, newStatus);
      await fetchSecurityAndAuditData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update alert status.");
    }
  };

  const handleUpdateSuspiciousStatus = async (activityId: number, newStatus: "OPEN" | "INVESTIGATING" | "RESOLVED" | "IGNORED") => {
    try {
      await updateSuspiciousActivityStatus(activityId, newStatus);
      await fetchSecurityAndAuditData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update suspicious activity status.");
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
    setGeneratedShareObj(null);
    setDirectEmailInput("");
    setDirectEmailStatus(null);
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

  const getShareDetails = (customUrl?: string, customShare?: ShareLink) => {
    const filename = selectedFileForShare?.original_name || "file";
    const secureLink = customUrl || generatedShareUrl || `${window.location.origin}/share/temp`;
    const shareObj = customShare || generatedShareObj;
    let expiryFormatted = "Never (Persistent)";
    if (shareObj?.expires_at) {
      expiryFormatted = new Date(shareObj.expires_at).toLocaleString();
    } else if (shareDuration === "1h") {
      expiryFormatted = "In 1 Hour";
    } else if (shareDuration === "24h") {
      expiryFormatted = "In 24 Hours";
    } else if (shareDuration === "7d") {
      expiryFormatted = "In 7 Days";
    } else if (shareDuration === "30d") {
      expiryFormatted = "In 30 Days";
    }
    const permissionLabel = (shareObj?.permission || sharePermission) === "can_download" ? "Allow Download & Decryption" : "View Only";

    const messageText = `Secure file shared via TrustShare.\n\nFile: ${filename}\nAccess Link: ${secureLink}\nExpires: ${expiryFormatted}\n\nOpen the link before it expires.`;

    return {
      filename,
      secureLink,
      expiryFormatted,
      permissionLabel,
      messageText,
    };
  };

  const handleWhatsAppShare = (customUrl?: string, customShare?: ShareLink) => {
    const { messageText } = getShareDetails(customUrl, customShare);
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleGmailShare = (customUrl?: string, customShare?: ShareLink) => {
    const { filename, messageText } = getShareDetails(customUrl, customShare);
    const subject = `Secure File: ${filename} via TrustShare`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageText)}`;
    window.open(gmailUrl, "_blank", "noopener,noreferrer");
  };

  const handleTelegramShare = (customUrl?: string, customShare?: ShareLink) => {
    const { secureLink, filename, expiryFormatted } = getShareDetails(customUrl, customShare);
    const tgSummary = `Secure file shared via TrustShare:\nFile: ${filename}\nExpires: ${expiryFormatted}`;
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(secureLink)}&text=${encodeURIComponent(tgSummary)}`;
    window.open(tgUrl, "_blank", "noopener,noreferrer");
  };

  const handleTeamsShare = (customUrl?: string, customShare?: ShareLink) => {
    const { secureLink, messageText } = getShareDetails(customUrl, customShare);
    const teamsUrl = `https://teams.microsoft.com/share?href=${encodeURIComponent(secureLink)}&msgText=${encodeURIComponent(messageText)}`;
    window.open(teamsUrl, "_blank", "noopener,noreferrer");
  };

  const handleMailtoShare = (customUrl?: string, customShare?: ShareLink) => {
    const { filename, messageText } = getShareDetails(customUrl, customShare);
    const subject = `Secure File Shared: ${filename}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageText)}`;
    window.location.href = mailtoUrl;
  };

  const handleSendDirectEmail = async () => {
    if (!directEmailInput || !directEmailInput.includes("@")) {
      alert("Please enter a valid recipient email address.");
      return;
    }
    if (!selectedFileForShare) return;

    setDirectEmailLoading(true);
    setDirectEmailStatus(null);
    try {
      const res = await createShareLink(selectedFileForShare.id, {
        duration: shareDuration,
        permission: sharePermission,
        recipient_email: directEmailInput.trim(),
      });
      setGeneratedShareObj(res);
      const fullUrl = `${window.location.origin}${res.share_url}`;
      setGeneratedShareUrl(fullUrl);
      setDirectEmailStatus(`✓ Dispatched to ${directEmailInput.trim()} (${res.email_status || 'Delivered'})`);
      setDirectEmailInput("");
      const updatedMeta = await getFileDetails(selectedFileForShare.id);
      setSelectedFileForShare(updatedMeta);
      await refreshAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to dispatch email.");
    } finally {
      setDirectEmailLoading(false);
    }
  };

  const handleGenerateShare = async () => {
    if (!selectedFileForShare) return;
    setSharingLoading(true);
    setShareFeedback(null);
    setDirectEmailStatus(null);

    try {
      if (shareMode === "link") {
        const shareRes = await createShareLink(selectedFileForShare.id, {
          duration: shareDuration,
          permission: sharePermission,
          recipient_email: directEmailInput.trim() ? directEmailInput.trim() : undefined,
        });
        const fullUrl = `${window.location.origin}${shareRes.share_url}`;
        setGeneratedShareUrl(fullUrl);
        setGeneratedShareObj(shareRes);
        if (shareRes.email_sent) {
          setShareFeedback(`Encrypted share link generated and sent to ${shareRes.recipient_email}! (${shareRes.email_status})`);
        } else {
          setShareFeedback("Encrypted share link generated successfully!");
        }
      } else {
        if (!recipientEmail || !recipientEmail.includes("@")) {
          alert("Please enter a valid recipient email address.");
          setSharingLoading(false);
          return;
        }
        const shareRes = await shareWithUser(selectedFileForShare.id, {
          recipient_email: recipientEmail.trim(),
          permission: sharePermission,
          duration: shareDuration,
        });
        setGeneratedShareObj(shareRes);
        setShareFeedback(`Successfully granted access to ${recipientEmail.trim()}! (${shareRes.email_status || 'Notification sent'})`);
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
        setGeneratedShareObj(null);
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

  // ── Notification Actions ────────────────────────────────────────────────────
  const handleMarkNotifRead = async (id: number) => {
    try {
      await markNotificationAsRead(id);
      await fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      await fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteNotif = async (id: number) => {
    try {
      await deleteNotification(id);
      await fetchNotifications();
    } catch (e) {
      console.error(e);
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
          {/* Notification Bell Badge */}
          <button
            onClick={() => setActiveTab("notifications")}
            style={{
              position: "relative",
              background: activeTab === "notifications" ? "rgba(99, 102, 241, 0.15)" : "none",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              padding: "0.5rem 0.75rem",
              cursor: "pointer",
              color: "var(--color-text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.9rem",
            }}
            title="Notification Center"
          >
            <span>🔔</span>
            {unreadNotifCount > 0 && (
              <span
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  borderRadius: "999px",
                  padding: "0.1rem 0.45rem",
                  lineHeight: 1.2,
                }}
              >
                {unreadNotifCount}
              </span>
            )}
          </button>

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
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
            Envelope Encryption Enabled
          </div>
        </div>
      </div>

      {/* ── Drag & Drop Upload Zone ────────────────────────────────────────── */}
      <div style={{ marginBottom: "2.5rem" }}>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? "var(--color-brand-primary)" : "var(--color-border)"}`,
            borderRadius: "var(--radius-lg)",
            padding: "2.5rem 1.5rem",
            textAlign: "center",
            cursor: "pointer",
            background: isDragging ? "rgba(99, 102, 241, 0.05)" : "var(--color-surface)",
            transition: "all 0.2s ease",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />

          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>
            {uploading ? "🔐" : "📤"}
          </div>

          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.35rem" }}>
            {uploading ? "Encrypting & Storing Ciphertext…" : "Drag & Drop files here, or click to browse"}
          </h3>
          <p className="text-muted" style={{ fontSize: "0.85rem", maxWidth: "500px", margin: "0 auto 1rem" }}>
            Files are encrypted locally on the server using an ephemeral AES-256-GCM key before storage. Plaintext is never saved.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span className="badge badge-user">PDF, Office, Docs</span>
            <span className="badge badge-user">Images & Media</span>
            <span className="badge badge-user">ZIP & Archives</span>
            <span className="badge badge-user">Max 50MB</span>
          </div>

          {/* Optional File Description */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "450px", margin: "1.25rem auto 0" }}
          >
            <input
              type="text"
              placeholder="Optional file description / notes…"
              value={fileDescription}
              onChange={(e) => setFileDescription(e.target.value)}
              className="form-input"
              style={{ fontSize: "0.85rem", padding: "0.5rem 0.85rem" }}
            />
          </div>

          {/* Upload Progress Bar */}
          {uploading && (
            <div style={{ maxWidth: "400px", margin: "1.5rem auto 0" }}>
              <div style={{ height: "6px", background: "var(--color-border)", borderRadius: "999px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${uploadProgress}%`,
                    background: "var(--color-brand-primary)",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>
              <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
                Encrypting payload… {uploadProgress}%
              </p>
            </div>
          )}

          {uploadError && (
            <div style={{ marginTop: "1rem", color: "#f87171", fontSize: "0.85rem" }}>
              ⚠️ {uploadError}
            </div>
          )}

          {uploadSuccess && (
            <div style={{ marginTop: "1rem", color: "var(--color-success)", fontSize: "0.85rem", fontWeight: 500 }}>
              ✓ {uploadSuccess}
            </div>
          )}
        </div>
      </div>

      {/* ── View Navigation Tabs ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.75rem", borderBottom: "1px solid var(--color-border)", marginBottom: "1.5rem", flexWrap: "wrap" }}>
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
          📁 Vault Files ({files.length})
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

        <button
          onClick={() => setActiveTab("analytics")}
          style={{
            padding: "0.75rem 1.25rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "analytics" ? "2px solid var(--color-brand-primary)" : "2px solid transparent",
            color: activeTab === "analytics" ? "var(--color-text-primary)" : "var(--color-text-muted)",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
          }}
        >
          📊 Analytics & Trends
        </button>

        <button
          onClick={() => setActiveTab("notifications")}
          style={{
            padding: "0.75rem 1.25rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "notifications" ? "2px solid var(--color-brand-primary)" : "2px solid transparent",
            color: activeTab === "notifications" ? "var(--color-text-primary)" : "var(--color-text-muted)",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>🔔 Notifications</span>
          {unreadNotifCount > 0 && (
            <span style={{ background: "#ef4444", color: "#fff", fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: "999px" }}>
              {unreadNotifCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          style={{
            padding: "0.75rem 1.25rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "audit" ? "2px solid var(--color-brand-primary)" : "2px solid transparent",
            color: activeTab === "audit" ? "var(--color-text-primary)" : "var(--color-text-muted)",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
          }}
        >
          🛡️ Security Audit
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

            {/* Category Filter Pills */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {["all", "document", "pdf", "image", "spreadsheet", "presentation", "archive", "other"].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`category-pill ${selectedCategory === cat ? "active" : ""}`}
                    style={{
                      padding: "0.35rem 0.85rem",
                      borderRadius: "999px",
                      fontSize: "0.8rem",
                      border: "1px solid var(--color-border)",
                      background: selectedCategory === cat ? "var(--color-brand-primary)" : "var(--color-surface)",
                      color: selectedCategory === cat ? "#fff" : "var(--color-text-secondary)",
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {cat !== "all" && CATEGORY_ICONS[cat]} {cat}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Files Table */}
          {files.length === 0 ? (
            <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📂</div>
              <h3 style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No encrypted files found</h3>
              <p className="text-muted" style={{ fontSize: "0.85rem" }}>
                {searchTerm || selectedCategory !== "all"
                  ? "Try adjusting your search criteria or category filter."
                  : "Drag and drop a file above to securely encrypt and store it in your private vault."}
              </p>
            </div>
          ) : (
            <div className="card" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                    <th style={{ padding: "1rem" }}>Filename</th>
                    <th style={{ padding: "1rem" }}>Size</th>
                    <th style={{ padding: "1rem" }}>Category</th>
                    <th style={{ padding: "1rem" }}>Security</th>
                    <th style={{ padding: "1rem" }}>Shares</th>
                    <th style={{ padding: "1rem" }}>Uploaded</th>
                    <th style={{ padding: "1rem", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr
                      key={f.id}
                      style={{ borderBottom: "1px solid var(--color-border)", transition: "background 0.15s ease" }}
                      className="table-row"
                    >
                      <td style={{ padding: "1rem", fontWeight: 500 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span>{CATEGORY_ICONS[f.category] || "📁"}</span>
                          <div>
                            <div>{f.original_name}</div>
                            {f.description && (
                              <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                {f.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "1rem", color: "var(--color-text-muted)" }}>
                        {formatBytes(f.file_size)}
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span className="badge badge-user" style={{ textTransform: "capitalize" }}>
                          {f.category}
                        </span>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--color-success)" }}>
                          🔒 AES-256-GCM
                        </span>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        {f.shares_count > 0 ? (
                          <span className="badge badge-admin">{f.shares_count} active</span>
                        ) : (
                          <span className="text-muted" style={{ fontSize: "0.8rem" }}>Private</span>
                        )}
                      </td>
                      <td style={{ padding: "1rem", color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                        {new Date(f.upload_date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "1rem", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => handleDownload(f)}
                            className="action-btn"
                            title="Decrypt & Download"
                          >
                            ⬇️
                          </button>
                          <button
                            onClick={() => openShareModal(f)}
                            className="action-btn"
                            title="Share File"
                          >
                            🔗
                          </button>
                          <button
                            onClick={() => openDetailsModal(f)}
                            className="action-btn"
                            title="Cryptographic Metadata"
                          >
                            🔍
                          </button>
                          <button
                            onClick={() => setDeleteModalFile(f)}
                            className="action-btn delete"
                            title="Delete File"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Shared With Me ─────────────────────────────────────────────── */}
      {activeTab === "shared_with_me" && (
        <div>
          <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, marginBottom: "1rem" }}>
            Files Shared with You ({sharedWithMe.length})
          </h2>

          {sharedWithMe.length === 0 ? (
            <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📥</div>
              <h3 style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No files shared with you yet</h3>
              <p className="text-muted" style={{ fontSize: "0.85rem" }}>
                When other registered TrustShare users grant you access to their encrypted files, they will appear here.
              </p>
            </div>
          ) : (
            <div className="card" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                    <th style={{ padding: "1rem" }}>Filename</th>
                    <th style={{ padding: "1rem" }}>Owner</th>
                    <th style={{ padding: "1rem" }}>Size</th>
                    <th style={{ padding: "1rem" }}>Permission</th>
                    <th style={{ padding: "1rem" }}>Expires</th>
                    <th style={{ padding: "1rem", textAlign: "right" }}>Download</th>
                  </tr>
                </thead>
                <tbody>
                  {sharedWithMe.map((s) => (
                    <tr key={s.share_id} style={{ borderBottom: "1px solid var(--color-border)" }} className="table-row">
                      <td style={{ padding: "1rem", fontWeight: 500 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span>{CATEGORY_ICONS[s.category] || "📁"}</span>
                          <span>{s.original_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "1rem", color: "var(--color-text-muted)" }}>{s.owner_email}</td>
                      <td style={{ padding: "1rem", color: "var(--color-text-muted)" }}>{formatBytes(s.file_size)}</td>
                      <td style={{ padding: "1rem" }}>
                        <span className={`badge ${s.permission === "can_download" ? "badge-admin" : "badge-user"}`}>
                          {s.permission === "can_download" ? "📥 Can Download" : "👁️ View Only"}
                        </span>
                      </td>
                      <td style={{ padding: "1rem", color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                        {s.expires_at ? new Date(s.expires_at).toLocaleString() : "Never"}
                      </td>
                      <td style={{ padding: "1rem", textAlign: "right" }}>
                        {s.can_download ? (
                          <button
                            onClick={() => handleDownloadShared(s)}
                            className="btn btn-primary"
                            style={{ padding: "0.4rem 0.85rem", fontSize: "0.8rem" }}
                          >
                            ⬇️ Download
                          </button>
                        ) : (
                          <span className="text-muted" style={{ fontSize: "0.75rem" }}>Restricted</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Analytics Dashboard ────────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: 700 }}>
              📊 Security & Storage Analytics
            </h2>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setAnalyticsDays(d)}
                  className={`category-pill ${analyticsDays === d ? "active" : ""}`}
                  style={{
                    padding: "0.35rem 0.85rem",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: analyticsDays === d ? "var(--color-brand-primary)" : "var(--color-surface)",
                    color: analyticsDays === d ? "#fff" : "var(--color-text-secondary)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Last {d} Days
                </button>
              ))}
            </div>
          </div>

          {/* Metric Overview Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            <div className="card" style={{ padding: "1.25rem" }}>
              <div className="text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Total Vault Files</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>{analyticsData?.total_files || stats?.total_files || 0}</div>
            </div>
            <div className="card" style={{ padding: "1.25rem" }}>
              <div className="text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Total Storage</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--color-brand-accent)" }}>
                {analyticsData?.total_storage_mb || stats?.total_storage_mb || 0} MB
              </div>
            </div>
            <div className="card" style={{ padding: "1.25rem" }}>
              <div className="text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Total Downloads</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#10b981" }}>{analyticsData?.total_downloads || 0}</div>
            </div>
            <div className="card" style={{ padding: "1.25rem" }}>
              <div className="text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Total Shares</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--color-brand-primary)" }}>{analyticsData?.total_shares || 0}</div>
            </div>
            <div className="card" style={{ padding: "1.25rem" }}>
              <div className="text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Security Incidents</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: (analyticsData?.security_incidents || 0) > 0 ? "#ef4444" : "#10b981" }}>
                {analyticsData?.security_incidents || 0}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
            {/* Upload & Download Trends Chart */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>
                📈 Activity Trends (Past {analyticsDays} Days)
              </h3>
              {analyticsData?.upload_trends && analyticsData.upload_trends.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {analyticsData.upload_trends.map((pt) => {
                    const maxVal = Math.max(...analyticsData.upload_trends.map((p) => Math.max(p.uploads, p.downloads, p.shares)), 1);
                    return (
                      <div key={pt.date} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.8rem" }}>
                        <span style={{ width: "80px", color: "var(--color-text-muted)" }}>{pt.date.slice(5)}</span>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{ width: `${(pt.uploads / maxVal) * 100}%`, minWidth: pt.uploads > 0 ? "8px" : "0", height: "8px", background: "var(--color-brand-primary)", borderRadius: "4px" }} />
                            <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>{pt.uploads} up</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{ width: `${(pt.downloads / maxVal) * 100}%`, minWidth: pt.downloads > 0 ? "8px" : "0", height: "8px", background: "#10b981", borderRadius: "4px" }} />
                            <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>{pt.downloads} down</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted" style={{ fontSize: "0.85rem" }}>No activity recorded yet in this window.</p>
              )}
            </div>

            {/* Storage Distribution */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>
                🗂️ Storage by Category
              </h3>
              {analyticsData?.category_distribution && analyticsData.category_distribution.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {analyticsData.category_distribution.map((cat) => (
                    <div key={cat.category}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                        <span style={{ textTransform: "capitalize", fontWeight: 500 }}>
                          {CATEGORY_ICONS[cat.category] || "📁"} {cat.category} ({cat.count} files)
                        </span>
                        <span className="text-muted">{formatBytes(cat.bytes)} ({cat.percentage}%)</span>
                      </div>
                      <div style={{ height: "8px", background: "var(--color-border)", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${cat.percentage}%`,
                            background: "linear-gradient(90deg, var(--color-brand-primary), var(--color-brand-accent))",
                            borderRadius: "4px",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted" style={{ fontSize: "0.85rem" }}>No storage data available.</p>
              )}
            </div>
          </div>

          {/* Live Recent Activity Stream */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>
              ⚡ Recent Transfer & Security Stream
            </h3>
            {analyticsData?.recent_activity && analyticsData.recent_activity.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {analyticsData.recent_activity.map((act) => (
                  <div
                    key={act.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--color-border)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem", marginRight: "0.5rem" }}>
                        {act.action}
                      </span>
                      <span>{act.filename || act.user_email || "System Event"}</span>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      <span className="text-muted" style={{ fontSize: "0.75rem" }}>IP: {act.ip_address}</span>
                      <span className="text-muted" style={{ fontSize: "0.75rem" }}>{new Date(act.timestamp).toLocaleTimeString()}</span>
                      <span className={`badge ${act.status === "success" ? "badge-user" : "badge-admin"}`} style={{ fontSize: "0.7rem" }}>
                        {act.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted" style={{ fontSize: "0.85rem" }}>No recent activity records.</p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: Notification Center ────────────────────────────────────────── */}
      {activeTab === "notifications" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
            <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: 700 }}>
              🔔 Notification Center ({notifications.length})
            </h2>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handleMarkAllNotifsRead}
                className="btn btn-secondary"
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                ✓ Mark All as Read
              </button>
              <button
                onClick={fetchNotifications}
                className="btn btn-secondary"
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🔕</div>
              <h3 style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No notifications</h3>
              <p className="text-muted" style={{ fontSize: "0.85rem" }}>
                You are all caught up! You will be notified here when files are shared, downloaded, or if security events occur.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="card"
                  style={{
                    padding: "1.25rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    borderLeft: `4px solid ${
                      n.type === "security_alert"
                        ? "#ef4444"
                        : n.type === "file_shared"
                        ? "var(--color-brand-primary)"
                        : "var(--color-success)"
                    }`,
                    opacity: n.is_read ? 0.75 : 1,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <span className="badge" style={{ textTransform: "capitalize", fontSize: "0.75rem" }}>
                        {n.type.replace("_", " ")}
                      </span>
                      {!n.is_read && (
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-brand-primary)" }} />
                      )}
                      <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "var(--color-text-primary)", fontWeight: n.is_read ? 400 : 600 }}>
                      {n.message}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {!n.is_read && (
                      <button
                        onClick={() => handleMarkNotifRead(n.id)}
                        className="action-btn"
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteNotif(n.id)}
                      className="action-btn delete"
                      title="Delete notification"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: Security Monitoring & Audit ────────────────────────────────────────── */}
      {activeTab === "audit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Header & Refresh Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                🛡️ Security Monitoring & Audit Center
              </h2>
              <p className="text-muted" style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
                Live suspicious activity detection, brute-force mitigation, account lockout management & real-time analytics.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <button
                onClick={fetchSecurityAndAuditData}
                disabled={securityLoading}
                className="btn btn-secondary"
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                {securityLoading ? "🔄 Refreshing…" : "🔄 Refresh Security Live Data"}
              </button>
            </div>
          </div>

          {/* ── SECTION 1: Real-time Security Summary Cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
            <div className="card" style={{ padding: "1.25rem", borderLeft: "4px solid var(--color-brand-primary)" }}>
              <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>Total Security Events</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "0.35rem" }}>
                {securitySummary?.total_security_events ?? auditStats?.total_events ?? 0}
              </div>
              <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Immutable audit records</div>
            </div>

            <div className="card" style={{ padding: "1.25rem", borderLeft: "4px solid #f59e0b" }}>
              <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>Suspicious Activities</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: (securitySummary?.suspicious_activities_count ?? 0) > 0 ? "#f59e0b" : "inherit", marginTop: "0.35rem" }}>
                {securitySummary?.suspicious_activities_count ?? 0}
              </div>
              <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Brute-force & velocity flags</div>
            </div>

            <div className="card" style={{ padding: "1.25rem", borderLeft: "4px solid #f87171" }}>
              <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>Failed Logins</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: (securitySummary?.failed_login_attempts ?? 0) > 0 ? "#f87171" : "inherit", marginTop: "0.35rem" }}>
                {securitySummary?.failed_login_attempts ?? auditStats?.failed_logins ?? 0}
              </div>
              <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Threshold: 5 in 10 mins</div>
            </div>

            <div className="card" style={{ padding: "1.25rem", borderLeft: "4px solid #ef4444" }}>
              <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>Locked Accounts</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: (securitySummary?.locked_accounts_count ?? 0) > 0 ? "#ef4444" : "#10b981", marginTop: "0.35rem" }}>
                {securitySummary?.locked_accounts_count ?? lockedAccounts.length}
              </div>
              <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>15-minute temporary lockout</div>
            </div>

            <div className="card" style={{ padding: "1.25rem", borderLeft: "4px solid #a855f7" }}>
              <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>Unauthorized Access</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: (securitySummary?.unauthorized_access_attempts ?? 0) > 0 ? "#a855f7" : "inherit", marginTop: "0.35rem" }}>
                {securitySummary?.unauthorized_access_attempts ?? 0}
              </div>
              <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Forbidden file/token attempts</div>
            </div>

            <div className="card" style={{ padding: "1.25rem", borderLeft: "4px solid #dc2626" }}>
              <div className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>Open Security Alerts</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: (securitySummary?.open_alerts_count ?? 0) > 0 ? "#dc2626" : "#10b981", marginTop: "0.35rem" }}>
                {securitySummary?.open_alerts_count ?? 0}
              </div>
              <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Requires admin review</div>
            </div>
          </div>

          {/* ── SECTION 2: Temporarily Locked Accounts (Milestone 3 Core) ── */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  🔒 Temporarily Locked Accounts ({lockedAccounts.length})
                </h3>
                <p className="text-muted" style={{ fontSize: "0.8rem" }}>
                  Accounts automatically locked by the backend after 5 consecutive failed logins. Backend strictly rejects authentication until lockout expires or admin unlocks.
                </p>
              </div>
            </div>

            {lockedAccounts.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", background: "rgba(16, 185, 129, 0.05)", borderRadius: "var(--radius-md)", border: "1px dashed rgba(16, 185, 129, 0.3)" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>✅</div>
                <div style={{ fontWeight: 600, color: "#10b981" }}>No Accounts Currently Locked</div>
                <div className="text-muted" style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>
                  All registered accounts are in good standing with zero active lockout restrictions.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                      <th style={{ padding: "0.75rem" }}>User / Email</th>
                      <th style={{ padding: "0.75rem" }}>Lock Reason</th>
                      <th style={{ padding: "0.75rem" }}>Failed Attempts</th>
                      <th style={{ padding: "0.75rem" }}>Locked At</th>
                      <th style={{ padding: "0.75rem" }}>Unlock Time</th>
                      <th style={{ padding: "0.75rem" }}>Remaining</th>
                      <th style={{ padding: "0.75rem" }}>Status</th>
                      <th style={{ padding: "0.75rem", textAlign: "right" }}>Admin Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lockedAccounts.map((acc) => (
                      <tr key={acc.user_id} style={{ borderBottom: "1px solid var(--color-border)" }} className="table-row">
                        <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                          <div>{acc.email}</div>
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>ID: {String(acc.user_id).substring(0, 8)}… ({acc.role || "user"})</div>
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <span className="badge" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", fontSize: "0.75rem" }}>
                            {acc.lock_reason}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem", fontWeight: 700, color: "#ef4444" }}>
                          {acc.failed_login_attempts}
                        </td>
                        <td style={{ padding: "0.75rem", color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
                          {acc.locked_at ? new Date(acc.locked_at).toLocaleTimeString() : "—"}
                        </td>
                        <td style={{ padding: "0.75rem", color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
                          {acc.locked_until ? new Date(acc.locked_until).toLocaleTimeString() : "—"}
                        </td>
                        <td style={{ padding: "0.75rem", fontWeight: 600, color: "#f59e0b" }}>
                          ⏱️ ~{acc.remaining_minutes} min
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <span className="badge" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", fontSize: "0.75rem" }}>
                            LOCKED
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem", textAlign: "right" }}>
                          <button
                            onClick={() => handleUnlockAccount(acc.user_id, acc.email)}
                            className="btn btn-primary"
                            style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", background: "#10b981", borderColor: "#10b981" }}
                          >
                            🔓 Unlock Account
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECTION 3: Active Security Alerts & Investigations ── */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  🚨 Security Alerts & Incidents ({securityAlerts.length})
                </h3>
                <p className="text-muted" style={{ fontSize: "0.8rem" }}>
                  Automated security alerts generated from brute-force spikes, unauthorized access, and suspicious file operations.
                </p>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <select
                  value={alertFilterSeverity}
                  onChange={(e) => setAlertFilterSeverity(e.target.value)}
                  className="form-input"
                  style={{ width: "auto", padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                >
                  <option value="all">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>

                <select
                  value={alertFilterStatus}
                  onChange={(e) => setAlertFilterStatus(e.target.value)}
                  className="form-input"
                  style={{ width: "auto", padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                >
                  <option value="all">All Statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="INVESTIGATING">Investigating</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </div>
            </div>

            {securityAlerts.length === 0 ? (
              <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--color-text-muted)" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>🛡️</div>
                <div>No security alerts matching current filters</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                      <th style={{ padding: "0.75rem" }}>Timestamp</th>
                      <th style={{ padding: "0.75rem" }}>Severity</th>
                      <th style={{ padding: "0.75rem" }}>Alert Title</th>
                      <th style={{ padding: "0.75rem" }}>Description & Context</th>
                      <th style={{ padding: "0.75rem" }}>IP Address</th>
                      <th style={{ padding: "0.75rem" }}>Investigation Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityAlerts
                      .filter((a) => alertFilterSeverity === "all" || a.severity.toUpperCase() === alertFilterSeverity.toUpperCase())
                      .filter((a) => alertFilterStatus === "all" || a.status.toUpperCase() === alertFilterStatus.toUpperCase())
                      .map((alert) => (
                        <tr key={alert.id} style={{ borderBottom: "1px solid var(--color-border)" }} className="table-row">
                          <td style={{ padding: "0.75rem", color: "var(--color-text-muted)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                            {new Date(alert.created_at).toLocaleString()}
                          </td>
                          <td style={{ padding: "0.75rem" }}>
                            <span
                              className="badge"
                              style={{
                                background:
                                  alert.severity.toUpperCase() === "CRITICAL"
                                    ? "rgba(239, 68, 68, 0.25)"
                                    : alert.severity.toUpperCase() === "HIGH"
                                    ? "rgba(245, 158, 11, 0.25)"
                                    : "rgba(59, 130, 246, 0.2)",
                                color:
                                  alert.severity.toUpperCase() === "CRITICAL"
                                    ? "#ef4444"
                                    : alert.severity.toUpperCase() === "HIGH"
                                    ? "#f59e0b"
                                    : "#3b82f6",
                                fontWeight: 700,
                                fontSize: "0.75rem",
                              }}
                            >
                              {alert.severity}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                            {alert.title}
                          </td>
                          <td style={{ padding: "0.75rem", color: "var(--color-text-secondary)", maxWidth: "350px" }}>
                            <div>{alert.description}</div>
                            {alert.user_email && (
                              <div className="text-muted" style={{ fontSize: "0.75rem" }}>Target: {alert.user_email}</div>
                            )}
                          </td>
                          <td style={{ padding: "0.75rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
                            {alert.ip_address || "127.0.0.1"}
                          </td>
                          <td style={{ padding: "0.75rem" }}>
                            <select
                              value={alert.status}
                              onChange={(e) => handleUpdateAlertStatus(alert.id, e.target.value as "OPEN" | "INVESTIGATING" | "RESOLVED")}
                              className="form-input"
                              style={{
                                padding: "0.3rem 0.6rem",
                                fontSize: "0.75rem",
                                width: "auto",
                                background:
                                  alert.status === "RESOLVED"
                                    ? "rgba(16, 185, 129, 0.15)"
                                    : alert.status === "INVESTIGATING"
                                    ? "rgba(245, 158, 11, 0.15)"
                                    : "rgba(239, 68, 68, 0.15)",
                                color:
                                  alert.status === "RESOLVED"
                                    ? "#10b981"
                                    : alert.status === "INVESTIGATING"
                                    ? "#f59e0b"
                                    : "#ef4444",
                                fontWeight: 600,
                              }}
                            >
                              <option value="OPEN">🔴 OPEN</option>
                              <option value="INVESTIGATING">🟡 INVESTIGATING</option>
                              <option value="RESOLVED">🟢 RESOLVED</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECTION 4: Suspicious Activity Detections (Velocity & Brute-force) ── */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  ⚠️ Suspicious Activity Detections ({suspiciousActivities.length})
                </h3>
                <p className="text-muted" style={{ fontSize: "0.8rem" }}>
                  Continuous behavioral monitoring tracking failed login spikes, rapid file access, and unauthorized attempts.
                </p>
              </div>
            </div>

            {suspiciousActivities.length === 0 ? (
              <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--color-text-muted)" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>🔍</div>
                <div>No suspicious activity patterns detected</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                      <th style={{ padding: "0.75rem" }}>Activity Type</th>
                      <th style={{ padding: "0.75rem" }}>User / Target</th>
                      <th style={{ padding: "0.75rem" }}>Attempts</th>
                      <th style={{ padding: "0.75rem" }}>First Seen</th>
                      <th style={{ padding: "0.75rem" }}>Last Seen</th>
                      <th style={{ padding: "0.75rem" }}>Severity</th>
                      <th style={{ padding: "0.75rem" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suspiciousActivities.map((act) => (
                      <tr key={act.id} style={{ borderBottom: "1px solid var(--color-border)" }} className="table-row">
                        <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                          <span className="badge" style={{ textTransform: "uppercase", fontSize: "0.75rem" }}>
                            {act.activity_type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <div>{act.user_email || "Unauthenticated User"}</div>
                          <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "monospace" }}>{act.ip_address || "127.0.0.1"}</div>
                        </td>
                        <td style={{ padding: "0.75rem", fontWeight: 700, color: act.attempt_count >= 5 ? "#ef4444" : "#f59e0b" }}>
                          {act.attempt_count}
                        </td>
                        <td style={{ padding: "0.75rem", color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
                          {new Date(act.first_detected).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: "0.75rem", color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
                          {new Date(act.last_detected).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <span
                            className="badge"
                            style={{
                              background: act.severity === "HIGH" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                              color: act.severity === "HIGH" ? "#ef4444" : "#f59e0b",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            {act.severity}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <select
                            value={act.status}
                            onChange={(e) => handleUpdateSuspiciousStatus(act.id, e.target.value as "OPEN" | "INVESTIGATING" | "RESOLVED" | "IGNORED")}
                            className="form-input"
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", width: "auto" }}
                          >
                            <option value="OPEN">🔴 OPEN</option>
                            <option value="INVESTIGATING">🟡 INVESTIGATING</option>
                            <option value="RESOLVED">🟢 RESOLVED</option>
                            <option value="IGNORED">⚪ IGNORED</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECTION 5: Security Analytics & Historical Trends ── */}
          {securityAnalytics && (
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                📊 Security Analytics & Event Breakdown (Last 7 Days)
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
                {/* Severity Breakdown */}
                <div style={{ background: "var(--color-surface)", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                    Severity Distribution
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {Object.entries(securityAnalytics.severity_distribution || {}).map(([sev, count]) => (
                      <div key={sev} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>{sev}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, marginLeft: "1rem", marginRight: "1rem" }}>
                          <div
                            style={{
                              height: "8px",
                              borderRadius: "4px",
                              background:
                                sev === "CRITICAL"
                                  ? "#ef4444"
                                  : sev === "HIGH"
                                  ? "#f59e0b"
                                  : sev === "WARNING"
                                  ? "#eab308"
                                  : "#3b82f6",
                              width: `${Math.min(100, Math.max(5, (count as number) * 15))}%`,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{count as number}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Event Types Breakdown */}
                <div style={{ background: "var(--color-surface)", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                    Security Events by Action
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "180px", overflowY: "auto" }}>
                    {Object.entries(securityAnalytics.events_by_type || {}).map(([type, count]) => (
                      <div key={type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.8rem" }}>
                        <span className="badge" style={{ fontSize: "0.7rem", textTransform: "uppercase" }}>{type.replace(/_/g, " ")}</span>
                        <span style={{ fontWeight: 700 }}>{count as number}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Daily Trend Overview */}
                <div style={{ background: "var(--color-surface)", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                    Recent Failed Logins & Lockouts Timeline
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {(securityAnalytics.daily_trends || []).slice(-5).map((point, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", borderBottom: "1px solid var(--color-border)", paddingBottom: "0.3rem" }}>
                        <span className="text-muted">{point.date}</span>
                        <span>Failed Logins: <strong style={{ color: point.failed_logins > 0 ? "#ef4444" : "inherit" }}>{point.failed_logins}</strong>, Lockouts: <strong style={{ color: point.account_lockouts > 0 ? "#ef4444" : "inherit" }}>{point.account_lockouts}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SECTION 6: Security Audit Log Table ── */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  📋 Immutable Audit & Event Logs ({auditLogs.length})
                </h3>
                <p className="text-muted" style={{ fontSize: "0.8rem" }}>
                  Full cryptographic and access logs recorded automatically for every authenticated action and security incident.
                </p>
              </div>

              {/* Action and Status Filters */}
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="form-input"
                  style={{ width: "auto", padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
                >
                  <option value="all">All Actions</option>
                  <option value="login">Login</option>
                  <option value="login_failed">Failed Login</option>
                  <option value="account_locked">Account Locked</option>
                  <option value="account_unlocked">Account Unlocked</option>
                  <option value="upload">Upload</option>
                  <option value="download">Download</option>
                  <option value="share">Share</option>
                  <option value="delete">Delete</option>
                  <option value="unauthorized_access">Unauthorized Access</option>
                  <option value="suspicious_activity">Suspicious Activity</option>
                </select>

                <select
                  value={auditStatusFilter}
                  onChange={(e) => setAuditStatusFilter(e.target.value)}
                  className="form-input"
                  style={{ width: "auto", padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="security_incident">Security Incident</option>
                </select>
              </div>
            </div>

            {auditLogs.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📋</div>
                <h4 style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No audit log records found</h4>
                <p className="text-muted" style={{ fontSize: "0.85rem" }}>
                  Audit events are recorded automatically upon logins, downloads, uploads, and security incidents.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                      <th style={{ padding: "0.85rem" }}>Timestamp</th>
                      <th style={{ padding: "0.85rem" }}>Action</th>
                      <th style={{ padding: "0.85rem" }}>IP Address</th>
                      <th style={{ padding: "0.85rem" }}>File / Resource</th>
                      <th style={{ padding: "0.85rem" }}>Status</th>
                      <th style={{ padding: "0.85rem" }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: "1px solid var(--color-border)" }} className="table-row">
                        <td style={{ padding: "0.85rem", color: "var(--color-text-muted)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: "0.85rem", fontWeight: 600 }}>
                          <span className="badge" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td style={{ padding: "0.85rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
                          {log.ip_address || "127.0.0.1"}
                        </td>
                        <td style={{ padding: "0.85rem" }}>
                          {log.filename ? <span>📄 {log.filename}</span> : <span className="text-muted">—</span>}
                        </td>
                        <td style={{ padding: "0.85rem" }}>
                          <span
                            className="badge"
                            style={{
                              background:
                                log.status === "success"
                                  ? "rgba(16, 185, 129, 0.15)"
                                  : log.status === "security_incident"
                                  ? "rgba(239, 68, 68, 0.25)"
                                  : "rgba(245, 158, 11, 0.15)",
                              color:
                                log.status === "success"
                                  ? "#10b981"
                                  : log.status === "security_incident"
                                  ? "#ef4444"
                                  : "#f59e0b",
                              fontSize: "0.75rem",
                            }}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: "0.85rem", color: "var(--color-text-muted)", maxWidth: "300px", wordBreak: "break-word" }}>
                          {log.details || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Secure Sharing ───────────────────────────────────────────── */}
      {selectedFileForShare && (
        <div className="modal-overlay" onClick={() => setSelectedFileForShare(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedFileForShare(null)}>
              ✕
            </button>
            <h3 style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, marginBottom: "0.25rem" }}>
              Secure File Sharing
            </h3>
            <p className="text-muted" style={{ fontSize: "var(--font-size-sm)", marginBottom: "1.5rem" }}>
              Share <strong>&quot;{selectedFileForShare.original_name}&quot;</strong> with cryptographic access controls.
            </p>

            {/* Share Mode Selector */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
              <button
                type="button"
                onClick={() => { setShareMode("link"); setGeneratedShareUrl(null); }}
                className={`btn ${shareMode === "link" ? "btn-primary" : "btn-secondary"}`}
                style={{ flex: 1, padding: "0.5rem", fontSize: "0.85rem" }}
              >
                🔗 Temporary Link
              </button>
              <button
                type="button"
                onClick={() => { setShareMode("user"); setGeneratedShareUrl(null); }}
                className={`btn ${shareMode === "user" ? "btn-primary" : "btn-secondary"}`}
                style={{ flex: 1, padding: "0.5rem", fontSize: "0.85rem" }}
              >
                👤 Registered User
              </button>
            </div>

            {/* User Share Email Input */}
            {shareMode === "user" && (
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">Recipient Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="recipient@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Expiration Duration */}
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label">Link Expiration</label>
              <select
                value={shareDuration}
                onChange={(e) => setShareDuration(e.target.value as ShareDuration)}
                className="form-input"
              >
                <option value="1h">1 Hour</option>
                <option value="24h">24 Hours (1 Day)</option>
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
                <option value="never">Never (Persistent)</option>
              </select>
            </div>

            {/* Permission Selector */}
            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label className="form-label">Access Permission</label>
              <select
                value={sharePermission}
                onChange={(e) => setSharePermission(e.target.value as SharePermission)}
                className="form-input"
              >
                <option value="can_download">📥 Allow Download & Decryption</option>
                <option value="view_only">👁️ View Only (Download Restricted)</option>
              </select>
            </div>

            <button
              onClick={handleGenerateShare}
              disabled={sharingLoading}
              className="btn btn-primary"
              style={{ width: "100%", marginBottom: "1rem" }}
            >
              {sharingLoading
                ? "Generating Secure Grant…"
                : shareMode === "link"
                ? "Generate Encrypted Share Link"
                : "Grant Access to User"}
            </button>

            {shareFeedback && (
              <div style={{ color: "var(--color-success)", fontSize: "0.85rem", marginBottom: "1rem", textAlign: "center" }}>
                ✓ {shareFeedback}
              </div>
            )}

            {/* Generated Link & Social Share Display */}
            {generatedShareUrl && (
              <div
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "1rem",
                  marginBottom: "1.25rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
                    🔒 Active Encrypted Share Link
                  </span>
                  <span className="badge badge-admin" style={{ fontSize: "0.7rem" }}>
                    Expires: {generatedShareObj?.expires_at ? new Date(generatedShareObj.expires_at).toLocaleString() : (shareDuration === "never" ? "Never" : shareDuration)}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.85rem" }}>
                  <input
                    type="text"
                    readOnly
                    value={generatedShareUrl}
                    className="form-input"
                    style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem" }}
                  />
                  <button
                    onClick={() => copyToClipboard(generatedShareUrl)}
                    className="btn btn-secondary"
                    style={{ width: "auto", padding: "0.4rem 0.85rem", fontSize: "0.8rem" }}
                  >
                    {copied ? "Copied! ✓" : "Copy"}
                  </button>
                </div>

                {/* WhatsApp One-Click Direct Action */}
                <div style={{ marginBottom: "0.85rem" }}>
                  <button
                    onClick={() => handleWhatsAppShare()}
                    className="btn"
                    style={{
                      width: "100%",
                      background: "linear-gradient(135deg, #25d366, #128c7e)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      padding: "0.6rem 1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      boxShadow: "0 4px 14px rgba(37, 211, 102, 0.35)",
                    }}
                  >
                    <span>💬</span>
                    <span>Share via WhatsApp</span>
                  </button>
                </div>

                {/* Social Sharing Multi-Platform Grid */}
                <div>
                  <div className="text-muted" style={{ fontSize: "0.75rem", marginBottom: "0.4rem", fontWeight: 600, textTransform: "uppercase" }}>
                    Multi-Platform Social Sharing:
                  </div>
                  <div className="social-share-grid">
                    <button
                      onClick={() => handleGmailShare()}
                      className="social-share-btn gmail"
                      title="Compose email in Gmail"
                    >
                      <span>✉️</span> Gmail
                    </button>
                    <button
                      onClick={() => handleTelegramShare()}
                      className="social-share-btn telegram"
                      title="Share in Telegram"
                    >
                      <span>✈️</span> Telegram
                    </button>
                    <button
                      onClick={() => handleTeamsShare()}
                      className="social-share-btn teams"
                      title="Share in Microsoft Teams"
                    >
                      <span>👥</span> MS Teams
                    </button>
                    <button
                      onClick={() => handleMailtoShare()}
                      className="social-share-btn email-direct"
                      title="Open default email client"
                    >
                      <span>📧</span> Default Mail
                    </button>
                  </div>
                </div>

                {/* Direct Email Dispatch Box */}
                <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px dashed var(--color-border)" }}>
                  <div className="text-muted" style={{ fontSize: "0.75rem", marginBottom: "0.35rem", fontWeight: 600 }}>
                    📧 Send Secure Link directly to Recipient Email:
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="email"
                      placeholder="recipient@example.com"
                      value={directEmailInput}
                      onChange={(e) => setDirectEmailInput(e.target.value)}
                      className="form-input"
                      style={{ fontSize: "0.8rem", padding: "0.4rem 0.6rem" }}
                    />
                    <button
                      onClick={handleSendDirectEmail}
                      disabled={directEmailLoading}
                      className="btn btn-primary"
                      style={{ width: "auto", padding: "0.4rem 0.85rem", fontSize: "0.8rem", whiteSpace: "nowrap" }}
                    >
                      {directEmailLoading ? "Sending…" : "Send Email"}
                    </button>
                  </div>
                  {directEmailStatus && (
                    <div style={{ color: "var(--color-success)", fontSize: "0.75rem", marginTop: "0.35rem" }}>
                      {directEmailStatus}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Active Shares List for this file */}
            {selectedFileForShare.shares && selectedFileForShare.shares.length > 0 && (
              <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--color-border)", paddingTop: "1rem" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                  Active Grants ({selectedFileForShare.shares.length})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "190px", overflowY: "auto" }}>
                  {selectedFileForShare.shares.map((s) => {
                    const fullGrantUrl = `${window.location.origin}${s.share_url}`;
                    return (
                      <div
                        key={s.share_token}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.6rem 0.75rem",
                          background: "var(--color-bg)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.8rem",
                        }}
                      >
                        <div style={{ flex: 1, marginRight: "0.5rem" }}>
                          <div style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>
                            {s.recipient_email ? `👤 ${s.recipient_email}` : "🔗 Public Link"} •{" "}
                            {s.permission === "can_download" ? "📥 Downloadable" : "👁️ View Only"}
                          </div>
                          <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                            {s.expires_at
                              ? `Expires: ${new Date(s.expires_at).toLocaleString()}`
                              : "Never expires"} • {s.download_count} downloads
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <button
                            onClick={() => handleWhatsAppShare(fullGrantUrl, s)}
                            className="action-btn"
                            style={{ color: "#25d366", borderColor: "rgba(37, 211, 102, 0.4)" }}
                            title="Share via WhatsApp"
                          >
                            💬
                          </button>
                          <button
                            onClick={() => handleGmailShare(fullGrantUrl, s)}
                            className="action-btn"
                            style={{ color: "#f87171", borderColor: "rgba(234, 67, 53, 0.4)" }}
                            title="Share via Gmail"
                          >
                            ✉️
                          </button>
                          <button
                            onClick={() => copyToClipboard(fullGrantUrl)}
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
                    );
                  })}
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
                { label: "Storage Backend", value: detailsModalFile.storage_backend === "supabase" ? "Supabase Cloud Storage (trustshare-files)" : "Secure Local Encrypted Vault" },
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
