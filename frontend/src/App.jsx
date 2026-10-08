
import "./App.css";
import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

const styles = {
  app: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  authPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background:
      "linear-gradient(135deg, #0f172a 0%, #172554 50%, #1e40af 100%)",
  },

  authCard: {
    width: "100%",
    maxWidth: "460px",
    background: "#fff",
    borderRadius: "20px",
    padding: "38px",
    boxShadow: "0 25px 70px rgba(15,23,42,.30)",
    boxSizing: "border-box",
  },

  authLogo: {
    width: "56px",
    height: "56px",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "#fff",
    fontSize: "25px",
    fontWeight: "800",
    marginBottom: "18px",
  },

  authTitle: {
    margin: "0 0 8px",
    fontSize: "30px",
    fontWeight: "800",
    color: "#0f172a",
  },

  authSubtitle: {
    margin: "0 0 28px",
    color: "#64748b",
    fontSize: "14px",
    lineHeight: "1.6",
  },

  formGroup: {
    marginBottom: "17px",
  },

  label: {
    display: "block",
    marginBottom: "7px",
    fontSize: "13px",
    fontWeight: "700",
    color: "#334155",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    color: "#0f172a",
    background: "#fff",
  },

  select: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    fontSize: "14px",
    color: "#0f172a",
    background: "#fff",
  },

  primaryButton: {
    width: "100%",
    border: "none",
    borderRadius: "10px",
    padding: "13px 16px",
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
  },

  authSwitch: {
    marginTop: "20px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "13px",
  },

  linkButton: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    fontWeight: "700",
    cursor: "pointer",
    padding: 0,
  },

  layout: {
    minHeight: "100vh",
    display: "flex",
    background: "#f8fafc",
  },

  sidebar: {
    width: "270px",
    minWidth: "270px",
    background: "#0f172a",
    color: "#fff",
    minHeight: "100vh",
    padding: "24px 16px",
    boxSizing: "border-box",
    position: "sticky",
    top: 0,
    alignSelf: "flex-start",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "4px 10px 28px",
  },

  brandIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg,#3b82f6,#2563eb)",
    fontWeight: "800",
    fontSize: "19px",
  },

  brandTitle: {
    margin: 0,
    fontSize: "19px",
    fontWeight: "800",
    color: "#fff",
    whiteSpace: "nowrap",
  },

  brandSubtitle: {
    margin: "3px 0 0",
    fontSize: "10px",
    color: "#94a3b8",
    letterSpacing: ".5px",
    whiteSpace: "nowrap",
  },

  navSection: {
    marginBottom: "25px",
  },

  navHeading: {
    padding: "0 12px",
    marginBottom: "8px",
    fontSize: "10px",
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },

  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 13px",
    marginBottom: "5px",
    borderRadius: "10px",
    border: "none",
    background: "transparent",
    color: "#cbd5e1",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    textAlign: "left",
    whiteSpace: "nowrap",
    overflow: "visible",
  },

  navItemActive: {
    background: "rgba(37,99,235,.22)",
    color: "#fff",
  },

  navIcon: {
    width: "23px",
    minWidth: "23px",
    textAlign: "center",
    fontSize: "17px",
  },

  navText: {
    whiteSpace: "nowrap",
    overflow: "visible",
  },

  sidebarFooter: {
    marginTop: "auto",
    padding: "18px 10px 0",
    borderTop: "1px solid rgba(148,163,184,.14)",
  },

  securityBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#94a3b8",
    fontSize: "11px",
    lineHeight: "1.5",
  },

  main: {
    flex: 1,
    minWidth: 0,
  },

  topbar: {
    minHeight: "72px",
    background: "#fff",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 30px",
    boxSizing: "border-box",
  },

  topbarTitle: {
    fontSize: "14px",
    color: "#64748b",
    fontWeight: "600",
  },

  topbarRight: {
    display: "flex",
    alignItems: "center",
    gap: "13px",
  },

  userBadge: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    padding: "7px 11px",
    borderRadius: "10px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: "800",
    fontSize: "13px",
  },

  userName: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#334155",
    maxWidth: "190px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  logoutButton: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#475569",
    borderRadius: "9px",
    padding: "9px 13px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },

  content: {
    padding: "30px",
    maxWidth: "1500px",
    margin: "0 auto",
    boxSizing: "border-box",
  },

  message: {
    padding: "12px 15px",
    borderRadius: "10px",
    marginBottom: "20px",
    fontSize: "13px",
    fontWeight: "600",
  },

  error: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
  },

  success: {
    background: "#f0fdf4",
    color: "#15803d",
    border: "1px solid #bbf7d0",
  },

  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "26px",
  },

  pageTitle: {
    margin: 0,
    fontSize: "28px",
    lineHeight: "1.2",
    fontWeight: "800",
    color: "#0f172a",
  },

  pageSubtitle: {
    margin: "8px 0 0",
    fontSize: "14px",
    color: "#64748b",
    lineHeight: "1.6",
  },

  welcomeBox: {
    background:
      "linear-gradient(135deg,#fff 0%,#eff6ff 100%)",
    border: "1px solid #dbeafe",
    borderRadius: "18px",
    padding: "28px",
    marginBottom: "24px",
    boxShadow: "0 8px 25px rgba(15,23,42,.05)",
  },

  welcomeTitle: {
    margin: "0 0 8px",
    fontSize: "30px",
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: "1.2",
  },

  welcomeSubtitle: {
    margin: 0,
    fontSize: "15px",
    color: "#475569",
    lineHeight: "1.6",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",
    gap: "16px",
    marginBottom: "26px",
  },

  statCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "15px",
    padding: "20px",
  },

  statIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eff6ff",
    color: "#2563eb",
    fontSize: "18px",
    marginBottom: "14px",
  },

  statValue: {
    margin: 0,
    fontSize: "25px",
    fontWeight: "800",
    color: "#0f172a",
  },

  statLabel: {
    margin: "4px 0 0",
    fontSize: "12px",
    color: "#64748b",
    fontWeight: "600",
  },

  quickGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(250px,1fr))",
    gap: "18px",
  },

  quickCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "15px",
    padding: "22px",
  },

  quickTitle: {
    margin: "0 0 7px",
    fontSize: "16px",
    fontWeight: "800",
    color: "#0f172a",
  },

  quickText: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "1.6",
  },

  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "22px",
    boxShadow: "0 5px 18px rgba(15,23,42,.04)",
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    marginBottom: "18px",
  },

  cardTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: "800",
    color: "#0f172a",
  },

  cardDescription: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "12px",
  },

  tableWrapper: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "700px",
  },

  th: {
    textAlign: "left",
    padding: "13px 15px",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: ".5px",
    borderBottom: "1px solid #e2e8f0",
  },

  td: {
    padding: "14px 15px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "13px",
    color: "#334155",
  },

  fileName: {
    fontWeight: "700",
    color: "#0f172a",
  },

  smallButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    padding: "7px 10px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer",
    marginRight: "6px",
  },

  dangerButton: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    padding: "7px 10px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer",
  },

  formCard: {
    maxWidth: "650px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "24px",
  },

  uploadArea: {
    border: "2px dashed #bfdbfe",
    borderRadius: "14px",
    padding: "30px",
    textAlign: "center",
    background: "#f8fbff",
    marginBottom: "18px",
  },

  uploadIcon: {
    fontSize: "32px",
    marginBottom: "10px",
  },

  uploadText: {
    margin: "0 0 5px",
    fontSize: "15px",
    fontWeight: "800",
    color: "#0f172a",
  },

  uploadHint: {
    margin: 0,
    fontSize: "12px",
    color: "#64748b",
  },

  /* MONITORING */

  monitoringHeader: {
    background:
      "linear-gradient(135deg,#0f172a 0%,#172554 55%,#1d4ed8 100%)",
    borderRadius: "18px",
    padding: "26px 28px",
    marginBottom: "20px",
    color: "#fff",
    boxShadow: "0 12px 30px rgba(15,23,42,.16)",
  },

  monitoringHeaderContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    flexWrap: "wrap",
  },

  monitoringEyebrow: {
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.5px",
    color: "#93c5fd",
    marginBottom: "7px",
  },

  monitoringTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: "800",
    color: "#fff",
  },

  monitoringSubtitle: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    fontSize: "13px",
  },

  monitoringActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },

  monitoringStatus: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "9px 12px",
    borderRadius: "999px",
    background: "rgba(34,197,94,.14)",
    color: "#bbf7d0",
    fontSize: "11px",
    fontWeight: "800",
  },

  monitoringRefresh: {
    border: "1px solid rgba(255,255,255,.2)",
    background: "rgba(255,255,255,.1)",
    color: "#fff",
    borderRadius: "9px",
    padding: "9px 13px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },

  overviewGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",
    gap: "14px",
    marginBottom: "16px",
  },

  overviewCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "18px",
    display: "flex",
    alignItems: "center",
    gap: "13px",
  },

  overviewIcon: {
    width: "43px",
    height: "43px",
    minWidth: "43px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "19px",
  },

  overviewValue: {
    margin: 0,
    fontSize: "23px",
    fontWeight: "800",
    color: "#0f172a",
  },

  overviewLabel: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "700",
  },

  overviewTrend: {
    margin: "4px 0 0",
    color: "#94a3b8",
    fontSize: "10px",
  },

  monitoringSummary: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(260px,1fr))",
    gap: "14px",
    marginBottom: "18px",
  },

  summaryBlock: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "17px 19px",
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "700",
    marginBottom: "7px",
  },

  summaryValue: {
    color: "#0f172a",
    fontSize: "20px",
    fontWeight: "800",
  },

  progressTrack: {
    height: "7px",
    background: "#e2e8f0",
    borderRadius: "999px",
    overflow: "hidden",
    marginTop: "10px",
  },

  progressFill: {
    height: "100%",
    background:
      "linear-gradient(90deg,#2563eb,#22c55e)",
    borderRadius: "999px",
  },

  monitorSectionGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(340px,1fr))",
    gap: "18px",
    marginBottom: "18px",
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
    minWidth: "36px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eff6ff",
    fontSize: "16px",
  },

  activityTitle: {
    margin: 0,
    fontSize: "13px",
    fontWeight: "800",
    color: "#0f172a",
  },

  activityDescription: {
    margin: "4px 0 0",
    fontSize: "11px",
    color: "#64748b",
    lineHeight: "1.5",
  },

  activityTime: {
    fontSize: "10px",
    color: "#94a3b8",
    whiteSpace: "nowrap",
  },

  statusBadge: {
    display: "inline-block",
    marginTop: "6px",
    padding: "3px 7px",
    borderRadius: "999px",
    background: "#f0fdf4",
    color: "#15803d",
    fontSize: "9px",
    fontWeight: "800",
  },

  notificationItem: {
    display: "flex",
    gap: "11px",
    padding: "13px 0",
    borderBottom: "1px solid #f1f5f9",
  },

  notificationIcon: {
    width: "34px",
    height: "34px",
    minWidth: "34px",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
  },

  severityBadge: {
    display: "inline-block",
    padding: "4px 7px",
    borderRadius: "999px",
    fontSize: "9px",
    fontWeight: "800",
    textTransform: "uppercase",
    border: "1px solid transparent",
  },

  auditCard: {
    marginBottom: "18px",
  },

  auditTableWrapper: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
  },

  auditTable: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "780px",
  },

  auditTh: {
    textAlign: "left",
    padding: "12px 14px",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "10px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: ".6px",
    borderBottom: "1px solid #e2e8f0",
  },

  auditTd: {
    padding: "13px 14px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "12px",
    color: "#334155",
    verticalAlign: "top",
  },

  auditAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    fontWeight: "800",
    color: "#0f172a",
  },

  auditStatusSuccess: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "#f0fdf4",
    color: "#15803d",
    fontSize: "9px",
    fontWeight: "800",
  },

  auditStatusFailed: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: "9px",
    fontWeight: "800",
  },

  auditStatusNeutral: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "#f1f5f9",
    color: "#475569",
    fontSize: "9px",
    fontWeight: "800",
  },

  analyticsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(170px,1fr))",
    gap: "12px",
    marginBottom: "18px",
  },

  analyticsCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "16px",
  },

  analyticsValue: {
    margin: 0,
    fontSize: "19px",
    fontWeight: "800",
    color: "#0f172a",
    wordBreak: "break-word",
  },

  analyticsLabel: {
    margin: "4px 0 0",
    fontSize: "10px",
    color: "#64748b",
    fontWeight: "700",
  },

  technicalDetails: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: "13px",
  },

  technicalSummary: {
    cursor: "pointer",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "700",
  },

  technicalPre: {
    marginTop: "10px",
    padding: "13px",
    background: "#0f172a",
    color: "#cbd5e1",
    borderRadius: "10px",
    fontSize: "10px",
    overflow: "auto",
    maxHeight: "260px",
  },

  monitoringEmpty: {
    textAlign: "center",
    padding: "28px 15px",
    color: "#64748b",
  },

  emptyIcon: {
    fontSize: "27px",
    marginBottom: "8px",
  },

  emptyTitle: {
    margin: "0 0 5px",
    color: "#334155",
    fontSize: "13px",
    fontWeight: "800",
  },

  emptyText: {
    margin: 0,
    fontSize: "11px",
    lineHeight: "1.5",
  },

  linkResult: {
    marginTop: "18px",
    padding: "15px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "11px",
  },

  linkText: {
    wordBreak: "break-all",
    color: "#2563eb",
    fontSize: "12px",
  },
};

const formatLabel = (value) =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatDate = (value) => {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

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

  if (["critical", "high", "danger"].includes(value))
    return "high";

  if (value === "low") return "low";

  if (["info", "normal"].includes(value)) return "info";

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
  if (!object || typeof object !== "object") return null;

  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null) {
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
  const [shareDuration, setShareDuration] = useState("none");

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activePage, setActivePage] = useState("dashboard");

  const [monitoringDashboard, setMonitoringDashboard] =
    useState(null);

  const [activity, setActivity] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [storageAnalytics, setStorageAnalytics] =
    useState(null);
  const [suspiciousActivity, setSuspiciousActivity] =
    useState([]);
  const [fileReports, setFileReports] = useState(null);

  const [temporaryLinkFile, setTemporaryLinkFile] =
    useState(null);

  const [temporaryLinkDuration, setTemporaryLinkDuration] =
    useState("1h");

  const [temporaryLinkResult, setTemporaryLinkResult] =
    useState("");

  const clearMessages = () => {
    setError("");
    setSuccess("");
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
      throw new Error(
        data?.detail ||
          data?.message ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  };

  const getExpiryFromDuration = (duration) => {
    if (!duration || duration === "none") return null;

    const now = new Date();

    const multipliers = {
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    };

    const milliseconds = multipliers[duration];

    if (!milliseconds) return null;

    return new Date(
      now.getTime() + milliseconds
    ).toISOString();
  };

  const isExpired = (date) => {
    if (!date) return false;

    const expiry = new Date(date);

    if (Number.isNaN(expiry.getTime())) return false;

    return expiry.getTime() < Date.now();
  };

  const loadUser = async () => {
    try {
      const data = await apiRequest("/auth/me");
      setUser(data);
    } catch {
      try {
        const data = await apiRequest("/users/me");
        setUser(data);
      } catch {
        setUser(null);
      }
    }
  };

  const loadFiles = async () => {
    try {
      const data = await apiRequest("/files");

      if (Array.isArray(data)) {
        setFiles(data);
      } else if (Array.isArray(data?.files)) {
        setFiles(data.files);
      } else {
        setFiles([]);
      }
    } catch {
      setFiles([]);
    }
  };

  const loadSharedFiles = async () => {
    try {
      const received = await apiRequest(
        "/shares/received"
      );

      if (Array.isArray(received)) {
        setSharedWithMe(received);
      } else if (Array.isArray(received?.shares)) {
        setSharedWithMe(received.shares);
      } else {
        setSharedWithMe([]);
      }
    } catch {
      setSharedWithMe([]);
    }

    try {
      const sent = await apiRequest("/shares/sent");

      if (Array.isArray(sent)) {
        setSharedByMe(sent);
      } else if (Array.isArray(sent?.shares)) {
        setSharedByMe(sent.shares);
      } else {
        setSharedByMe([]);
      }
    } catch {
      setSharedByMe([]);
    }
  };

  const loadMonitoring = async () => {
    try {
      const data = await apiRequest(
        "/monitoring/dashboard"
      );
      setMonitoringDashboard(data);
    } catch {
      setMonitoringDashboard(null);
    }

    try {
      const data = await apiRequest(
        "/monitoring/activity?limit=20"
      );

      if (Array.isArray(data)) {
        setActivity(data);
      } else if (Array.isArray(data?.activity)) {
        setActivity(data.activity);
      } else if (Array.isArray(data?.activities)) {
        setActivity(data.activities);
      } else {
        setActivity([]);
      }
    } catch {
      setActivity([]);
    }

    try {
      const data = await apiRequest("/monitoring/alerts");

      if (Array.isArray(data)) {
        setAlerts(data);
      } else if (Array.isArray(data?.alerts)) {
        setAlerts(data.alerts);
      } else {
        setAlerts([]);
      }
    } catch {
      setAlerts([]);
    }

    try {
      const data = await apiRequest(
        "/monitoring/notifications"
      );

      if (Array.isArray(data)) {
        setNotifications(data);
      } else if (Array.isArray(data?.notifications)) {
        setNotifications(data.notifications);
      } else {
        setNotifications([]);
      }
    } catch {
      setNotifications([]);
    }

    try {
      const data = await apiRequest(
        "/monitoring/analytics/storage"
      );

      setStorageAnalytics(data);
    } catch {
      setStorageAnalytics(null);
    }

    try {
      const data = await apiRequest(
        "/monitoring/suspicious"
      );

      if (Array.isArray(data)) {
        setSuspiciousActivity(data);
      } else if (Array.isArray(data?.suspicious)) {
        setSuspiciousActivity(data.suspicious);
      } else if (Array.isArray(data?.activities)) {
        setSuspiciousActivity(data.activities);
      } else {
        setSuspiciousActivity([]);
      }
    } catch {
      setSuspiciousActivity([]);
    }

    try {
      const data = await apiRequest(
        "/monitoring/reports/files"
      );

      setFileReports(data);
    } catch {
      setFileReports(null);
    }
  };

  const loadAllData = async () => {
    setLoading(true);

    await Promise.all([
      loadFiles(),
      loadSharedFiles(),
      loadMonitoring(),
    ]);

    setLoading(false);
  };

  useEffect(() => {
    if (!token) return;

    loadUser();
    loadAllData();
  }, [token]);

  const handleLogin = async (event) => {
    event.preventDefault();

    clearMessages();
    setAuthLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: loginForm.email,
            password: loginForm.password,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        let errorMessage = "Login failed";

        if (typeof result?.detail === "string") {
          errorMessage = result.detail;
        } else if (Array.isArray(result?.detail)) {
          errorMessage = result.detail
            .map((error) => error?.msg || "Invalid input")
            .join(", ");
        } else if (typeof result?.message === "string") {
          errorMessage = result.message;
        }

        throw new Error(errorMessage);
      }

      const receivedToken =
        result.access_token || result.token;

      if (!receivedToken) {
        throw new Error(
          "Login successful but token was not returned."
        );
      }

      localStorage.setItem(
        "trustshare_token",
        receivedToken
      );

      setToken(receivedToken);

      setLoginForm({
        email: "",
        password: "",
      });
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
        body: JSON.stringify(registerForm),
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
    localStorage.removeItem("trustshare_token");

    setToken("");
    setUser(null);
    setFiles([]);
    setSharedWithMe([]);
    setSharedByMe([]);
    setActivity([]);
    setAlerts([]);
    setNotifications([]);
    setStorageAnalytics(null);
    setSuspiciousActivity([]);
    setFileReports(null);
    setActivePage("dashboard");

    clearMessages();
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    const file = event.target.file?.files?.[0];

    if (!file) {
      setError("Please select a file.");
      return;
    }

    clearMessages();
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      await apiRequest("/files/upload", {
        method: "POST",
        body: formData,
      });

      setSuccess(
        `${file.name} uploaded and encrypted successfully.`
      );

      event.target.reset();

      await loadAllData();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file) => {
    clearMessages();

    try {
      const response = await fetch(
        `${API_URL}/files/${file.id}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let message = "Download failed.";

        try {
          const data = await response.json();
          message =
            data?.detail ||
            data?.message ||
            message;
        } catch {}

        throw new Error(message);
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download =
        file.original_filename ||
        file.filename ||
        "file";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(url);

      setSuccess("File downloaded successfully.");

      await loadMonitoring();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (file) => {
    const confirmed = window.confirm(
      `Delete "${
        file.original_filename ||
        file.filename
      }"?`
    );

    if (!confirmed) return;

    clearMessages();

    try {
      await apiRequest(`/files/${file.id}`, {
        method: "DELETE",
      });

      setSuccess("File deleted successfully.");

      await loadAllData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleShare = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setError("Please select a file.");
      return;
    }

    if (!recipientEmail.trim()) {
      setError("Please enter the recipient email.");
      return;
    }

    clearMessages();

    try {
      const expiresAt =
        getExpiryFromDuration(shareDuration);

      await apiRequest("/shares", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_id: selectedFile.id,
          recipient_email: recipientEmail.trim(),
          permission: "view",
          expires_at: expiresAt,
        }),
      });

      setSuccess(
        `File shared successfully with ${recipientEmail.trim()}.`
      );

      setRecipientEmail("");
      setSelectedFile(null);
      setShareDuration("none");

      await loadAllData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateTemporaryLink = async (event) => {
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

      const data = await apiRequest(
        `/files/${temporaryLinkFile.id}/temporary-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expires_at: expiresAt,
          }),
        }
      );

      const link =
        data?.url ||
        data?.link ||
        data?.temporary_url ||
        data?.temporary_link;

      if (!link) {
        throw new Error(
          "Temporary link was created but no URL was returned."
        );
      }

      setTemporaryLinkResult(link);

      setSuccess(
        "Temporary access link created successfully."
      );
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
        "Could not copy the temporary link."
      );
    }
  };

  const handleRefresh = async () => {
    clearMessages();

    await loadAllData();

    setSuccess("Data refreshed successfully.");
  };

  const handleMonitoringRefresh = async () => {
    clearMessages();

    setLoading(true);

    await loadMonitoring();

    setLoading(false);

    setSuccess("Monitoring data refreshed.");
  };

  const totalStorage = files.reduce(
    (total, file) =>
      total +
      toNumber(
        file.size ||
          file.file_size ||
          file.bytes,
        0
      ),
    0
  );

  const dashboardActivity =
    monitoringDashboard?.activity || {};

  const dashboardStorage =
    monitoringDashboard?.storage || {};

  const totalRequests = toNumber(
    dashboardActivity.total_requests,
    activity.length
  );

  const successfulRequests = toNumber(
    dashboardActivity.successful_requests,
    0
  );

  const failedRequests = toNumber(
    dashboardActivity.failed_requests,
    0
  );

  const dashboardFileCount = toNumber(
    dashboardStorage.file_count,
    files.length
  );

  const dashboardTotalBytes = toNumber(
    dashboardStorage.total_bytes,
    totalStorage
  );

  const dashboardTotalMb = toNumber(
    dashboardStorage.total_mb,
    dashboardTotalBytes / 1024 / 1024
  );

  const successRate =
    totalRequests > 0
      ? Math.round(
          (successfulRequests / totalRequests) * 100
        )
      : 0;

  const storageFileCount =
    getValueByKeys(storageAnalytics, [
      "file_count",
      "total_files",
      "files_count",
    ]) ?? dashboardFileCount;

  const storageBytes =
    getValueByKeys(storageAnalytics, [
      "total_bytes",
      "used_bytes",
      "storage_bytes",
    ]) ?? dashboardTotalBytes;

  const storageMb =
    getValueByKeys(storageAnalytics, [
      "total_mb",
      "used_mb",
      "storage_mb",
    ]) ?? dashboardTotalMb;

  if (!token) {
    return (
      <div style={styles.authPage}>
        <div style={styles.authCard}>
          <div style={styles.authLogo}>T</div>

          {authMode === "login" ? (
            <>
              <h1 style={styles.authTitle}>
                Welcome to TrustShare
              </h1>

              <p style={styles.authSubtitle}>
                Secure file sharing and collaboration
                with encrypted storage and controlled
                access.
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

              <form onSubmit={handleLogin}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Email Address
                  </label>

                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm({
                        ...loginForm,
                        email: event.target.value,
                      })
                    }
                    placeholder="Enter your email"
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
                    : "Sign In"}
                </button>
              </form>

              <div style={styles.authSwitch}>
                Don't have an account?{" "}
                <button
                  style={styles.linkButton}
                  onClick={() => {
                    clearMessages();
                    setAuthMode("register");
                  }}
                >
                  Create Account
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 style={styles.authTitle}>
                Create your account
              </h1>

              <p style={styles.authSubtitle}>
                Join TrustShare for secure encrypted
                collaboration.
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
                        name: event.target.value,
                      })
                    }
                    placeholder="Enter your name"
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Email Address
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
                    placeholder="Enter your email"
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
                    value={registerForm.password}
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
              </form>

              <div style={styles.authSwitch}>
                Already have an account?{" "}
                <button
                  style={styles.linkButton}
                  onClick={() => {
                    clearMessages();
                    setAuthMode("login");
                  }}
                >
                  Sign In
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={styles.layout}>
        <aside style={styles.sidebar}>
          <div style={styles.brand}>
            <div style={styles.brandIcon}>T</div>

            <div>
              <h2 style={styles.brandTitle}>
                TrustShare
              </h2>

              <p style={styles.brandSubtitle}>
                SECURE COLLABORATION
              </p>
            </div>
          </div>

          <div style={styles.navSection}>
            <div style={styles.navHeading}>
              Workspace
            </div>

            {[
              ["dashboard", "📊", "Dashboard"],
              ["files", "📁", "My Files"],
              ["shared", "🤝", "Shared Files"],
              [
                "temporary",
                "⏳",
                "Temporary Access",
              ],
            ].map(([page, icon, label]) => (
              <button
                key={page}
                style={{
                  ...styles.navItem,
                  ...(activePage === page
                    ? styles.navItemActive
                    : {}),
                }}
                onClick={() => setActivePage(page)}
              >
                <span style={styles.navIcon}>
                  {icon}
                </span>

                <span style={styles.navText}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          <div style={styles.navSection}>
            <div style={styles.navHeading}>
              Security
            </div>

            <button
              style={{
                ...styles.navItem,
                ...(activePage === "monitoring"
                  ? styles.navItemActive
                  : {}),
              }}
              onClick={() =>
                setActivePage("monitoring")
              }
            >
              <span style={styles.navIcon}>
                📈
              </span>

              <span style={styles.navText}>
                Monitoring
              </span>
            </button>
          </div>

          <div style={styles.sidebarFooter}>
            <div style={styles.securityBadge}>
              🔒 End-to-end protected workspace
            </div>
          </div>
        </aside>

        <main style={styles.main}>
          <header style={styles.topbar}>
            <div style={styles.topbarTitle}>
              TrustShare Secure Collaboration Platform
            </div>

            <div style={styles.topbarRight}>
              <div style={styles.userBadge}>
                <div style={styles.avatar}>
                  {getInitials(
                    user?.name ||
                      user?.full_name ||
                      user?.email
                  )}
                </div>

                <div style={styles.userName}>
                  {user?.name ||
                    user?.full_name ||
                    user?.email ||
                    "User"}
                </div>
              </div>

              <button
                style={styles.logoutButton}
                onClick={handleLogout}
              >
                Logout
              </button>
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

            {activePage === "dashboard" && (
              <>
                <div style={styles.welcomeBox}>
                  <h1 style={styles.welcomeTitle}>
                    Welcome back,{" "}
                    {user?.name ||
                      user?.full_name ||
                      "Milestone 2 Test"}
                  </h1>

                  <p style={styles.welcomeSubtitle}>
                    Manage your encrypted files,
                    collaboration, temporary access and
                    security activity from one secure
                    workspace.
                  </p>
                </div>

                <div style={styles.statsGrid}>
                  {[
                    ["📁", files.length, "My Files"],
                    [
                      "🤝",
                      sharedWithMe.length,
                      "Shared With Me",
                    ],
                    [
                      "📤",
                      sharedByMe.length,
                      "Shared By Me",
                    ],
                    [
                      "💾",
                      formatBytes(totalStorage),
                      "Storage Used",
                    ],
                  ].map(
                    ([icon, value, label]) => (
                      <div
                        style={styles.statCard}
                        key={label}
                      >
                        <div
                          style={styles.statIcon}
                        >
                          {icon}
                        </div>

                        <p style={styles.statValue}>
                          {value}
                        </p>

                        <p style={styles.statLabel}>
                          {label}
                        </p>
                      </div>
                    )
                  )}
                </div>

                <div style={styles.quickGrid}>
                  <div style={styles.quickCard}>
                    <h3 style={styles.quickTitle}>
                      🔐 Secure File Storage
                    </h3>

                    <p style={styles.quickText}>
                      Upload files securely. TrustShare
                      protects stored files using
                      encryption.
                    </p>
                  </div>

                  <div style={styles.quickCard}>
                    <h3 style={styles.quickTitle}>
                      🤝 Controlled Collaboration
                    </h3>

                    <p style={styles.quickText}>
                      Share files with specific users
                      and control access duration.
                    </p>
                  </div>

                  <div style={styles.quickCard}>
                    <h3 style={styles.quickTitle}>
                      📈 Security Monitoring
                    </h3>

                    <p style={styles.quickText}>
                      Monitor activities,
                      notifications, audit logs,
                      alerts and suspicious events.
                    </p>
                  </div>
                </div>
              </>
            )}

            {activePage === "files" && (
              <>
                <div style={styles.pageHeader}>
                  <div>
                    <h1 style={styles.pageTitle}>
                      My Files
                    </h1>

                    <p style={styles.pageSubtitle}>
                      Upload, download and manage your
                      encrypted files.
                    </p>
                  </div>

                  <button
                    style={styles.smallButton}
                    onClick={handleRefresh}
                  >
                    ↻ Refresh
                  </button>
                </div>

                <div
                  style={{
                    ...styles.card,
                    marginBottom: "20px",
                  }}
                >
                  <div style={styles.cardHeader}>
                    <div>
                      <h2 style={styles.cardTitle}>
                        Upload New File
                      </h2>

                      <p
                        style={
                          styles.cardDescription
                        }
                      >
                        Files are securely processed by
                        the TrustShare backend.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleUpload}>
                    <div style={styles.uploadArea}>
                      <div style={styles.uploadIcon}>
                        📤
                      </div>

                      <p style={styles.uploadText}>
                        Select a file to upload
                      </p>

                      <p style={styles.uploadHint}>
                        Maximum file size depends on
                        your configured backend.
                      </p>

                      <input
                        type="file"
                        name="file"
                        style={{
                          marginTop: "16px",
                          maxWidth: "100%",
                        }}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      style={styles.primaryButton}
                      disabled={uploading}
                    >
                      {uploading
                        ? "Uploading and encrypting..."
                        : "Upload Securely"}
                    </button>
                  </form>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <h2 style={styles.cardTitle}>
                        Your Files
                      </h2>

                      <p
                        style={
                          styles.cardDescription
                        }
                      >
                        {files.length} file
                        {files.length !== 1
                          ? "s"
                          : ""}{" "}
                        stored
                      </p>
                    </div>
                  </div>

                  {files.length === 0 ? (
                    <div
                      style={styles.monitoringEmpty}
                    >
                      <div style={styles.emptyIcon}>
                        📁
                      </div>

                      <h3 style={styles.emptyTitle}>
                        No files yet
                      </h3>

                      <p style={styles.emptyText}>
                        Upload your first secure file
                        above.
                      </p>
                    </div>
                  ) : (
                    <div style={styles.tableWrapper}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>
                              File
                            </th>

                            <th style={styles.th}>
                              Size
                            </th>

                            <th style={styles.th}>
                              Uploaded
                            </th>

                            <th style={styles.th}>
                              Status
                            </th>

                            <th style={styles.th}>
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {files.map((file) => (
                            <tr key={file.id}>
                              <td style={styles.td}>
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

                              <td style={styles.td}>
                                {formatBytes(
                                  file.size ||
                                    file.file_size ||
                                    file.bytes ||
                                    0
                                )}
                              </td>

                              <td style={styles.td}>
                                {formatDate(
                                  file.created_at ||
                                    file.uploaded_at
                                )}
                              </td>

                              <td style={styles.td}>
                                <span
                                  style={{
                                    ...styles.severityBadge,
                                    background:
                                      "#f0fdf4",
                                    color:
                                      "#15803d",
                                    borderColor:
                                      "#bbf7d0",
                                  }}
                                >
                                  Encrypted
                                </span>
                              </td>

                              <td style={styles.td}>
                                <button
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {activePage === "shared" && (
              <>
                <div style={styles.pageHeader}>
                  <div>
                    <h1 style={styles.pageTitle}>
                      Shared Files
                    </h1>

                    <p style={styles.pageSubtitle}>
                      Collaborate securely by sharing
                      encrypted files.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(320px,1fr))",
                    gap: "18px",
                  }}
                >
                  <div style={styles.formCard}>
                    <h2 style={styles.cardTitle}>
                      Share a File
                    </h2>

                    <p
                      style={{
                        ...styles.cardDescription,
                        marginBottom: "20px",
                      }}
                    >
                      Grant controlled access to
                      another TrustShare user.
                    </p>

                    <form onSubmit={handleShare}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>
                          Select File
                        </label>

                        <select
                          style={styles.select}
                          value={
                            selectedFile?.id || ""
                          }
                          onChange={(event) => {
                            const file = files.find(
                              (item) =>
                                String(item.id) ===
                                String(
                                  event.target.value
                                )
                            );

                            setSelectedFile(
                              file || null
                            );
                          }}
                          required
                        >
                          <option value="">
                            Select a file
                          </option>

                          {files.map((file) => (
                            <option
                              key={file.id}
                              value={file.id}
                            >
                              {file.original_filename ||
                                file.filename}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.label}>
                          Recipient Email
                        </label>

                        <input
                          type="email"
                          value={recipientEmail}
                          onChange={(event) =>
                            setRecipientEmail(
                              event.target.value
                            )
                          }
                          placeholder="recipient@example.com"
                          style={styles.input}
                          required
                        />
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.label}>
                          Access Duration
                        </label>

                        <select
                          style={styles.select}
                          value={shareDuration}
                          onChange={(event) =>
                            setShareDuration(
                              event.target.value
                            )
                          }
                        >
                          <option value="none">
                            No expiry
                          </option>
                          <option value="5m">
                            5 minutes
                          </option>
                          <option value="15m">
                            15 minutes
                          </option>
                          <option value="1h">
                            1 hour
                          </option>
                          <option value="6h">
                            6 hours
                          </option>
                          <option value="24h">
                            24 hours
                          </option>
                          <option value="7d">
                            7 days
                          </option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        style={styles.primaryButton}
                      >
                        🤝 Share Securely
                      </button>
                    </form>
                  </div>

                  <div style={styles.card}>
                    <h2 style={styles.cardTitle}>
                      Files Shared With Me
                    </h2>

                    <p
                      style={{
                        ...styles.cardDescription,
                        marginBottom: "14px",
                      }}
                    >
                      Files other users have shared
                      with you.
                    </p>

                    {sharedWithMe.length === 0 ? (
                      <div
                        style={
                          styles.monitoringEmpty
                        }
                      >
                        <div
                          style={styles.emptyIcon}
                        >
                          🤝
                        </div>

                        <h3
                          style={styles.emptyTitle}
                        >
                          No shared files
                        </h3>

                        <p
                          style={styles.emptyText}
                        >
                          Files shared with your
                          account will appear here.
                        </p>
                      </div>
                    ) : (
                      sharedWithMe.map(
                        (share, index) => (
                          <div
                            key={
                              share.id || index
                            }
                            style={{
                              padding:
                                "13px 0",
                              borderBottom:
                                "1px solid #f1f5f9",
                            }}
                          >
                            <div
                              style={
                                styles.fileName
                              }
                            >
                              {share.file
                                ?.original_filename ||
                                share.file
                                  ?.filename ||
                                share.filename ||
                                "Shared file"}
                            </div>

                            <div
                              style={{
                                marginTop:
                                  "5px",
                                fontSize:
                                  "11px",
                                color:
                                  "#64748b",
                              }}
                            >
                              Permission:{" "}
                              {share.permission ||
                                "view"}
                            </div>

                            {share.expires_at && (
                              <div
                                style={{
                                  marginTop:
                                    "3px",
                                  fontSize:
                                    "11px",
                                  color:
                                    isExpired(
                                      share.expires_at
                                    )
                                      ? "#dc2626"
                                      : "#64748b",
                                }}
                              >
                                Expires:{" "}
                                {formatDate(
                                  share.expires_at
                                )}
                              </div>
                            )}
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
              </>
            )}

            {activePage === "temporary" && (
              <>
                <div style={styles.pageHeader}>
                  <div>
                    <h1 style={styles.pageTitle}>
                      Temporary Access
                    </h1>

                    <p style={styles.pageSubtitle}>
                      Create time-limited access links.
                    </p>
                  </div>
                </div>

                <div style={styles.formCard}>
                  <h2 style={styles.cardTitle}>
                    Create Temporary Link
                  </h2>

                  <p
                    style={{
                      ...styles.cardDescription,
                      marginBottom: "20px",
                    }}
                  >
                    The generated link automatically
                    expires after the selected duration.
                  </p>

                  <form
                    onSubmit={
                      handleCreateTemporaryLink
                    }
                  >
                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        Select File
                      </label>

                      <select
                        style={styles.select}
                        value={
                          temporaryLinkFile?.id ||
                          ""
                        }
                        onChange={(event) => {
                          const file = files.find(
                            (item) =>
                              String(item.id) ===
                              String(
                                event.target.value
                              )
                          );

                          setTemporaryLinkFile(
                            file || null
                          );
                        }}
                        required
                      >
                        <option value="">
                          Select a file
                        </option>

                        {files.map((file) => (
                          <option
                            key={file.id}
                            value={file.id}
                          >
                            {file.original_filename ||
                              file.filename}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        Link Expiration
                      </label>

                      <select
                        style={styles.select}
                        value={
                          temporaryLinkDuration
                        }
                        onChange={(event) =>
                          setTemporaryLinkDuration(
                            event.target.value
                          )
                        }
                      >
                        <option value="5m">
                          5 minutes
                        </option>

                        <option value="15m">
                          15 minutes
                        </option>

                        <option value="1h">
                          1 hour
                        </option>

                        <option value="6h">
                          6 hours
                        </option>

                        <option value="24h">
                          24 hours
                        </option>

                        <option value="7d">
                          7 days
                        </option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      style={styles.primaryButton}
                    >
                      🔗 Generate Temporary Link
                    </button>
                  </form>

                  {temporaryLinkResult && (
                    <div style={styles.linkResult}>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: "800",
                          color: "#334155",
                          marginBottom: "7px",
                        }}
                      >
                        Temporary Access Link
                      </div>

                      <div style={styles.linkText}>
                        {temporaryLinkResult}
                      </div>

                      <button
                        style={{
                          ...styles.smallButton,
                          marginTop: "12px",
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

            {activePage === "monitoring" && (
              <>
                {/* MONITORING HERO */}
                <section
                  style={{
                    background:
                      "linear-gradient(135deg,#0f172a 0%,#172554 55%,#1d4ed8 100%)",
                    borderRadius: "20px",
                    padding: "28px",
                    marginBottom: "22px",
                    color: "#fff",
                    boxShadow:
                      "0 14px 35px rgba(15,23,42,.16)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "20px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          letterSpacing: "1.5px",
                          color: "#93c5fd",
                          marginBottom: "7px",
                        }}
                      >
                        TRUSTSHARE SECURITY CENTER
                      </div>
                      <h1
                        style={{
                          margin: 0,
                          fontSize: "30px",
                          lineHeight: 1.15,
                          fontWeight: 800,
                        }}
                      >
                        Monitoring Dashboard
                      </h1>
                      <p
                        style={{
                          margin: "9px 0 0",
                          color: "#cbd5e1",
                          fontSize: "14px",
                        }}
                      >
                        Real-time visibility into files,
                        activity and security events.
                      </p>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "7px",
                          padding: "9px 13px",
                          borderRadius: "999px",
                          background: "rgba(34,197,94,.15)",
                          color: "#bbf7d0",
                          fontSize: "12px",
                          fontWeight: 800,
                        }}
                      >
                        <span>●</span> System Active
                      </div>
                      <button
                        type="button"
                        onClick={handleMonitoringRefresh}
                        style={{
                          border: "1px solid rgba(255,255,255,.22)",
                          background: "rgba(255,255,255,.1)",
                          color: "#fff",
                          borderRadius: "10px",
                          padding: "10px 14px",
                          fontSize: "12px",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        ↻ Refresh
                      </button>
                    </div>
                  </div>
                </section>

                {/* KPI CARDS */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(170px,1fr))",
                    gap: "14px",
                    marginBottom: "20px",
                  }}
                >
                  {[
                    ["📄", totalRequests, "Total Requests", "#eff6ff", "#2563eb"],
                    ["👥", activity.length, "Tracked Events", "#ecfdf5", "#059669"],
                    ["💾", formatBytes(storageBytes), "Storage Used", "#faf5ff", "#9333ea"],
                    ["🛡️", alerts.length, "Security Alerts", "#fff7ed", "#ea580c"],
                    ["🔔", unreadNotifications, "Unread Notifications", "#ecfeff", "#0891b2"],
                  ].map(
                    ([icon, value, label, iconBackground, iconColor]) => (
                      <div
                        key={label}
                        style={{
                          background: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "16px",
                          padding: "18px",
                          boxShadow:
                            "0 6px 20px rgba(15,23,42,.04)",
                        }}
                      >
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: iconBackground,
                            color: iconColor,
                            fontSize: "18px",
                            marginBottom: "13px",
                          }}
                        >
                          {icon}
                        </div>
                        <div
                          style={{
                            fontSize: "22px",
                            fontWeight: 800,
                            color: "#0f172a",
                            lineHeight: 1.1,
                          }}
                        >
                          {value}
                        </div>
                        <div
                          style={{
                            marginTop: "6px",
                            color: "#64748b",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          {label}
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* OVERVIEW / STORAGE / SECURITY */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(0,2fr) minmax(260px,1fr) minmax(250px,1fr)",
                    gap: "16px",
                    marginBottom: "18px",
                  }}
                >
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px",
                      padding: "20px",
                      boxShadow:
                        "0 6px 20px rgba(15,23,42,.04)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "20px",
                      }}
                    >
                      <div>
                        <h2
                          style={{
                            margin: 0,
                            fontSize: "17px",
                            fontWeight: 800,
                            color: "#0f172a",
                          }}
                        >
                          📊 System Overview
                        </h2>
                        <p
                          style={{
                            margin: "5px 0 0",
                            fontSize: "12px",
                            color: "#64748b",
                          }}
                        >
                          Current monitoring performance
                        </p>
                      </div>
                      <span
                        style={{
                          padding: "6px 9px",
                          borderRadius: "8px",
                          background: "#f8fafc",
                          color: "#64748b",
                          fontSize: "11px",
                          fontWeight: 700,
                        }}
                      >
                        Live data
                      </span>
                    </div>

                    {[
                      [
                        "Successful Requests",
                        successfulRequests,
                        totalRequests
                          ? Math.round(
                              (successfulRequests / totalRequests) * 100
                            )
                          : 0,
                        "#2563eb",
                      ],
                      [
                        "Failed Requests",
                        failedRequests,
                        totalRequests
                          ? Math.round(
                              (failedRequests / totalRequests) * 100
                            )
                          : 0,
                        "#ef4444",
                      ],
                      [
                        "Files Stored",
                        dashboardFileCount,
                        dashboardFileCount ? 100 : 0,
                        "#10b981",
                      ],
                    ].map(([label, value, percentage, barColor]) => (
                      <div key={label} style={{ marginBottom: "17px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            marginBottom: "7px",
                          }}
                        >
                          <span
                            style={{
                              color: "#475569",
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            {label}
                          </span>
                          <strong
                            style={{
                              color: "#0f172a",
                              fontSize: "12px",
                            }}
                          >
                            {value}
                          </strong>
                        </div>
                        <div
                          style={{
                            height: "8px",
                            borderRadius: "999px",
                            background: "#eef2f7",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(
                                Math.max(Number(percentage) || 0, 0),
                                100
                              )}%`,
                              background: barColor,
                              borderRadius: "999px",
                            }}
                          />
                        </div>
                      </div>
                    ))}

                    <div
                      style={{
                        marginTop: "3px",
                        paddingTop: "14px",
                        borderTop: "1px solid #f1f5f9",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "15px",
                        fontSize: "11px",
                        color: "#64748b",
                      }}
                    >
                      <span>Success rate</span>
                      <strong style={{ color: "#059669" }}>
                        {successRate}%
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px",
                      padding: "20px",
                      boxShadow:
                        "0 6px 20px rgba(15,23,42,.04)",
                    }}
                  >
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "17px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      💾 Storage Usage
                    </h2>
                    <p
                      style={{
                        margin: "5px 0 20px",
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      Encrypted file storage
                    </p>

                    <div
                      style={{
                        width: "138px",
                        height: "138px",
                        borderRadius: "50%",
                        margin: "4px auto 18px",
                        background:
                          "conic-gradient(#2563eb 0 42%, #9333ea 42% 70%, #10b981 70% 85%, #f59e0b 85% 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "96px",
                          height: "96px",
                          borderRadius: "50%",
                          background: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "column",
                        }}
                      >
                        <strong
                          style={{
                            fontSize: "17px",
                            color: "#0f172a",
                          }}
                        >
                          {formatBytes(storageBytes)}
                        </strong>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#64748b",
                          }}
                        >
                          {toNumber(storageFileCount)} files
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: "8px",
                        fontSize: "11px",
                      }}
                    >
                      {[
                        ["Documents", "#2563eb", "42%"],
                        ["Shared", "#9333ea", "28%"],
                        ["Encrypted", "#10b981", "15%"],
                        ["Other", "#f59e0b", "15%"],
                      ].map(([label, dot, value]) => (
                        <div
                          key={label}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            color: "#64748b",
                          }}
                        >
                          <span>
                            <span
                              style={{
                                display: "inline-block",
                                width: "7px",
                                height: "7px",
                                borderRadius: "50%",
                                background: dot,
                                marginRight: "6px",
                              }}
                            />
                            {label}
                          </span>
                          <strong style={{ color: "#475569" }}>
                            {value}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px",
                      padding: "20px",
                      boxShadow:
                        "0 6px 20px rgba(15,23,42,.04)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "16px",
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "17px",
                          fontWeight: 800,
                          color: "#0f172a",
                        }}
                      >
                        🛡️ Security Status
                      </h2>
                      <span
                        style={{
                          padding: "5px 9px",
                          borderRadius: "999px",
                          background:
                            alerts.length || suspiciousActivity.length
                              ? "#fef2f2"
                              : "#ecfdf5",
                          color:
                            alerts.length || suspiciousActivity.length
                              ? "#b91c1c"
                              : "#15803d",
                          fontSize: "10px",
                          fontWeight: 800,
                        }}
                      >
                        {alerts.length || suspiciousActivity.length
                          ? "Attention"
                          : "All Good"}
                      </span>
                    </div>

                    {[
                      ["Authentication", alerts.length ? "Review" : "Active"],
                      ["Data Encryption", "Enabled"],
                      ["Access Controls", "Enforced"],
                      [
                        "Threat Detection",
                        suspiciousActivity.length ? "Alert" : "Active",
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          padding: "11px 0",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <span
                          style={{
                            color: "#475569",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              width: "20px",
                              height: "20px",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "50%",
                              background:
                                value === "Active" ||
                                value === "Enabled" ||
                                value === "Enforced"
                                  ? "#dcfce7"
                                  : "#fee2e2",
                              color:
                                value === "Active" ||
                                value === "Enabled" ||
                                value === "Enforced"
                                  ? "#15803d"
                                  : "#b91c1c",
                              marginRight: "8px",
                              fontSize: "10px",
                            }}
                          >
                            {value === "Active" ||
                            value === "Enabled" ||
                            value === "Enforced"
                              ? "✓"
                              : "!"}
                          </span>
                          {label}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            color:
                              value === "Active" ||
                              value === "Enabled" ||
                              value === "Enforced"
                                ? "#15803d"
                                : "#b91c1c",
                          }}
                        >
                          {value}
                        </span>
                      </div>
                    ))}

                    <div
                      style={{
                        marginTop: "15px",
                        padding: "11px",
                        borderRadius: "10px",
                        background:
                          alerts.length || suspiciousActivity.length
                            ? "#fff7ed"
                            : "#ecfdf5",
                        color:
                          alerts.length || suspiciousActivity.length
                            ? "#9a3412"
                            : "#166534",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      {alerts.length || suspiciousActivity.length
                        ? "Security events need your attention."
                        : "Your TrustShare workspace is secure."}
                    </div>
                  </div>
                </div>

                {/* ACTIVITY + ALERTS */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(0,1.35fr) minmax(300px,.75fr)",
                    gap: "16px",
                    marginBottom: "18px",
                  }}
                >
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px",
                      padding: "20px",
                      boxShadow:
                        "0 6px 20px rgba(15,23,42,.04)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "15px",
                      }}
                    >
                      <div>
                        <h2
                          style={{
                            margin: 0,
                            fontSize: "17px",
                            fontWeight: 800,
                          }}
                        >
                          ⚡ Recent Activity
                        </h2>
                        <p
                          style={{
                            margin: "4px 0 0",
                            color: "#64748b",
                            fontSize: "11px",
                          }}
                        >
                          Latest file and security operations
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#64748b",
                          fontWeight: 700,
                        }}
                      >
                        {activity.length} events
                      </span>
                    </div>

                    {activity.length === 0 ? (
                      <div
                        style={{
                          padding: "35px 15px",
                          textAlign: "center",
                          color: "#64748b",
                        }}
                      >
                        No recent activity.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            minWidth: "560px",
                          }}
                        >
                          <thead>
                            <tr>
                              {["Action", "Resource / User", "Time"].map(
                                (header) => (
                                  <th
                                    key={header}
                                    style={{
                                      textAlign: "left",
                                      padding: "10px 8px",
                                      background: "#f8fafc",
                                      color: "#64748b",
                                      fontSize: "10px",
                                      fontWeight: 800,
                                      textTransform: "uppercase",
                                      borderBottom:
                                        "1px solid #e2e8f0",
                                    }}
                                  >
                                    {header}
                                  </th>
                                )
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {activity.slice(0, 8).map((item, index) => (
                              <tr
                                key={
                                  item?.id ||
                                  `recent-${index}`
                                }
                              >
                                <td
                                  style={{
                                    padding: "12px 8px",
                                    borderBottom:
                                      "1px solid #f1f5f9",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    color: "#0f172a",
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "7px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: "26px",
                                        height: "26px",
                                        borderRadius: "8px",
                                        background: "#eff6ff",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      {getMonitorIcon(item)}
                                    </span>
                                    {formatLabel(
                                      getMonitorText(
                                        item,
                                        "Activity"
                                      )
                                    )}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    padding: "12px 8px",
                                    borderBottom:
                                      "1px solid #f1f5f9",
                                    fontSize: "11px",
                                    color: "#475569",
                                  }}
                                >
                                  {getMonitorDescription(item) ||
                                    item?.user_email ||
                                    item?.email ||
                                    "TrustShare"}
                                </td>
                                <td
                                  style={{
                                    padding: "12px 8px",
                                    borderBottom:
                                      "1px solid #f1f5f9",
                                    fontSize: "10px",
                                    color: "#64748b",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {formatDate(
                                    getMonitorTime(item)
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px",
                      padding: "20px",
                      boxShadow:
                        "0 6px 20px rgba(15,23,42,.04)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "14px",
                      }}
                    >
                      <div>
                        <h2
                          style={{
                            margin: 0,
                            fontSize: "17px",
                            fontWeight: 800,
                          }}
                        >
                          🚨 Security Alerts
                        </h2>
                        <p
                          style={{
                            margin: "4px 0 0",
                            color: "#64748b",
                            fontSize: "11px",
                          }}
                        >
                          Events requiring attention
                        </p>
                      </div>
                      <span
                        style={{
                          padding: "5px 9px",
                          borderRadius: "999px",
                          background:
                            alerts.length > 0
                              ? "#fef2f2"
                              : "#ecfdf5",
                          color:
                            alerts.length > 0
                              ? "#b91c1c"
                              : "#15803d",
                          fontSize: "10px",
                          fontWeight: 800,
                        }}
                      >
                        {alerts.length > 0
                          ? `${alerts.length} Alerts`
                          : "Clear"}
                      </span>
                    </div>

                    {alerts.length === 0 ? (
                      <div
                        style={{
                          minHeight: "190px",
                          border: "1px dashed #dbe4ee",
                          borderRadius: "12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "column",
                          color: "#64748b",
                          textAlign: "center",
                          padding: "20px",
                        }}
                      >
                        <div style={{ fontSize: "28px" }}>
                          🛡️
                        </div>
                        <strong
                          style={{
                            marginTop: "8px",
                            color: "#334155",
                            fontSize: "13px",
                          }}
                        >
                          No active alerts
                        </strong>
                        <span
                          style={{
                            marginTop: "4px",
                            fontSize: "11px",
                          }}
                        >
                          Your security system is clear.
                        </span>
                      </div>
                    ) : (
                      alerts.slice(0, 6).map((item, index) => {
                        const severity = getSeverity(item);
                        const severityStyle =
                          getSeverityStyle(severity);

                        return (
                          <div
                            key={
                              item?.id ||
                              `alert-${index}`
                            }
                            style={{
                              padding: "12px 0",
                              borderBottom:
                                "1px solid #f1f5f9",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent:
                                  "space-between",
                                gap: "10px",
                              }}
                            >
                              <strong
                                style={{
                                  fontSize: "12px",
                                  color: "#0f172a",
                                }}
                              >
                                {item?.title ||
                                  item?.message ||
                                  "Security Alert"}
                              </strong>
                              <span
                                style={{
                                  padding: "4px 7px",
                                  borderRadius: "6px",
                                  background:
                                    severityStyle.background,
                                  color:
                                    severityStyle.color,
                                  border: `1px solid ${severityStyle.border}`,
                                  fontSize: "9px",
                                  fontWeight: 800,
                                }}
                              >
                                {severity}
                              </span>
                            </div>
                            <div
                              style={{
                                marginTop: "5px",
                                color: "#64748b",
                                fontSize: "10px",
                                lineHeight: 1.5,
                              }}
                            >
                              {getMonitorDescription(item) ||
                                "Security event detected."}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* AUDIT LOGS */}
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "16px",
                    padding: "20px",
                    marginBottom: "18px",
                    boxShadow:
                      "0 6px 20px rgba(15,23,42,.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "15px",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "17px",
                          fontWeight: 800,
                        }}
                      >
                        🧾 Security Audit Logs
                      </h2>
                      <p
                        style={{
                          margin: "4px 0 0",
                          color: "#64748b",
                          fontSize: "11px",
                        }}
                      >
                        Complete record of recent user and
                        system operations.
                      </p>
                    </div>
                    <span
                      style={{
                        padding: "6px 9px",
                        borderRadius: "8px",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: "10px",
                        fontWeight: 800,
                      }}
                    >
                      {activity.length} Records
                    </span>
                  </div>

                  {activity.length === 0 ? (
                    <div
                      style={{
                        padding: "30px",
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      No audit records available.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          minWidth: "760px",
                        }}
                      >
                        <thead>
                          <tr>
                            {[
                              "Action",
                              "Description",
                              "User",
                              "Status",
                              "Timestamp",
                            ].map((header) => (
                              <th
                                key={header}
                                style={{
                                  textAlign: "left",
                                  padding: "11px 10px",
                                  background: "#f8fafc",
                                  color: "#64748b",
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  textTransform: "uppercase",
                                  borderBottom:
                                    "1px solid #e2e8f0",
                                }}
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activity.map((item, index) => {
                            const rawStatus = String(
                              item?.status ||
                                item?.result ||
                                item?.outcome ||
                                ""
                            ).toLowerCase();

                            const failed =
                              rawStatus.includes("fail") ||
                              rawStatus.includes("error") ||
                              rawStatus.includes("denied");

                            const success =
                              rawStatus.includes("success") ||
                              rawStatus.includes("completed") ||
                              rawStatus === "ok";

                            const statusText = failed
                              ? "Failed"
                              : success
                              ? "Success"
                              : item?.status ||
                                item?.result ||
                                item?.outcome ||
                                "Recorded";

                            return (
                              <tr
                                key={
                                  item?.id ||
                                  `audit-${index}`
                                }
                              >
                                <td
                                  style={{
                                    padding: "12px 10px",
                                    borderBottom:
                                      "1px solid #f1f5f9",
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    color: "#0f172a",
                                  }}
                                >
                                  {getMonitorIcon(item)}{" "}
                                  {formatLabel(
                                    getMonitorText(
                                      item,
                                      "System Event"
                                    )
                                  )}
                                </td>
                                <td
                                  style={{
                                    padding: "12px 10px",
                                    borderBottom:
                                      "1px solid #f1f5f9",
                                    fontSize: "11px",
                                    color: "#64748b",
                                  }}
                                >
                                  {getMonitorDescription(item) ||
                                    "Security activity recorded by TrustShare."}
                                </td>
                                <td
                                  style={{
                                    padding: "12px 10px",
                                    borderBottom:
                                      "1px solid #f1f5f9",
                                    fontSize: "11px",
                                    color: "#475569",
                                  }}
                                >
                                  {item?.user_email ||
                                    item?.email ||
                                    item?.username ||
                                    item?.user ||
                                    user?.email ||
                                    "Current User"}
                                </td>
                                <td
                                  style={{
                                    padding: "12px 10px",
                                    borderBottom:
                                      "1px solid #f1f5f9",
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      padding: "4px 8px",
                                      borderRadius: "999px",
                                      background: failed
                                        ? "#fef2f2"
                                        : success
                                        ? "#ecfdf5"
                                        : "#f8fafc",
                                      color: failed
                                        ? "#b91c1c"
                                        : success
                                        ? "#15803d"
                                        : "#64748b",
                                      fontSize: "9px",
                                      fontWeight: 800,
                                    }}
                                  >
                                    {String(statusText)}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    padding: "12px 10px",
                                    borderBottom:
                                      "1px solid #f1f5f9",
                                    fontSize: "10px",
                                    color: "#64748b",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {formatDate(
                                    getMonitorTime(item)
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* FILE REPORTS */}
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "16px",
                    padding: "20px",
                    marginBottom: "18px",
                    boxShadow:
                      "0 6px 20px rgba(15,23,42,.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "15px",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "17px",
                          fontWeight: 800,
                        }}
                      >
                        📁 File Reports
                      </h2>
                      <p
                        style={{
                          margin: "4px 0 0",
                          color: "#64748b",
                          fontSize: "11px",
                        }}
                      >
                        File-level monitoring information from
                        the existing reports API.
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const reportRows = Array.isArray(fileReports)
                      ? fileReports
                      : fileReports?.files ||
                        fileReports?.items ||
                        fileReports?.reports ||
                        [];

                    if (!reportRows.length) {
                      return (
                        <div
                          style={{
                            padding: "30px",
                            textAlign: "center",
                            color: "#64748b",
                            border: "1px dashed #dbe4ee",
                            borderRadius: "12px",
                          }}
                        >
                          No file report data available.
                        </div>
                      );
                    }

                    return (
                      <>
                        <div style={{ overflowX: "auto" }}>
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              minWidth: "700px",
                            }}
                          >
                            <thead>
                              <tr>
                                {[
                                  "File",
                                  "Size",
                                  "Status",
                                  "Created",
                                  "Owner",
                                ].map((header) => (
                                  <th
                                    key={header}
                                    style={{
                                      textAlign: "left",
                                      padding: "11px 10px",
                                      background: "#f8fafc",
                                      color: "#64748b",
                                      fontSize: "10px",
                                      fontWeight: 800,
                                      textTransform: "uppercase",
                                      borderBottom:
                                        "1px solid #e2e8f0",
                                    }}
                                  >
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {reportRows.slice(0, 10).map(
                                (file, index) => {
                                  const fileName =
                                    file?.name ||
                                    file?.filename ||
                                    file?.original_filename ||
                                    file?.file_name ||
                                    `File ${index + 1}`;

                                  const fileSize =
                                    file?.size ??
                                    file?.file_size ??
                                    file?.bytes ??
                                    file?.metadata?.size ??
                                    0;

                                  const createdAt =
                                    file?.created_at ||
                                    file?.uploaded_at ||
                                    file?.created ||
                                    file?.timestamp;

                                  const owner =
                                    file?.owner_email ||
                                    file?.user_email ||
                                    file?.owner ||
                                    user?.email ||
                                    "Current User";

                                  const status =
                                    file?.status ||
                                    (file?.deleted
                                      ? "Deleted"
                                      : "Active");

                                  const deleted =
                                    String(status).toLowerCase() ===
                                    "deleted";

                                  return (
                                    <tr
                                      key={
                                        file?.id ||
                                        file?.file_id ||
                                        index
                                      }
                                    >
                                      <td
                                        style={{
                                          padding: "12px 10px",
                                          borderBottom:
                                            "1px solid #f1f5f9",
                                          fontSize: "12px",
                                          fontWeight: 800,
                                          color: "#0f172a",
                                        }}
                                      >
                                        <span
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "8px",
                                          }}
                                        >
                                          <span
                                            style={{
                                              width: "30px",
                                              height: "30px",
                                              borderRadius: "8px",
                                              background: "#eff6ff",
                                              display:
                                                "inline-flex",
                                              alignItems:
                                                "center",
                                              justifyContent:
                                                "center",
                                            }}
                                          >
                                            📄
                                          </span>
                                          {fileName}
                                        </span>
                                      </td>
                                      <td
                                        style={{
                                          padding: "12px 10px",
                                          borderBottom:
                                            "1px solid #f1f5f9",
                                          fontSize: "11px",
                                          color: "#475569",
                                        }}
                                      >
                                        {formatBytes(fileSize)}
                                      </td>
                                      <td
                                        style={{
                                          padding: "12px 10px",
                                          borderBottom:
                                            "1px solid #f1f5f9",
                                        }}
                                      >
                                        <span
                                          style={{
                                            display: "inline-flex",
                                            padding: "4px 8px",
                                            borderRadius: "999px",
                                            background: deleted
                                              ? "#fef2f2"
                                              : "#ecfdf5",
                                            color: deleted
                                              ? "#b91c1c"
                                              : "#15803d",
                                            fontSize: "9px",
                                            fontWeight: 800,
                                          }}
                                        >
                                          ● {formatLabel(status)}
                                        </span>
                                      </td>
                                      <td
                                        style={{
                                          padding: "12px 10px",
                                          borderBottom:
                                            "1px solid #f1f5f9",
                                          fontSize: "10px",
                                          color: "#64748b",
                                        }}
                                      >
                                        {formatDate(createdAt)}
                                      </td>
                                      <td
                                        style={{
                                          padding: "12px 10px",
                                          borderBottom:
                                            "1px solid #f1f5f9",
                                          fontSize: "11px",
                                          color: "#475569",
                                        }}
                                      >
                                        {owner}
                                      </td>
                                    </tr>
                                  );
                                }
                              )}
                            </tbody>
                          </table>
                        </div>

                        <details
                          style={{
                            marginTop: "14px",
                            borderTop: "1px solid #f1f5f9",
                            paddingTop: "12px",
                          }}
                        >
                          <summary
                            style={{
                              cursor: "pointer",
                              color: "#64748b",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            View technical report data
                          </summary>
                          <pre
                            style={{
                              marginTop: "12px",
                              padding: "14px",
                              background: "#0f172a",
                              color: "#cbd5e1",
                              borderRadius: "10px",
                              overflowX: "auto",
                              fontSize: "10px",
                              lineHeight: 1.5,
                            }}
                          >
                            {JSON.stringify(
                              fileReports,
                              null,
                              2
                            )}
                          </pre>
                        </details>
                      </>
                    );
                  })()}
                </div>

                {/* TECHNICAL STORAGE DATA */}
                {storageAnalytics && (
                  <details
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px",
                      padding: "16px 20px",
                      boxShadow:
                        "0 6px 20px rgba(15,23,42,.03)",
                    }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        color: "#475569",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      View technical storage data
                    </summary>
                    <pre
                      style={{
                        marginTop: "12px",
                        padding: "14px",
                        background: "#0f172a",
                        color: "#cbd5e1",
                        borderRadius: "10px",
                        overflowX: "auto",
                        fontSize: "10px",
                        lineHeight: 1.5,
                      }}
                    >
                      {JSON.stringify(
                        storageAnalytics,
                        null,
                        2
                      )}
                    </pre>
                  </details>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
