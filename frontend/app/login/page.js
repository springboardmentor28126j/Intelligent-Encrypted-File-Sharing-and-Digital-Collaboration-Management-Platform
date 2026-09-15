"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login, verifyMfa } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // MFA step state
  const [mfaToken, setMfaToken] = useState(null);
  const [mfaCode, setMfaCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await login(email, password);

      if (result.mfaRequired) {
        setMfaToken(result.mfaToken);
      }
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
      setError(
        err?.response?.data?.detail || "Invalid code. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (mfaToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-center text-2xl font-bold text-brand-700">
            Two-factor verification
          </h1>

          <p className="mb-6 text-center text-sm text-gray-500">
            Enter the 6-digit code from your authenticator app
          </p>

          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              required
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-center text-lg tracking-widest focus:border-brand-500 focus:outline-none"
              placeholder="000000"
            />

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "Verifying…" : "Verify"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMfaToken(null);
                setMfaCode("");
                setError("");
              }}
              className="w-full text-center text-sm text-gray-500 hover:underline"
            >
              ← Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-sm">

        <h1 className="mb-1 text-center text-2xl font-bold text-brand-700">
          TrustShare
        </h1>

        <p className="mb-6 text-center text-sm text-gray-500">
          Secure encrypted file sharing
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>

            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="••••••••"
            />

            {/* Forgot Password */}
            <div className="mt-2 text-right">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-brand-600 hover:underline"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}