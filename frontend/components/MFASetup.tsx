"use client";

import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { setupMFA, enableMFA, disableMFA } from "@/lib/api";

interface Props {
  enabled: boolean;
  onChanged: () => void;
}

export default function MFASetup({ enabled, onChanged }: Props) {
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function beginSetup() {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      await setupMFA();
      setCodeSent(true);
      setSuccessMessage("Verification code sent to your email address.");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Unable to send setup code to your email."
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnable() {
    if (code.length < 6) {
      setError("Enter the valid MFA code sent to your email.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await enableMFA(code);
      setCodeSent(false);
      setCode("");
      setSuccessMessage("");
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired MFA code.");
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    if (!confirm("Are you sure you want to disable Multi-Factor Authentication?")) return;
    setLoading(true);
    setError("");

    try {
      await disableMFA();
      setCodeSent(false);
      setCode("");
      setSuccessMessage("");
      onChanged();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Unable to disable MFA."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // MFA ENABLED STATE
  // ==========================================================
  if (enabled) {
    return (
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Security</h2>
            <p className="text-xs text-slate-500">
              Email-based Multi-Factor Authentication
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm font-bold text-emerald-950">
                Multi-factor authentication is enabled
              </h3>
            </div>
            <p className="text-xs text-emerald-800">
              Your TrustShare account is protected with email verification codes.
            </p>
          </div>

          <button
            type="button"
            onClick={disable}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-700 bg-white hover:bg-red-50 rounded-xl border border-red-200 transition-colors shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5" />
            )}
            Disable MFA
          </button>
        </div>
      </section>
    );
  }

  // ==========================================================
  // MFA DISABLED / SETUP STATE
  // ==========================================================
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
          <KeyRound className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Security</h2>
          <p className="text-xs text-slate-500">
            Multi-Factor Authentication (MFA via Email)
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-600">
        Protect your TrustShare account by requesting a verification code sent directly to your registered email address during setup and login.
      </p>

      {error && (
        <div className="p-3.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {!codeSent ? (
        <button
          type="button"
          onClick={beginSetup}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          Send Verification Code to Email
        </button>
      ) : (
        <div className="space-y-4 bg-slate-50/70 border border-slate-200 p-5 rounded-2xl">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-600" />
              Enter Email Verification Code
            </h3>
            <p className="text-xs text-slate-500">
              Check your inbox for a verification code and enter it below to confirm MFA setup.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="Enter code"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              disabled={loading}
              className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-sm tracking-widest text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all sm:w-48"
            />

            <button
              type="button"
              onClick={confirmEnable}
              disabled={loading || code.length < 6}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              Verify & Enable MFA
            </button>

            <button
              type="button"
              onClick={beginSetup}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Resend Code
            </button>
          </div>
        </div>
      )}
    </section>
  );
}