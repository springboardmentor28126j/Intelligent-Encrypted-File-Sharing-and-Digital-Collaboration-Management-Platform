"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await forgotPassword({ email: email.trim().toLowerCase() });
      setSuccess(true);
      if (res.delivery_status) {
        setDeliveryStatus(res.delivery_status);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <div
        className="card animate-fade-in"
        style={{ width: "100%", maxWidth: "460px" }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <Link href="/" className="logo" style={{ justifyContent: "center" }}>
            <span className="logo-icon">🛡️</span>
            <span className="logo-text">TrustShare</span>
          </Link>
          <h1
            style={{
              fontSize: "var(--font-size-2xl)",
              fontWeight: 700,
              marginTop: "1.5rem",
              marginBottom: "0.5rem",
            }}
          >
            Reset Password
          </h1>
          <p className="text-muted" style={{ fontSize: "var(--font-size-sm)" }}>
            Enter your account email to receive a secure password recovery link.
          </p>
        </div>

        {/* Success State */}
        {success ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 1.25rem",
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.75rem",
              }}
            >
              ✉️
            </div>
            <h2
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: 600,
                marginBottom: "0.5rem",
              }}
            >
              Check your inbox
            </h2>
            <p
              className="text-muted"
              style={{ fontSize: "var(--font-size-sm)", marginBottom: "1.5rem", lineHeight: 1.6 }}
            >
              If an account with <strong>{email}</strong> exists, we&apos;ve sent a password reset link valid for 30 minutes.
            </p>

            {deliveryStatus && (
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-text-muted, #9ca3af)",
                  background: "rgba(255, 255, 255, 0.03)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-sm, 6px)",
                  marginBottom: "1.5rem",
                  border: "1px solid var(--color-border, #1f2937)",
                }}
              >
                Status: {deliveryStatus}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => {
                  setSuccess(false);
                  setEmail("");
                }}
                className="btn btn-secondary"
                style={{ width: "100%" }}
              >
                Send to another email
              </button>
              <Link
                href="/login"
                className="btn btn-primary"
                style={{ width: "100%" }}
              >
                Return to Login →
              </Link>
            </div>
          </div>
        ) : (
          /* Input Form */
          <>
            {/* Error Alert */}
            {error && (
              <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
                <span>✕</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="forgot-email" className="form-label">
                  Registered Email Address
                </label>
                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  className="form-input"
                  placeholder="alice@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  required
                  autoFocus
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <button
                id="forgot-submit-btn"
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ marginTop: "0.5rem", width: "100%" }}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Sending instructions…
                  </>
                ) : (
                  "Send Reset Link →"
                )}
              </button>
            </form>

            <div className="divider">or</div>

            <p
              className="text-muted"
              style={{ textAlign: "center", fontSize: "var(--font-size-sm)" }}
            >
              Remembered your password?{" "}
              <Link
                href="/login"
                style={{ color: "var(--color-text-link, #818cf8)", fontWeight: 500 }}
              >
                Sign In →
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
