'use client';
import React, { useState } from 'react';
import {
  Folder,
  FolderPlus,
  FileText,
  Download,
  Share2,
  History,
  Trash2,
  Search,
  Lock,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';

export interface FileItem {
  id: string;
  name: string;
  size_bytes: number;
  mime_type: string;
  category: string;
  current_version: number;
  updated_at: string;
}

export interface FolderItem {
  id: string;
  name: string;
  parent_id?: string | null;
}

interface FileExplorerProps {
  files: FileItem[];
  folders: FolderItem[];
  currentFolderId?: string | null;
  onOpenFolder: (id: string | null) => void;
  onCreateFolder: () => void;
  onShare: (file: FileItem) => void;
  onViewHistory: (file: FileItem) => void;
  onDeleteFile: (file: FileItem) => void;
  onDeleteFolder: (folder: FolderItem) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  folders,
  currentFolderId,
  onOpenFolder,
  onCreateFolder,
  onShare,
  onViewHistory,
  onDeleteFile,
  onDeleteFolder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleDownload = async (file: FileItem) => {
    setDownloadingFileId(file.id);
    try {
      const response = await api.get(`/files/${file.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Failed to download decrypted file.'));
    } finally {
      setDownloadingFileId(null);
    }
  };

  const filteredFiles = files.filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const currentFolder = folders.find((f) => f.id === currentFolderId);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
        {/* Breadcrumb path */}
        <div className="flex items-center space-x-2 text-sm text-slate-600 flex-wrap">
          <button
            onClick={() => onOpenFolder(null)}
            className={`hover:text-indigo-600 font-medium transition-colors ${
              !currentFolderId ? 'text-indigo-600' : ''
            }`}
          >
            Root Storage
          </button>
          {currentFolder && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800">{currentFolder.name}</span>
            </>
          )}
        </div>

        {/* Toolbar: Search + New Folder */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search encrypted files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={onCreateFolder}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors shrink-0"
            title="Create New Folder"
          >
            <FolderPlus className="w-4 h-4 text-indigo-600" />
            <span>New Folder</span>
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {/* Folders List */}
        {folders.map((folder) => (
          <div
            key={folder.id}
            onClick={() => onOpenFolder(folder.id)}
            className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <Folder className="w-5 h-5 text-indigo-500 fill-indigo-50 group-hover:scale-105 transition-transform" />
              <span className="font-medium text-slate-800 text-sm">{folder.name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Folder</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(folder);
                }}
                title="Delete Folder"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Files List */}
        {filteredFiles.map((file) => (
          <div key={file.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-center space-x-3 min-w-0">
              <FileText className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="truncate">
                <p className="font-medium text-slate-800 text-sm truncate flex items-center gap-1.5">
                  {file.name}
                  <span
                    title="AES-256 Encrypted at rest in Supabase S3"
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    <Lock className="w-2.5 h-2.5 text-emerald-600" />
                    AES-256
                  </span>
                </p>
                <p className="text-xs text-slate-400">
                  {formatSize(file.size_bytes)} • Version {file.current_version} •{' '}
                  {new Date(file.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleDownload(file)}
                disabled={downloadingFileId === file.id}
                title="Download Decrypted File"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors disabled:opacity-50"
              >
                {downloadingFileId === file.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => onShare(file)}
                title="Share Expiring Encrypted Link"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onViewHistory(file)}
                title="Version History & Upload New Version"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              >
                <History className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDeleteFile(file)}
                title="Delete File"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {folders.length === 0 && filteredFiles.length === 0 && (
          <div className="p-12 text-center text-slate-400 text-sm">
            No encrypted files or folders found in this directory.
          </div>
        )}
      </div>
    </div>
  );
};
