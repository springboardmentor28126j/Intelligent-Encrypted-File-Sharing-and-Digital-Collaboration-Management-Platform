import { useEffect, useState } from "react";
import api from "../lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DURATION_OPTIONS = [
  { label: "1 hour", seconds: 60 * 60 },
  { label: "24 hours", seconds: 24 * 60 * 60 },
  { label: "7 days", seconds: 7 * 24 * 60 * 60 },
];

function formatExpiry(expiresInSeconds) {
  if (!expiresInSeconds || expiresInSeconds <= 0) return "Expired";
  const target = new Date(Date.now() + expiresInSeconds * 1000);
  return target.toLocaleString();
}

export default function ShareModal({ file, onClose }) {
  const [email, setEmail] = useState("");
  const [emailPermission, setEmailPermission] = useState("read");
  const [people, setPeople] = useState([]);

  const [linkPermission, setLinkPermission] = useState("read");
  const [linkDuration, setLinkDuration] = useState(DURATION_OPTIONS[1].seconds);
  const [links, setLinks] = useState([]);

  const [error, setError] = useState("");
  const [copiedToken, setCopiedToken] = useState(null);

  const loadPeople = () => {
    api.get(`/files/${file.id}/shares`).then((res) => setPeople(res.data));
  };
  const loadLinks = () => {
    api.get(`/files/${file.id}/share-links`).then((res) => setLinks(res.data));
  };

  useEffect(() => {
    loadPeople();
    loadLinks();
  }, [file.id]);

  const handleShareWithUser = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post(`/files/${file.id}/shares`, { email, permission: emailPermission });
      setEmail("");
      loadPeople();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not share with that user");
    }
  };

  const handleRevokePerson = async (shareId) => {
    await api.delete(`/files/shares/${shareId}`);
    loadPeople();
  };

  const handleGenerateLink = async () => {
    setError("");
    try {
      await api.post(`/files/${file.id}/share`, {
        permission: linkPermission,
        expires_in_seconds: linkDuration,
      });
      loadLinks();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not generate share link");
    }
  };

  const handleRevokeLink = async (token) => {
    await api.delete(`/files/${file.id}/share-links/${token}`);
    loadLinks();
  };

  const handleCopyLink = (token) => {
    const url = `${BACKEND_URL}/share/${token}/download`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 1500);
  };

  const selectStyle = {
    padding: "10px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    fontSize: 13,
    background: "#fff",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(16, 36, 62, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card)",
          borderRadius: 14,
          padding: 28,
          width: 460,
          maxWidth: "90vw",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Share file</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{file.filename}</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: 14,
              background: "var(--danger-bg)",
              color: "var(--danger)",
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Share with a specific user */}
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Share with user</div>
          <form onSubmit={handleShareWithUser} style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}
            />
            <select value={emailPermission} onChange={(e) => setEmailPermission(e.target.value)} style={selectStyle}>
              <option value="read">Read</option>
              <option value="write">Write</option>
            </select>
            <button
              type="submit"
              style={{
                background: "var(--forest)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Share
            </button>
          </form>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>People with access</div>
          {people.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No users have access.</div>
          )}
          {people.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderTop: "1px solid var(--border)",
                fontSize: 13,
              }}
            >
              <div>
                <div>{p.email}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 12, textTransform: "capitalize" }}>
                  {p.permission}
                </div>
              </div>
              <button
                onClick={() => handleRevokePerson(p.id)}
                style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer" }}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>

        {/* Expiring share link */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Expiring share link</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={linkPermission} onChange={(e) => setLinkPermission(e.target.value)} style={selectStyle}>
              <option value="read">Read</option>
              <option value="write">Write</option>
            </select>
            <select
              value={linkDuration}
              onChange={(e) => setLinkDuration(Number(e.target.value))}
              style={selectStyle}
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.seconds} value={opt.seconds}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleGenerateLink}
              style={{
                background: "var(--lime)",
                color: "var(--forest)",
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              Generate
            </button>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Active links</div>
          {links.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No active share links.</div>
          )}
          {links.map((link) => (
            <div
              key={link.token}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ fontWeight: 600, textTransform: "uppercase" }}>Permission: {link.permission}</span>
                  <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
                    Expires: {formatExpiry(link.expires_in_seconds)}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeLink(link.token)}
                  style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer" }}
                >
                  Revoke
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <span
                  style={{
                    flex: 1,
                    fontSize: 11,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    background: "var(--bg)",
                    padding: "4px 8px",
                    borderRadius: 6,
                  }}
                >
                  {`${BACKEND_URL}/share/${link.token}/download`}
                </span>
                <button
                  onClick={() => handleCopyLink(link.token)}
                  style={{
                    background: "var(--forest)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    whiteSpace: "nowrap",
                  }}
                >
                  {copiedToken === link.token ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
