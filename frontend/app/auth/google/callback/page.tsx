"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, Loader2, AlertCircle } from "lucide-react";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const directAccessToken = params.get("access_token");

    // Case 1: Direct Access Token already present
    if (directAccessToken) {
      processedRef.current = true;
      login(directAccessToken)
        .then(() => {
          window.history.replaceState({}, "", "/auth/google/callback");
          router.replace("/dashboard");
        })
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "Unable to complete Google sign-in."
          );
        });
      return;
    }

    // Case 2: Exchange Authorization Code with backend
    if (code) {
      processedRef.current = true;
      const redirectUri = `${window.location.origin}/auth/google/callback`;

      const endpoint = new URL("http://localhost:8000/auth/google/callback");
      endpoint.searchParams.append("code", code);
      endpoint.searchParams.append("redirect_uri", redirectUri);
      if (state) endpoint.searchParams.append("state", state);

      fetch(endpoint.toString(), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.detail || "Failed to exchange authorization code.");
          }
          return data;
        })
        .then((data) => {
          if (!data.access_token) {
            throw new Error("Backend did not return an access token.");
          }
          return login(data.access_token);
        })
        .then(() => {
          window.history.replaceState({}, "", "/auth/google/callback");
          router.replace("/dashboard");
        })
        .catch((err) => {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to complete Google sign-in."
          );
        });
      return;
    }

    // Case 3: Neither parameter is present
    setError("Google sign-in did not return a valid session or authorization code.");
  }, [login, router]);

  return (
    <main className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-8 border border-slate-100 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white mb-4 shadow-md shadow-indigo-200">
          <ShieldCheck className="w-6 h-6" />
        </div>

        {error ? (
          <>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Sign-in Failed</h1>
            
            <div className="mb-6 p-3.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center gap-2 text-left">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="font-medium text-sm">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
            >
              Back to Login
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Signing you in…</h1>
            <p className="text-sm text-slate-500 mb-6">
              Please wait while we establish your secure session.
            </p>

            <div className="flex justify-center py-4">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          </>
        )}
      </div>
    </main>
  );
}