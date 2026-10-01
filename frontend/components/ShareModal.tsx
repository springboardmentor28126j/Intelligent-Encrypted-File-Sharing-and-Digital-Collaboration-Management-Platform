"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  Link as LinkIcon,
  ShieldCheck,
  X,
  UserPlus,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { createShareLink, shareFile } from "@/lib/api";
import { FileItem } from "@/types";

interface ShareModalProps {
  file: FileItem;
  onClose: () => void;
}

export default function ShareModal({ file, onClose }: ShareModalProps) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"READ" | "WRITE">("READ");
  const [canDownload, setCanDownload] = useState(true);
  const [maxDownloads, setMaxDownloads] = useState("");
  const [expires, setExpires] = useState("24");
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const calculateExpiry = () =>
    new Date(Date.now() + Number(expires) * 3600000).toISOString();

  async function submitUser() {
    if (!email.trim()) {
      return setError("Please enter a valid recipient email address.");
    }
    setLoadingUser(true);
    setError("");
    setSuccessMessage("");

    try {
      await shareFile({
        file_id: file.id,
        email: email.trim(),
        permission,
        can_download: canDownload,
        max_downloads: maxDownloads ? Number(maxDownloads) : null,
        expires_at: calculateExpiry(),
      });
      setSuccessMessage(`File successfully shared with ${email.trim()}`);
      setEmail("");
    } catch (e: any) {
      setError(e.message || "Failed to share file with user.");
    } finally {
      setLoadingUser(false);
    }
  }

  async function createLink() {
    const hours = Number(expires);
    if (!hours || hours <= 0) {
      return setError("Expiration period must be greater than zero.");
    }
    setLoadingLink(true);
    setError("");
    setSuccessMessage("");

    try {
      const r = await createShareLink({
        file_id: file.id,
        permission,
        can_download: canDownload,
        max_downloads: maxDownloads ? Number(maxDownloads) : null,
        expires_at: calculateExpiry(),
      });
      setShareLink(r.access_url);
    } catch (e: any) {
      setError(e.message || "Failed to generate share link.");
    } finally {
      setLoadingLink(false);
    }
  }

  async function copyToClipboard() {
    if (!shareLink) return;
    const url = shareLink.startsWith("http")
      ? shareLink
      : `${window.location.origin}${shareLink}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link to clipboard.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Secure Sharing</h2>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-700 truncate max-w-[220px]">
                  {file.filename}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Notifications */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Access Controls Panel */}
          <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              Access Controls
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Permission
                </label>
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value as "READ" | "WRITE")}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="READ">View only</option>
                  <option value="WRITE">View & Edit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Expires in
                </label>
                <select
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-200/60">
              <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={canDownload}
                  onChange={(e) => setCanDownload(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Allow file download</span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Maximum downloads (optional)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Direct Share Section */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
              Share with TrustShare User
            </h3>

            <div className="flex gap-2">
              <input
                type="email"
                placeholder="recipient@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button
                onClick={submitUser}
                disabled={loadingUser}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer shrink-0"
              >
                {loadingUser ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Share</span>
                )}
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Temporary Link Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-indigo-600" />
                Create Temporary Link
              </h3>
              <button
                onClick={createLink}
                disabled={loadingLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
              >
                {loadingLink ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Generate Link</span>
                )}
              </button>
            </div>

            {shareLink && (
              <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  value={
                    shareLink.startsWith("http")
                      ? shareLink
                      : `${typeof window !== "undefined" ? window.location.origin : ""}${shareLink}`
                  }
                  readOnly
                  className="flex-1 bg-transparent px-2 text-xs font-mono text-slate-600 outline-none truncate"
                />
                <button
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-lg transition-colors cursor-pointer shrink-0 shadow-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}