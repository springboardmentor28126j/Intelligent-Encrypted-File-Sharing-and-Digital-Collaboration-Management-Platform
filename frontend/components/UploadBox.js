"use client";

import { useRef, useState } from "react";
import api from "@/lib/api";

export default function UploadBox({ onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const doUpload = async (file) => {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("upload", file);
      await api.post("/api/files/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onUploaded?.();
    } catch (err) {
      setError(err?.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          doUpload(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragOver ? "border-brand-500 bg-brand-50" : "border-gray-300 bg-white hover:border-brand-400"
        }`}
      >
        <p className="text-sm font-medium text-gray-700">
          {uploading ? "Encrypting & uploading…" : "Click or drag a file here to upload"}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Files are encrypted with AES-256 on the server before storage
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => doUpload(e.target.files?.[0])}
        />
      </div>
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
