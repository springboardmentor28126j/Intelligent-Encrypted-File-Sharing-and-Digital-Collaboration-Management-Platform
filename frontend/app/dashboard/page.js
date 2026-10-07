
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import UploadBox from "@/components/UploadBox";
import api from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";

function FileRow({ file, onDeleted }) {
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);

    try {
      const res = await api.get(`/api/files/${file.id}/download`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(
        new Blob([res.data])
      );

      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      alert(error?.response?.data?.detail || "Unable to download file.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${file.filename}"? This cannot be undone.`)) {
      return;
    }

    setBusy(true);

    try {
      await api.delete(`/api/files/${file.id}`);
      await onDeleted?.();
    } catch (error) {
      alert(error?.response?.data?.detail || "Unable to delete file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-b border-slate-800/80 transition hover:bg-teal-400/[0.04]">
      <td className="px-5 py-4">
        <Link
          href={`/dashboard/files/${file.id}`}
          className="flex items-center gap-3 font-medium text-slate-200 transition hover:text-teal-300"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-400/15 bg-teal-400/[0.08] text-teal-300">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" />
              <path d="M13 3v7h7M8 15h8M8 18h6" />
            </svg>
          </span>
          <span className="max-w-[260px] truncate">{file.filename}</span>
        </Link>
      </td>

      <td className="px-5 py-4 text-sm text-slate-400">
        {formatBytes(file.size_bytes)}
      </td>

      <td className="px-5 py-4 text-sm text-slate-400">
        {formatDate(file.uploaded_at)}
      </td>

      <td className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleDownload}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-teal-400/50 hover:bg-teal-400/10 hover:text-teal-300 disabled:opacity-50"
          >
            {busy ? "Please wait..." : "Download"}
          </button>

          <Link
            href={`/dashboard/files/${file.id}`}
            className="rounded-lg border border-teal-400/20 bg-teal-400/[0.07] px-3 py-2 text-xs font-medium text-teal-300 transition hover:bg-teal-400/15"
          >
            Share
          </Link>

          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function DashboardContent() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/api/files");
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Unable to load files:", err);
      setError(err?.response?.data?.detail || "Could not load your files. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const filteredFiles = files.filter((file) =>
    (file.filename || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  const fileIcon = (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" />
      <path d="M13 3v7h7M8 15h8M8 18h6" />
    </svg>
  );

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-[#06111f] px-4 py-6 text-slate-100 sm:px-6 lg:px-9 lg:py-9">
        <div className="mx-auto max-w-[1500px]">
          <header className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-teal-300">
                <span className="h-2 w-2 rounded-full bg-teal-300 shadow-[0_0_12px_#2dd4bf]" />
                TrustShare workspace
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                My Files
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Upload, organize, download, and share your documents from one
                secure workspace.
              </p>
            </div>

            <Link
              href="/analytics"
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-teal-400/25 bg-teal-400/[0.08] px-4 py-3 text-sm font-medium text-teal-300 transition hover:bg-teal-400/[0.14]"
            >
              View analytics
              <span aria-hidden="true">↗</span>
            </Link>
          </header>

          <section className="mb-7 overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1b2d] shadow-xl shadow-black/10">
            <div className="flex flex-col gap-4 border-b border-slate-800 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Upload a file
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Add a document to your secure workspace.
                </p>
              </div>

              <div className="rounded-lg border border-teal-400/15 bg-teal-400/[0.06] px-3 py-2 text-xs text-teal-300">
                <span className="mr-2">●</span>
                Secure workspace
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <UploadBox onUploaded={loadFiles} />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1b2d] shadow-xl shadow-black/10">
            <div className="flex flex-col gap-4 border-b border-slate-800 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Your files
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {loading
                    ? "Loading your files..."
                    : `${filteredFiles.length} file${filteredFiles.length === 1 ? "" : "s"} shown`}
                </p>
              </div>

              <label className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-slate-700 bg-[#071626] px-4 md:max-w-xs">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m16 16 4 4" />
                </svg>

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your files..."
                  aria-label="Search files"
                  className="w-full min-w-0 border-0 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                />
              </label>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-teal-300" />
                <p className="text-sm text-slate-400">Loading your files...</p>
              </div>
            ) : error ? (
              <div className="p-10 text-center">
                <p role="alert" className="mb-4 text-sm text-rose-300">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={loadFiles}
                  className="rounded-lg bg-teal-300 px-4 py-2 text-sm font-semibold text-[#06111f] hover:bg-teal-200"
                >
                  Try again
                </button>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-400/15 bg-teal-400/[0.07] text-teal-300">
                  {fileIcon}
                </div>

                <h3 className="font-medium text-white">
                  {search ? "No matching files" : "Your workspace is ready"}
                </h3>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
                  {search
                    ? "Try a different filename or clear your search."
                    : "Upload your first file above. Your documents will appear here."}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead className="bg-[#0c2033]">
                      <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-4 font-medium">File name</th>
                        <th className="px-5 py-4 font-medium">Size</th>
                        <th className="px-5 py-4 font-medium">Uploaded</th>
                        <th className="px-5 py-4 text-right font-medium">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredFiles.map((file) => (
                        <FileRow
                          key={file.id}
                          file={file}
                          onDeleted={loadFiles}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-2 border-t border-slate-800 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Showing {filteredFiles.length} of {files.length} file(s)
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-teal-300" />
                    TrustShare workspace
                  </span>
                </div>
              </>
            )}
          </section>

          <footer className="mt-6 flex flex-col gap-2 pb-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>TrustShare · Secure file sharing and collaboration</span>
            <span>Manage your files in one place</span>
          </footer>
        </div>
      </main>
    </ProtectedRoute>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}