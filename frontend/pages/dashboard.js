import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const ACTION_LABELS = {
  login: "Logged in",
  register: "Account created",
  upload: "Uploaded a file",
  download: "Downloaded a file",
  forgot_password_requested: "Requested password reset",
  password_reset: "Password changed",
};

function StatCard({ label, value }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "20px 22px",
        flex: 1,
        minWidth: 160,
      }}
    >
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [stats, setStats] = useState({ total_files: 0, total_bytes: 0 });
  const [files, setFiles] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    api.get("/auth/me").then((res) => setEmail(res.data.email)).catch(() => {});
    api.get("/files/stats").then((res) => setStats(res.data)).catch(() => {});
    api
      .get("/files")
      .then((res) => setFiles(res.data.slice(0, 5)))
      .catch(() => {});
    api
      .get("/activity")
      .then((res) => setActivity(res.data.slice(0, 5)))
      .catch(() => {});
  }, []);

  const firstName = email ? email.split("@")[0] : "";

  return (
    <Layout
      active="overview"
      eyebrow="Secure file sharing"
      title="Overview"
      action={
        <a
          href="/upload"
          style={{
            background: "var(--lime)",
            color: "var(--forest)",
            padding: "10px 18px",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          + Upload file
        </a>
      }
    >
      <div style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text-muted)" }}>
        Good to see you
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "6px 0 4px" }}>Welcome, {firstName || "there"}</h2>
      <p style={{ color: "var(--text-muted)", marginTop: 0, marginBottom: 28 }}>
        Everything you need is in one secure place.
      </p>

      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        <StatCard label="Total files" value={stats.total_files} />
        <StatCard label="Storage used" value={formatBytes(stats.total_bytes)} />
        <StatCard label="Folders" value={0} />
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div
          style={{
            flex: 2,
            minWidth: 320,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontWeight: 600 }}>Recent files</span>
            <a href="/files" style={{ fontSize: 13, color: "var(--lime-dark)", textDecoration: "none" }}>
              View all
            </a>
          </div>
          {files.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "12px 0" }}>
              No files yet. Upload your first file to get started.
            </div>
          )}
          {files.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--lime)",
                  color: "var(--forest)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {f.filename.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.filename}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatBytes(f.size_bytes)}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {new Date(f.uploaded_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 260,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
            <span>Recent activity</span>
            <a href="/activity" style={{ fontSize: 13, color: "var(--lime-dark)", textDecoration: "none", fontWeight: 400 }}>
              View all
            </a>
          </div>
          {activity.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 14 }}>No activity yet.</div>
          )}
          {activity.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0" }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--lime-dark)",
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 14 }}>{ACTION_LABELS[a.action] || a.action}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{timeAgo(a.timestamp)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
