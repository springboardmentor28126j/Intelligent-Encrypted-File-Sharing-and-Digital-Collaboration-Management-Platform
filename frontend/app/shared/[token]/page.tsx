"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_URL = "http://127.0.0.1:8000";

type ShareDetails = {
  filename: string;
  permission: "view" | "download";
  expires_at: string | null;
  download_allowed: boolean;
};

export default function PublicSharedFilePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [details, setDetails] = useState<ShareDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`${API_URL}/sharing/link/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || "This share link is unavailable.");
        return body;
      })
      .then((body) => {
        if (!cancelled) setDetails(body);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "This share link is unavailable.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  async function viewFile() {
    if (!token || details?.download_allowed) return;
    setViewing(true);
    setError("");
    setPreviewContent(null);
    try {
      const response = await fetch(`${API_URL}/sharing/link/${encodeURIComponent(token)}/view`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Unable to preview this file.");
      setPreviewContent(typeof body.content === "string" ? body.content : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to preview this file.");
    } finally {
      setViewing(false);
    }
  }

  async function downloadFile() {
    if (!token || !details?.download_allowed) return;
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/sharing/link/${encodeURIComponent(token)}/download`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || "Download failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = details.filename || "shared-file";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-xl" aria-hidden="true">🔐</div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">TrustShare · Secure file sharing</p>
        <h1 className="mt-2 text-2xl font-bold">Shared file</h1>
        {loading ? (
          <p className="mt-6 text-sm text-slate-600">Checking this secure link…</p>
        ) : error ? (
          <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : details ? (
          <>
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">File name</p>
              <p className="mt-1 break-words font-semibold">{details.filename}</p>
              <p className="mt-4 text-xs text-slate-500">Access permission</p>
              <p className="mt-1 font-medium">{details.permission === "download" ? "Download allowed" : "View only"}</p>
              <p className="mt-4 text-xs text-slate-500">Link expiration</p>
              <p className="mt-1 font-medium">{details.expires_at ? new Date(details.expires_at).toLocaleString() : "No expiry set"}</p>
            </div>
            {details.download_allowed ? (
              <button onClick={downloadFile} disabled={downloading} className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                {downloading ? "Preparing download…" : "Download file"}
              </button>
            ) : (
              <button onClick={viewFile} disabled={viewing} className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                {viewing ? "Loading preview…" : "View File"}
              </button>
            )}
            {previewContent !== null && (
              <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">File preview (view only)</h2>
                <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-sm text-slate-800">{previewContent || "This file is empty."}</pre>
                <p className="mt-3 text-xs text-slate-500">Previewing does not provide a download button. This preview currently supports text-based files only.</p>
              </section>
            )}
          </>
        ) : null}
        <p className="mt-7 text-xs leading-5 text-slate-500">Only open links from people you trust. If the owner revokes the link or it expires, access will stop.</p>
      </section>
    </main>
  );
}
