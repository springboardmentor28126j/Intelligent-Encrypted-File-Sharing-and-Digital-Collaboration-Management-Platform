"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import TrustShareLogo from "@/components/TrustShareLogo";

function FieldIcon({ type }) {
  return type === "email" ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c.5-3.3 3-5 7-5s6.5 1.7 7 5"
        strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v3" />
    </svg>
  );
}

export default function LoginPage() {
  const { login, verifyMfa } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [mfaToken, setMfaToken] = useState(null);
  const [mfaCode, setMfaCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.mfaRequired) setMfaToken(result.mfaToken);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        "Login failed. Check your email and password."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await verifyMfa(mfaToken, mfaCode);
    } catch (err) {
      setError(err?.response?.data?.detail || "Invalid code. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-scene">
      <section className="auth-card">
        <TrustShareLogo className="auth-logo" />

        {mfaToken ? (
          <>
            <h1 className="auth-title">Two-factor verification</h1>
            <p className="auth-subtitle">
              Enter the 6-digit code from your authenticator app.
            </p>

            <form onSubmit={handleMfaSubmit} className="auth-form">
              <label className="auth-field">
                <FieldIcon type="password" />
                <input
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="6-digit verification code"
                />
              </label>

              {error && <p className="auth-alert">{error}</p>}

              <button className="auth-submit" disabled={submitting}>
                {submitting ? "Verifying..." : "Verify code →"}
              </button>

              <button
                type="button"
                className="auth-google"
                onClick={() => {
                  setMfaToken(null);
                  setMfaCode("");
                  setError("");
                }}
              >
                ← Back to login
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">
              Sign in to your TrustShare account
            </p>

            <form onSubmit={handleSubmit} className="auth-form">
              <label className="auth-field">
                <FieldIcon type="email" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                />
              </label>

              <label className="auth-field">
                <FieldIcon type="password" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    color: "#8daed0",
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </label>

              <div className="auth-options">
                <label className="auth-check">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember me
                </label>
                <Link href="/forgot-password">Forgot password?</Link>
              </div>

              {error && <p className="auth-alert">{error}</p>}

              <button
                className="auth-submit"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Signing in..." : "Sign In →"}
              </button>
            </form>

            <p className="auth-footer">
              Don&apos;t have an account?{" "}
              <Link href="/register">Create account</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}