import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import ShareModal from "../components/ShareModal";
import api from "../lib/api";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

const CATEGORY_MAP = {
  jpg: "Images", jpeg: "Images", png: "Images", gif: "Images", webp: "Images", svg: "Images",
  mp4: "Videos", mov: "Videos", avi: "Videos", mkv: "Videos", webm: "Videos",
  pdf: "Documents", doc: "Documents", docx: "Documents", txt: "Documents",
  xls: "Documents", xlsx: "Documents", ppt: "Documents", pptx: "Documents",
};

function categoryFor(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  return CATEGORY_MAP[ext] || "Other";
}

export default function Files() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [moveMenuId, setMoveMenuId] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [banner, setBanner] = useState({ type: "", message: "" });

  const loadFiles = () => {
    api
      .get("/files")
      .then((res) => setFiles(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFiles();
    api.get("/folders").then((res) => setFolders(res.data));
  }, []);

  const showBanner = (type, message) => {
    setBanner({ type, message });
    setTimeout(() => setBanner({ type: "", message: "" }), 3000);
  };

  const categories = useMemo(() => {
    const set = new Set(files.map((f) => categoryFor(f.filename)));
    return ["All categories", ...Array.from(set)];
  }, [files]);

  const visibleFiles = useMemo(() => {
    return files.filter((f) => {
      const matchesSearch = f.filename.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "All categories" || categoryFor(f.filename) === category;
      return matchesSearch && matchesCategory;
    });
  }, [files, search, category]);

  const handleDownload = async (id, filename) => {
    const res = await api.get(`/files/${id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setOpenMenuId(null);
  };

  const handlePreview = async (id) => {
    const res = await api.get(`/files/${id}/preview`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    window.open(url, "_blank");
    setOpenMenuId(null);
  };

  const handleRename = async (id, currentName) => {
    setOpenMenuId(null);
    const newName = window.prompt("Rename file to:", currentName);
    if (!newName || newName.trim() === "" || newName === currentName) return;
    try {
      await api.patch(`/files/${id}/rename`, { filename: newName.trim() });
      showBanner("success", "File renamed successfully.");
      loadFiles();
    } catch (err) {
      showBanner("error", err.response?.data?.detail || "Could not rename file");
    }
  };

  const handleDelete = async (id, filename) => {
    setOpenMenuId(null);
    if (!window.confirm(`Delete "${filename}"? This can't be undone.`)) return;
    try {
      await api.delete(`/files/${id}`);
      showBanner("success", "File deleted successfully.");
      loadFiles();
    } catch (err) {
      showBanner("error", err.response?.data?.detail || "Could not delete file");
    }
  };

  const handleMove = async (id, folderId, folderName) => {
    setMoveMenuId(null);
    setOpenMenuId(null);
    try {
      await api.patch(`/files/${id}/move`, { folder_id: folderId });
      showBanner("success", folderId ? `Moved to "${folderName}".` : "Removed from folder.");
      loadFiles();
    } catch (err) {
      showBanner("error", err.response?.data?.detail || "Could not move file");
    }
  };

  return (
    <Layout
      active="files"
      eyebrow="Secure file sharing"
      title="My files"
      action={
        <a
          href="/upload"
          style={{
            background: "var(--lime)",
            color: "var(--forest)",
            padding: "10px 18px",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          + Upload file
        </a>
      }
    >
      {banner.message && (
        <div
          style={{
            background: banner.type === "error" ? "var(--danger-bg)" : "#e8f3e6",
            color: banner.type === "error" ? "var(--danger)" : "#2e7d32",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {banner.message}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by filename..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 13,
          }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "#fff" }}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 8 }}>
        {loading && <div style={{ padding: 16, color: "var(--text-muted)" }}>Loading files...</div>}
        {!loading && visibleFiles.length === 0 && (
          <div style={{ padding: 24, color: "var(--text-muted)", textAlign: "center" }}>
            {files.length === 0 ? "No files yet. Upload your first file to get started." : "No files match your search."}
          </div>
        )}
        {visibleFiles.map((f, idx) => (
          <div
            key={f.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 12px",
              borderTop: idx === 0 ? "none" : "1px solid var(--border)",
              position: "relative",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "var(--lime)",
                color: "var(--forest)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {f.filename.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{f.filename}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {categoryFor(f.filename)} · {formatBytes(f.size_bytes)} · {new Date(f.uploaded_at).toLocaleDateString()}
              </div>
            </div>

            <button
              onClick={() => setOpenMenuId(openMenuId === f.id ? null : f.id)}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 8,
                width: 32,
                height: 32,
                fontSize: 16,
                lineHeight: "1",
                cursor: "pointer",
              }}
            >
              ⋮
            </button>

            {openMenuId === f.id && (
              <div
                style={{
                  position: "absolute",
                  right: 12,
                  top: 48,
                  background: "#fff",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(16,36,62,0.15)",
                  zIndex: 10,
                  minWidth: 160,
                  overflow: "hidden",
                }}
              >
                {[
                  { label: "Open / Preview", action: () => handlePreview(f.id) },
                  { label: "Download", action: () => handleDownload(f.id, f.filename) },
                  { label: "Share", action: () => { setShareTarget(f); setOpenMenuId(null); } },
                  { label: "Rename", action: () => handleRename(f.id, f.filename) },
                  {
                    label: "Move to folder",
                    action: () => setMoveMenuId(moveMenuId === f.id ? null : f.id),
                  },
                  { label: "Delete", action: () => handleDelete(f.id, f.filename), danger: true },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      background: "none",
                      border: "none",
                      fontSize: 13,
                      color: item.danger ? "var(--danger)" : "var(--text)",
                      cursor: "pointer",
                    }}
                  >
                    {item.label}
                  </button>
                ))}

                {moveMenuId === f.id && (
                  <div style={{ borderTop: "1px solid var(--border)", maxHeight: 160, overflowY: "auto" }}>
                    {folders.length === 0 && (
                      <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-muted)" }}>
                        No folders yet — create one on the Folders page.
                      </div>
                    )}
                    {f.folder_id && (
                      <button
                        onClick={() => handleMove(f.id, null, null)}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
                      >
                        Remove from folder
                      </button>
                    )}
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => handleMove(f.id, folder.id, folder.name)}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", fontSize: 12, color: "var(--text)", cursor: "pointer" }}
                      >
                        📁 {folder.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {shareTarget && <ShareModal file={shareTarget} onClose={() => setShareTarget(null)} />}
    </Layout>
  );
}
