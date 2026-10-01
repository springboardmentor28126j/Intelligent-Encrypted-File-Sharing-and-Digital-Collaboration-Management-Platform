"use client";

import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, Plus, Loader2, AlertCircle } from "lucide-react";
import { getFiles, searchFiles, deleteFile, downloadFile, getFolders } from "@/lib/api";
import { FileItem } from "@/types";
import UploadModal from "@/components/UploadModal";
import FileTable from "@/components/FileTable";
import ShareModal from "@/components/ShareModal";
import FileMetadataPanel from "@/components/FileMetadataPanel";
import VersionHistoryModal from "@/components/VersionHistoryModal";

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showUpload, setShowUpload] = useState(false);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null); // Changed from selectedFileId
  const [versionFile, setVersionFile] = useState<FileItem | null>(null);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [folderId, setFolderId] = useState<number | undefined>();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data =
        q || category || folderId != null
          ? await searchFiles({
              q: q || undefined,
              category: category || undefined,
              folder_id: folderId,
            })
          : await getFiles();
      setFiles(data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load files");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getFolders()
      .then(setFolders)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q, category, folderId]);

  async function del(f: FileItem) {
    if (!confirm(`Move ${f.filename} to trash?`)) return;
    try {
      await deleteFile(f.id);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function download(f: FileItem) {
    try {
      const b = await downloadFile(f.id);
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = f.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(u);
    } catch (e: any) {
      alert(e.message);
    }
  }

  const hasActiveFilters = Boolean(q || category || folderId !== undefined);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Files</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage, search, version and securely share your encrypted files.
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-sm transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Upload File
        </button>
      </div>

      {/* Filter and Search Bar Panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
              placeholder="Search files by name or type…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all cursor-pointer"
          >
            <option value="">All categories</option>
            <option value="document">Documents</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
            <option value="archive">Archives</option>
            <option value="other">Other</option>
          </select>

          {/* Folder Dropdown */}
          <select
            value={folderId ?? ""}
            onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all cursor-pointer"
          >
            <option value="">All folders</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          {/* Clear Button */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setQ("");
                setCategory("");
                setFolderId(undefined);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Loading & Table Section */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Loading files…</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <FileTable
            files={files}
            onDownload={download}
            onDelete={del}
            onShare={setShareFile}
            onViewDetails={(f) => setSelectedFile(f)}
            onVersions={setVersionFile}
          />
        </div>
      )}

      {/* Modals & Slide-over Panels */}
      {showUpload && (
        <UploadModal
          onSuccess={() => {
            setShowUpload(false);
            load();
          }}
          onClose={() => setShowUpload(false)}
        />
      )}
      {shareFile && <ShareModal file={shareFile} onClose={() => setShareFile(null)} />}
      {selectedFile && (
        <FileMetadataPanel file={selectedFile} onClose={() => setSelectedFile(null)} />
      )}
      {versionFile && (
        <VersionHistoryModal
          fileId={versionFile.id}
          filename={versionFile.filename}
          onClose={() => setVersionFile(null)}
        />
      )}
    </div>
  );
}