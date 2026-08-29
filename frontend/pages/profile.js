import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";

export default function Profile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.get("/auth/me").then((res) => setUser(res.data));
  }, []);

  return (
    <Layout active="profile" eyebrow="Secure file sharing" title="Profile">
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 28,
          maxWidth: 420,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--lime)",
            color: "var(--forest)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 22,
            marginBottom: 16,
          }}
        >
          {user?.email ? user.email.charAt(0).toUpperCase() : "?"}
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Email</div>
          <div style={{ fontSize: 15 }}>{user?.email || "..."}</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Role</div>
          <div style={{ fontSize: 15, textTransform: "capitalize" }}>{user?.role || "..."}</div>
        </div>
        <a
          href="/forgot-password"
          style={{ fontSize: 13, color: "var(--lime-dark)", textDecoration: "none" }}
        >
          Change password
        </a>
      </div>
    </Layout>
  );
}
