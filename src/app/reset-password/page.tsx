"use client";

import { useState, useEffect, Suspense, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/api";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tokenParam = searchParams.get("token") || "";

  const [token, setToken] = useState(tokenParam);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, [tokenParam]);

  // Password strength calculation
  const hasMinLength = newPassword.length >= 6;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const score = [hasMinLength, hasUppercase, hasNumber, hasSpecial].filter(Boolean).length;

  const getStrengthLabel = () => {
    if (newPassword.length === 0) return "";
    if (score <= 1) return "Weak";
    if (score <= 3) return "Moderate";
    return "Strong";
  };

  const getStrengthColor = () => {
    if (score <= 1) return "#ef4444";
    if (score <= 3) return "#f59e0b";
    return "#10b981";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError("Password reset token is missing.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await resetPassword({
        token: token.trim(),
        new_password: newPassword,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Password reset failed. Token may be expired.");
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
            Set New Password
          </h1>
          <p className="text-muted" style={{ fontSize: "var(--font-size-sm)" }}>
            Choose a strong, secure password for your account.
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
              ✓
            </div>
            <h2
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: 600,
                marginBottom: "0.5rem",
              }}
            >
              Password Reset Complete!
            </h2>
            <p
              className="text-muted"
              style={{ fontSize: "var(--font-size-sm)", marginBottom: "2rem", lineHeight: 1.6 }}
            >
              Your credentials have been updated securely with zero-knowledge hashing. You can now log in with your new password.
            </p>

            <Link
              href="/login"
              className="btn btn-primary"
              style={{ width: "100%" }}
            >
              Sign In Now →
            </Link>
          </div>
        ) : (
          /* Reset Form */
          <>
            {/* Error Alert */}
            {error && (
              <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
                <span>✕</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Token Input (shown if no token query parameter) */}
              {!tokenParam && (
                <div className="form-group">
                  <label htmlFor="reset-token" className="form-label">
                    Reset Token
                  </label>
                  <input
                    id="reset-token"
                    name="token"
                    type="text"
                    className="form-input"
                    placeholder="Enter security token from email"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              )}

              {/* New Password */}
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="reset-new-password" className="form-label" style={{ marginBottom: 0 }}>
                    New Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--color-primary-light, #818cf8)",
                      fontSize: "var(--font-size-xs)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  id="reset-new-password"
                  name="newPassword"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  style={{ marginTop: "0.5rem" }}
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>

              {/* Password Strength Meter */}
              {newPassword.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                    <span className="text-muted">Password Strength:</span>
                    <span style={{ color: getStrengthColor(), fontWeight: 600 }}>{getStrengthLabel()}</span>
                  </div>
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${(score / 4) * 100}%`,
                        background: getStrengthColor(),
                        transition: "all 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              <div className="form-group">
                <label htmlFor="reset-confirm-password" className="form-label">
                  Confirm New Password
                </label>
                <input
                  id="reset-confirm-password"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>

              <button
                id="reset-submit-btn"
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ marginTop: "0.5rem", width: "100%" }}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Updating password…
                  </>
                ) : (
                  "Update Password →"
                )}
              </button>
            </form>

            <div className="divider">or</div>

            <p
              className="text-muted"
              style={{ textAlign: "center", fontSize: "var(--font-size-sm)" }}
            >
              Need a new link?{" "}
              <Link
                href="/forgot-password"
                style={{ color: "var(--color-text-link, #818cf8)", fontWeight: 500 }}
              >
                Request reset link →
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="page-center">
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
