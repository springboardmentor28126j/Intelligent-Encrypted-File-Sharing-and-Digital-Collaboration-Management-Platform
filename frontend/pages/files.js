import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export default function Files() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFiles = () => {
    api
      .get("/files")
      .then((res) => setFiles(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(loadFiles, []);

  const handleDownload = async (id, filename) => {
    const res = await api.get(`/files/${id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
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
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 8 }}>
        {loading && <div style={{ padding: 16, color: "var(--text-muted)" }}>Loading files...</div>}
        {!loading && files.length === 0 && (
          <div style={{ padding: 24, color: "var(--text-muted)", textAlign: "center" }}>
            No files yet. Upload your first file to get started.
          </div>
        )}
        {files.map((f, idx) => (
          <div
            key={f.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 12px",
              borderTop: idx === 0 ? "none" : "1px solid var(--border)",
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
                {formatBytes(f.size_bytes)} · {new Date(f.uploaded_at).toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => handleDownload(f.id, f.filename)}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
              }}
            >
              Download
            </button>
          </div>
        ))}
      </div>
    </Layout>
  );
}
