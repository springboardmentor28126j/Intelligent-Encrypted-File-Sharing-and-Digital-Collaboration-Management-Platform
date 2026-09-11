'use client';
import React, { useState, useEffect } from 'react';
import { X, Share2, Copy, Check, Lock, Clock, Eye, Download, Hash, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { FileItem } from '../file-manager/file-explorer';
import { api, extractErrorMessage } from '@/lib/api';

interface ShareDialogProps {
  file: FileItem | null;
  onClose: () => void;
}

interface ExistingShare {
  id: string;
  share_url: string;
  permission_type: string;
  requires_passphrase: boolean;
  max_downloads: number | null;
  current_downloads: number;
  expires_at: string;
  is_revoked: boolean;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({ file, onClose }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [permissionType, setPermissionType] = useState<'view_only' | 'download_allowed'>('view_only');
  const [passphrase, setPassphrase] = useState('');
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [maxDownloads, setMaxDownloads] = useState<number | ''>('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [existingShares, setExistingShares] = useState<ExistingShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchExistingShares = async () => {
    if (!file) return;
    setLoadingShares(true);
    try {
      const res = await api.get('/shares', { params: { file_id: file.id } });
      if (Array.isArray(res.data)) {
        setExistingShares(res.data);
      }
    } catch {
      // Ignore in demo mode
    } finally {
      setLoadingShares(false);
    }
  };

  useEffect(() => {
    if (file && activeTab === 'manage') {
      fetchExistingShares();
    }
  }, [file, activeTab]);

  if (!file) return null;

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await api.post('/shares', {
        file_id: file.id,
        permission_type: permissionType,
        passphrase: passphrase || null,
        expires_in_hours: expiresInHours,
        max_downloads: maxDownloads ? Number(maxDownloads) : null,
      });
      const fullUrl = `${window.location.origin}${response.data.share_url}`;
      setShareUrl(fullUrl);
      fetchExistingShares();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to generate share link'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    setRevokingId(shareId);
    try {
      await api.delete(`/shares/${shareId}/revoke`);
      setExistingShares((prev) =>
        prev.map((s) => (s.id === shareId ? { ...s, is_revoked: true } : s))
      );
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Failed to revoke link'));
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Share2 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-lg text-slate-900">Share Encrypted File</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex space-x-1 border-b border-slate-100 mt-4 mb-2">
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Create Link
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'manage'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Manage Active Links
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'create' ? (
          !shareUrl ? (
            <div className="py-3 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                  Permission Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPermissionType('view_only')}
                    className={`flex items-center justify-center space-x-2 p-2.5 rounded-lg border text-sm font-medium transition-all ${
                      permissionType === 'view_only'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Only</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermissionType('download_allowed')}
                    className={`flex items-center justify-center space-x-2 p-2.5 rounded-lg border text-sm font-medium transition-all ${
                      permissionType === 'download_allowed'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Allow Download</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                    Expiration (Hours)
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={expiresInHours}
                      onChange={(e) => setExpiresInHours(Number(e.target.value))}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {permissionType === 'download_allowed' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                      Max Downloads (Optional)
                    </label>
                    <div className="relative">
                      <Hash className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        value={maxDownloads}
                        onChange={(e) => setMaxDownloads(e.target.value ? Number(e.target.value) : '')}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                  Passphrase Protection (Optional)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Set an access passphrase"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerateLink}
                disabled={isGenerating}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isGenerating ? 'Generating Secure Token...' : 'Create Expiring Link'}
              </button>
            </div>
          ) : (
            <div className="py-6 space-y-4">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center space-x-2 text-emerald-800 text-sm">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Share link generated and ready!</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg select-all"
                />
                <button
                  onClick={() => handleCopy(shareUrl)}
                  className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={() => setShareUrl(null)}
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                Create another link
              </button>
            </div>
          )
        ) : (
          <div className="py-4 space-y-3 max-h-72 overflow-y-auto">
            {loadingShares ? (
              <div className="py-8 flex justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : existingShares.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                No active share links created for this file yet.
              </p>
            ) : (
              existingShares.map((share) => {
                const isExpired = new Date() > new Date(share.expires_at);
                const isLimitReached = share.max_downloads !== null && share.current_downloads >= share.max_downloads;
                const isInactive = share.is_revoked || isExpired || isLimitReached;

                return (
                  <div
                    key={share.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                      isInactive ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-slate-800 capitalize">
                          {share.permission_type.replace('_', ' ')}
                        </span>
                        {share.is_revoked ? (
                          <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-medium">Revoked</span>
                        ) : isExpired ? (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded font-medium">Expired</span>
                        ) : isLimitReached ? (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded font-medium">Limit Reached</span>
                        ) : (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-medium">Active</span>
                        )}
                        {share.requires_passphrase && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">Passphrase</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Expires: {new Date(share.expires_at).toLocaleString()} • Downloads: {share.current_downloads}
                        {share.max_downloads ? `/${share.max_downloads}` : ' (unlimited)'}
                      </p>
                    </div>

                    {!share.is_revoked && !isExpired && (
                      <button
                        onClick={() => handleRevoke(share.id)}
                        disabled={revokingId === share.id}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-2 shrink-0"
                        title="Revoke Share Link"
                      >
                        {revokingId === share.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
