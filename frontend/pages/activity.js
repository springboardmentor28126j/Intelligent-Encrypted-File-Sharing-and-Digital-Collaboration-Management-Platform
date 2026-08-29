import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";

const ACTION_LABELS = {
  login: "Logged in",
  register: "Account created",
  upload: "Uploaded a file",
  download: "Downloaded a file",
  forgot_password_requested: "Requested password reset",
  password_reset: "Password changed",
};

export default function Activity() {
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    api.get("/activity").then((res) => setActivity(res.data));
  }, []);

  return (
    <Layout active="activity" eyebrow="Secure file sharing" title="Activity">
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 8 }}>
        {activity.length === 0 && (
          <div style={{ padding: 24, color: "var(--text-muted)", textAlign: "center" }}>No activity yet.</div>
        )}
        {activity.map((a, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              gap: 12,
              padding: "14px 12px",
              borderTop: idx === 0 ? "none" : "1px solid var(--border)",
            }}
          >
            <div
              style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--lime-dark)", marginTop: 6, flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: 14 }}>{ACTION_LABELS[a.action] || a.action}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {new Date(a.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
