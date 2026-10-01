"use client";

import {
  ChangeEvent,
  useState,
} from "react";

import { uploadFile } from "@/lib/api";

interface Props {
  folderId?: number | null;
  onSuccess: () => void;
  onClose: () => void;
}

export default function UploadModal({
  folderId,
  onSuccess,
  onClose,
}: Props) {
  const [file, setFile] =
    useState<File | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  function handleFileChange(
    e: ChangeEvent<HTMLInputElement>
  ) {
    setFile(e.target.files?.[0] || null);
  }

  async function handleUpload() {
    if (!file) {
      setError("Select a file first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await uploadFile(file, folderId);

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err?.message || "Upload failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Upload File</h2>

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        <input
          type="file"
          onChange={handleFileChange}
        />

        {file && (
          <p>
            Selected: {file.name}
          </p>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>
            Cancel
          </button>

          <button
            onClick={handleUpload}
            disabled={loading}
          >
            {loading
              ? "Uploading..."
              : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}