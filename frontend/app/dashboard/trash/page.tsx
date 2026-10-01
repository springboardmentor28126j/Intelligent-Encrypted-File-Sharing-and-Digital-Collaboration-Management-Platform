"use client";

import { useEffect, useState } from "react";
import {
  Trash2,
  RotateCcw,
  AlertOctagon,
  Loader2,
  AlertCircle,
  FileText,
  HardDrive,
} from "lucide-react";
import { getTrash, restoreFile, permanentlyDeleteFile } from "@/lib/api";
import { FileItem } from "@/types";

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || bytes === 0) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

export default function TrashPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getTrash();
      setFiles(data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load trash items.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRestore(file: FileItem) {
    setActionId(file.id);
    try {
      await restoreFile(file.id);
      await load();
    } catch (e: any) {
      alert(e.message || "Failed to restore file.");
    } finally {
      setActionId(null);
    }
  }

  async function handlePermanentDelete(file: FileItem) {
    if (
      !confirm(
        `Are you sure you want to permanently delete "${file.filename}"? This action cannot be undone.`
      )
    ) {
      return;
    }
    setActionId(file.id);
    try {
      await permanentlyDeleteFile(file.id);
      await load();
    } catch (e: any) {
      alert(e.message || "Failed to permanently delete file.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-slate-700" />
            Trash
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Items in trash are kept until permanently purged or restored.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Main Content Card */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Loading trash items…</span>
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <div className="p-3 bg-slate-100 text-slate-400 rounded-full mb-3">
            <Trash2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            Trash is empty
          </h3>
          <p className="text-sm text-slate-500 max-w-xs mt-1">
            Files you delete will appear here before being permanently removed.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-6 py-3.5 font-semibold">
                    File Name
                  </th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">
                    Size
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 font-semibold text-right"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {files.map((f) => {
                  const isProcessing = actionId === f.id;
                  return (
                    <tr
                      key={f.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="truncate max-w-md">
                            {f.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                          {formatBytes(f.size)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={isProcessing}
                            onClick={() => handleRestore(f)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            Restore
                          </button>
                          <button
                            disabled={isProcessing}
                            onClick={() => handlePermanentDelete(f)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <AlertOctagon className="w-3.5 h-3.5" />
                            )}
                            Delete forever
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}