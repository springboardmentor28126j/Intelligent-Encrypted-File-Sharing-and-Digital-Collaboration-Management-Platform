"use client";

import { useEffect, useState } from "react";
import { 
  FolderPlus, 
  Upload, 
  ChevronRight, 
  Home, 
  Folder as FolderIcon, 
  Loader2, 
  ArrowLeft 
} from "lucide-react";

import { deleteFolder, getFolders } from "@/lib/api";
import { Folder } from "@/types";

import FolderCard from "@/components/FolderCard";
import CreateFolderModal from "@/components/CreateFolderModal";
import UploadModal from "@/components/UploadModal";

export default function FoldersPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentParent, setCurrentParent] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  async function loadFolders() {
    setLoading(true);
    try {
      const data = await getFolders(currentParent);
      setFolders(data);
    } catch (err: any) {
      alert(err?.message || "Failed to load folders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFolders();
  }, [currentParent]);

  async function handleDelete(folder: Folder) {
    if (!window.confirm(`Delete ${folder.name}?`)) {
      return;
    }

    try {
      await deleteFolder(folder.id);
      await loadFolders();
    } catch (err: any) {
      alert(err?.message || "Unable to delete folder");
    }
  }

  function openFolder(folder: Folder) {
    setCurrentParent(folder.id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Folders</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Organize and manage your encrypted folder directories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>New Folder</span>
          </button>

          {currentParent !== null && (
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload to Folder</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Breadcrumb / Back Bar */}
      {currentParent !== null && (
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5">
          <button
            onClick={() => setCurrentParent(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Root</span>
          </button>

          <span className="text-slate-300">|</span>

          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <Home className="w-3.5 h-3.5 text-slate-400" />
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="font-medium text-slate-700">Subfolder #{currentParent}</span>
          </nav>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[280px] bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium">Loading folders...</p>
        </div>
      ) : folders.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onOpen={openFolder}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[280px] bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
          <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl mb-3">
            <FolderIcon className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">No folders found</h3>
          <p className="text-xs text-slate-500 max-w-sm mb-4">
            Get started by creating a new folder to organize your files securely.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Create First Folder</span>
          </button>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateFolderModal
          parentId={currentParent}
          onSuccess={loadFolders}
          onClose={() => setShowCreate(false)}
        />
      )}

      {showUpload && (
        <UploadModal
          folderId={currentParent}
          onSuccess={loadFolders}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}