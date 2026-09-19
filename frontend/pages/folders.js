import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function Folders() {
  const [folders, setFolders] = useState([]);
  const [newName, setNewName] = useState("");
  const [openFolder, setOpenFolder] = useState(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [error, setError] = useState("");

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
    api
      .delete(`/folders/${folderId}`)
      .then(() => {
        loadFolders();
        if (openFolder && openFolder.id === folderId) setOpenFolder(null);
      })
      .catch((err) => setError((err.response && err.response.data && err.response.data.detail) || "Could not delete folder"));
  };

  if (openFolder) {
    return (
      <Layout active="folders" eyebrow="Secure file sharing" title={openFolder.name}>
        <button
          onClick={() => setOpenFolder(null)}
          style={{ background: "transparent", border: "none", color: "var(--lime-dark)", fontSize: 13, marginBottom: 16, padding: 0 }}
        >
          ← Back to folders
        </button>

        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 8 }}>
          {folderFiles.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              This folder is empty. Move files here from the My files page.
            </div>
          )}
          {folderFiles.map((f, idx) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "14px 12px",
                borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                fontSize: 14,
              }}
            >
              <span>{f.filename}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{formatBytes(f.size_bytes)}</span>
            </div>
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout active="folders" eyebrow="Secure file sharing" title="Folders">
      <form onSubmit={createFolder} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New folder name"
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: "var(--lime)",
            color: "var(--forest)",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Create folder
        </button>
      </form>

      {error && (
        <div style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {folders.length === 0 && (
        <div style={{ background: "var(--card)", border: "1px dashed var(--border)", borderRadius: 12, padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          No folders yet — create one above to start organizing your files.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {folders.map((f) => (
          <div
            key={f.id}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 18,
            }}
          >
            <div onClick={() => openFolderView(f)} style={{ cursor: "pointer" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{f.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{f.file_count} file{f.file_count === 1 ? "" : "s"}</div>
            </div>
            <button
              onClick={() => deleteFolder(f.id)}
              style={{
                marginTop: 12,
                background: "transparent",
                border: "none",
                color: "var(--danger)",
                fontSize: 12,
                padding: 0,
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </Layout>
  );
}
