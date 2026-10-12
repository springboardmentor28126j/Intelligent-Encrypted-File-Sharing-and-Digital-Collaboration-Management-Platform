import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const ACCENTS = ["#f5b942", "#6aa6ff", "#8ad4a0", "#e07b9b", "#b79cf0", "#5fc9c9"];

function accentFor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

function FolderIcon({ color, size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6.5C3 5.67 3.67 5 4.5 5h4.3c.33 0 .64.13.88.37L11 6.6c.24.24.55.37.88.37H19.5c.83 0 1.5.67 1.5 1.5v9.03c0 .83-.67 1.5-1.5 1.5h-15C3.67 19 3 18.33 3 17.5v-11z"
        fill={color}
      />
    </svg>
  );
}

export default function Folders() {
  const [folders, setFolders] = useState([]);
  const [newName, setNewName] = useState("");
  const [openFolder, setOpenFolder] = useState(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [error, setError] = useState("");
  const [hoveredId, setHoveredId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const loadFolders = () => {
    api.get("/folders").then((res) => setFolders(res.data));
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const createFolder = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    api.post("/folders", { name: newName.trim() }).then(() => {
      setNewName("");
      loadFolders();
    });
  };

  const openFolderView = (folder) => {
    setOpenFolder(folder);
    setError("");
    api.get(`/folders/${folder.id}/files`).then((res) => setFolderFiles(res.data));
  };

  const deleteFolder = (folderId) => {
    setError("");
    setConfirmDeleteId(null);
    api
      .delete(`/folders/${folderId}`)
      .then(() => {
        loadFolders();
        if (openFolder && openFolder.id === folderId) setOpenFolder(null);
      })
      .catch((err) => setError((err.response && err.response.data && err.response.data.detail) || "Could not delete folder"));
  };

  if (openFolder) {
    const accent = accentFor(openFolder.id);
    return (
      <Layout active="folders" eyebrow="Secure file sharing" title={openFolder.name}>
        <button
          onClick={() => setOpenFolder(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            color: "var(--lime-dark)",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 18,
            padding: 0,
          }}
        >
          ← Back to folders
        </button>

        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          {folderFiles.length === 0 && (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ marginBottom: 10, opacity: 0.6 }}>
                <FolderIcon color={accent} size={40} />
              </div>
              This folder is empty. Move files here from the My files page.
            </div>
          )}
          {folderFiles.map((f, idx) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                justifyContent: "space-between",
                padding: "14px 18px",
                borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                fontSize: 14,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: accent,
                    flexShrink: 0,
                  }}
                />
                {f.filename}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{formatBytes(f.size_bytes)}</span>
            </div>
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout active="folders" eyebrow="Secure file sharing" title="Folders">
      <form onSubmit={createFolder} style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New folder name"
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            fontSize: 14,
            background: "var(--card)",
          }}
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          style={{
            padding: "12px 22px",
            borderRadius: 10,
            border: "none",
            background: newName.trim() ? "var(--lime)" : "#eef1f6",
            color: newName.trim() ? "var(--forest)" : "var(--text-muted)",
            fontWeight: 700,
            fontSize: 14,
            whiteSpace: "nowrap",
            cursor: newName.trim() ? "pointer" : "default",
          }}
        >
          + Create folder
        </button>
      </form>

      {error && (
        <div style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {folders.length === 0 && (
        <div
          style={{
            background: "var(--card)",
            border: "1.5px dashed var(--border)",
            borderRadius: 14,
            padding: 48,
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ marginBottom: 10, opacity: 0.5 }}>
            <FolderIcon color="#94a3b8" size={36} />
          </div>
          No folders yet — create one above to start organizing your files.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {folders.map((f) => {
          const accent = accentFor(f.id);
          const isHovered = hoveredId === f.id;
          return (
            <div
              key={f.id}
              onMouseEnter={() => setHoveredId(f.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 20,
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                transform: isHovered ? "translateY(-2px)" : "none",
                boxShadow: isHovered ? "0 10px 24px rgba(16,36,62,0.1)" : "none",
                position: "relative",
              }}
            >
              <div onClick={() => openFolderView(f)} style={{ cursor: "pointer" }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: `${accent}22`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 14,
                  }}
                >
                  <FolderIcon color={accent} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {f.file_count} file{f.file_count === 1 ? "" : "s"} · {formatDate(f.created_at)}
                </div>
              </div>

              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                {confirmDeleteId === f.id ? (
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Delete folder?</span>
                    <button
                      onClick={() => deleteFolder(f.id)}
                      style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, fontWeight: 700, padding: 0 }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, padding: 0 }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(f.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: isHovered ? "var(--danger)" : "var(--text-muted)",
                      fontSize: 12,
                      padding: 0,
                      transition: "color 0.15s ease",
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}