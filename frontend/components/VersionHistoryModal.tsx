"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Download,
  RefreshCw,
  Upload,
  X,
  Shield,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  downloadFileVersion,
  getFileVersions,
  uploadFileVersion,
  rotateFileKey,
} from "@/lib/api";

interface FileVersion {
  id: number;
  version_number: number;
  filename: string;
  size: number;
  created_at: string;
}

export default function VersionHistoryModal({
  fileId,
  filename,
  onClose,
}: {
  fileId: number;
  filename: string;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [rotating, setRotating] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFileVersions(fileId);
      setVersions(data || []);
    } catch (e: any) {
      setFeedback({
        type: "error",
        message: e?.message || "Failed to load file versions.",
      });
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setFeedback(null);
    try {
      await uploadFileVersion(fileId, file);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFeedback({
        type: "success",
        message: "New version uploaded successfully.",
      });
      loadVersions();
    } catch (e: any) {
      setFeedback({
        type: "error",
        message: e?.message || "Failed to upload new version.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRotateKey = async () => {
    if (
      !confirm(
        "Rotate this file's encryption key? The file will remain downloadable."
      )
    )
      return;

    setRotating(true);
    setFeedback(null);
    try {
      await rotateFileKey(fileId);
      setFeedback({
        type: "success",
        message: "Encryption key rotated successfully.",
      });
    } catch (e: any) {
      setFeedback({
        type: "error",
        message: e?.message || "Failed to rotate encryption key.",
      });
    } finally {
      setRotating(false);
    }
  };

  const handleDownload = async (versionId: number, targetFilename: string) => {
    setDownloadingId(versionId);
    try {
      const blob = await downloadFileVersion(fileId, versionId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = targetFilename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setFeedback({
        type: "error",
        message: e?.message || "Failed to download version.",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Version History
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">
                {filename}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mt-4 flex items-center justify-between rounded-lg p-3 text-xs ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-400"
                : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Action Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
            id="modal-file-upload"
          />
          <label
            htmlFor="modal-file-upload"
            className={`inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 cursor-pointer ${
              uploading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? "Uploading version..." : "Upload New Version"}
          </label>

          <button
            onClick={handleRotateKey}
            disabled={rotating}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 transition"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-gray-500 ${
                rotating ? "animate-spin" : ""
              }`}
            />
            {rotating ? "Rotating key..." : "Rotate Key"}
          </button>
        </div>

        {/* Versions Table */}
        <div className="mt-5 max-h-80 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Loading version history...
              </p>
            </div>
          ) : versions.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
              No version history found for this file.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 uppercase text-gray-500 sticky top-0 dark:bg-gray-800/80 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Version</th>
                  <th className="px-4 py-3 font-semibold">Filename</th>
                  <th className="px-4 py-3 font-semibold">Size</th>
                  <th className="px-4 py-3 font-semibold">Encryption</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {versions.map((v) => (
                  <tr
                    key={v.id}
                    className="transition hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                        v{v.version_number}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 max-w-[140px] truncate">
                      {v.filename}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono">
                      {formatSize(v.size)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        <Shield className="h-3 w-3 text-emerald-500" />
                        AES-256-GCM
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(v.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDownload(v.id, v.filename)}
                        disabled={downloadingId === v.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-700 shadow-2xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition"
                        title="Download version"
                      >
                        {downloadingId === v.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                        ) : (
                          <Download className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                        )}
                        <span>Download</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-5 flex justify-end border-t border-gray-100 pt-4 dark:border-gray-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}