"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginUser, storeToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const tokenResponse = await loginUser(formData);
      // Store the JWT in localStorage
      storeToken(tokenResponse.access_token);
      // Navigate to the protected dashboard
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
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
            Welcome back
          </h1>
          <p className="text-muted" style={{ fontSize: "var(--font-size-sm)" }}>
            Sign in to your TrustShare account
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
            <span>✕</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              Email Address
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              className="form-input"
              placeholder="alice@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              className="form-input"
              placeholder="Your password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {/* Sign In button */}
          <button
            id="login-submit-btn"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: "0.5rem" }}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Signing in…
              </>
            ) : (
              "Sign In →"
            )}
          </button>
        </form>

        {/* Register Link */}
        <div className="divider">or</div>
        <p
          className="text-muted"
          style={{ textAlign: "center", fontSize: "var(--font-size-sm)" }}
        >
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            style={{ color: "var(--color-text-link)", fontWeight: 500 }}
          >
            Create one →
          </Link>
        </p>
      </div>
    </div>
  );
}
