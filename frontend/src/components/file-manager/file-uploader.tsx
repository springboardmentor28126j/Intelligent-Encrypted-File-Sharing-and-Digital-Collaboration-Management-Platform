'use client';
import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';

interface FileUploaderProps {
  currentFolderId?: string;
  onUploadSuccess: () => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ currentFolderId, onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (currentFolderId) {
        formData.append('folder_id', currentFolderId);
      }
      formData.append('category', 'general');

      await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(true);
      onUploadSuccess();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to upload and encrypt file'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
        isDragging
          ? 'border-indigo-600 bg-indigo-50/50'
          : 'border-slate-300 hover:border-indigo-400 bg-white'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      />
      <div className="flex flex-col items-center justify-center space-y-3">
        {isUploading ? (
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        ) : success ? (
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        ) : error ? (
          <AlertCircle className="w-10 h-10 text-rose-600" />
        ) : (
          <UploadCloud className="w-10 h-10 text-slate-400" />
        )}
        <div>
          <p className="text-sm font-semibold text-slate-700">
            {isUploading ? 'Encrypting & uploading...' : 'Drop files here or click to browse'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Files are automatically protected with AES-256 Server-Side Encryption
          </p>
        </div>
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      </div>
    </div>
  );
};
