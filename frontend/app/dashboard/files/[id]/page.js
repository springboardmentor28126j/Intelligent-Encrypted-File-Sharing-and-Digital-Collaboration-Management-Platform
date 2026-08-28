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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [filesRes, sharesRes] = await Promise.all([
        api.get("/api/files"),
        api.get(`/api/files/${id}/shares`),
      ]);
      const found = filesRes.data.find((f) => String(f.id) === String(id));
      setFile(found || null);
      setShares(sharesRes.data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const createShare = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post(`/api/files/${id}/share`, {
        permission,
        expires_in_hours: Number(expiresIn),
        max_downloads: maxDownloads ? Number(maxDownloads) : null,
      });
      setMaxDownloads("");
      await load();
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (linkId) => {
    await api.post(`/api/shares/${linkId}/revoke`);
    await load();
  };

  const copyLink = (token, linkId) => {
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/shared/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(linkId);
    setTimeout(() => setCopiedId(null), 1500);
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
          <h1 className="mb-1 text-2xl font-bold text-gray-800">{file.filename}</h1>
          <p className="mb-8 text-sm text-gray-500">
            {formatBytes(file.size_bytes)} · uploaded {formatDate(file.created_at)}
          </p>

          <div className="mb-8 rounded-xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Create a share link</h2>
            <form onSubmit={createShare} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Permission
                </label>
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="download">Download</option>
                  <option value="view">View only (metadata)</option>
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
                  onChange={(e) => setExpiresIn(e.target.value)}
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
                  onChange={(e) => setMaxDownloads(e.target.value)}
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

          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Share links</h2>
            {shares.length === 0 ? (
              <p className="text-sm text-gray-400">No share links yet.</p>
            ) : (
              <div className="space-y-3">
                {shares.map((s) => {
                  const expired = new Date(s.expires_at) < new Date();
                  const inactive = s.revoked || expired;
                  return (
                    <div
                      key={s.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                        inactive ? "bg-gray-50 opacity-60" : "bg-white"
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
                          Expires {formatDate(s.expires_at)} · {s.download_count}
                          {s.max_downloads ? `/${s.max_downloads}` : ""} downloads used
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => copyLink(s.token, s.id)}
                          className="text-sm font-medium text-brand-600 hover:underline"
                        >
                          {copiedId === s.id ? "Copied!" : "Copy link"}
                        </button>
                        {!s.revoked && (
                          <button
                            onClick={() => revoke(s.id)}
                            className="text-sm font-medium text-red-500 hover:underline"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
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
