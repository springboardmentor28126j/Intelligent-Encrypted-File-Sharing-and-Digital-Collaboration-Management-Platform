import { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import api from "../lib/api";

export default function Upload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Choose a file first");
      return;
    }
    setError("");
    setStatus("Uploading...");
    const formData = new FormData();
    formData.append("upload", selectedFile);
    try {
      await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStatus("Uploaded. Redirecting to your files...");
      setTimeout(() => router.push("/files"), 800);
    } catch (err) {
      setStatus("");
      setError(err.response?.data?.detail || "Upload failed");
    }
  };

  return (
    <Layout active="upload" eyebrow="Secure file sharing" title="Upload file">
      <form
        onSubmit={handleUpload}
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 32,
          maxWidth: 480,
        }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "2px dashed var(--border)",
            borderRadius: 12,
            padding: "32px 16px",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {selectedFile ? selectedFile.name : "Choose a file"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : "Click to browse"}
          </div>
          <input
            type="file"
            onChange={(e) => setSelectedFile(e.target.files[0])}
            style={{ display: "none" }}
          />
        </label>

        {error && <p style={{ color: "var(--danger)", fontSize: 14, marginTop: 12 }}>{error}</p>}
        {status && <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 12 }}>{status}</p>}

        <button
          type="submit"
          style={{
            width: "100%",
            marginTop: 20,
            padding: "12px 0",
            background: "var(--forest)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Upload
        </button>
      </form>
    </Layout>
  );
}
