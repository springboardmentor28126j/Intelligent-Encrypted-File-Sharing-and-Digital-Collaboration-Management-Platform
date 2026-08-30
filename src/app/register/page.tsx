"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await registerUser(formData);
      setSuccess(true);
      // Redirect to login after short delay so the user sees the success message
      setTimeout(() => router.push("/login"), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <div
        className="card animate-fade-in"
        style={{ width: "100%", maxWidth: "440px" }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
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
            Create your account
          </h1>
          <p className="text-muted" style={{ fontSize: "var(--font-size-sm)" }}>
            Join TrustShare and start sharing securely
          </p>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="alert alert-success" style={{ marginBottom: "1.5rem" }}>
            <span>✓</span>
            <span>Account created! Redirecting to login…</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
            <span>✕</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <div className="form-group">
            <label htmlFor="full_name" className="form-label">
              Full Name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              className="form-input"
              placeholder="Alice Smith"
              value={formData.full_name}
              onChange={handleChange}
              required
              minLength={2}
              autoComplete="name"
              disabled={loading || success}
            />
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="form-input"
              placeholder="alice@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
              disabled={loading || success}
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-input"
              placeholder="At least 6 characters"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              autoComplete="new-password"
              disabled={loading || success}
            />
          </div>

          {/* Submit */}
          <button
            id="register-submit-btn"
            type="submit"
            className="btn btn-primary"
            disabled={loading || success}
            style={{ marginTop: "0.5rem" }}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Creating account…
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* Login Link */}
        <div className="divider">or</div>
        <p
          className="text-muted"
          style={{ textAlign: "center", fontSize: "var(--font-size-sm)" }}
        >
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--color-text-link)", fontWeight: 500 }}>
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  );
}
