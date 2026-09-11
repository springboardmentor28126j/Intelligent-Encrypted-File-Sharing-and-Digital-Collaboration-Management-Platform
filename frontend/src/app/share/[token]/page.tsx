'use client';
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Lock,
  FileText,
  Download,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  FileWarning,
} from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';

interface ShareMeta {
  file_name: string;
  mime_type: string;
  size_bytes: number;
  permission_type: 'view_only' | 'download_allowed';
  is_expired: boolean;
  is_revoked: boolean;
  has_download_limit: boolean;
  is_download_limit_reached: boolean;
  requires_passphrase: boolean;
  expires_at: string;
}

export default function GuestSharePage({ params: propParams }: { params?: { token: string } }) {
  const routerParams = useParams();
  const token = (routerParams?.token as string) || propParams?.token || '';

  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [passphrase, setPassphrase] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // 1. Fetch metadata on load
  const fetchMetadata = async () => {
    if (!token) return;
    setMetaLoading(true);
    setMetaError(null);
    try {
      const res = await api.get(`/shares/${token}/meta`);
      setMeta(res.data);
      if (!res.data.requires_passphrase) {
        setIsUnlocked(true);
      }
    } catch (err: any) {
      setMetaError(extractErrorMessage(err, 'This shared link is invalid or has been deleted.'));
    } finally {
      setMetaLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [token]);

  // 2. Unlock with passphrase
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockLoading(true);
    setUnlockError(null);
    try {
      await api.post(`/shares/${token}/access`, { passphrase: passphrase || undefined });
      setIsUnlocked(true);
    } catch (err: any) {
      setUnlockError(extractErrorMessage(err, 'Incorrect passphrase. Access denied.'));
    } finally {
      setUnlockLoading(false);
    }
  };

  // 3. Load decrypted preview
  const handleLoadPreview = async () => {
    if (previewUrl || previewText) {
      setShowPreview(true);
      return;
    }
    setPreviewLoading(true);
    try {
      const response = await api.post(
        `/shares/${token}/preview`,
        { passphrase: passphrase || undefined },
        { responseType: 'blob' }
      );
      const blob: Blob = response.data;
      if (meta?.mime_type.startsWith('text/') || meta?.mime_type === 'application/json') {
        const text = await blob.text();
        setPreviewText(text);
      } else {
        const url = window.URL.createObjectURL(blob);
        setPreviewUrl(url);
      }
      setShowPreview(true);
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Failed to generate decrypted preview.'));
    } finally {
      setPreviewLoading(false);
    }
  };

  // Auto-load preview when unlocked in view_only mode
  useEffect(() => {
    if (isUnlocked && meta?.permission_type === 'view_only' && !previewUrl && !previewText && !previewLoading) {
      handleLoadPreview();
    }
  }, [isUnlocked, meta]);

  // 4. Download file
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await api.post(
        `/shares/${token}/download`,
        { passphrase: passphrase || undefined },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', meta?.file_name || 'download');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Failed to download shared file.'));
    } finally {
      setDownloading(false);
    }
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (metaLoading) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-2xl shadow-sm border border-slate-200 text-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-700">Verifying encrypted link authenticity...</p>
      </div>
    );
  }

  if (metaError || !meta) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-2xl shadow-sm border border-slate-200 text-center">
        <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <FileWarning className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Link Not Available</h1>
        <p className="text-xs text-slate-500 mt-2">{metaError || 'This share link does not exist.'}</p>
      </div>
    );
  }

  // Revoked link screen
  if (meta.is_revoked) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-2xl shadow-sm border border-rose-200 text-center">
        <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Access Revoked</h1>
        <p className="text-xs text-slate-600 mt-2">
          This share link has been revoked by the document owner. Immediate access has been disabled.
        </p>
      </div>
    );
  }

  // Expired link screen
  if (meta.is_expired) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-2xl shadow-sm border border-amber-200 text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Share Link Expired</h1>
        <p className="text-xs text-slate-600 mt-2">
          This encrypted share link expired on {new Date(meta.expires_at).toLocaleString()}. Contact the document owner for a new link.
        </p>
      </div>
    );
  }

  // Download limit reached screen
  if (meta.is_download_limit_reached) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-2xl shadow-sm border border-amber-200 text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Download Limit Exceeded</h1>
        <p className="text-xs text-slate-600 mt-2">
          The maximum number of authorized downloads for this link has been reached.
        </p>
      </div>
    );
  }

  return (
    <div className={`mx-auto my-12 bg-white rounded-2xl shadow-sm border border-slate-200 transition-all ${
      showPreview ? 'max-w-4xl p-6 sm:p-8' : 'max-w-md p-8 text-center'
    }`}>
      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Secure Shared Document</h1>
        <p className="text-xs text-slate-500 mt-1">
          Encrypted at Rest with AES-256-GCM • Supabase S3 Cloud Storage
        </p>
      </div>

      {/* Document Overview Card */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-left mb-6">
        <div className="flex items-center space-x-3 min-w-0">
          <FileText className="w-8 h-8 text-indigo-500 shrink-0" />
          <div className="truncate">
            <p className="font-semibold text-sm text-slate-800 truncate">{meta.file_name}</p>
            <p className="text-xs text-slate-400">
              {formatSize(meta.size_bytes)} • Expires {new Date(meta.expires_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${
            meta.permission_type === 'view_only'
              ? 'bg-amber-100 text-amber-800 border border-amber-200'
              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
          }`}
        >
          {meta.permission_type === 'view_only' ? 'View Only' : 'Download Allowed'}
        </span>
      </div>

      {/* Passphrase Gate */}
      {meta.requires_passphrase && !isUnlocked ? (
        <form onSubmit={handleUnlock} className="space-y-4 text-left">
          {unlockError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-rose-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{unlockError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-400" />
              Passphrase Protected
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="password"
                required
                autoFocus
                placeholder="Enter document passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              The sender protected this document with an end-to-end passphrase.
            </p>
          </div>

          <button
            type="submit"
            disabled={unlockLoading || !passphrase.trim()}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 flex items-center justify-center space-x-2 disabled:opacity-50 transition-colors"
          >
            {unlockLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Unlock Document</span>
          </button>
        </form>
      ) : (
        /* Document Actions & Secure Previewer */
        <div className="space-y-6">
          {meta.permission_type === 'view_only' ? (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-amber-800 text-xs text-left">
              <strong>View-Only Protection:</strong> Downloading and printing are restricted by the document sender.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 flex items-center justify-center space-x-2 disabled:opacity-50 transition-colors"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Download Decrypted Document</span>
              </button>

              <button
                onClick={() => {
                  if (showPreview) {
                    setShowPreview(false);
                  } else {
                    handleLoadPreview();
                  }
                }}
                disabled={previewLoading}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-sm flex items-center justify-center space-x-2 disabled:opacity-50 transition-colors"
              >
                {previewLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : showPreview ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                <span>{showPreview ? 'Hide Preview' : 'Inline Preview'}</span>
              </button>
            </div>
          )}

          {/* Secure In-Browser Preview with Watermark */}
          {showPreview && (
            <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden bg-slate-900/5 relative shadow-inner">
              {/* Header Bar */}
              <div className="bg-slate-800 text-slate-200 text-xs px-4 py-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Decrypted Secure Viewer
                </span>
                <span className="text-[11px] text-slate-400">
                  {meta.permission_type === 'view_only' ? 'Protected • View Only' : 'Decrypted Stream'}
                </span>
              </div>

              {/* Watermark Overlay (Prominent for View-Only) */}
              <div
                className="absolute inset-0 pointer-events-none select-none z-10 flex items-center justify-center overflow-hidden"
                aria-hidden="true"
              >
                <div className="rotate-[-25deg] text-center opacity-10 text-slate-950 font-black text-3xl sm:text-5xl uppercase tracking-widest whitespace-nowrap leading-relaxed">
                  TRUSTSHARE SECURE PREVIEW
                  <br />
                  CONFIDENTIAL • DO NOT DISTRIBUTE
                </div>
              </div>

              {/* Content Preview Container */}
              <div
                className="relative z-0 p-4 select-none min-h-[300px] flex items-center justify-center"
                onContextMenu={(e) => {
                  if (meta.permission_type === 'view_only') {
                    e.preventDefault();
                  }
                }}
              >
                {previewLoading ? (
                  <div className="p-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    <p className="text-xs">Streaming and decrypting content...</p>
                  </div>
                ) : previewText !== null ? (
                  <pre className="w-full max-h-[500px] overflow-auto text-left text-xs font-mono p-4 bg-slate-900 text-emerald-400 rounded-lg whitespace-pre-wrap">
                    {previewText}
                  </pre>
                ) : meta.mime_type.startsWith('image/') && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={meta.file_name}
                    className="max-h-[600px] w-auto mx-auto rounded-lg shadow-sm"
                  />
                ) : meta.mime_type === 'application/pdf' && previewUrl ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[650px] rounded-lg border-0 bg-white"
                    title={meta.file_name}
                  />
                ) : (
                  <div className="p-12 text-center text-slate-500">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700">Preview not directly supported for this format</p>
                    <p className="text-xs text-slate-400 mt-1">({meta.mime_type})</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
