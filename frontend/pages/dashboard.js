import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import api from "../lib/api";

export default function Dashboard() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState("");
  const router = useRouter();

  const loadFiles = async () => {
    try {
      const res = await api.get("/files");
      setFiles(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        router.push("/");
      }
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("token")) {
      router.push("/");
      return;
    }
    loadFiles();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    setError("");
    const formData = new FormData();
    formData.append("upload", selectedFile);
    try {
      await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSelectedFile(null);
      loadFiles();
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed");
    }
  };

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

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/");
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>My Files</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <form onSubmit={handleUpload} style={{ margin: "20px 0" }}>
        <input type="file" onChange={(e) => setSelectedFile(e.target.files[0])} />
        <button type="submit" style={{ marginLeft: 8 }}>
          Upload
        </button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <table width="100%" cellPadding="6" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Filename</th>
            <th>Size (bytes)</th>
            <th>Uploaded</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{f.filename}</td>
              <td>{f.size_bytes}</td>
              <td>{new Date(f.uploaded_at).toLocaleString()}</td>
              <td>
                <button onClick={() => handleDownload(f.id, f.filename)}>Download</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
