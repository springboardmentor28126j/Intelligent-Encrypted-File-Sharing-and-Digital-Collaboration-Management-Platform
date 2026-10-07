"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Dashboard", href: "/dashboard", icon: "▦" },
  { label: "My Files", href: "/dashboard", icon: "▤" },
  { label: "Analytics", href: "/analytics", icon: "▥" },
  { label: "Security", href: "/security", icon: "◈" },
];

export default function TrustShareSidebar() {
  const pathname = usePathname();

  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/"
  ) return null;

  return (
    <aside className="ts-sidebar">
      <div className="ts-brand">
        <div className="ts-logo">T</div>
        <div>
          <div className="ts-brand-name">TrustShare</div>
          <div className="ts-brand-subtitle">Secure workspace</div>
        </div>
      </div>

      <div className="ts-section-label">WORKSPACE</div>
      <nav className="ts-nav">
        {items.map((item, index) => {
          const active = item.href === "/dashboard"
            ? pathname.startsWith("/dashboard")
            : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`ts-nav-item ${active ? "ts-active" : ""}`}
            >
              <span className="ts-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="ts-security-card">
        <div className="ts-security-icon">◇</div>
        <div className="ts-security-title">Your files, protected</div>
        <p>Secure file sharing and digital collaboration in one place.</p>
      </div>

      <div className="ts-sidebar-footer">
        <span className="ts-status-dot" />
        Secure workspace
      </div>
    </aside>
  );
}
