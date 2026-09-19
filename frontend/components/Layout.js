import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import api from "../lib/api";
import NotificationBell from "./NotificationBell";

const NAV_ITEMS = [
  { key: "overview", label: "Dashboard", href: "/dashboard" },
  { key: "files", label: "My files", href: "/files" },
  { key: "upload", label: "Upload file", href: "/upload" },
  { key: "folders", label: "Folders", href: "/folders" },
  { key: "activity", label: "Activity", href: "/activity" },
  { key: "admin", label: "Admin", href: "/admin" },
  { key: "profile", label: "Profile", href: "/profile" },
];

export default function Layout({ active, eyebrow, title, action, children }) {
  const [email, setEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("token")) {
      router.push("/");
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setEmail(res.data.email))
      .catch(() => {
        localStorage.removeItem("token");
        router.push("/");
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header
        style={{
          background: "var(--forest)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 32px",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "var(--lime)",
                color: "var(--forest)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              T
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap" }}>TrustShare</span>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {NAV_ITEMS.map((item) => {
              const isActive = active === item.key;
              return (
                <a
                  key={item.key}
                  href={item.href}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: isActive ? "var(--forest)" : "rgba(255,255,255,0.8)",
                    background: isActive ? "var(--lime)" : "transparent",
                    fontWeight: isActive ? 600 : 400,
                    fontSize: 14,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <NotificationBell />
          <span
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.65)",
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {email}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "rgba(255,255,255,0.9)",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <main style={{ padding: "32px 48px", maxWidth: 1100, margin: "0 auto" }}>
        {(title || action) && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 24,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              {eyebrow && (
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  {eyebrow}
                </div>
              )}
              {title && <h1 style={{ fontSize: 28, fontWeight: 700, margin: "6px 0 0" }}>{title}</h1>}
            </div>

            {action}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
