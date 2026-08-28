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
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${file.filename}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.delete(`/api/files/${file.id}`);
      onDeleted?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-b last:border-0">
      <td className="py-3 pr-4">
        <Link
          href={`/dashboard/files/${file.id}`}
          className="font-medium text-gray-800 hover:text-brand-600 hover:underline"
        >
          {file.filename}
        </Link>
      </td>
      <td className="py-3 pr-4 text-sm text-gray-500">{formatBytes(file.size_bytes)}</td>
      <td className="py-3 pr-4 text-sm text-gray-500">{formatDate(file.created_at)}</td>
      <td className="py-3 text-right text-sm">
        <button
          disabled={busy}
          onClick={handleDownload}
          className="mr-3 font-medium text-brand-600 hover:underline disabled:opacity-50"
        >
          Download
        </button>
        <Link
          href={`/dashboard/files/${file.id}`}
          className="mr-3 font-medium text-gray-600 hover:underline"
        >
          Share
        </Link>
        <button
          disabled={busy}
          onClick={handleDelete}
          className="font-medium text-red-500 hover:underline disabled:opacity-50"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/files");
      setFiles(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  return (
    <ProtectedRoute>
      <h1 className="mb-1 text-2xl font-bold text-gray-800">Your Files</h1>
      <p className="mb-6 text-sm text-gray-500">
        Every file is encrypted with AES-256-GCM on the server before it's stored.
      </p>

      <div className="mb-8">
        <UploadBox onUploaded={loadFiles} />
      </div>

      <div className="rounded-xl border bg-white p-6">
        {loading ? (
          <p className="text-sm text-gray-400">Loading files…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-gray-400">
            No files yet — upload one above to get started.
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Size</th>
                <th className="pb-2 font-medium">Uploaded</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <FileRow key={f.id} file={f} onDeleted={loadFiles} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ProtectedRoute>
  );
}
