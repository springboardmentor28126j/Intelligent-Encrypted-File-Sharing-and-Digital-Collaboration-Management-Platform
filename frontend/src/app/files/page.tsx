'use client';
import React, { useState, useEffect } from 'react';
import { FolderPlus, X, Loader2 } from 'lucide-react';
import { FileUploader } from '@/components/file-manager/file-uploader';
import { FileExplorer, FileItem, FolderItem } from '@/components/file-manager/file-explorer';
import { VersionHistoryModal } from '@/components/file-manager/version-history';
import { ShareDialog } from '@/components/share-modal/share-dialog';
import { api, extractErrorMessage } from '@/lib/api';

const DEFAULT_DEMO_FILES: FileItem[] = [
  {
    id: 'f101-demo',
    name: 'Confidential_Quarterly_Strategy_2026.pdf',
    size_bytes: 2457600,
    mime_type: 'application/pdf',
    category: 'executive',
    current_version: 3,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'f102-demo',
    name: 'Security_Audit_Report_AES256.docx',
    size_bytes: 1048576,
    mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    category: 'compliance',
    current_version: 1,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'f103-demo',
    name: 'ZeroKnowledge_Architecture_Diagram.png',
    size_bytes: 3584000,
    mime_type: 'image/png',
    category: 'architecture',
    current_version: 2,
    updated_at: new Date().toISOString(),
  }
];

const DEFAULT_DEMO_FOLDERS: FolderItem[] = [
  { id: 'fol-1', name: 'Executive Documents', parent_id: null },
  { id: 'fol-2', name: 'Security & Compliance', parent_id: null },
  { id: 'fol-3', name: 'Cryptographic Schemas', parent_id: null },
];

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>(DEFAULT_DEMO_FILES);
  const [folders, setFolders] = useState<FolderItem[]>(DEFAULT_DEMO_FOLDERS);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFileForHistory, setSelectedFileForHistory] = useState<FileItem | null>(null);
  const [selectedFileForShare, setSelectedFileForShare] = useState<FileItem | null>(null);

  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const fetchFilesAndFolders = async () => {
    try {
      const [filesRes, foldersRes] = await Promise.all([
        api.get('/files', { params: { folder_id: currentFolderId || undefined } }),
        api.get('/folders'),
      ]);
      if (Array.isArray(filesRes.data)) {
        setFiles(filesRes.data);
      }
      if (Array.isArray(foldersRes.data)) {
        setFolders(foldersRes.data.filter((f: FolderItem) => f.parent_id === (currentFolderId || null)));
      }
    } catch {
      // Retain demo files for standalone frontend mode
    }
  };

  useEffect(() => {
    fetchFilesAndFolders();
  }, [currentFolderId]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await api.post('/folders', {
        name: newFolderName.trim(),
        parent_id: currentFolderId || null,
      });
      setNewFolderName('');
      setIsCreateFolderOpen(false);
      await fetchFilesAndFolders();
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Failed to create folder'));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFile = async (file: FileItem) => {
    if (!window.confirm(`Permanently delete "${file.name}" and all its encrypted versions?`)) {
      return;
    }
    try {
      await api.delete(`/files/${file.id}`);
      await fetchFilesAndFolders();
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Failed to delete file'));
    }
  };

  const handleDeleteFolder = async (folder: FolderItem) => {
    if (!window.confirm(`Delete folder "${folder.name}"? Files inside will be moved to root storage.`)) {
      return;
    }
    try {
      await api.delete(`/folders/${folder.id}`);
      await fetchFilesAndFolders();
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Failed to delete folder'));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Encrypted File Manager</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload, organize, and manage versions of your documents protected with server-side AES-256 encryption.
        </p>
      </div>

      <FileUploader currentFolderId={currentFolderId || undefined} onUploadSuccess={fetchFilesAndFolders} />

      <FileExplorer
        files={files}
        folders={folders}
        currentFolderId={currentFolderId}
        onOpenFolder={(id) => setCurrentFolderId(id)}
        onCreateFolder={() => setIsCreateFolderOpen(true)}
        onShare={(file) => setSelectedFileForShare(file)}
        onViewHistory={(file) => setSelectedFileForHistory(file)}
        onDeleteFile={handleDeleteFile}
        onDeleteFolder={handleDeleteFolder}
      />

      {/* Create Folder Modal */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FolderPlus className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-base text-slate-900">Create New Folder</h3>
              </div>
              <button
                onClick={() => setIsCreateFolderOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Legal Contracts 2026"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateFolderOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingFolder || !newFolderName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg flex items-center space-x-1 disabled:opacity-50"
                >
                  {creatingFolder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Folder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ShareDialog
        file={selectedFileForShare}
        onClose={() => setSelectedFileForShare(null)}
      />

      <VersionHistoryModal
        file={selectedFileForHistory}
        onClose={() => setSelectedFileForHistory(null)}
        onVersionUploaded={fetchFilesAndFolders}
      />
    </div>
  );
}
