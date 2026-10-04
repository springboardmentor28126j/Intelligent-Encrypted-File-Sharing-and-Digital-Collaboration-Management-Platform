"use client";

import type { Metadata } from "next";
import Link from "next/link";
import { useState, useEffect } from "react";

// Note: metadata export works in Server Components. Moving SEO to layout for this client page.

const features = [
  {
    icon: "🔒",
    title: "End-to-End Encrypted",
    description: "Your files are encrypted before they leave your device. Only you and your recipients can read them.",
  },
  {
    icon: "⚡",
    title: "Lightning Fast",
    description: "Optimized for speed with CDN-backed storage so your files are always close to your recipients.",
  },
  {
    icon: "👥",
    title: "Role-Based Access",
    description: "Granular permission controls. Assign viewer, editor, or admin roles to every collaborator.",
  },
  {
    icon: "📊",
    title: "Activity Audit Logs",
    description: "Know exactly who accessed what and when. Full audit trail for compliance and peace of mind.",
  },
];

export default function HomePage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1.25rem 0",
          borderBottom: "1px solid var(--color-border)",
          marginBottom: "5rem",
        }}
      >
        <a href="/" className="logo">
          <span className="logo-icon">🛡️</span>
          <span className="logo-text">TrustShare</span>
        </a>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/login" className="btn btn-secondary" style={{ padding: "0.6rem 1.25rem", width: "auto" }}>
            Sign In
          </Link>
          <Link href="/register" className="btn btn-primary" style={{ padding: "0.6rem 1.25rem", width: "auto" }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        className={isVisible ? "animate-fade-in" : ""}
        style={{ textAlign: "center", marginBottom: "6rem" }}
      >
        {/* Pill badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.4rem 1rem",
            background: "rgba(99, 102, 241, 0.12)",
            border: "1px solid rgba(99, 102, 241, 0.25)",
            borderRadius: "9999px",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--color-brand-primary)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: "2rem",
          }}
        >
          <span>✨</span>
          <span>Enterprise Secure File Sharing Platform</span>
        </div>

        <h1 className="heading-1" style={{ marginBottom: "1.5rem" }}>
          Secure File Sharing
          <br />
          <span className="gradient-text">Built on Trust</span>
        </h1>

        <p
          className="text-muted"
          style={{
            fontSize: "var(--font-size-xl)",
            maxWidth: "600px",
            margin: "0 auto 2.5rem",
            lineHeight: "1.7",
          }}
        >
          Share sensitive files with confidence. TrustShare combines enterprise-grade
          security with a delightful user experience.
        </p>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/register"
            className="btn btn-primary"
            style={{ width: "auto", padding: "1rem 2rem", fontSize: "1.05rem" }}
          >
            Create Free Account →
          </Link>
          <Link
            href="/login"
            className="btn btn-secondary"
            style={{ width: "auto", padding: "1rem 2rem" }}
          >
            Sign In
          </Link>
        </div>

        {/* Floating stats */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "3rem",
            marginTop: "4rem",
            flexWrap: "wrap",
          }}
        >
          {[
            { value: "256-bit", label: "Encryption" },
            { value: "99.9%", label: "Uptime" },
            { value: "0", label: "Data breaches" },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "var(--font-size-2xl)",
                  fontWeight: 800,
                  background: "var(--color-brand-gradient)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {stat.value}
              </div>
              <div className="text-muted" style={{ fontSize: "var(--font-size-sm)", marginTop: "0.25rem" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Grid ───────────────────────────────────────────────── */}
      <section style={{ marginBottom: "5rem" }}>
        <h2
          style={{
            textAlign: "center",
            fontSize: "var(--font-size-3xl)",
            fontWeight: 700,
            marginBottom: "3rem",
            letterSpacing: "-0.02em",
          }}
        >
          Everything You Need to{" "}
          <span className="gradient-text">Share Safely</span>
        </h2>

        <div
          className="stagger-children"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {features.map((feature) => (
            <div
              key={feature.title}
              className="card"
              style={{ cursor: "default" }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>
                {feature.icon}
              </div>
              <h3
                style={{
                  fontSize: "var(--font-size-lg)",
                  fontWeight: 600,
                  marginBottom: "0.5rem",
                }}
              >
                {feature.title}
              </h3>
              <p className="text-muted" style={{ lineHeight: "1.6" }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────────── */}
      <section
        style={{
          textAlign: "center",
          padding: "4rem",
          background: "linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.08) 100%)",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: "var(--radius-xl)",
        }}
      >
        <h2
          style={{ fontSize: "var(--font-size-3xl)", fontWeight: 700, marginBottom: "1rem" }}
        >
          Ready to get started?
        </h2>
        <p
          className="text-muted"
          style={{ marginBottom: "2rem", fontSize: "var(--font-size-lg)" }}
        >
          Create your free account and start sharing securely in minutes.
        </p>
        <Link
          href="/register"
          className="btn btn-primary"
          style={{ width: "auto", padding: "1rem 2.5rem", fontSize: "1.05rem" }}
        >
          Get Started Free →
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer
        className="text-muted"
        style={{
          textAlign: "center",
          marginTop: "4rem",
          paddingTop: "2rem",
          borderTop: "1px solid var(--color-border)",
          fontSize: "var(--font-size-sm)",
        }}
      >
        © 2026 TrustShare. Milestone 1 – Authentication Foundation.
      </footer>
    </div>
  );
}
