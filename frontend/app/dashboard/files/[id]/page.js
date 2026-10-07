
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";

export default function FileDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [file, setFile] = useState(null);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState("download");
  const [expiresIn, setExpiresIn] = useState(24);
  const [maxDownloads, setMaxDownloads] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [filesRes, sharesRes] = await Promise.all([
        api.get("/api/files"),
        api.get(`/api/files/${id}/shares`),
      ]);

      setFile(
        filesRes.data.find((f) => String(f.id) === String(id)) || null
      );
      setShares(sharesRes.data);
    } catch (error) {
      console.error("Failed to load file details:", error);
      setNotice("Could not load file details. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const createShare = async (e) => {
    e.preventDefault();
    setCreating(true);
    setNotice("");

    try {
      await api.post(`/api/files/${id}/share`, {
        permission,
        expires_in_hours: Number(expiresIn),
        max_downloads: maxDownloads ? Number(maxDownloads) : null,
      });
      setMaxDownloads("");
      setNotice("Share link created successfully.");
      await load();
    } catch (error) {
      setNotice(error.response?.data?.detail || "Failed to create share link.");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (linkId) => {
    if (!window.confirm("Revoke this share link? It will no longer be active.")) {
      return;
    }

    try {
      await api.post(`/api/shares/${linkId}/revoke`);
      setNotice("Share link revoked.");
      await load();
    } catch (error) {
      setNotice(error.response?.data?.detail || "Failed to revoke share link.");
    }
  };

  const copyLink = async (token, linkId) => {
    const url = `${
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    }/api/shared/${token}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(linkId);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setNotice("Could not copy the link. Check your browser permissions.");
    }
  };

  const sendViaEmail = async () => {
    if (!recipientEmail.trim()) {
      setEmailMessage("Please enter a recipient email.");
      setEmailError(true);
      return;
    }

    setSendingEmail(true);
    setEmailMessage("");
    setEmailError(false);

    try {
      await api.post(`/api/files/${id}/share/email`, {
        recipient_email: recipientEmail.trim(),
      });
      setEmailMessage("Email sent successfully!");
      setRecipientEmail("");
    } catch (error) {
      setEmailMessage(
        error.response?.data?.detail || "Failed to send email."
      );
      setEmailError(true);
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen space-y-6 pb-10">
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-teal-400 hover:text-teal-300"
        >
          ← Back to files
        </button>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-teal-400">
                TrustShare / File management
              </p>
              <h1 className="break-words text-2xl font-bold text-white sm:text-3xl">
                {loading ? "Loading file..." : file?.filename || "File details"}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Manage access and securely share your file.
              </p>
            </div>
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3">
              <p className="text-xs text-slate-400">Security status</p>
              <p className="mt-1 font-semibold text-teal-300">Protected access</p>
            </div>
          </div>

          {file && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                <p className="text-xs text-slate-400">File size</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {formatBytes(file.size_bytes)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                <p className="text-xs text-slate-400">Uploaded</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {formatDate(file.uploaded_at)}
                </p>
              </div>
            </div>
          )}
        </section>

        {notice && (
          <div
            role="status"
            className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-200"
          >
            {notice}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
            Loading file details...
          </div>
        ) : !file ? (
          <div className="rounded-2xl border border-red-500/30 bg-slate-900 p-8 text-center">
            <p className="font-semibold text-red-300">File not found</p>
            <p className="mt-2 text-sm text-slate-400">
              The file may have been deleted or you may not have access.
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-lg sm:p-8">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
                  Share settings
                </p>
                <h2 className="mt-2 text-xl font-bold text-white">
                  Create a share link
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Choose permissions, expiry time, and optional download limits.
                </p>
              </div>

              <form onSubmit={createShare} className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Permission
                  </label>
                  <select
                    value={permission}
                    onChange={(e) => setPermission(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                  >
                    <option value="download">Allow download</option>
                    <option value="view">View metadata only</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Expires in (hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Maximum downloads
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={maxDownloads}
                    onChange={(e) => setMaxDownloads(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Leave blank for no download limit.
                  </p>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full rounded-xl bg-teal-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "+ Create share link"}
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-lg sm:p-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
                    Access management
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-white">
                    Existing share links
                  </h2>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-300">
                  {shares.length} {shares.length === 1 ? "link" : "links"}
                </span>
              </div>

              {shares.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                  <p className="text-lg font-semibold text-white">No share links yet</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Create a link above to start sharing this file.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shares.map((s) => {
                    const expired = new Date(s.expires_at) < new Date();
                    const inactive = Boolean(s.revoked || expired);

                    return (
                      <article
                        key={s.id}
                        className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 sm:p-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-teal-400/10 px-3 py-1 text-xs font-semibold capitalize text-teal-300">
                              {s.permission}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                s.revoked
                                  ? "bg-red-500/10 text-red-300"
                                  : expired
                                  ? "bg-amber-500/10 text-amber-300"
                                  : "bg-emerald-500/10 text-emerald-300"
                              }`}
                            >
                              {s.revoked ? "Revoked" : expired ? "Expired" : "Active"}
                            </span>
                          </div>

                          <p className="text-xs text-slate-400">
                            {s.download_count ?? 0}
                            {s.max_downloads ? ` / ${s.max_downloads}` : ""}
                            {" "}downloads used
                          </p>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-slate-500">Expires</p>
                            <p className="mt-1 text-slate-200">
                              {formatDate(s.expires_at)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Link ID</p>
                            <p className="mt-1 break-all font-mono text-slate-300">
                              {s.id}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => copyLink(s.token, s.id)}
                            className="rounded-lg border border-teal-500/40 px-4 py-2 text-sm font-medium text-teal-300 transition hover:bg-teal-400/10"
                          >
                            {copiedId === s.id ? "Copied!" : "Copy link"}
                          </button>

                          {!inactive && (
                            <button
                              type="button"
                              onClick={() => {
                                setEmailMessage("");
                                setEmailError(false);
                                setRecipientEmail("");
                                setCopiedId(null);
                                setNotice("");
                                setShares((current) => current);
                                setRecipientEmail("");
                                setEmailMessage("");
                                setEmailError(false);
                                window.setTimeout(() => {
                                  document.getElementById(`email-${s.id}`)?.focus();
                                }, 0);
                              }}
                              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-teal-400"
                            >
                              Email options
                            </button>
                          )}

                          {!s.revoked && (
                            <button
                              type="button"
                              onClick={() => revoke(s.id)}
                              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/10"
                            >
                              Revoke link
                            </button>
                          )}
                        </div>

                        {!inactive && (
                          <div className="mt-4 border-t border-slate-800 pt-4">
                            <label
                              htmlFor={`email-${s.id}`}
                              className="mb-2 block text-sm font-medium text-slate-300"
                            >
                              Send this file by email
                            </label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                id={`email-${s.id}`}
                                type="email"
                                placeholder="recipient@example.com"
                                value={recipientEmail}
                                onChange={(e) => {
                                  setRecipientEmail(e.target.value);
                                  setEmailMessage("");
                                }}
                                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white"
                              />
                              <button
                                type="button"
                                onClick={sendViaEmail}
                                disabled={sendingEmail}
                                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50"
                              >
                                {sendingEmail ? "Sending..." : "Send email"}
                              </button>
                            </div>
                            {emailMessage && (
                              <p
                                role="status"
                                className={`mt-2 text-sm ${
                                  emailError ? "text-red-300" : "text-emerald-300"
                                }`}
                              >
                                {emailMessage}
                              </p>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}