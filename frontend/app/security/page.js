"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function SecurityPage() {
  const { user } = useAuth();

  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // MFA status for the current session
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const startSetup = async () => {
    setError("");
    setBusy(true);

    try {
      const res = await api.post("/api/auth/mfa/setup");
      setSetupData(res.data);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Could not start MFA setup."
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async (e) => {
    e.preventDefault();

    setError("");
    setBusy(true);

    try {
      await api.post("/api/auth/mfa/enable", {
        code,
      });

      // 2FA successfully enabled
      setMfaEnabled(true);
      setSetupData(null);
      setCode("");
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Invalid code."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProtectedRoute>
      <h1 className="mb-1 text-2xl font-bold text-gray-800">
        Security
      </h1>

      <p className="mb-6 text-sm text-gray-500">
        Manage two-factor authentication for your account.
      </p>

      <div className="max-w-lg rounded-xl border bg-white p-6">

        {/* 2FA ENABLED */}
        {mfaEnabled ? (
          <div className="rounded-md bg-green-50 px-4 py-4">
            <p className="text-sm font-semibold text-green-700">
              ✅ Two-factor authentication is enabled
            </p>

            <p className="mt-2 text-xs text-green-600">
              Your account is protected with two-factor authentication.
            </p>
          </div>

        ) : setupData ? (

          /* 2FA SETUP */
          <>
            <p className="mb-4 text-sm text-gray-600">
              Scan this QR code with Google Authenticator,
              Authy, or any TOTP app, then enter the
              6-digit code it generates.
            </p>

            <img
              src={setupData.qr_code_data_uri}
              alt="MFA QR code"
              className="mx-auto mb-4 h-40 w-40 rounded-md border"
            />

            <p className="mb-4 break-all rounded-md bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
              Manual entry key: {setupData.secret}
            </p>

            <form
              onSubmit={confirmEnable}
              className="space-y-3"
            >
              <input
                autoFocus
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) =>
                  setCode(e.target.value)
                }
                className="w-full rounded-md border px-3 py-2 text-center text-lg tracking-widest"
                placeholder="000000"
              />

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "Verifying..." : "Confirm & enable"}
              </button>
            </form>
          </>

        ) : (

          /* 2FA DISABLED */
          <>
            <p className="mb-4 text-sm text-gray-600">
              Two-factor authentication is currently
              disabled. Enable it to require a time-based
              code from your authenticator at every login.
            </p>

            <button
              onClick={startSetup}
              disabled={busy}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy
                ? "Starting..."
                : "Enable two-factor authentication"}
            </button>
          </>
        )}

        {/* ERROR */}
        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </ProtectedRoute>
  );
}