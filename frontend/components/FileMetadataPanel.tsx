"use client";

import { useState } from "react";
import {
  X,
  Info,
  FileText,
  HardDrive,
  Shield,
  Calendar,
  Copy,
  Check,
  Tag,
  User,
  Folder,
} from "lucide-react";
import { FileItem } from "@/types";

interface FileMetadataPanelProps {
  file: FileItem | null | undefined;
  onClose: () => void;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "0 Bytes";
  if (bytes === 0) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function formatDate(date?: string): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleString();
}

export default function FileMetadataPanel({
  file,
  onClose,
}: FileMetadataPanelProps) {
  if (!file) return null;

  const filename = file.filename || "Unnamed File";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                File Details
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Technical properties and metadata
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-2">
          <MetadataRow
            icon={<FileText className="w-4 h-4 text-slate-400" />}
            label="File Name"
            value={filename}
            canCopy
          />

          {file.id !== undefined && (
            <MetadataRow
              icon={<Tag className="w-4 h-4 text-slate-400" />}
              label="File ID"
              value={String(file.id)}
            />
          )}

          {"content_type" in file && file.content_type && (
            <MetadataRow
              icon={<Shield className="w-4 h-4 text-slate-400" />}
              label="MIME Type"
              value={String(file.content_type)}
            />
          )}

          {"category" in file && file.category && (
            <MetadataRow label="Category" value={String(file.category)} />
          )}

          {"size" in file && file.size !== undefined && (
            <MetadataRow
              icon={<HardDrive className="w-4 h-4 text-slate-400" />}
              label="File Size"
              value={formatBytes(Number(file.size))}
            />
          )}

          {"owner_id" in file && file.owner_id !== undefined && (
            <MetadataRow
              icon={<User className="w-4 h-4 text-slate-400" />}
              label="Owner ID"
              value={String(file.owner_id)}
            />
          )}

          {"folder_id" in file && (
            <MetadataRow
              icon={<Folder className="w-4 h-4 text-slate-400" />}
              label="Folder"
              value={
                file.folder_id !== null && file.folder_id !== undefined
                  ? `Folder #${file.folder_id}`
                  : "Root Directory"
              }
            />
          )}

          {"encryption_status" in file && (
            <MetadataRow
              label="Encryption"
              value={String(file.encryption_status || "AES-256")}
              customBadge={
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {String(file.encryption_status || "AES-256")}
                </span>
              }
            />
          )}

          {"is_deleted" in file && (
            <MetadataRow
              label="Status"
              value={file.is_deleted ? "Deleted" : "Active"}
              customBadge={
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                    file.is_deleted
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {file.is_deleted ? "Deleted" : "Active"}
                </span>
              }
            />
          )}

          {"created_at" in file && file.created_at && (
            <MetadataRow
              icon={<Calendar className="w-4 h-4 text-slate-400" />}
              label="Uploaded"
              value={formatDate(String(file.created_at))}
            />
          )}

          {"updated_at" in file && file.updated_at && (
            <MetadataRow
              icon={<Calendar className="w-4 h-4 text-slate-400" />}
              label="Last Modified"
              value={formatDate(String(file.updated_at))}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface MetadataRowProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  customBadge?: React.ReactNode;
  canCopy?: boolean;
}

function MetadataRow({
  label,
  value,
  icon,
  customBadge,
  canCopy = false,
}: MetadataRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/60 bg-slate-50/50 px-3.5 py-2.5 hover:bg-slate-100/50 transition-colors">
      <span className="text-xs font-medium text-slate-500 flex items-center gap-2 shrink-0">
        {icon}
        {label}
      </span>

      <div className="flex items-center gap-1.5 max-w-[60%] justify-end">
        {customBadge ? (
          customBadge
        ) : (
          <span
            className="truncate text-xs font-semibold text-slate-900"
            title={value}
          >
            {value}
          </span>
        )}

        {canCopy && (
          <button
            onClick={handleCopy}
            title="Copy value"
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}