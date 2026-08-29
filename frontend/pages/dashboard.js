import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function extForFile(filename) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "OTHER";
}

const TYPE_COLORS = ["#f5b942", "#5b8def", "#3fb37f", "#c65fd6", "#e0655e", "#4bc1c9"];

function buildBreakdown(files) {
  const groups = {};
  files.forEach((f) => {
    const ext = extForFile(f.filename);
    if (!groups[ext]) groups[ext] = { count: 0, bytes: 0 };
    groups[ext].count += 1;
    groups[ext].bytes += f.size_bytes;
  });
  const totalBytes = files.reduce((sum, f) => sum + f.size_bytes, 0) || 1;
  return Object.entries(groups)
    .map(([ext, data], i) => ({
      ext,
      count: data.count,
      bytes: data.bytes,
      pct: Math.round((data.bytes / totalBytes) * 100),
      color: TYPE_COLORS[i % TYPE_COLORS.length],
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

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

  useEffect(() => {
    api.get("/auth/me").then((res) => setEmail(res.data.email)).catch(() => {});
    api.get("/files/stats").then((res) => setStats(res.data)).catch(() => {});
    api
      .get("/files")
      .then((res) => setFiles(res.data))
      .catch(() => {});
  }, []);

  const firstName = email ? email.split("@")[0] : "";
  const recentFiles = files.slice(0, 5);
  const breakdown = buildBreakdown(files);

  return (
    <Layout
      active="overview"
      eyebrow="Secure file sharing"
      title="Dashboard"
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
      <div
        style={{
          background: "var(--forest)",
          borderRadius: 14,
          padding: "24px 28px",
          marginBottom: 28,
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 0.4, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>
          Welcome back{firstName ? `, ${firstName}` : ""}
        </h2>
        <p style={{ color: "rgba(255,255,255,0.75)", margin: 0, fontSize: 14 }}>
          Here's a snapshot of your workspace — {stats.total_files} file{stats.total_files === 1 ? "" : "s"} stored,{" "}
          {formatBytes(stats.total_bytes)} in use.
        </p>
      </div>

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
          {recentFiles.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "12px 0" }}>
              No files yet. Upload your first file to get started.
            </div>
          )}
          {recentFiles.map((f) => (
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
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 14 }}>Storage by file type</div>
            {breakdown.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
                Upload files to see a breakdown here.
              </div>
            )}
            {breakdown.map((b) => (
              <div key={b.ext} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{b.ext}</span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {b.count} file{b.count === 1 ? "" : "s"} · {formatBytes(b.bytes)}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: "var(--bg)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${b.pct}%`,
                      height: "100%",
                      background: b.color,
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 14 }}>Quick actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a
                href="/upload"
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  color: "var(--text)",
                  fontSize: 14,
                }}
              >
                ↑ Upload a new file
              </a>
              <a
                href="/files"
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  color: "var(--text)",
                  fontSize: 14,
                }}
              >
                📁 Browse all files
              </a>
              <a
                href="/activity"
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  color: "var(--text)",
                  fontSize: 14,
                }}
              >
                🕒 View activity log
              </a>
              <a
                href="/forgot-password"
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  color: "var(--text)",
                  fontSize: 14,
                }}
              >
                🔒 Change password
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
