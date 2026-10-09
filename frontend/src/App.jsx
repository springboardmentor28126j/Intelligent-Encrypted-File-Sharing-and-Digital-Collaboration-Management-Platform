import "./App.css";
import { useEffect, useMemo, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8002";

/* =========================================================
   HELPERS
========================================================= */

const formatLabel = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatDate = (value) => {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
};

const formatBytes = (bytes) => {
  const value = toNumber(bytes, 0);

  if (value === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];

  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );

  return `${(value / 1024 ** index).toFixed(
    index === 0 ? 0 : 2
  )} ${units[index]}`;
};

const getMonitorText = (item, fallback = "Activity") =>
  item?.action ||
  item?.event ||
  item?.activity ||
  item?.type ||
  item?.title ||
  fallback;

const getMonitorDescription = (item) =>
  item?.description ||
  item?.message ||
  item?.details ||
  item?.detail ||
  item?.content ||
  item?.body ||
  "";

const getMonitorTime = (item) =>
  item?.created_at ||
  item?.timestamp ||
  item?.occurred_at ||
  item?.updated_at ||
  item?.time;

const getMonitorIcon = (item) => {
  const text = `${item?.action || ""} ${
    item?.event || ""
  } ${item?.activity || ""} ${item?.type || ""} ${
    item?.title || ""
  }`.toLowerCase();

  if (text.includes("upload")) return "📤";
  if (text.includes("download")) return "⬇️";
  if (text.includes("share")) return "🤝";
  if (text.includes("login") || text.includes("auth"))
    return "🔐";
  if (text.includes("logout")) return "🚪";
  if (text.includes("delete")) return "🗑️";
  if (text.includes("temporary") || text.includes("link"))
    return "🔗";
  if (text.includes("access") || text.includes("view"))
    return "👁️";

  return "📋";
};

const getSeverity = (item) => {
  const value = String(
    item?.severity ||
      item?.level ||
      item?.priority ||
      "medium"
  ).toLowerCase();

  if (["critical", "high", "danger"].includes(value)) {
    return "high";
  }

  if (value === "low") return "low";

  if (["info", "normal"].includes(value)) {
    return "info";
  }

  return "medium";
};

const getSeverityStyle = (severity) => {
  const values = {
    high: {
      background: "#fef2f2",
      color: "#b91c1c",
      border: "#fecaca",
    },
    medium: {
      background: "#fff7ed",
      color: "#c2410c",
      border: "#fed7aa",
    },
    low: {
      background: "#fefce8",
      color: "#a16207",
      border: "#fde68a",
    },
    info: {
      background: "#eff6ff",
      color: "#1d4ed8",
      border: "#bfdbfe",
    },
  };

  return values[severity] || values.medium;
};

const getValueByKeys = (object, keys) => {
  if (!object || typeof object !== "object") {
    return null;
  }

  for (const key of keys) {
    if (
      object[key] !== undefined &&
      object[key] !== null
    ) {
      return object[key];
    }
  }

  return null;
};

const getInitials = (name) => {
  if (!name) return "U";

  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

/* =========================================================
   STYLES
========================================================= */

const styles = {
  app: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },

  authPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background:
      "linear-gradient(135deg, #0f172a 0%, #172554 50%, #1e3a8a 100%)",
  },

  authCard: {
    width: "100%",
    maxWidth: "440px",
    background: "#ffffff",
    borderRadius: "20px",
    padding: "32px",
    boxShadow: "0 25px 70px rgba(15,23,42,0.30)",
  },

  authLogo: {
    width: "58px",
    height: "58px",
    borderRadius: "16px",
    background: "#2563eb",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "27px",
    fontWeight: 900,
    marginBottom: "18px",
  },

  authTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 900,
  },

  authSubtitle: {
    marginTop: "8px",
    marginBottom: "26px",
    color: "#64748b",
    lineHeight: 1.6,
  },

  layout: {
    display: "flex",
    minHeight: "100vh",
  },

  sidebar: {
    width: "250px",
    flexShrink: 0,
    background: "#0f172a",
    color: "#ffffff",
    padding: "20px 14px",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },

  sidebarLogo: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    padding: "8px 10px 24px",
    fontWeight: 900,
    fontSize: "20px",
  },

  sidebarLogoIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "11px",
    background: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
  },

  sidebarSection: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    padding: "10px",
    textTransform: "uppercase",
  },

  navButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#cbd5e1",
    textAlign: "left",
    padding: "11px 12px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 700,
    marginBottom: "4px",
  },

  navButtonActive: {
    background: "#1d4ed8",
    color: "#ffffff",
  },

  sidebarBottom: {
    marginTop: "auto",
    borderTop: "1px solid #1e293b",
    paddingTop: "16px",
  },

  userMini: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px",
  },

  avatar: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    background: "#2563eb",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    flexShrink: 0,
  },

  userName: {
    color: "#ffffff",
    fontWeight: 800,
    fontSize: "13px",
  },

  userEmail: {
    color: "#94a3b8",
    fontSize: "11px",
    marginTop: "3px",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  logoutButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    padding: "9px 13px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 700,
  },

  main: {
    flex: 1,
    minWidth: 0,
  },

  topbar: {
    height: "70px",
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 28px",
    boxSizing: "border-box",
  },

  topbarTitle: {
    fontWeight: 900,
    color: "#0f172a",
    fontSize: "17px",
  },

  topbarRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  content: {
    padding: "28px",
    maxWidth: "1500px",
    margin: "0 auto",
  },

  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    marginBottom: "24px",
  },

  pageTitle: {
    margin: 0,
    fontSize: "27px",
    fontWeight: 900,
    color: "#0f172a",
  },

  pageSubtitle: {
    margin: "7px 0 0",
    color: "#64748b",
    lineHeight: 1.5,
  },

  dashboardHero: {
    background:
      "linear-gradient(135deg, #172554, #1d4ed8)",
    borderRadius: "18px",
    padding: "28px",
    color: "#ffffff",
    marginBottom: "22px",
  },

  heroTitle: {
    margin: 0,
    fontSize: "30px",
    fontWeight: 900,
  },

  heroText: {
    margin: "8px 0 0",
    color: "#dbeafe",
    maxWidth: "700px",
    lineHeight: 1.6,
  },

  statGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "16px",
    marginBottom: "22px",
  },

  statCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "20px",
  },

  statIcon: {
    fontSize: "23px",
    marginBottom: "12px",
  },

  statValue: {
    fontSize: "27px",
    fontWeight: 900,
    color: "#0f172a",
  },

  statLabel: {
    color: "#64748b",
    fontSize: "13px",
    marginTop: "4px",
    fontWeight: 700,
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "20px",
    marginBottom: "20px",
  },

  formCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "20px",
    marginBottom: "20px",
  },

  cardHeader: {
    marginBottom: "18px",
  },

  cardTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 900,
    color: "#0f172a",
  },

  cardDescription: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.5,
  },

  formGroup: {
    marginBottom: "16px",
  },

  label: {
    display: "block",
    marginBottom: "7px",
    fontSize: "13px",
    fontWeight: 800,
    color: "#334155",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
    padding: "11px 12px",
    fontSize: "14px",
    outline: "none",
    color: "#0f172a",
    background: "#ffffff",
  },

  select: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
    padding: "11px 12px",
    fontSize: "14px",
    outline: "none",
    color: "#0f172a",
    background: "#ffffff",
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
    padding: "11px 12px",
    fontSize: "14px",
    outline: "none",
    resize: "vertical",
  },

  primaryButton: {
    width: "100%",
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    padding: "11px 16px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: "14px",
  },

  smallButton: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "8px 12px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: "12px",
    whiteSpace: "nowrap",
  },

  dangerButton: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    padding: "8px 12px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: "12px",
    whiteSpace: "nowrap",
  },

  message: {
    padding: "11px 13px",
    borderRadius: "9px",
    marginBottom: "18px",
    fontSize: "13px",
    fontWeight: 700,
  },

  success: {
    background: "#f0fdf4",
    color: "#166534",
    border: "1px solid #bbf7d0",
  },

  error: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "720px",
  },

  th: {
    textAlign: "left",
    padding: "12px",
    borderBottom: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  td: {
    padding: "13px 12px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "13px",
    color: "#334155",
  },

  fileName: {
    fontWeight: 800,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 800,
    border: "1px solid",
  },

  severityBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 800,
    border: "1px solid",
  },

  empty: {
    padding: "45px 20px",
    textAlign: "center",
    color: "#64748b",
  },

  emptyIcon: {
    fontSize: "34px",
    marginBottom: "8px",
  },

  emptyTitle: {
    margin: 0,
    color: "#334155",
    fontSize: "17px",
    fontWeight: 900,
  },

  emptyText: {
    margin: "7px 0 0",
    fontSize: "13px",
    lineHeight: 1.5,
  },

  monitoringEmpty: {
    padding: "30px 16px",
    textAlign: "center",
  },

  linkResult: {
    marginTop: "18px",
    padding: "15px",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "10px",
  },

  linkText: {
    wordBreak: "break-all",
    background: "#ffffff",
    border: "1px solid #dcfce7",
    borderRadius: "8px",
    padding: "10px",
    fontSize: "12px",
    color: "#166534",
    marginBottom: "10px",
  },

  monitoringHeader: {
    background:
      "linear-gradient(135deg, #0f172a, #1e3a8a)",
    borderRadius: "18px",
    color: "#ffffff",
    padding: "25px",
    marginBottom: "20px",
  },

  monitoringHeaderContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
  },

  monitoringEyebrow: {
    fontSize: "11px",
    letterSpacing: "0.1em",
    fontWeight: 900,
    color: "#93c5fd",
  },

  monitoringTitle: {
    margin: "7px 0 0",
    fontSize: "28px",
    fontWeight: 900,
  },

  monitoringSubtitle: {
    margin: "6px 0 0",
    color: "#cbd5e1",
  },

  monitoringActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },

  monitoringStatus: {
    background: "rgba(34,197,94,0.16)",
    border: "1px solid rgba(134,239,172,0.35)",
    color: "#bbf7d0",
    padding: "8px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
  },

  monitoringRefresh: {
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.1)",
    color: "#ffffff",
    padding: "9px 13px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 800,
  },

  overviewGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  },

  overviewCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "18px",
  },

  overviewIcon: {
    fontSize: "21px",
    marginBottom: "10px",
  },

  overviewValue: {
    fontSize: "25px",
    fontWeight: 900,
  },

  overviewLabel: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#64748b",
    marginTop: "4px",
  },

  overviewTrend: {
    fontSize: "11px",
    color: "#64748b",
    marginTop: "8px",
    fontWeight: 700,
  },

  monitoringSummary: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "18px",
    marginBottom: "20px",
  },

  summaryBlock: {
    minWidth: 0,
  },

  summaryLabel: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#64748b",
  },

  summaryValue: {
    fontSize: "22px",
    fontWeight: 900,
    margin: "5px 0 10px",
  },

  progressTrack: {
    height: "7px",
    background: "#e2e8f0",
    borderRadius: "999px",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    background: "#2563eb",
    borderRadius: "999px",
  },

  monitorSectionGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "20px",
  },

  activityItem: {
    display: "flex",
    gap: "12px",
    padding: "13px 0",
    borderBottom: "1px solid #f1f5f9",
  },

  activityIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  activityTitle: {
    fontWeight: 800,
    color: "#0f172a",
    fontSize: "13px",
  },

  activityDescription: {
    marginTop: "4px",
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.5,
  },

  activityTime: {
    marginTop: "5px",
    color: "#94a3b8",
    fontSize: "11px",
  },

  notificationItem: {
    display: "flex",
    gap: "12px",
    padding: "13px",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    marginBottom: "9px",
  },

  notificationIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  auditCard: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "14px",
    padding: "20px",
    marginBottom: "20px",
  },

  auditTableWrapper: {
    overflowX: "auto",
  },

  auditTable: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "850px",
  },

  auditTh: {
    textAlign: "left",
    padding: "12px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: "12px",
  },

  auditTd: {
    padding: "12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#334155",
    fontSize: "12px",
  },

  auditAction: {
    fontWeight: 800,
    color: "#1d4ed8",
  },

  auditStatusSuccess: {
    background: "#f0fdf4",
    color: "#15803d",
    border: "1px solid #bbf7d0",
    borderRadius: "999px",
    padding: "5px 9px",
    fontWeight: 800,
    fontSize: "11px",
  },

  auditStatusFailed: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "999px",
    padding: "5px 9px",
    fontWeight: 800,
    fontSize: "11px",
  },

  auditStatusNeutral: {
    background: "#f8fafc",
    color: "#475569",
    border: "1px solid #cbd5e1",
    borderRadius: "999px",
    padding: "5px 9px",
    fontWeight: 800,
    fontSize: "11px",
  },

  analyticsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
  },

  analyticsCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "18px",
  },

  analyticsValue: {
    fontSize: "23px",
    fontWeight: 900,
    color: "#0f172a",
  },

  analyticsLabel: {
    marginTop: "5px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 800,
  },

  technicalDetails: {
    background: "#0f172a",
    color: "#e2e8f0",
    borderRadius: "14px",
    overflow: "hidden",
  },

  technicalSummary: {
    padding: "15px 18px",
    cursor: "pointer",
    fontWeight: 800,
  },

  technicalPre: {
    margin: 0,
    padding: "18px",
    overflow: "auto",
    fontSize: "11px",
    lineHeight: 1.6,
  },
};

/* =========================================================
   APP
========================================================= */

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
  const [shareDuration, setShareDuration] =
    useState("none");
  const [sharePermission, setSharePermission] =
    useState("view");

  const [editingShare, setEditingShare] = useState(null);

  const [manageSharePermission, setManageSharePermission] =
    useState("view");

  const [manageShareExpiry, setManageShareExpiry] =
    useState("none");

  const [shareManagementMessage, setShareManagementMessage] =
    useState("");

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activePage, setActivePage] =
    useState("dashboard");

  const [monitoringDashboard, setMonitoringDashboard] =
    useState(null);

  const [activity, setActivity] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] =
    useState([]);

  const [storageAnalytics, setStorageAnalytics] =
    useState(null);

  const [suspiciousActivity, setSuspiciousActivity] =
    useState([]);

  const [fileReports, setFileReports] =
    useState(null);

  const [temporaryLinkFile, setTemporaryLinkFile] =
    useState(null);

  const [temporaryLinkDuration, setTemporaryLinkDuration] =
    useState("1h");

  const [temporaryLinkResult, setTemporaryLinkResult] =
    useState("");

  /* =======================================================
     COMMON FUNCTIONS
  ======================================================= */

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const apiRequest = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});

    if (token) {
      headers.set(
        "Authorization",
        `Bearer ${token}`
      );
    }

    const response = await fetch(
      `${API_URL}${path}`,
      {
        ...options,
        headers,
      }
    );

    const contentType =
      response.headers.get("content-type") || "";

    let data = null;

    if (contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      try {
        const text = await response.text();
        data = text ? { message: text } : null;
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      let message =
        data?.detail ||
        data?.message ||
        `Request failed with status ${response.status}`;

      if (Array.isArray(message)) {
        message = message
          .map(
            (item) =>
              item?.msg ||
              item?.message ||
              JSON.stringify(item)
          )
          .join(", ");
      }

      throw new Error(String(message));
    }

    return data;
  };

  const getExpiryFromDuration = (duration) => {
    if (!duration || duration === "none") {
      return null;
    }

    const durations = {
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    };

    const milliseconds =
      durations[duration];

    if (!milliseconds) return null;

    return new Date(
      Date.now() + milliseconds
    ).toISOString();
  };

  const isExpired = (value) => {
    if (!value) return false;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    return date.getTime() <= Date.now();
  };

  /* =======================================================
     LOAD USER
  ======================================================= */

  const loadUser = async () => {
    try {
      const data = await apiRequest("/auth/me");

      setUser(
        data?.user ||
          data?.data ||
          data ||
          null
      );
    } catch (err) {
      if (
        err.message.toLowerCase().includes("401") ||
        err.message.toLowerCase().includes("token") ||
        err.message.toLowerCase().includes("unauthorized")
      ) {
        handleLogout();
      }
    }
  };

  /* =======================================================
     LOAD FILES
  ======================================================= */

  const loadFiles = async () => {
    try {
      const data = await apiRequest("/files");

      const list = Array.isArray(data)
        ? data
        : data?.files ||
          data?.data ||
          [];

      setFiles(list);
    } catch (err) {
      setFiles([]);
      throw err;
    }
  };

  /* =======================================================
     LOAD SHARED FILES
  ======================================================= */

  const loadSharedFiles = async () => {
    try {
      const data = await apiRequest(
        "/files/shared"
      );

      const received =
        data?.shared_with_me ||
        data?.received ||
        data?.incoming ||
        data?.files_shared_with_me ||
        [];

      const sent =
        data?.shared_by_me ||
        data?.sent ||
        data?.outgoing ||
        data?.files_shared_by_me ||
        [];

      if (Array.isArray(data)) {
        setSharedWithMe(data);
        setSharedByMe([]);
      } else {
        setSharedWithMe(
          Array.isArray(received)
            ? received
            : []
        );

        setSharedByMe(
          Array.isArray(sent)
            ? sent
            : []
        );
      }
    } catch (err) {
      /*
       * Some backend versions expose separate
       * endpoints. Try them if /files/shared
       * is not available.
       */

      try {
        const received =
          await apiRequest(
            "/files/shared-with-me"
          );

        setSharedWithMe(
          Array.isArray(received)
            ? received
            : received?.files || []
        );
      } catch {
        setSharedWithMe([]);
      }

      try {
        const sent =
          await apiRequest(
            "/files/shared-by-me"
          );

        setSharedByMe(
          Array.isArray(sent)
            ? sent
            : sent?.files || []
        );
      } catch {
        setSharedByMe([]);
      }
    }
  };

  /* =======================================================
     LOAD MONITORING
  ======================================================= */

  const loadMonitoring = async () => {
    const requests = [
      {
        path: "/monitoring/dashboard",
        setter: setMonitoringDashboard,
      },
      {
        path: "/monitoring/activity",
        setter: setActivity,
      },
      {
        path: "/monitoring/audit",
        setter: setAuditLogs,
      },
      {
        path: "/monitoring/alerts",
        setter: setAlerts,
      },
      {
        path: "/monitoring/notifications",
        setter: setNotifications,
      },
      {
        path: "/monitoring/storage",
        setter: setStorageAnalytics,
      },
      {
        path: "/monitoring/suspicious-activity",
        setter: setSuspiciousActivity,
      },
      {
        path: "/monitoring/file-reports",
        setter: setFileReports,
      },
    ];

    await Promise.all(
      requests.map(
        async ({ path, setter }) => {
          try {
            const data =
              await apiRequest(path);

            if (path.endsWith("/activity")) {
              setter(
                Array.isArray(data)
                  ? data
                  : data?.activity ||
                      data?.events ||
                      data?.data ||
                      []
              );
            } else if (
              path.endsWith("/audit")
            ) {
              setter(
                Array.isArray(data)
                  ? data
                  : data?.logs ||
                      data?.audit_logs ||
                      data?.data ||
                      []
              );
            } else if (
              path.endsWith("/alerts")
            ) {
              setter(
                Array.isArray(data)
                  ? data
                  : data?.alerts ||
                      data?.data ||
                      []
              );
            } else if (
              path.endsWith(
                "/notifications"
              )
            ) {
              setter(
                Array.isArray(data)
                  ? data
                  : data?.notifications ||
                      data?.data ||
                      []
              );
            } else if (
              path.endsWith(
                "/suspicious-activity"
              )
            ) {
              setter(
                Array.isArray(data)
                  ? data
                  : data?.suspicious_activity ||
                      data?.events ||
                      data?.data ||
                      []
              );
            } else {
              setter(data);
            }
          } catch {
            /*
             * Keep other monitoring cards working
             * if one optional endpoint is unavailable.
             */
          }
        }
      )
    );
  };

  const loadAllData = async () => {
    setLoading(true);

    try {
      await Promise.all([
        loadUser(),
        loadFiles(),
        loadSharedFiles(),
        loadMonitoring(),
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadAllData();
    }
  }, [token]);

  /* =======================================================
     AUTH
  ======================================================= */

  const handleLogin = async (event) => {
    event.preventDefault();

    clearMessages();
    setAuthLoading(true);

    try {
      const data = await fetch(`${API_URL}/auth/login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: loginForm.email.trim(),
    password: loginForm.password,
  }),
});

      const result =
        await data.json().catch(() => ({}));

      if (!data.ok) {
        throw new Error(
          result?.detail ||
            result?.message ||
            "Login failed."
        );
      }

      const accessToken =
        result?.access_token ||
        result?.token;

      if (!accessToken) {
        throw new Error(
          "Login succeeded but no access token was returned."
        );
      }

      localStorage.setItem(
        "trustshare_token",
        accessToken
      );

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
      await apiRequest("/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: registerForm.name.trim(),
          email: registerForm.email.trim(),
          password: registerForm.password,
        }),
      });

      setSuccess(
        "Registration successful. Please login."
      );

      setAuthMode("login");

      setLoginForm({
        email: registerForm.email,
        password: "",
      });

      setRegisterForm({
        name: "",
        email: "",
        password: "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(
      "trustshare_token"
    );

    setToken("");
    setUser(null);
    setFiles([]);
    setSharedWithMe([]);
    setSharedByMe([]);
    setActivity([]);
    setAuditLogs([]);
    setAlerts([]);
    setNotifications([]);
    setMonitoringDashboard(null);
    setStorageAnalytics(null);
    setSuspiciousActivity([]);
    setFileReports(null);
    setActivePage("dashboard");
    clearMessages();
  };

  /* =======================================================
     UPLOAD
  ======================================================= */

  const handleUpload = async (event) => {
    event.preventDefault();

    const file =
      event.target.elements.file?.files?.[0];

    if (!file) {
      setError("Please select a file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(
        "File size must be 10 MB or less."
      );
      return;
    }

    clearMessages();
    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("uploaded_file", file);

      await apiRequest("/files/upload", {
        method: "POST",
        body: formData,
      });

      setSuccess(
        `${file.name} uploaded successfully.`
      );

      event.target.reset();

      await loadFiles();
      await loadMonitoring();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  /* =======================================================
     DOWNLOAD
  ======================================================= */

  const handleDownload = async (file) => {
    if (!file?.id) {
      setError("File ID is missing.");
      return;
    }

    clearMessages();

    try {
      const headers = {};

      if (token) {
        headers.Authorization =
          `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_URL}/files/${file.id}/download`,
        {
          method: "GET",
          headers,
        }
      );

      if (!response.ok) {
        let message =
          `Download failed with status ${response.status}`;

        try {
          const data =
            await response.json();

          message =
            data?.detail ||
            data?.message ||
            message;
        } catch {
          // Keep default message.
        }

        throw new Error(message);
      }

      const blob =
        await response.blob();

      const objectUrl =
        window.URL.createObjectURL(blob);

      const anchor =
        document.createElement("a");

      anchor.href = objectUrl;

      anchor.download =
        file.original_filename ||
        file.filename ||
        "file";

      document.body.appendChild(anchor);

      anchor.click();

      anchor.remove();

      window.URL.revokeObjectURL(
        objectUrl
      );

      setSuccess(
        "File downloaded successfully."
      );

      await loadMonitoring();
    } catch (err) {
      setError(err.message);
    }
  };

  /* =======================================================
     DELETE
  ======================================================= */

  const handleDelete = async (file) => {
    if (!file?.id) {
      setError("File ID is missing.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${
        file.original_filename ||
        file.filename ||
        "this file"
      }"?`
    );

    if (!confirmed) return;

    clearMessages();

    try {
      await apiRequest(
        `/files/${file.id}`,
        {
          method: "DELETE",
        }
      );

      setSuccess(
        "File deleted successfully."
      );

      await loadFiles();
      await loadSharedFiles();
      await loadMonitoring();
    } catch (err) {
      setError(err.message);
    }
  };

  /* =======================================================
     SHARE
  ======================================================= */

  const handleShare = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setError("Please select a file.");
      return;
    }

    if (!recipientEmail.trim()) {
      setError(
        "Please enter the recipient email."
      );
      return;
    }

    clearMessages();

    try {
      const expiresAt =
        getExpiryFromDuration(
          shareDuration
        );

      await apiRequest(
        "/files/share",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            file_id: selectedFile.id,
            shared_with_email:
              recipientEmail.trim(),
            permission:
              sharePermission,
            expires_at: expiresAt,
          }),
        }
      );

      setSuccess(
        `File shared successfully with ${recipientEmail.trim()}.`
      );

      setRecipientEmail("");
      setSelectedFile(null);
      setShareDuration("none");
      setSharePermission("view");

      await loadAllData();
    } catch (err) {
      setError(err.message);
    }
  };

  /* =======================================================
     TEMPORARY LINK
  ======================================================= */

  const handleCreateTemporaryLink =
    async (event) => {
      event.preventDefault();

      if (!temporaryLinkFile) {
        setError("Please select a file.");
        return;
      }

      clearMessages();
      setTemporaryLinkResult("");

      try {
        const expiresAt =
          getExpiryFromDuration(
            temporaryLinkDuration
          );

        let data;

        try {
          data =
            await apiRequest(
              "/files/temporary-link",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  file_id:
                    temporaryLinkFile.id,
                  expires_at:
                    expiresAt,
                }),
              }
            );
        } catch {
          data =
            await apiRequest(
              "/files/temporary-access",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  file_id:
                    temporaryLinkFile.id,
                  expires_at:
                    expiresAt,
                }),
              }
            );
        }

        const link =
          data?.url ||
          data?.link ||
          data?.temporary_link ||
          data?.access_url ||
          data?.data?.url;

        if (!link) {
          throw new Error(
            "Temporary link was created but the server did not return the link."
          );
        }

        setTemporaryLinkResult(
          link
        );

        setSuccess(
          "Temporary access link created successfully."
        );

        await loadMonitoring();
      } catch (err) {
        setError(err.message);
      }
    };

  const copyTemporaryLink = async () => {
    if (!temporaryLinkResult) return;

    try {
      await navigator.clipboard.writeText(
        temporaryLinkResult
      );

      setSuccess(
        "Temporary link copied to clipboard."
      );
    } catch {
      setError(
        "Unable to copy the link automatically."
      );
    }
  };

  /* =======================================================
     SHARE MANAGEMENT
  ======================================================= */

  const getSharedFileName = (share) =>
    share?.file?.original_filename ||
    share?.file?.filename ||
    share?.original_filename ||
    share?.filename ||
    "Shared file";

  const startEditingShare = (share) => {
    setEditingShare(share.id);

    setManageSharePermission(
      share?.permission || "view"
    );

    setManageShareExpiry("none");
  };

  const handleUpdateShare = async (
    shareId
  ) => {
    if (!shareId) {
      setError(
        "Share ID is missing."
      );
      return;
    }

    clearMessages();

    try {
      const expiresAt =
        getExpiryFromDuration(
          manageShareExpiry
        );

      await apiRequest(
        `/files/share/${shareId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            permission:
              manageSharePermission,
            expires_at:
              expiresAt,
          }),
        }
      );

      setShareManagementMessage(
        "Shared access updated successfully."
      );

      setEditingShare(null);

      await loadAllData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRevokeShare = async (
    shareId
  ) => {
    if (!shareId) {
      setError(
        "Share ID is missing."
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to revoke this shared access?"
    );

    if (!confirmed) return;

    clearMessages();

    try {
      await apiRequest(
        `/files/share/${shareId}`,
        {
          method: "DELETE",
        }
      );

      setShareManagementMessage(
        "Shared access revoked successfully."
      );

      await loadAllData();
    } catch (err) {
      setError(err.message);
    }
  };

  /* =======================================================
     REFRESH
  ======================================================= */

  const handleRefresh = async () => {
    clearMessages();

    await loadAllData();

    setSuccess(
      "TrustShare data refreshed successfully."
    );
  };

  const handleMonitoringRefresh =
    async () => {
      clearMessages();

      setLoading(true);

      try {
        await Promise.all([
          loadFiles(),
          loadSharedFiles(),
          loadMonitoring(),
        ]);

        setSuccess(
          "Monitoring data refreshed successfully."
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

  /* =======================================================
     MONITORING CALCULATIONS
  ======================================================= */

  const totalRequests = useMemo(() => {
    const dashboardValue =
      getValueByKeys(
        monitoringDashboard,
        [
          "total_requests",
          "requests",
          "request_count",
          "total",
        ]
      );

    if (dashboardValue !== null) {
      return toNumber(
        dashboardValue,
        auditLogs.length
      );
    }

    return auditLogs.length;
  }, [
    monitoringDashboard,
    auditLogs,
  ]);

  const successfulRequests =
    useMemo(() => {
      const dashboardValue =
        getValueByKeys(
          monitoringDashboard,
          [
            "successful_requests",
            "success_count",
            "successful",
          ]
        );

      if (dashboardValue !== null) {
        return toNumber(
          dashboardValue,
          0
        );
      }

      return auditLogs.filter(
        (log) => {
          const status =
            String(
              log?.status || ""
            ).toLowerCase();

          const code =
            Number(
              log?.status_code
            );

          return (
            status.includes("success") ||
            (code >= 200 &&
              code < 400)
          );
        }
      ).length;
    }, [
      monitoringDashboard,
      auditLogs,
    ]);

  const failedRequests =
    useMemo(() => {
      const dashboardValue =
        getValueByKeys(
          monitoringDashboard,
          [
            "failed_requests",
            "failure_count",
            "failed",
          ]
        );

      if (dashboardValue !== null) {
        return toNumber(
          dashboardValue,
          0
        );
      }

      return auditLogs.filter(
        (log) => {
          const status =
            String(
              log?.status || ""
            ).toLowerCase();

          const code =
            Number(
              log?.status_code
            );

          return (
            status.includes("fail") ||
            code >= 400
          );
        }
      ).length;
    }, [
      monitoringDashboard,
      auditLogs,
    ]);

  const successRate =
    totalRequests > 0
      ? Math.round(
          (successfulRequests /
            totalRequests) *
            100
        )
      : 0;

  const storageFileCount =
    toNumber(
      getValueByKeys(
        storageAnalytics,
        [
          "file_count",
          "files_count",
          "total_files",
          "stored_files",
        ]
      ),
      files.length
    );

  const storageBytes =
    toNumber(
      getValueByKeys(
        storageAnalytics,
        [
          "storage_bytes",
          "total_bytes",
          "total_size",
          "used_bytes",
        ]
      ),
      files.reduce(
        (total, file) =>
          total +
          toNumber(
            file?.size ||
              file?.file_size ||
              file?.size_bytes,
            0
          ),
        0
      )
    );

  const storageMb =
    storageBytes / 1024 / 1024;

  const totalStorage =
    storageBytes;

  const dashboardFileCount =
    toNumber(
      getValueByKeys(
        monitoringDashboard,
        [
          "file_count",
          "files_count",
          "total_files",
        ]
      ),
      files.length
    );

  const unreadNotifications =
    notifications.filter(
      (item) =>
        item?.read === false ||
        item?.is_read === false ||
        String(
          item?.status || ""
        ).toLowerCase() ===
          "unread"
    ).length;

  /* =======================================================
     AUTH PAGE
  ======================================================= */

  if (!token) {
    return (
      <div style={styles.authPage}>
        <div style={styles.authCard}>
          <div style={styles.authLogo}>
            🔐
          </div>

          <h1 style={styles.authTitle}>
            TrustShare
          </h1>

          <p style={styles.authSubtitle}>
            Secure encrypted file sharing and
            digital collaboration platform.
          </p>

          {error && (
            <div
              style={{
                ...styles.message,
                ...styles.error,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                ...styles.message,
                ...styles.success,
              }}
            >
              {success}
            </div>
          )}

          {authMode === "login" ? (
            <form onSubmit={handleLogin}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Email
                </label>

                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm({
                      ...loginForm,
                      email:
                        event.target.value,
                    })
                  }
                  placeholder="you@example.com"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Password
                </label>

                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm({
                      ...loginForm,
                      password:
                        event.target.value,
                    })
                  }
                  placeholder="Enter your password"
                  style={styles.input}
                  required
                />
              </div>

              <button
                type="submit"
                style={styles.primaryButton}
                disabled={authLoading}
              >
                {authLoading
                  ? "Signing in..."
                  : "🔐 Sign In"}
              </button>

              <button
                type="button"
                style={{
                  ...styles.logoutButton,
                  width: "100%",
                  marginTop: "10px",
                }}
                onClick={() => {
                  clearMessages();
                  setAuthMode(
                    "register"
                  );
                }}
              >
                Create an account
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Full Name
                </label>

                <input
                  type="text"
                  value={registerForm.name}
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      name:
                        event.target.value,
                    })
                  }
                  placeholder="Your name"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Email
                </label>

                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      email:
                        event.target.value,
                    })
                  }
                  placeholder="you@example.com"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Password
                </label>

                <input
                  type="password"
                  value={
                    registerForm.password
                  }
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      password:
                        event.target.value,
                    })
                  }
                  placeholder="Create a password"
                  style={styles.input}
                  required
                />
              </div>

              <button
                type="submit"
                style={styles.primaryButton}
                disabled={authLoading}
              >
                {authLoading
                  ? "Creating..."
                  : "Create Account"}
              </button>

              <button
                type="button"
                style={{
                  ...styles.logoutButton,
                  width: "100%",
                  marginTop: "10px",
                }}
                onClick={() => {
                  clearMessages();
                  setAuthMode("login");
                }}
              >
                Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const navigation = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "📊",
    },
    {
      id: "files",
      label: "My Files",
      icon: "📁",
    },
    {
      id: "shared",
      label: "Shared Files",
      icon: "🤝",
    },
    {
      id: "temporary",
      label: "Temporary Access",
      icon: "🔗",
    },
    {
      id: "monitoring",
      label: "Monitoring",
      icon: "🛡️",
    },
  ];

  /* =======================================================
     MAIN APP
  ======================================================= */

  return (
    <div style={styles.app}>
      <div style={styles.layout}>
        {/* SIDEBAR */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarLogo}>
            <div style={styles.sidebarLogoIcon}>
              🔐
            </div>

            <span>TrustShare</span>
          </div>

          <div style={styles.sidebarSection}>
            Workspace
          </div>

          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              style={{
                ...styles.navButton,
                ...(activePage === item.id
                  ? styles.navButtonActive
                  : {}),
              }}
              onClick={() => {
                clearMessages();
                setActivePage(item.id);
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "25px",
                }}
              >
                {item.icon}
              </span>

              {item.label}
            </button>
          ))}

          <div style={styles.sidebarBottom}>
            <div style={styles.userMini}>
              <div style={styles.avatar}>
                {getInitials(
                  user?.name ||
                    user?.full_name ||
                    user?.email
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={styles.userName}>
                  {user?.name ||
                    user?.full_name ||
                    "TrustShare User"}
                </div>

                <div style={styles.userEmail}>
                  {user?.email ||
                    "Authenticated user"}
                </div>
              </div>
            </div>

            <button
              type="button"
              style={{
                ...styles.logoutButton,
                width: "100%",
                marginTop: "10px",
              }}
              onClick={handleLogout}
            >
              🚪 Logout
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main style={styles.main}>
          <header style={styles.topbar}>
            <div style={styles.topbarTitle}>
              {navigation.find(
                (item) =>
                  item.id === activePage
              )?.label ||
                "TrustShare"}
            </div>

            <div style={styles.topbarRight}>
              <span
                style={{
                  fontSize: "12px",
                  color: "#64748b",
                  fontWeight: 700,
                }}
              >
                🔒 Secure Workspace
              </span>
            </div>
          </header>

          <div style={styles.content}>
            {error && (
              <div
                style={{
                  ...styles.message,
                  ...styles.error,
                }}
              >
                {error}
              </div>
            )}

            {success && (
              <div
                style={{
                  ...styles.message,
                  ...styles.success,
                }}
              >
                {success}
              </div>
            )}

            {/* =================================================
                DASHBOARD
            ================================================= */}

            {activePage === "dashboard" && (
              <>
                <div style={styles.dashboardHero}>
                  <h1 style={styles.heroTitle}>
                    Welcome to TrustShare
                  </h1>

                  <p style={styles.heroText}>
                    Securely upload, encrypt,
                    share and monitor your files
                    from one trusted collaboration
                    workspace.
                  </p>
                </div>

                <div style={styles.statGrid}>
                  <div style={styles.statCard}>
                    <div style={styles.statIcon}>
                      📁
                    </div>

                    <div style={styles.statValue}>
                      {files.length}
                    </div>

                    <div style={styles.statLabel}>
                      My Files
                    </div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={styles.statIcon}>
                      🤝
                    </div>

                    <div style={styles.statValue}>
                      {sharedWithMe.length +
                        sharedByMe.length}
                    </div>

                    <div style={styles.statLabel}>
                      Shared Files
                    </div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={styles.statIcon}>
                      📝
                    </div>

                    <div style={styles.statValue}>
                      {activity.length}
                    </div>

                    <div style={styles.statLabel}>
                      Activity Events
                    </div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={styles.statIcon}>
                      🔔
                    </div>

                    <div style={styles.statValue}>
                      {unreadNotifications}
                    </div>

                    <div style={styles.statLabel}>
                      Unread Notifications
                    </div>
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <h2 style={styles.cardTitle}>
                      Security Overview
                    </h2>

                    <p
                      style={
                        styles.cardDescription
                      }
                    >
                      TrustShare protects your
                      collaboration workflow with
                      authentication, encryption,
                      controlled sharing and
                      activity monitoring.
                    </p>
                  </div>

                  <div style={styles.analyticsGrid}>
                    <div
                      style={
                        styles.analyticsCard
                      }
                    >
                      <div
                        style={
                          styles.analyticsValue
                        }
                      >
                        🔐
                      </div>

                      <div
                        style={
                          styles.analyticsLabel
                        }
                      >
                        Encrypted File Storage
                      </div>
                    </div>

                    <div
                      style={
                        styles.analyticsCard
                      }
                    >
                      <div
                        style={
                          styles.analyticsValue
                        }
                      >
                        🤝
                      </div>

                      <div
                        style={
                          styles.analyticsLabel
                        }
                      >
                        Controlled File Sharing
                      </div>
                    </div>

                    <div
                      style={
                        styles.analyticsCard
                      }
                    >
                      <div
                        style={
                          styles.analyticsValue
                        }
                      >
                        🔗
                      </div>

                      <div
                        style={
                          styles.analyticsLabel
                        }
                      >
                        Temporary Access
                      </div>
                    </div>

                    <div
                      style={
                        styles.analyticsCard
                      }
                    >
                      <div
                        style={
                          styles.analyticsValue
                        }
                      >
                        📜
                      </div>

                      <div
                        style={
                          styles.analyticsLabel
                        }
                      >
                        Security Audit Logs
                      </div>
                    </div>
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <h2 style={styles.cardTitle}>
                      Recent Activity
                    </h2>

                    <p
                      style={
                        styles.cardDescription
                      }
                    >
                      Latest actions in your
                      TrustShare workspace.
                    </p>
                  </div>

                  {activity.length === 0 ? (
                    <div style={styles.empty}>
                      <div style={styles.emptyIcon}>
                        📋
                      </div>

                      <h3
                        style={styles.emptyTitle}
                      >
                        No activity yet
                      </h3>

                      <p
                        style={styles.emptyText}
                      >
                        Upload, download or share a
                        file to create activity.
                      </p>
                    </div>
                  ) : (
                    activity
                      .slice(0, 5)
                      .map((item, index) => (
                        <div
                          key={
                            item?.id ||
                            index
                          }
                          style={
                            styles.activityItem
                          }
                        >
                          <div
                            style={
                              styles.activityIcon
                            }
                          >
                            {getMonitorIcon(
                              item
                            )}
                          </div>

                          <div>
                            <div
                              style={
                                styles.activityTitle
                              }
                            >
                              {formatLabel(
                                getMonitorText(
                                  item
                                )
                              )}
                            </div>

                            <div
                              style={
                                styles.activityDescription
                              }
                            >
                              {getMonitorDescription(
                                item
                              ) ||
                                "Security activity recorded."}
                            </div>

                            <div
                              style={
                                styles.activityTime
                              }
                            >
                              {formatDate(
                                getMonitorTime(
                                  item
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </>
            )}

            {/* =================================================
                MY FILES
            ================================================= */}

            {activePage === "files" && (
              <>
                <div style={styles.pageHeader}>
                  <div>
                    <h1
                      style={styles.pageTitle}
                    >
                      My Files
                    </h1>

                    <p
                      style={
                        styles.pageSubtitle
                      }
                    >
                      Upload and manage your
                      encrypted files.
                    </p>
                  </div>

                  <button
                    type="button"
                    style={
                      styles.smallButton
                    }
                    onClick={handleRefresh}
                    disabled={loading}
                  >
                    {loading
                      ? "Refreshing..."
                      : "Refresh"}
                  </button>
                </div>

                <div style={styles.formCard}>
                  <div style={styles.cardHeader}>
                    <h2
                      style={styles.cardTitle}
                    >
                      Upload New File
                    </h2>

                    <p
                      style={
                        styles.cardDescription
                      }
                    >
                      Files are securely processed
                      by the TrustShare backend.
                      Maximum file size: 10 MB.
                    </p>
                  </div>

                  <form
                    onSubmit={handleUpload}
                  >
                    <div
                      style={
                        styles.formGroup
                      }
                    >
                      <label
                        style={
                          styles.label
                        }
                      >
                        Select File
                      </label>

                      <input
                        type="file"
                        name="file"
                        style={styles.input}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      style={
                        styles.primaryButton
                      }
                      disabled={uploading}
                    >
                      {uploading
                        ? "Uploading..."
                        : "📤 Upload Securely"}
                    </button>
                  </form>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <h2
                      style={styles.cardTitle}
                    >
                      Your Files
                    </h2>

                    <p
                      style={
                        styles.cardDescription
                      }
                    >
                      Files uploaded to your
                      TrustShare workspace.
                    </p>
                  </div>

                  {files.length === 0 ? (
                    <div
                      style={styles.empty}
                    >
                      <div
                        style={
                          styles.emptyIcon
                        }
                      >
                        📁
                      </div>

                      <h3
                        style={
                          styles.emptyTitle
                        }
                      >
                        No files uploaded
                      </h3>

                      <p
                        style={
                          styles.emptyText
                        }
                      >
                        Upload your first file to
                        get started.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={
                        styles.tableWrapper
                      }
                    >
                      <table
                        style={styles.table}
                      >
                        <thead>
                          <tr>
                            <th
                              style={
                                styles.th
                              }
                            >
                              File
                            </th>

                            <th
                              style={
                                styles.th
                              }
                            >
                              Size
                            </th>

                            <th
                              style={
                                styles.th
                              }
                            >
                              Uploaded
                            </th>

                            <th
                              style={
                                styles.th
                              }
                            >
                              Status
                            </th>

                            <th
                              style={
                                styles.th
                              }
                            >
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {files.map(
                            (file) => (
                              <tr
                                key={
                                  file.id
                                }
                              >
                                <td
                                  style={
                                    styles.td
                                  }
                                >
                                  <div
                                    style={
                                      styles.fileName
                                    }
                                  >
                                    {file.original_filename ||
                                      file.filename ||
                                      "Unnamed file"}
                                  </div>
                                </td>

                                <td
                                  style={
                                    styles.td
                                  }
                                >
                                  {formatBytes(
                                    file.size ||
                                      file.file_size ||
                                      file.size_bytes
                                  )}
                                </td>

                                <td
                                  style={
                                    styles.td
                                  }
                                >
                                  {formatDate(
                                    file.created_at ||
                                      file.uploaded_at ||
                                      file.createdAt
                                  )}
                                </td>

                                <td
                                  style={
                                    styles.td
                                  }
                                >
                                  <span
                                    style={{
                                      ...styles.statusBadge,
                                      background:
                                        "#f0fdf4",
                                      color:
                                        "#15803d",
                                      borderColor:
                                        "#bbf7d0",
                                    }}
                                  >
                                    🔐 Encrypted
                                  </span>
                                </td>

                                <td
                                  style={{
                                    ...styles.td,
                                    display:
                                      "flex",
                                    gap: "8px",
                                    flexWrap:
                                      "wrap",
                                  }}
                                >
                                  <button
                                    type="button"
                                    style={
                                      styles.smallButton
                                    }
                                    onClick={() =>
                                      handleDownload(
                                        file
                                      )
                                    }
                                  >
                                    Download
                                  </button>

                                  <button
                                    type="button"
                                    style={
                                      styles.dangerButton
                                    }
                                    onClick={() =>
                                      handleDelete(
                                        file
                                      )
                                    }
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* =================================================
                SHARED FILES
            ================================================= */}

            {activePage === "shared" && (
              <>
                <div style={styles.pageHeader}>
                  <div>
                    <h1
                      style={styles.pageTitle}
                    >
                      Shared Files
                    </h1>

                    <p
                      style={
                        styles.pageSubtitle
                      }
                    >
                      Collaborate securely by sharing
                      encrypted files.
                    </p>
                  </div>

                  <button
                    type="button"
                    style={
                      styles.smallButton
                    }
                    onClick={handleRefresh}
                    disabled={loading}
                  >
                    {loading
                      ? "Refreshing..."
                      : "Refresh"}
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: "20px",
                  }}
                >
                  {/* SHARE A FILE */}
                  <div
                    style={
                      styles.formCard
                    }
                  >
                    <div
                      style={
                        styles.cardHeader
                      }
                    >
                      <h2
                        style={
                          styles.cardTitle
                        }
                      >
                        Share a File
                      </h2>

                      <p
                        style={
                          styles.cardDescription
                        }
                      >
                        Grant controlled access to
                        another TrustShare user.
                      </p>
                    </div>

                    <form
                      onSubmit={handleShare}
                    >
                      <div
                        style={
                          styles.formGroup
                        }
                      >
                        <label
                          style={
                            styles.label
                          }
                        >
                          Select File
                        </label>

                        <select
                          value={
                            selectedFile?.id ||
                            ""
                          }
                          onChange={(event) => {
                            const file =
                              files.find(
                                (item) =>
                                  String(
                                    item.id
                                  ) ===
                                  String(
                                    event
                                      .target
                                      .value
                                  )
                              );

                            setSelectedFile(
                              file ||
                                null
                            );
                          }}
                          style={
                            styles.select
                          }
                          required
                        >
                          <option value="">
                            Select a file
                          </option>

                          {files.map(
                            (file) => (
                              <option
                                key={
                                  file.id
                                }
                                value={
                                  file.id
                                }
                              >
                                {file.original_filename ||
                                  file.filename ||
                                  "Unnamed file"}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div
                        style={
                          styles.formGroup
                        }
                      >
                        <label
                          style={
                            styles.label
                          }
                        >
                          Recipient Email
                        </label>

                        <input
                          type="email"
                          value={
                            recipientEmail
                          }
                          onChange={(
                            event
                          ) =>
                            setRecipientEmail(
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="user@example.com"
                          style={
                            styles.input
                          }
                          required
                        />
                      </div>

                      <div
                        style={
                          styles.formGroup
                        }
                      >
                        <label
                          style={
                            styles.label
                          }
                        >
                          Access Duration
                        </label>

                        <select
                          value={
                            shareDuration
                          }
                          onChange={(
                            event
                          ) =>
                            setShareDuration(
                              event
                                .target
                                .value
                            )
                          }
                          style={
                            styles.select
                          }
                        >
                          <option value="none">
                            No Expiry
                          </option>

                          <option value="5m">
                            5 Minutes
                          </option>

                          <option value="15m">
                            15 Minutes
                          </option>

                          <option value="1h">
                            1 Hour
                          </option>

                          <option value="6h">
                            6 Hours
                          </option>

                          <option value="24h">
                            24 Hours
                          </option>

                          <option value="7d">
                            7 Days
                          </option>
                        </select>
                      </div>

                      <div
                        style={
                          styles.formGroup
                        }
                      >
                        <label
                          style={
                            styles.label
                          }
                        >
                          Permission
                        </label>

                        <select
                          value={
                            sharePermission
                          }
                          onChange={(
                            event
                          ) =>
                            setSharePermission(
                              event
                                .target
                                .value
                            )
                          }
                          style={
                            styles.select
                          }
                        >
                          <option value="view">
                            View Only
                          </option>

                          <option value="edit">
                            View & Edit
                          </option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        style={
                          styles.primaryButton
                        }
                      >
                        🤝 Share Securely
                      </button>
                    </form>
                  </div>

                  {/* SHARED WITH ME */}
                  <div style={styles.card}>
                    <div
                      style={
                        styles.cardHeader
                      }
                    >
                      <h2
                        style={
                          styles.cardTitle
                        }
                      >
                        Files Shared With Me
                      </h2>

                      <p
                        style={
                          styles.cardDescription
                        }
                      >
                        Files that other TrustShare
                        users have shared with you.
                      </p>
                    </div>

                    {sharedWithMe.length ===
                    0 ? (
                      <div
                        style={
                          styles.monitoringEmpty
                        }
                      >
                        <div
                          style={
                            styles.emptyIcon
                          }
                        >
                          🤝
                        </div>

                        <h3
                          style={
                            styles.emptyTitle
                          }
                        >
                          No shared files
                        </h3>

                        <p
                          style={
                            styles.emptyText
                          }
                        >
                          Files shared with you
                          will appear here.
                        </p>
                      </div>
                    ) : (
                      <div>
                        {sharedWithMe.map(
                          (
                            item,
                            index
                          ) => {
                            const expired =
                              isExpired(
                                item?.expires_at
                              );

                            const sharedFileForDownload =
                              {
                                id:
                                  item?.file_id ||
                                  item?.file?.id,
                                original_filename:
                                  item?.original_filename ||
                                  item?.filename ||
                                  item
                                    ?.file
                                    ?.original_filename ||
                                  item
                                    ?.file
                                    ?.filename ||
                                  "shared-file",
                              };

                            return (
                              <div
                                key={
                                  item?.id ||
                                  `${item?.file_id}-${index}`
                                }
                                style={{
                                  padding:
                                    "14px 0",
                                  borderBottom:
                                    "1px solid #f1f5f9",
                                }}
                              >
                                <div
                                  style={{
                                    display:
                                      "flex",
                                    justifyContent:
                                      "space-between",
                                    alignItems:
                                      "flex-start",
                                    gap: "12px",
                                  }}
                                >
                                  <div
                                    style={{
                                      minWidth: 0,
                                    }}
                                  >
                                    <div
                                      style={
                                        styles.fileName
                                      }
                                    >
                                      {item
                                        ?.file
                                        ?.original_filename ||
                                        item
                                          ?.file
                                          ?.filename ||
                                        item?.original_filename ||
                                        item?.filename ||
                                        "Shared file"}
                                    </div>

                                    <div
                                      style={{
                                        fontSize:
                                          "12px",
                                        color:
                                          "#64748b",
                                        marginTop:
                                          "5px",
                                      }}
                                    >
                                      From:{" "}
                                      {item?.owner_email ||
                                        item?.shared_by_email ||
                                        item
                                          ?.owner
                                          ?.email ||
                                        item?.user_email ||
                                        "TrustShare user"}
                                    </div>

                                    <div
                                      style={{
                                        display:
                                          "flex",
                                        flexWrap:
                                          "wrap",
                                        gap: "7px",
                                        marginTop:
                                          "8px",
                                      }}
                                    >
                                      <span
                                        style={{
                                          ...styles.severityBadge,
                                          background:
                                            "#eff6ff",
                                          color:
                                            "#1d4ed8",
                                          borderColor:
                                            "#bfdbfe",
                                        }}
                                      >
                                        {formatLabel(
                                          item?.permission ||
                                            "view"
                                        )}
                                      </span>

                                      <span
                                        style={{
                                          ...styles.severityBadge,
                                          background:
                                            expired
                                              ? "#fef2f2"
                                              : "#f8fafc",
                                          color:
                                            expired
                                              ? "#b91c1c"
                                              : "#475569",
                                          borderColor:
                                            expired
                                              ? "#fecaca"
                                              : "#cbd5e1",
                                        }}
                                      >
                                        {expired
                                          ? "Expired"
                                          : item?.expires_at
                                          ? `Expires ${formatDate(
                                              item.expires_at
                                            )}`
                                          : "No expiry"}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    style={{
                                      ...styles.smallButton,
                                      opacity:
                                        !sharedFileForDownload.id ||
                                        expired
                                          ? 0.5
                                          : 1,
                                    }}
                                    disabled={
                                      !sharedFileForDownload.id ||
                                      expired
                                    }
                                    onClick={() =>
                                      handleDownload(
                                        sharedFileForDownload
                                      )
                                    }
                                  >
                                    Download
                                  </button>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* MANAGE SHARED ACCESS */}
                <div style={styles.card}>
                  <div
                    style={
                      styles.cardHeader
                    }
                  >
                    <h2
                      style={
                        styles.cardTitle
                      }
                    >
                      Manage Shared Access
                    </h2>

                    <p
                      style={
                        styles.cardDescription
                      }
                    >
                      Review, update, or revoke files
                      you have shared with other
                      users.
                    </p>
                  </div>

                  {shareManagementMessage && (
                    <div
                      style={{
                        ...styles.message,
                        ...styles.success,
                      }}
                    >
                      {shareManagementMessage}
                    </div>
                  )}

                  {sharedByMe.length === 0 ? (
                    <div
                      style={
                        styles.monitoringEmpty
                      }
                    >
                      <div
                        style={
                          styles.emptyIcon
                        }
                      >
                        📤
                      </div>

                      <h3
                        style={
                          styles.emptyTitle
                        }
                      >
                        No shared access
                      </h3>

                      <p
                        style={
                          styles.emptyText
                        }
                      >
                        Files you share with other
                        users will appear here.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gap: "12px",
                      }}
                    >
                      {sharedByMe.map(
                        (share) => {
                          const expired =
                            isExpired(
                              share?.expires_at
                            );

                          const isEditing =
                            editingShare ===
                            share.id;

                          return (
                            <div
                              key={
                                share.id
                              }
                              style={{
                                border:
                                  "1px solid #e2e8f0",
                                borderRadius:
                                  "12px",
                                padding:
                                  "16px",
                                background:
                                  "#ffffff",
                              }}
                            >
                              <div
                                style={{
                                  display:
                                    "flex",
                                  justifyContent:
                                    "space-between",
                                  alignItems:
                                    "flex-start",
                                  gap: "16px",
                                  flexWrap:
                                    "wrap",
                                }}
                              >
                                <div
                                  style={{
                                    minWidth: 0,
                                    flex: 1,
                                  }}
                                >
                                  <div
                                    style={
                                      styles.fileName
                                    }
                                  >
                                    {getSharedFileName(
                                      share
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      fontSize:
                                        "12px",
                                      color:
                                        "#64748b",
                                      marginTop:
                                        "6px",
                                    }}
                                  >
                                    Shared with:{" "}
                                    <strong>
                                      {share?.shared_with_email ||
                                        share?.recipient_email ||
                                        share
                                          ?.shared_with
                                          ?.email ||
                                        "Unknown user"}
                                    </strong>
                                  </div>

                                  <div
                                    style={{
                                      display:
                                        "flex",
                                      gap: "8px",
                                      flexWrap:
                                        "wrap",
                                      marginTop:
                                        "9px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        ...styles.severityBadge,
                                        background:
                                          "#eff6ff",
                                        color:
                                          "#1d4ed8",
                                        borderColor:
                                          "#bfdbfe",
                                      }}
                                    >
                                      {formatLabel(
                                        share?.permission ||
                                          "view"
                                      )}
                                    </span>

                                    <span
                                      style={{
                                        ...styles.severityBadge,
                                        background:
                                          expired
                                            ? "#fef2f2"
                                            : "#f8fafc",
                                        color:
                                          expired
                                            ? "#b91c1c"
                                            : "#475569",
                                        borderColor:
                                          expired
                                            ? "#fecaca"
                                            : "#cbd5e1",
                                      }}
                                    >
                                      {expired
                                        ? "Expired"
                                        : share?.expires_at
                                        ? `Expires ${formatDate(
                                            share.expires_at
                                          )}`
                                        : "No expiry"}
                                    </span>
                                  </div>
                                </div>

                                {!isEditing && (
                                  <div
                                    style={{
                                      display:
                                        "flex",
                                      gap: "8px",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      style={
                                        styles.smallButton
                                      }
                                      onClick={() =>
                                        startEditingShare(
                                          share
                                        )
                                      }
                                    >
                                      Edit
                                    </button>

                                    <button
                                      type="button"
                                      style={
                                        styles.dangerButton
                                      }
                                      onClick={() =>
                                        handleRevokeShare(
                                          share.id
                                        )
                                      }
                                    >
                                      Revoke
                                    </button>
                                  </div>
                                )}
                              </div>

                              {isEditing && (
                                <div
                                  style={{
                                    marginTop:
                                      "16px",
                                    paddingTop:
                                      "16px",
                                    borderTop:
                                      "1px solid #e2e8f0",
                                  }}
                                >
                                  <div
                                    style={{
                                      display:
                                        "grid",
                                      gridTemplateColumns:
                                        "repeat(auto-fit, minmax(220px, 1fr))",
                                      gap: "14px",
                                    }}
                                  >
                                    <div
                                      style={
                                        styles.formGroup
                                      }
                                    >
                                      <label
                                        style={
                                          styles.label
                                        }
                                      >
                                        Permission
                                      </label>

                                      <select
                                        value={
                                          manageSharePermission
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          setManageSharePermission(
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        style={
                                          styles.select
                                        }
                                      >
                                        <option value="view">
                                          View Only
                                        </option>

                                        <option value="edit">
                                          View & Edit
                                        </option>
                                      </select>
                                    </div>

                                    <div
                                      style={
                                        styles.formGroup
                                      }
                                    >
                                      <label
                                        style={
                                          styles.label
                                        }
                                      >
                                        Access Expiry
                                      </label>

                                      <select
                                        value={
                                          manageShareExpiry
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          setManageShareExpiry(
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        style={
                                          styles.select
                                        }
                                      >
                                        <option value="none">
                                          No Expiry
                                        </option>

                                        <option value="5m">
                                          5 Minutes
                                        </option>

                                        <option value="15m">
                                          15 Minutes
                                        </option>

                                        <option value="1h">
                                          1 Hour
                                        </option>

                                        <option value="6h">
                                          6 Hours
                                        </option>

                                        <option value="24h">
                                          24 Hours
                                        </option>

                                        <option value="7d">
                                          7 Days
                                        </option>
                                      </select>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      display:
                                        "flex",
                                      gap: "8px",
                                      marginTop:
                                        "4px",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      style={{
                                        ...styles.primaryButton,
                                        width:
                                          "auto",
                                      }}
                                      onClick={() =>
                                        handleUpdateShare(
                                          share.id
                                        )
                                      }
                                    >
                                      Save Changes
                                    </button>

                                    <button
                                      type="button"
                                      style={
                                        styles.logoutButton
                                      }
                                      onClick={() =>
                                        setEditingShare(
                                          null
                                        )
                                      }
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* =================================================
                TEMPORARY ACCESS
            ================================================= */}

            {activePage ===
              "temporary" && (
              <>
                <div style={styles.pageHeader}>
                  <div>
                    <h1
                      style={styles.pageTitle}
                    >
                      Temporary Access
                    </h1>

                    <p
                      style={
                        styles.pageSubtitle
                      }
                    >
                      Create time-limited links for
                      controlled file access.
                    </p>
                  </div>
                </div>

                <div
                  style={styles.formCard}
                >
                  <div
                    style={
                      styles.cardHeader
                    }
                  >
                    <h2
                      style={
                        styles.cardTitle
                      }
                    >
                      Create Temporary Access Link
                    </h2>

                    <p
                      style={
                        styles.cardDescription
                      }
                    >
                      Generate a secure link that
                      automatically expires after
                      the selected duration.
                    </p>
                  </div>

                  <form
                    onSubmit={
                      handleCreateTemporaryLink
                    }
                  >
                    <div
                      style={
                        styles.formGroup
                      }
                    >
                      <label
                        style={
                          styles.label
                        }
                      >
                        Select File
                      </label>

                      <select
                        value={
                          temporaryLinkFile?.id ||
                          ""
                        }
                        onChange={(event) => {
                          const file =
                            files.find(
                              (item) =>
                                String(
                                  item.id
                                ) ===
                                String(
                                  event
                                    .target
                                    .value
                                )
                            );

                          setTemporaryLinkFile(
                            file || null
                          );

                          setTemporaryLinkResult(
                            ""
                          );
                        }}
                        style={
                          styles.select
                        }
                        required
                      >
                        <option value="">
                          Select a file
                        </option>

                        {files.map(
                          (file) => (
                            <option
                              key={
                                file.id
                              }
                              value={
                                file.id
                              }
                            >
                              {file.original_filename ||
                                file.filename ||
                                "Unnamed file"}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div
                      style={
                        styles.formGroup
                      }
                    >
                      <label
                        style={
                          styles.label
                        }
                      >
                        Link Duration
                      </label>

                      <select
                        value={
                          temporaryLinkDuration
                        }
                        onChange={(
                          event
                        ) =>
                          setTemporaryLinkDuration(
                            event
                              .target
                              .value
                          )
                        }
                        style={
                          styles.select
                        }
                      >
                        <option value="5m">
                          5 Minutes
                        </option>

                        <option value="15m">
                          15 Minutes
                        </option>

                        <option value="1h">
                          1 Hour
                        </option>

                        <option value="6h">
                          6 Hours
                        </option>

                        <option value="24h">
                          24 Hours
                        </option>

                        <option value="7d">
                          7 Days
                        </option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      style={
                        styles.primaryButton
                      }
                    >
                      🔗 Create Temporary Link
                    </button>
                  </form>

                  {temporaryLinkResult && (
                    <div
                      style={
                        styles.linkResult
                      }
                    >
                      <div
                        style={{
                          fontSize:
                            "13px",
                          fontWeight: 800,
                          color:
                            "#166534",
                          marginBottom:
                            "8px",
                        }}
                      >
                        Temporary Link Created
                      </div>

                      <div
                        style={
                          styles.linkText
                        }
                      >
                        {
                          temporaryLinkResult
                        }
                      </div>

                      <button
                        type="button"
                        style={{
                          ...styles.smallButton,
                          background:
                            "#ffffff",
                        }}
                        onClick={
                          copyTemporaryLink
                        }
                      >
                        Copy Link
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* =================================================
                MONITORING
            ================================================= */}

            {activePage ===
              "monitoring" && (
              <>
                <div
                  style={
                    styles.monitoringHeader
                  }
                >
                  <div
                    style={
                      styles.monitoringHeaderContent
                    }
                  >
                    <div>
                      <div
                        style={
                          styles.monitoringEyebrow
                        }
                      >
                        TRUSTSHARE SECURITY CENTER
                      </div>

                      <h1
                        style={
                          styles.monitoringTitle
                        }
                      >
                        Monitoring Dashboard
                      </h1>

                      <p
                        style={
                          styles.monitoringSubtitle
                        }
                      >
                        Security activity and system
                        information.
                      </p>
                    </div>

                    <div
                      style={
                        styles.monitoringActions
                      }
                    >
                      <span
                        style={
                          styles.monitoringStatus
                        }
                      >
                        ● System Active
                      </span>

                      <button
                        type="button"
                        style={
                          styles.monitoringRefresh
                        }
                        onClick={
                          handleMonitoringRefresh
                        }
                        disabled={loading}
                      >
                        {loading
                          ? "Refreshing..."
                          : "↻ Refresh"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* OVERVIEW */}
                <div
                  style={
                    styles.overviewGrid
                  }
                >
                  <div
                    style={
                      styles.overviewCard
                    }
                  >
                    <div
                      style={
                        styles.overviewIcon
                      }
                    >
                      📊
                    </div>

                    <div
                      style={
                        styles.overviewValue
                      }
                    >
                      {totalRequests}
                    </div>

                    <div
                      style={
                        styles.overviewLabel
                      }
                    >
                      Total Requests
                    </div>

                    <div
                      style={
                        styles.overviewTrend
                      }
                    >
                      Tracked activity
                    </div>
                  </div>

                  <div
                    style={
                      styles.overviewCard
                    }
                  >
                    <div
                      style={
                        styles.overviewIcon
                      }
                    >
                      📝
                    </div>

                    <div
                      style={
                        styles.overviewValue
                      }
                    >
                      {activity.length}
                    </div>

                    <div
                      style={
                        styles.overviewLabel
                      }
                    >
                      Tracked Events
                    </div>

                    <div
                      style={
                        styles.overviewTrend
                      }
                    >
                      Recent activity
                    </div>
                  </div>

                  <div
                    style={
                      styles.overviewCard
                    }
                  >
                    <div
                      style={
                        styles.overviewIcon
                      }
                    >
                      💾
                    </div>

                    <div
                      style={
                        styles.overviewValue
                      }
                    >
                      {formatBytes(
                        storageBytes
                      )}
                    </div>

                    <div
                      style={
                        styles.overviewLabel
                      }
                    >
                      Storage Used
                    </div>

                    <div
                      style={
                        styles.overviewTrend
                      }
                    >
                      {storageFileCount} files
                    </div>
                  </div>

                  <div
                    style={
                      styles.overviewCard
                    }
                  >
                    <div
                      style={
                        styles.overviewIcon
                      }
                    >
                      🚨
                    </div>

                    <div
                      style={
                        styles.overviewValue
                      }
                    >
                      {alerts.length}
                    </div>

                    <div
                      style={
                        styles.overviewLabel
                      }
                    >
                      Security Alerts
                    </div>

                    <div
                      style={{
                        ...styles.overviewTrend,
                        color:
                          alerts.length >
                          0
                            ? "#b91c1c"
                            : "#15803d",
                      }}
                    >
                      {alerts.length >
                      0
                        ? "Review required"
                        : "No active alerts"}
                    </div>
                  </div>

                  <div
                    style={
                      styles.overviewCard
                    }
                  >
                    <div
                      style={
                        styles.overviewIcon
                      }
                    >
                      🔔
                    </div>

                    <div
                      style={
                        styles.overviewValue
                      }
                    >
                      {unreadNotifications}
                    </div>

                    <div
                      style={
                        styles.overviewLabel
                      }
                    >
                      Unread Notifications
                    </div>

                    <div
                      style={
                        styles.overviewTrend
                      }
                    >
                      Notification center
                    </div>
                  </div>
                </div>

                {/* SYSTEM OVERVIEW */}
                <div
                  style={
                    styles.monitoringSummary
                  }
                >
                  <div
                    style={
                      styles.summaryBlock
                    }
                  >
                    <div
                      style={
                        styles.summaryLabel
                      }
                    >
                      Successful Requests
                    </div>

                    <div
                      style={
                        styles.summaryValue
                      }
                    >
                      {successfulRequests}
                    </div>

                    <div
                      style={
                        styles.progressTrack
                      }
                    >
                      <div
                        style={{
                          ...styles.progressFill,
                          width: `${Math.min(
                            successRate,
                            100
                          )}%`,
                          background:
                            "#16a34a",
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={
                      styles.summaryBlock
                    }
                  >
                    <div
                      style={
                        styles.summaryLabel
                      }
                    >
                      Failed Requests
                    </div>

                    <div
                      style={
                        styles.summaryValue
                      }
                    >
                      {failedRequests}
                    </div>

                    <div
                      style={
                        styles.progressTrack
                      }
                    >
                      <div
                        style={{
                          ...styles.progressFill,
                          width:
                            totalRequests >
                            0
                              ? `${Math.min(
                                  Math.round(
                                    (failedRequests /
                                      totalRequests) *
                                      100
                                  ),
                                  100
                                )}%`
                              : "0%",
                          background:
                            "#dc2626",
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={
                      styles.summaryBlock
                    }
                  >
                    <div
                      style={
                        styles.summaryLabel
                      }
                    >
                      Files Stored
                    </div>

                    <div
                      style={
                        styles.summaryValue
                      }
                    >
                      {dashboardFileCount}
                    </div>

                    <div
                      style={
                        styles.progressTrack
                      }
                    >
                      <div
                        style={{
                          ...styles.progressFill,
                          width: "100%",
                          background:
                            "#2563eb",
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={
                      styles.summaryBlock
                    }
                  >
                    <div
                      style={
                        styles.summaryLabel
                      }
                    >
                      Request Success Rate
                    </div>

                    <div
                      style={
                        styles.summaryValue
                      }
                    >
                      {successRate}%
                    </div>

                    <div
                      style={
                        styles.progressTrack
                      }
                    >
                      <div
                        style={{
                          ...styles.progressFill,
                          width: `${Math.min(
                            successRate,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* ACTIVITY + ALERTS */}
                <div
                  style={
                    styles.monitorSectionGrid
                  }
                >
                  <div style={styles.card}>
                    <div
                      style={
                        styles.cardHeader
                      }
                    >
                      <h2
                        style={
                          styles.cardTitle
                        }
                      >
                        Recent Activity
                      </h2>

                      <p
                        style={
                          styles.cardDescription
                        }
                      >
                        Latest actions recorded in
                        your workspace.
                      </p>
                    </div>

                    {activity.length ===
                    0 ? (
                      <div
                        style={
                          styles.monitoringEmpty
                        }
                      >
                        <div
                          style={
                            styles.emptyIcon
                          }
                        >
                          📋
                        </div>

                        <h3
                          style={
                            styles.emptyTitle
                          }
                        >
                          No activity available
                        </h3>

                        <p
                          style={
                            styles.emptyText
                          }
                        >
                          Activity will appear here
                          when actions are performed.
                        </p>
                      </div>
                    ) : (
                      <div>
                        {activity
                          .slice(0, 10)
                          .map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                key={
                                  item?.id ||
                                  index
                                }
                                style={
                                  styles.activityItem
                                }
                              >
                                <div
                                  style={
                                    styles.activityIcon
                                  }
                                >
                                  {getMonitorIcon(
                                    item
                                  )}
                                </div>

                                <div
                                  style={{
                                    minWidth: 0,
                                    flex: 1,
                                  }}
                                >
                                  <div
                                    style={
                                      styles.activityTitle
                                    }
                                  >
                                    {formatLabel(
                                      getMonitorText(
                                        item
                                      )
                                    )}
                                  </div>

                                  <div
                                    style={
                                      styles.activityDescription
                                    }
                                  >
                                    {getMonitorDescription(
                                      item
                                    ) ||
                                      "Security activity recorded."}
                                  </div>

                                  <div
                                    style={
                                      styles.activityTime
                                    }
                                  >
                                    {formatDate(
                                      getMonitorTime(
                                        item
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                      </div>
                    )}
                  </div>

                  <div style={styles.card}>
                    <div
                      style={
                        styles.cardHeader
                      }
                    >
                      <h2
                        style={
                          styles.cardTitle
                        }
                      >
                        Security Alerts
                      </h2>

                      <p
                        style={
                          styles.cardDescription
                        }
                      >
                        Potential security events
                        detected by the system.
                      </p>
                    </div>

                    {alerts.length ===
                    0 ? (
                      <div
                        style={
                          styles.monitoringEmpty
                        }
                      >
                        <div
                          style={
                            styles.emptyIcon
                          }
                        >
                          🛡️
                        </div>

                        <h3
                          style={
                            styles.emptyTitle
                          }
                        >
                          No security alerts
                        </h3>

                        <p
                          style={
                            styles.emptyText
                          }
                        >
                          Your workspace currently
                          has no active security alerts.
                        </p>
                      </div>
                    ) : (
                      <div>
                        {alerts.map(
                          (
                            item,
                            index
                          ) => {
                            const severity =
                              getSeverity(
                                item
                              );

                            const severityStyle =
                              getSeverityStyle(
                                severity
                              );

                            return (
                              <div
                                key={
                                  item?.id ||
                                  index
                                }
                                style={{
                                  ...styles.notificationItem,
                                  background:
                                    severityStyle.background,
                                  borderColor:
                                    severityStyle.border,
                                }}
                              >
                                <div
                                  style={
                                    styles.notificationIcon
                                  }
                                >
                                  🚨
                                </div>

                                <div
                                  style={{
                                    flex: 1,
                                  }}
                                >
                                  <div
                                    style={{
                                      display:
                                        "flex",
                                      justifyContent:
                                        "space-between",
                                      gap: "8px",
                                      alignItems:
                                        "center",
                                    }}
                                  >
                                    <div
                                      style={
                                        styles.activityTitle
                                      }
                                    >
                                      {formatLabel(
                                        getMonitorText(
                                          item,
                                          "Security Alert"
                                        )
                                      )}
                                    </div>

                                    <span
                                      style={{
                                        ...styles.severityBadge,
                                        background:
                                          severityStyle.background,
                                        color:
                                          severityStyle.color,
                                        borderColor:
                                          severityStyle.border,
                                      }}
                                    >
                                      {severity.toUpperCase()}
                                    </span>
                                  </div>

                                  <div
                                    style={
                                      styles.activityDescription
                                    }
                                  >
                                    {getMonitorDescription(
                                      item
                                    ) ||
                                      "Security event detected."}
                                  </div>

                                  <div
                                    style={
                                      styles.activityTime
                                    }
                                  >
                                    {formatDate(
                                      getMonitorTime(
                                        item
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* NOTIFICATIONS */}
                <div style={styles.card}>
                  <div
                    style={
                      styles.cardHeader
                    }
                  >
                    <h2
                      style={
                        styles.cardTitle
                      }
                    >
                      🔔 Notifications
                    </h2>

                    <p
                      style={
                        styles.cardDescription
                      }
                    >
                      System notifications and security
                      messages.
                    </p>
                  </div>

                  {notifications.length ===
                  0 ? (
                    <div
                      style={
                        styles.monitoringEmpty
                      }
                    >
                      <div
                        style={
                          styles.emptyIcon
                        }
                      >
                        🔔
                      </div>

                      <h3
                        style={
                          styles.emptyTitle
                        }
                      >
                        No notifications
                      </h3>

                      <p
                        style={
                          styles.emptyText
                        }
                      >
                        New notifications will appear
                        here when the system generates
                        them.
                      </p>
                    </div>
                  ) : (
                    <div>
                      {notifications.map(
                        (
                          item,
                          index
                        ) => {
                          const severity =
                            getSeverity(
                              item
                            );

                          const severityStyle =
                            getSeverityStyle(
                              severity
                            );

                          const unread =
                            item?.read ===
                              false ||
                            item?.is_read ===
                              false ||
                            String(
                              item?.status ||
                                ""
                            ).toLowerCase() ===
                              "unread";

                          return (
                            <div
                              key={
                                item?.id ||
                                index
                              }
                              style={{
                                ...styles.notificationItem,
                                background:
                                  unread
                                    ? "#eff6ff"
                                    : "#ffffff",
                                borderColor:
                                  unread
                                    ? "#bfdbfe"
                                    : "#e2e8f0",
                              }}
                            >
                              <div
                                style={
                                  styles.notificationIcon
                                }
                              >
                                🔔
                              </div>

                              <div
                                style={{
                                  flex: 1,
                                }}
                              >
                                <div
                                  style={{
                                    display:
                                      "flex",
                                    justifyContent:
                                      "space-between",
                                    alignItems:
                                      "center",
                                    gap: "10px",
                                  }}
                                >
                                  <div
                                    style={
                                      styles.activityTitle
                                    }
                                  >
                                    {item?.title ||
                                      formatLabel(
                                        getMonitorText(
                                          item,
                                          "Notification"
                                        )
                                      )}
                                  </div>

                                  <span
                                    style={{
                                      ...styles.severityBadge,
                                      background:
                                        severityStyle.background,
                                      color:
                                        severityStyle.color,
                                      borderColor:
                                        severityStyle.border,
                                    }}
                                  >
                                    {severity.toUpperCase()}
                                  </span>
                                </div>

                                <div
                                  style={
                                    styles.activityDescription
                                  }
                                >
                                  {getMonitorDescription(
                                    item
                                  ) ||
                                    "System notification."}
                                </div>

                                <div
                                  style={
                                    styles.activityTime
                                  }
                                >
                                  {formatDate(
                                    getMonitorTime(
                                      item
                                    )
                                  )}

                                  {unread && (
                                    <span
                                      style={{
                                        marginLeft:
                                          "8px",
                                        color:
                                          "#1d4ed8",
                                        fontWeight:
                                          800,
                                      }}
                                    >
                                      • Unread
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>

                {/* AUDIT LOGS */}
                <div
                  style={
                    styles.auditCard
                  }
                >
                  <div
                    style={
                      styles.cardHeader
                    }
                  >
                    <h2
                      style={
                        styles.cardTitle
                      }
                    >
                      🔐 Security Audit Logs
                    </h2>

                    <p
                      style={
                        styles.cardDescription
                      }
                    >
                      Detailed record of security
                      requests and system activity.
                    </p>
                  </div>

                  {auditLogs.length ===
                  0 ? (
                    <div
                      style={
                        styles.monitoringEmpty
                      }
                    >
                      <div
                        style={
                          styles.emptyIcon
                        }
                      >
                        📜
                      </div>

                      <h3
                        style={
                          styles.emptyTitle
                        }
                      >
                        No audit logs available
                      </h3>

                      <p
                        style={
                          styles.emptyText
                        }
                      >
                        Security requests will be
                        recorded here automatically.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={
                        styles.auditTableWrapper
                      }
                    >
                      <table
                        style={
                          styles.auditTable
                        }
                      >
                        <thead>
                          <tr>
                            <th
                              style={
                                styles.auditTh
                              }
                            >
                              Action
                            </th>

                            <th
                              style={
                                styles.auditTh
                              }
                            >
                              Description
                            </th>

                            <th
                              style={
                                styles.auditTh
                              }
                            >
                              Status
                            </th>

                            <th
                              style={
                                styles.auditTh
                              }
                            >
                              Status Code
                            </th>

                            <th
                              style={
                                styles.auditTh
                              }
                            >
                              Time
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {auditLogs.map(
                            (
                              log,
                              index
                            ) => {
                              let status =
                                log?.status;

                              if (!status) {
                                const code =
                                  Number(
                                    log?.status_code
                                  );

                                if (
                                  code >=
                                    200 &&
                                  code < 400
                                ) {
                                  status =
                                    "Success";
                                } else if (
                                  code >=
                                  400
                                ) {
                                  status =
                                    "Failed";
                                } else {
                                  status =
                                    "Recorded";
                                }
                              }

                              const normalizedStatus =
                                String(
                                  status ||
                                    "Recorded"
                                ).toLowerCase();

                              let statusStyle =
                                styles.auditStatusNeutral;

                              if (
                                normalizedStatus.includes(
                                  "success"
                                )
                              ) {
                                statusStyle =
                                  styles.auditStatusSuccess;
                              } else if (
                                normalizedStatus.includes(
                                  "fail"
                                )
                              ) {
                                statusStyle =
                                  styles.auditStatusFailed;
                              }

                              return (
                                <tr
                                  key={
                                    log?.id ||
                                    index
                                  }
                                >
                                  <td
                                    style={
                                      styles.auditTd
                                    }
                                  >
                                    <span
                                      style={
                                        styles.auditAction
                                      }
                                    >
                                      {formatLabel(
                                        log?.action ||
                                          log?.event ||
                                          log?.activity ||
                                          "System Activity"
                                      )}
                                    </span>
                                  </td>

                                  <td
                                    style={
                                      styles.auditTd
                                    }
                                  >
                                    {log?.description ||
                                      log?.message ||
                                      log?.details ||
                                      "Security request recorded."}
                                  </td>

                                  <td
                                    style={
                                      styles.auditTd
                                    }
                                  >
                                    <span
                                      style={
                                        statusStyle
                                      }
                                    >
                                      {formatLabel(
                                        status
                                      )}
                                    </span>
                                  </td>

                                  <td
                                    style={
                                      styles.auditTd
                                    }
                                  >
                                    {log?.status_code ??
                                      "—"}
                                  </td>

                                  <td
                                    style={
                                      styles.auditTd
                                    }
                                  >
                                    {formatDate(
                                      log?.timestamp ||
                                        log?.created_at
                                    )}
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* FILE REPORTS */}
                <div style={styles.card}>
                  <div
                    style={
                      styles.cardHeader
                    }
                  >
                    <h2
                      style={
                        styles.cardTitle
                      }
                    >
                      📁 File Reports
                    </h2>

                    <p
                      style={
                        styles.cardDescription
                      }
                    >
                      File storage and activity summary.
                    </p>
                  </div>

                  {!fileReports ? (
                    <div
                      style={
                        styles.monitoringEmpty
                      }
                    >
                      <div
                        style={
                          styles.emptyIcon
                        }
                      >
                        📊
                      </div>

                      <h3
                        style={
                          styles.emptyTitle
                        }
                      >
                        File report unavailable
                      </h3>

                      <p
                        style={
                          styles.emptyText
                        }
                      >
                        File reporting information is
                        currently unavailable.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={
                        styles.analyticsGrid
                      }
                    >
                      <div
                        style={
                          styles.analyticsCard
                        }
                      >
                        <div
                          style={
                            styles.analyticsValue
                          }
                        >
                          {toNumber(
                            getValueByKeys(
                              fileReports,
                              [
                                "total_files",
                                "file_count",
                                "files_count",
                              ]
                            ),
                            files.length
                          )}
                        </div>

                        <div
                          style={
                            styles.analyticsLabel
                          }
                        >
                          Total Files
                        </div>
                      </div>

                      <div
                        style={
                          styles.analyticsCard
                        }
                      >
                        <div
                          style={
                            styles.analyticsValue
                          }
                        >
                          {formatBytes(
                            toNumber(
                              getValueByKeys(
                                fileReports,
                                [
                                  "total_bytes",
                                  "storage_bytes",
                                  "total_size",
                                ]
                              ),
                              totalStorage
                            )
                          )}
                        </div>

                        <div
                          style={
                            styles.analyticsLabel
                          }
                        >
                          Total File Size
                        </div>
                      </div>

                      <div
                        style={
                          styles.analyticsCard
                        }
                      >
                        <div
                          style={
                            styles.analyticsValue
                          }
                        >
                          {toNumber(
                            getValueByKeys(
                              fileReports,
                              [
                                "shared_files",
                                "shared_count",
                              ]
                            ),
                            sharedByMe.length +
                              sharedWithMe.length
                          )}
                        </div>

                        <div
                          style={
                            styles.analyticsLabel
                          }
                        >
                          Shared Files
                        </div>
                      </div>

                      <div
                        style={
                          styles.analyticsCard
                        }
                      >
                        <div
                          style={
                            styles.analyticsValue
                          }
                        >
                          {toNumber(
                            getValueByKeys(
                              fileReports,
                              [
                                "encrypted_files",
                                "encrypted_count",
                              ]
                            ),
                            files.length
                          )}
                        </div>

                        <div
                          style={
                            styles.analyticsLabel
                          }
                        >
                          Encrypted Files
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* STORAGE ANALYTICS */}
                <div style={styles.card}>
                  <div
                    style={
                      styles.cardHeader
                    }
                  >
                    <h2
                      style={
                        styles.cardTitle
                      }
                    >
                      💾 Storage Analytics
                    </h2>

                    <p
                      style={
                        styles.cardDescription
                      }
                    >
                      Current storage information
                      collected by TrustShare.
                    </p>
                  </div>

                  <div
                    style={
                      styles.analyticsGrid
                    }
                  >
                    <div
                      style={
                        styles.analyticsCard
                      }
                    >
                      <div
                        style={
                          styles.analyticsValue
                        }
                      >
                        {storageFileCount}
                      </div>

                      <div
                        style={
                          styles.analyticsLabel
                        }
                      >
                        Stored Files
                      </div>
                    </div>

                    <div
                      style={
                        styles.analyticsCard
                      }
                    >
                      <div
                        style={
                          styles.analyticsValue
                        }
                      >
                        {formatBytes(
                          storageBytes
                        )}
                      </div>

                      <div
                        style={
                          styles.analyticsLabel
                        }
                      >
                        Storage Used
                      </div>
                    </div>

                    <div
                      style={
                        styles.analyticsCard
                      }
                    >
                      <div
                        style={
                          styles.analyticsValue
                        }
                      >
                        {Number(
                          storageMb || 0
                        ).toFixed(2)}{" "}
                        MB
                      </div>

                      <div
                        style={
                          styles.analyticsLabel
                        }
                      >
                        Storage in MB
                      </div>
                    </div>

                    <div
                      style={
                        styles.analyticsCard
                      }
                    >
                      <div
                        style={
                          styles.analyticsValue
                        }
                      >
                        {
                          suspiciousActivity.length
                        }
                      </div>

                      <div
                        style={
                          styles.analyticsLabel
                        }
                      >
                        Suspicious Events
                      </div>
                    </div>
                  </div>
                </div>

                {/* TECHNICAL DETAILS */}
                <div
                  style={
                    styles.technicalDetails
                  }
                >
                  <details>
                    <summary
                      style={
                        styles.technicalSummary
                      }
                    >
                      Technical Monitoring Data
                    </summary>

                    <pre
                      style={
                        styles.technicalPre
                      }
                    >
                      {JSON.stringify(
                        {
                          monitoringDashboard,
                          storageAnalytics,
                          suspiciousActivity,
                          fileReports,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;