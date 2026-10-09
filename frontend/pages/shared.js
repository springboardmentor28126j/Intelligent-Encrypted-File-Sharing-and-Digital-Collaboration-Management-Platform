import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";

function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export default function SharedWithMe() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [openMenuId, setOpenMenuId] = useState(null);
    const [banner, setBanner] = useState({ type: "", message: "" });

    const loadShared = () => {
        setLoading(true);
        api
            .get("/files/shared-with-me")
            .then((res) => setFiles(res.data))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadShared();
    }, []);

    const showBanner = (type, message) => {
        setBanner({ type, message });
        setTimeout(() => setBanner({ type: "", message: "" }), 3000);
    };

    const visibleFiles = useMemo(() => {
        return files.filter((f) => f.filename.toLowerCase().includes(search.toLowerCase()));
    }, [files, search]);

    const handleDownload = async (id, filename) => {
        try {
            const res = await api.get(`/files/${id}/download`, { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            showBanner("error", err.response?.data?.detail || "Could not download file");
        }
        setOpenMenuId(null);
    };

    const handlePreview = async (id) => {
        try {
            const res = await api.get(`/files/${id}/preview`, { responseType: "blob" });
            const url = window.URL.createObjectURL(res.data);
            window.open(url, "_blank");
        } catch (err) {
            showBanner("error", err.response?.data?.detail || "Could not preview file");
        }
        setOpenMenuId(null);
    };

    const handleRename = async (id, currentName) => {
        setOpenMenuId(null);
        const newName = window.prompt("Rename file to:", currentName);
        if (!newName || newName.trim() === "" || newName === currentName) return;
        try {
            await api.patch(`/files/${id}/rename`, { filename: newName.trim() });
            showBanner("success", "File renamed successfully.");
            loadShared();
        } catch (err) {
            showBanner("error", err.response?.data?.detail || "Could not rename file");
        }
    };

    return (
        <Layout active="shared" eyebrow="Secure file sharing" title="Shared with me">
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
            </div>

            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 8 }}>
                {loading && <div style={{ padding: 16, color: "var(--text-muted)" }}>Loading shared files...</div>}
                {!loading && visibleFiles.length === 0 && (
                    <div style={{ padding: 24, color: "var(--text-muted)", textAlign: "center" }}>
                        {files.length === 0
                            ? "Nothing's been shared with you yet. Files someone shares with your email will show up here."
                            : "No files match your search."}
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
                                Shared by {f.owner_email} · {formatBytes(f.size_bytes)} · {new Date(f.uploaded_at).toLocaleDateString()}
                            </div>
                        </div>

                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: 0.4,
                                padding: "4px 10px",
                                borderRadius: 999,
                                background: f.permission === "write" ? "var(--lime)" : "#eef1f6",
                                color: f.permission === "write" ? "var(--forest)" : "var(--text-muted)",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {f.permission === "write" ? "Can edit" : "Read only"}
                        </span>

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
                                    ...(f.permission === "write"
                                        ? [{ label: "Rename", action: () => handleRename(f.id, f.filename) }]
                                        : []),
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
                                            color: "var(--text)",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Layout>
    );
}