
"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";

export default function SecurityPage() {
  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const startSetup = async () => {
    setError("");
    setSuccess("");
    setBusy(true);

    try {
      const res = await api.post("/api/auth/mfa/setup");
      setSetupData(res.data);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Could not start two-factor authentication setup."
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!/^\d{6}$/.test(code)) {
      setError("Enter a valid 6-digit authentication code.");
      return;
    }

    setBusy(true);

    try {
      await api.post("/api/auth/mfa/enable", { code });
      setMfaEnabled(true);
      setSetupData(null);
      setCode("");
      setSuccess("Two-factor authentication was enabled successfully.");
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Verification failed. Check the code in your authenticator app."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-[#06111f] px-4 py-8 text-slate-100 sm:px-6 lg:px-9">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">
              <span className="h-2 w-2 rounded-full bg-teal-300" />
              Account protection
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Security Center
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Add an extra layer of protection to your TrustShare account
              using two-factor authentication.
            </p>
          </header>

          <section className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-[#0b1b2d] p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-teal-300/20 bg-teal-300/10 text-teal-300">
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <h2 className="font-semibold text-white">Two-factor authentication</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Verify your identity with a time-based code from an
                authenticator app.
              </p>
              <div className="mt-4">
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  mfaEnabled
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                    : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                }`}>
                  <span className={`h-2 w-2 rounded-full ${
                    mfaEnabled ? "bg-emerald-300" : "bg-amber-300"
                  }`} />
                  {mfaEnabled ? "Enabled" : "Not enabled in this session"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0b1b2d] p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-300/10 text-sky-300">
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M14 14h3v3h-3zM20 14v2M17 20h4M20 18v3" />
                </svg>
              </div>
              <h2 className="font-semibold text-white">Authenticator app</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Use Google Authenticator, Authy, or another compatible
                TOTP authenticator to generate your verification code.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-[#0b1b2d] p-5 shadow-xl shadow-black/10 sm:p-7">
            <h2 className="text-xl font-semibold text-white">
              {mfaEnabled
                ? "Your account has an extra protection step"
                : setupData
                ? "Complete authentication setup"
                : "Enable two-factor authentication"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {mfaEnabled
                ? "Your account was successfully configured with two-factor authentication."
                : setupData
                ? "Scan the QR code with your authenticator app, then enter the current 6-digit code."
                : "Start setup to connect an authenticator app to your account."}
            </p>

            {!mfaEnabled && !setupData && (
              <button
                type="button"
                onClick={startSetup}
                disabled={busy}
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-300 px-5 py-3 text-sm font-semibold text-[#06111f] transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Preparing setup..." : "Set up two-factor authentication"}
              </button>
            )}

            {!mfaEnabled && setupData && (
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-700 bg-[#071626] p-5 text-center">
                  <p className="mb-4 text-sm font-medium text-slate-200">
                    Step 1 · Scan this QR code
                  </p>

                  {setupData.qr_code_data_uri && (
                    <img
                      src={setupData.qr_code_data_uri}
                      alt="QR code for authenticator setup"
                      className="mx-auto h-48 w-48 rounded-xl bg-white p-2"
                    />
                  )}

                  <p className="mt-4 text-xs leading-5 text-slate-400">
                    Keep your setup key private. Anyone with access to it
                    may be able to generate authentication codes.
                  </p>

                  {setupData.secret && (
                    <details className="mt-4 text-left">
                      <summary className="cursor-pointer text-sm text-teal-300">
                        Show manual setup key
                      </summary>
                      <p className="mt-3 break-all rounded-lg border border-slate-700 bg-[#06111f] p-3 font-mono text-xs text-slate-200">
                        {setupData.secret}
                      </p>
                    </details>
                  )}
                </div>

                <div className="rounded-xl border border-slate-700 bg-[#071626] p-5">
                  <p className="mb-2 text-sm font-medium text-slate-200">
                    Step 2 · Verify your code
                  </p>
                  <p className="mb-5 text-sm leading-6 text-slate-400">
                    Enter the 6-digit code displayed in your
                    authenticator app to finish setup.
                  </p>

                  <form onSubmit={confirmEnable} className="space-y-4">
                    <label
                      htmlFor="mfa-code"
                      className="block text-sm font-medium text-slate-300"
                    >
                      Authentication code
                    </label>

                    <input
                      id="mfa-code"
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="000000"
                      className="w-full rounded-xl border border-slate-700 bg-[#06111f] px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-white outline-none transition placeholder:text-slate-600 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/10"
                    />

                    <button
                      type="submit"
                      disabled={busy || code.length !== 6}
                      className="w-full rounded-xl bg-teal-300 px-4 py-3 text-sm font-semibold text-[#06111f] transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "Verifying..." : "Verify and enable"}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSetupData(null);
                        setCode("");
                        setError("");
                      }}
                      className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      Cancel setup
                    </button>
                  </form>
                </div>
              </div>
            )}

            {mfaEnabled && (
              <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4">
                <p className="font-medium text-emerald-300">
                  Two-factor authentication enabled
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Setup completed successfully. Your server must enforce
                  MFA during authentication for it to protect future logins.
                </p>
              </div>
            )}

            {error && (
              <div role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.08] p-4 text-sm leading-6 text-rose-300">
                {error}
              </div>
            )}

            {success && (
              <div role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4 text-sm text-emerald-300">
                {success}
              </div>
            )}
          </section>

          <p className="mt-5 text-xs leading-5 text-slate-500">
            Security note: never share your authentication code or setup key.
            The status shown here reflects this page's current state; refresh
            persistence depends on the backend's MFA status endpoint.
          </p>
        </div>
      </main>
    </ProtectedRoute>
  );
}