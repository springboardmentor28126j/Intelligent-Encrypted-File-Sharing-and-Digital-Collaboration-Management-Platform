"use client";

import {
  Download,
  Trash2,
  Share2,
  Info,
  History,
} from "lucide-react";

import { FileItem } from "@/types";

interface Props {
  files: FileItem[];
  onDownload: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onViewDetails: (file: FileItem) => void;
  onVersions?: (file: FileItem) => void;
}

export default function FileTable({
  files,
  onDownload,
  onDelete,
  onShare,
  onViewDetails,
  onVersions,
}: Props) {
  if (!files.length) {
    return (
      <div className="empty-state">
        No files found.
      </div>
    );
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "0 B";

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
    ];

    const index = Math.floor(
      Math.log(bytes) / Math.log(1024)
    );

    return `${(
      bytes /
      Math.pow(1024, index)
    ).toFixed(1)} ${units[index]}`;
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Size</th>
            <th>Type</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {files.map((file) => (
            <tr key={file.id}>
              <td>{file.filename}</td>

              <td>
                {formatBytes(file.size)}
              </td>

              <td>
                {file.content_type ||
                  "Unknown"}
              </td>

              <td>
                {new Date(
                  file.created_at
                ).toLocaleDateString()}
              </td>

              <td>
                <div className="action-buttons">
                  <button
                    title="Details"
                    onClick={() =>
                      onViewDetails(file)
                    }
                  >
                    <Info size={17} />
                  </button>
                  
                  {onVersions && <button title="Version history" onClick={() => onVersions(file)}><History size={17} /></button>}

                  <button
                    title="Download"
                    onClick={() =>
                      onDownload(file)
                    }
                  >
                    <Download size={17} />
                  </button>

                  <button
                    title="Share"
                    onClick={() =>
                      onShare(file)
                    }
                  >
                    <Share2 size={17} />
                  </button>

                  <button
                    title="Delete"
                    onClick={() =>
                      onDelete(file)
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}