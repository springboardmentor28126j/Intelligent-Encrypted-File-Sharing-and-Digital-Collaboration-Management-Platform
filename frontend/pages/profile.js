import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

const ACTION_META = {
  login: { label: "Logged in", icon: "→" },
  register: { label: "Account created", icon: "★" },
  upload: { label: "Uploaded a file", icon: "↑" },
  download: { label: "Downloaded a file", icon: "↓" },
  preview: { label: "Previewed a file", icon: "◎" },
  rename: { label: "Renamed a file", icon: "✎" },
  delete: { label: "Deleted a file", icon: "🗑" },
  share_link_created: { label: "Created a share link", icon: "🔗" },
  share_link_revoked: { label: "Revoked a share link", icon: "⊘" },
  shared_with_user: { label: "Shared a file with someone", icon: "👤" },
  forgot_password_requested: { label: "Requested password reset", icon: "?" },
  password_reset: { label: "Password changed", icon: "✓" },
};

function StatCard({ label, value }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 18px",
        flex: 1,
        minWidth: 130,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default function Profile() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ total_files: 0, total_bytes: 0 });
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    api.get("/auth/me").then((res) => setUser(res.data));
    api.get("/files/stats").then((res) => setStats(res.data));
    api.get("/activity").then((res) => setActivity(res.data));
  }, []);

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "...";

  const lastLogin = activity.find((a) => a.action === "login");

  return (
    <Layout active="profile" eyebrow="Secure file sharing" title="Profile">
      {/* Identity card */}
      <div
        style={{
          background: "var(--forest)",
          borderRadius: 14,
          padding: "24px 28px",
          marginBottom: 20,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--lime)",
            color: "var(--forest)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 26,
            flexShrink: 0,
          }}
        >
          {user?.email ? user.email.charAt(0).toUpperCase() : "?"}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{user?.email || "..."}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2, textTransform: "capitalize" }}>
            {user?.role || "..."} account · Member since {memberSince}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Total files" value={stats.total_files} />
        <StatCard label="Storage used" value={formatBytes(stats.total_bytes)} />
        <StatCard label="Logged activity events" value={activity.length} />
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {/* Security section */}
        <div
          style={{
            flex: 1,
            minWidth: 280,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Security</div>

          <div style={{ fontSize: 13, marginBottom: 4 }}>Password</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            Change your password if you think it may be compromised.
          </div>
          <a
            href="/forgot-password"
            style={{
              display: "inline-block",
              background: "var(--forest)",
              color: "#fff",
              padding: "8px 16px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 18,
            }}
          >
            Change password
          </a>

          <div style={{ fontSize: 13, marginBottom: 4 }}>Last login</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {lastLogin ? new Date(lastLogin.timestamp).toLocaleString() : "No login recorded yet"}
          </div>
        </div>

        {/* Recent activity */}
        <div
          style={{
            flex: 1,
            minWidth: 280,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
            <span>Recent activity</span>
            <a href="/activity" style={{ fontSize: 12, fontWeight: 400, color: "var(--lime-dark)", textDecoration: "none" }}>
              View all
            </a>
          </div>
          {activity.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No activity yet.</div>
          )}
          {activity.slice(0, 5).map((a, i) => {
            const meta = ACTION_META[a.action] || { label: a.action, icon: "•" };
            return (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0" }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    flexShrink: 0,
                  }}
                >
                  {meta.icon}
                </div>
                <div style={{ fontSize: 13 }}>{meta.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
