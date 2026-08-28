"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function SecurityPage() {
  const { user, refresh } = useAuth();
  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const startSetup = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await api.post("/api/auth/mfa/setup");
      setSetupData(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not start MFA setup.");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/api/auth/mfa/enable", { code });
      setSetupData(null);
      setCode("");
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.detail || "Invalid code.");
    } finally {
      setBusy(false);
    }
  };

  const disableMfa = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/api/auth/mfa/disable", { code: disableCode });
      setDisableCode("");
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.detail || "Invalid code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProtectedRoute>
      <h1 className="mb-1 text-2xl font-bold text-gray-800">Security</h1>
      <p className="mb-6 text-sm text-gray-500">
        Manage two-factor authentication for your account.
      </p>

      <div className="max-w-lg rounded-xl border bg-white p-6">
        {user?.mfa_enabled ? (
          <>
            <p className="mb-4 text-sm font-medium text-green-700">
              ✅ Two-factor authentication is enabled.
            </p>
            <form onSubmit={disableMfa} className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Enter a current code to disable MFA
              </label>
              <input
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="000000"
              />
              <button
                disabled={busy}
                className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Disable MFA
              </button>
            </form>
          </>
        ) : setupData ? (
          <>
            <p className="mb-4 text-sm text-gray-600">
              Scan this QR code with Google Authenticator, Authy, or any TOTP app,
              then enter the 6-digit code it generates.
            </p>
            <img
              src={setupData.qr_code_data_uri}
              alt="MFA QR code"
              className="mx-auto mb-4 h-40 w-40 rounded-md border"
            />
            <p className="mb-4 break-all rounded-md bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
              Manual entry key: {setupData.secret}
            </p>
            <form onSubmit={confirmEnable} className="space-y-3">
              <input
                autoFocus
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-center text-lg tracking-widest"
                placeholder="000000"
              />
              <button
                disabled={busy}
                className="w-full rounded-md bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "Verifying…" : "Confirm & enable"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-600">
              Two-factor authentication is currently disabled. Enable it to
              require a time-based code from your phone at every login.
            </p>
            <button
              onClick={startSetup}
              disabled={busy}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "Starting…" : "Enable two-factor authentication"}
            </button>
          </>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </ProtectedRoute>
  );
}
