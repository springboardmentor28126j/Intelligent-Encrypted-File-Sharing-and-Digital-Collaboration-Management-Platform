"use client";

import {
  Folder as FolderIcon,
  Trash2,
} from "lucide-react";

import { Folder } from "@/types";

interface Props {
  folder: Folder;
  onOpen: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}

export default function FolderCard({
  folder,
  onOpen,
  onDelete,
}: Props) {
  return (
    <div className="folder-card">
      <button
        className="folder-open"
        onClick={() =>
          onOpen(folder)
        }
      >
        <FolderIcon size={42} />

        <span>{folder.name}</span>
      </button>

      <button
        className="icon-button"
        onClick={() =>
          onDelete(folder)
        }
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}