"use client";

import { useState } from "react";

import { createFolder } from "@/lib/api";

interface Props {
  parentId?: number | null;
  onSuccess: () => void;
  onClose: () => void;
}

export default function CreateFolderModal({
  parentId,
  onSuccess,
  onClose,
}: Props) {
  const [name, setName] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleCreate() {
    if (!name.trim()) {
      setError(
        "Folder name is required"
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createFolder(
        name.trim(),
        parentId
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to create folder"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Create Folder</h2>

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        <input
          placeholder="Folder name"
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
        />

        <div className="modal-actions">
          <button onClick={onClose}>
            Cancel
          </button>

          <button
            onClick={handleCreate}
            disabled={loading}
          >
            {loading
              ? "Creating..."
              : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}