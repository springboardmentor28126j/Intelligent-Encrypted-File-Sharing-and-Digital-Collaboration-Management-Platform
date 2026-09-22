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

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [filesRes, sharesRes] = await Promise.all([
        api.get("/api/files"),
        api.get(`/api/files/${id}/shares`),
      ]);

      const found = filesRes.data.find(
        (f) => String(f.id) === String(id)
      );

      setFile(found || null);
      setShares(sharesRes.data);
    } catch (error) {
      console.error("Failed to load file details:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      load();
    }
  }, [id, load]);

  const createShare = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      await api.post(`/api/files/${id}/share`, {
        permission,
        expires_in_hours: Number(expiresIn),
        max_downloads: maxDownloads
          ? Number(maxDownloads)
          : null,
      });

      setMaxDownloads("");
      await load();
    } catch (error) {
      console.error("Failed to create share link:", error);
      alert(
        error.response?.data?.detail ||
          "Failed to create share link."
      );
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (linkId) => {
    try {
      await api.post(`/api/shares/${linkId}/revoke`);
      await load();
    } catch (error) {
      console.error("Failed to revoke share link:", error);
      alert(
        error.response?.data?.detail ||
          "Failed to revoke share link."
      );
    }
  };

  const copyLink = async (token, linkId) => {
    const url = `${
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000"
    }/api/shared/${token}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(linkId);

      setTimeout(() => {
        setCopiedId(null);
      }, 1500);
    } catch (error) {
      console.error("Failed to copy link:", error);
      alert("Could not copy the link.");
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
      setEmailError(false);
      setRecipientEmail("");
    } catch (error) {
      console.error("Failed to send email:", error);

      setEmailMessage(
        error.response?.data?.detail ||
          "Failed to send email."
      );
      setEmailError(true);
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <ProtectedRoute>
      <button
        onClick={() => router.push("/dashboard")}
        className="mb-4 text-sm font-medium text-gray-500 hover:text-brand-600"
      >
        ← Back to files
      </button>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : !file ? (
        <p className="text-sm text-red-500">File not found.</p>
      ) : (
        <>
          <h1 className="mb-1 text-2xl font-bold text-gray-800">
            {file.filename}
          </h1>

          <p className="mb-8 text-sm text-gray-500">
            {formatBytes(file.size_bytes)} · uploaded{" "}
            {formatDate(file.uploaded_at)}
          </p>

          {/* Create share link section */}
          <div className="mb-8 rounded-xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              Create a share link
            </h2>

            <form
              onSubmit={createShare}
              className="grid grid-cols-1 gap-4 sm:grid-cols-4"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Permission
                </label>

                <select
                  value={permission}
                  onChange={(e) =>
                    setPermission(e.target.value)
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="download">Download</option>
                  <option value="view">
                    View only (metadata)
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Expires in (hours)
                </label>

                <input
                  type="number"
                  min={1}
                  value={expiresIn}
                  onChange={(e) =>
                    setExpiresIn(e.target.value)
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Max downloads (optional)
                </label>

                <input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={maxDownloads}
                  onChange={(e) =>
                    setMaxDownloads(e.target.value)
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full rounded-md bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create link"}
                </button>
              </div>
            </form>
          </div>

          {/* Existing share links section */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              Share links
            </h2>

            {shares.length === 0 ? (
              <p className="text-sm text-gray-400">
                No share links yet.
              </p>
            ) : (
              <div className="space-y-3">
                {shares.map((s) => {
                  const expired =
                    new Date(s.expires_at) < new Date();

                  const inactive = s.revoked || expired;

                  return (
                    <div
                      key={s.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                        inactive
                          ? "bg-gray-50 opacity-60"
                          : "bg-white"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                            {s.permission}
                          </span>

                          {s.revoked && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                              revoked
                            </span>
                          )}

                          {!s.revoked && expired && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                              expired
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-gray-500">
                          Expires {formatDate(s.expires_at)} ·{" "}
                          {s.download_count}
                          {s.max_downloads
                            ? `/${s.max_downloads}`
                            : ""}{" "}
                          downloads used
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Copy link button */}
                        <button
                          onClick={() =>
                            copyLink(s.token, s.id)
                          }
                          className="text-sm font-medium text-brand-600 hover:underline"
                        >
                          {copiedId === s.id
                            ? "Copied!"
                            : "Copy link"}
                        </button>

                        {/* Email input and button */}
                        {!inactive && (
                          <>
                            <input
                              type="email"
                              placeholder="Recipient email"
                              value={recipientEmail}
                              onChange={(e) => {
                                setRecipientEmail(
                                  e.target.value
                                );
                                setEmailMessage("");
                              }}
                              className="w-48 rounded-md border px-3 py-1 text-sm"
                            />

                            <button
                              onClick={sendViaEmail}
                              disabled={sendingEmail}
                              className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
                            >
                              {sendingEmail
                                ? "Sending..."
                                : "Send via Email"}
                            </button>
                          </>
                        )}

                        {/* Revoke button */}
                        {!s.revoked && (
                          <button
                            onClick={() => revoke(s.id)}
                            className="text-sm font-medium text-red-500 hover:underline"
                          >
                            Revoke
                          </button>
                        )}
                      </div>

                      {/* Email status message */}
                      {emailMessage && (
                        <p
                          className={`w-full text-sm ${
                            emailError
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {emailMessage}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </ProtectedRoute>
  );
}