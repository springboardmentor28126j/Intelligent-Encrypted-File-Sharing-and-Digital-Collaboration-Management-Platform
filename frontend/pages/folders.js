import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import api from "../lib/api";

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const ACCENTS = ["#f5b942", "#6aa6ff", "#8ad4a0", "#e07b9b", "#b79cf0", "#5fc9c9"];

function accentFor(id) {
  const s = String(id);
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

function extOf(filename) {
  if (!filename || !filename.includes(".")) return "FILE";
  return filename.split(".").pop().slice(0, 4).toUpperCase();
}

export default function Folders() {
  const router = useRouter();

  const [folders, setFolders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [openFolder, setOpenFolder] = useState(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [sort, setSort] = useState("newest");
  const [query, setQuery] = useState("");

  const handleAuthError = (err) => {
    if (err && err.response && err.response.status === 401) {
      localStorage.removeItem("token");
      router.push("/");
      return true;
    }
    return false;
  };

  const loadFolders = () =>
    api
      .get("/folders")
      .then((res) => setFolders(res.data))
      .catch((err) => {
        if (!handleAuthError(err)) setError("Could not load your folders. Refresh to try again.");
      })
      .finally(() => setLoaded(true));

  useEffect(() => {
    loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createFolder = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;
    setError("");
    setCreating(true);
    api
      .post("/folders", { name })
      .then(() => {
        setNewName("");
        return loadFolders();
      })
      .catch((err) => {
        if (!handleAuthError(err)) {
          setError(
            (err.response && err.response.data && err.response.data.detail) ||
            "Could not create the folder. Try again."
          );
        }
      })
      .finally(() => setCreating(false));
  };

  const openFolderView = (folder) => {
    setOpenFolder(folder);
    setFolderFiles([]);
    setFilesLoading(true);
    setError("");
    setConfirmDeleteId(null);
    api
      .get(`/folders/${folder.id}/files`)
      .then((res) => setFolderFiles(res.data))
      .catch((err) => {
        if (!handleAuthError(err)) setError("Could not load the files in this folder.");
      })
      .finally(() => setFilesLoading(false));
  };

  const deleteFolder = (folderId) => {
    setError("");
    setConfirmDeleteId(null);
    api
      .delete(`/folders/${folderId}`)
      .then(() => {
        if (openFolder && openFolder.id === folderId) setOpenFolder(null);
        return loadFolders();
      })
      .catch((err) =>
        setError(
          (err.response && err.response.data && err.response.data.detail) ||
          "Could not delete folder"
        )
      );
  };

  const downloadFile = async (file) => {
    try {
      const res = await api.get(`/files/${file.id}/download`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (!handleAuthError(err)) setError("Could not download that file.");
    }
  };

  const visibleFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = folders.filter((f) => !q || f.name.toLowerCase().includes(q));
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "files") sorted.sort((a, b) => (b.file_count || 0) - (a.file_count || 0));
    else sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return sorted;
  }, [folders, sort, query]);

  const totalFiles = folders.reduce((sum, f) => sum + (f.file_count || 0), 0);
  const showTools = folders.length > 3;

  const renderDelete = (folder) =>
    confirmDeleteId === folder.id ? (
      <div className="fl-confirm" role="group" aria-label={`Confirm deleting ${folder.name}`}>
        <span>Delete this folder?</span>
        <button type="button" className="fl-link fl-link-danger" onClick={() => deleteFolder(folder.id)}>
          Delete
        </button>
        <button type="button" className="fl-link" onClick={() => setConfirmDeleteId(null)}>
          Keep
        </button>
      </div>
    ) : (
      <button
        type="button"
        className="fl-link fl-link-quiet"
        onClick={() => setConfirmDeleteId(folder.id)}
        aria-label={`Delete folder ${folder.name}`}
      >
        Delete
      </button>
    );

  const renderFolderArt = (folder) => {
    const count = folder.file_count || 0;
    const sheets = Math.min(count, 3);
    return (
      <div className="fl-art" style={{ "--a": accentFor(folder.id) }} aria-hidden="true">
        <div className="fl-back" />
        {sheets >= 3 && <div className="fl-sheet fl-s3" />}
        {sheets >= 2 && <div className="fl-sheet fl-s2" />}
        {sheets >= 1 && <div className="fl-sheet fl-s1" />}
        <div className="fl-front" />
      </div>
    );
  };

  return (
    <Layout active="folders" eyebrow="Secure file sharing" title="Folders">
      {error && (
        <div className="fl-error" role="alert">
          {error}
        </div>
      )}

      {openFolder ? (
        <section aria-label={`Folder ${openFolder.name}`}>
          <button type="button" className="fl-back-btn" onClick={() => setOpenFolder(null)}>
            ← All folders
          </button>

          <div className="fl-open-head">
            <div className="fl-open-art">{renderFolderArt(openFolder)}</div>
            <div className="fl-open-info">
              <h2 className="fl-open-title">{openFolder.name}</h2>
              <p className="fl-muted">
                {filesLoading
                  ? "Loading files..."
                  : `${plural(folderFiles.length, "file")}, ${formatBytes(
                    folderFiles.reduce((s, f) => s + (f.size_bytes || 0), 0)
                  )} in total`}
              </p>
            </div>
            <div className="fl-open-actions">{renderDelete(openFolder)}</div>
          </div>

          {filesLoading ? (
            <div className="fl-list">
              {[0, 1, 2].map((i) => (
                <div key={i} className="fl-row fl-skel-row" />
              ))}
            </div>
          ) : folderFiles.length === 0 ? (
            <div className="fl-empty">
              <p className="fl-empty-title">No files in this folder yet</p>
              <p className="fl-muted">Files you move here will show up in this list.</p>
            </div>
          ) : (
            <ul className="fl-list">
              {folderFiles.map((f) => (
                <li key={f.id} className="fl-row">
                  <span className="fl-ext">{extOf(f.filename)}</span>
                  <span className="fl-file-name" title={f.filename}>
                    {f.filename}
                  </span>
                  <span className="fl-file-size">{formatBytes(f.size_bytes)}</span>
                  <button type="button" className="fl-btn-small" onClick={() => downloadFile(f)}>
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          <div className="fl-toolbar">
            <p className="fl-summary">
              {loaded
                ? folders.length === 0
                  ? "You have no folders yet"
                  : `${plural(folders.length, "folder")}, ${plural(totalFiles, "file")}`
                : "Loading your folders..."}
            </p>

            <form className="fl-create" onSubmit={createFolder}>
              <label htmlFor="fl-new-name" className="fl-sr">
                New folder name
              </label>
              <input
                id="fl-new-name"
                className="fl-input"
                type="text"
                placeholder="Name a new folder"
                value={newName}
                maxLength={100}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button type="submit" className="fl-btn" disabled={!newName.trim() || creating}>
                {creating ? "Creating..." : "Create folder"}
              </button>
            </form>
          </div>

          {showTools && (
            <div className="fl-tools">
              <input
                className="fl-input fl-search"
                type="search"
                placeholder="Search folders"
                aria-label="Search folders"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className="fl-input fl-select"
                aria-label="Sort folders"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="name">Name A to Z</option>
                <option value="files">Most files</option>
              </select>
            </div>
          )}

          {!loaded ? (
            <ul className="fl-grid" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="fl-card fl-skel-card" />
              ))}
            </ul>
          ) : folders.length === 0 ? (
            <div className="fl-empty">
              <div className="fl-empty-art">{renderFolderArt({ id: "empty", file_count: 0 })}</div>
              <p className="fl-empty-title">Create your first folder</p>
              <p className="fl-muted">Folders keep related files together. Type a name above to start.</p>
            </div>
          ) : visibleFolders.length === 0 ? (
            <div className="fl-empty">
              <p className="fl-empty-title">No folders match "{query}"</p>
              <button type="button" className="fl-link" onClick={() => setQuery("")}>
                Clear search
              </button>
            </div>
          ) : (
            <ul className="fl-grid">
              {visibleFolders.map((folder) => (
                <li key={folder.id} className="fl-card">
                  <button type="button" className="fl-open" onClick={() => openFolderView(folder)}>
                    {renderFolderArt(folder)}
                    <span className="fl-name" title={folder.name}>
                      {folder.name}
                    </span>
                    <span className="fl-meta">
                      {plural(folder.file_count || 0, "file")}, created {formatDate(folder.created_at)}
                    </span>
                  </button>
                  <div className="fl-card-actions">{renderDelete(folder)}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <style jsx global>{`
        .fl-sr {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
        }
        .fl-muted {
          color: var(--text-muted, #6b7280);
          font-size: 14px;
          margin: 0;
        }

        /* toolbar */
        .fl-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          margin-bottom: 20px;
        }
        .fl-summary {
          margin: 0;
          font-size: 15px;
          color: var(--text-muted, #6b7280);
        }
        .fl-create {
          display: flex;
          gap: 8px;
          flex: 1 1 340px;
          max-width: 520px;
        }
        .fl-tools {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .fl-input {
          font: inherit;
          font-size: 15px;
          padding: 10px 14px;
          border: 1px solid var(--border, #e3e6ec);
          border-radius: 10px;
          background: var(--card, #fff);
          color: var(--forest, #14213d);
          min-width: 0;
        }
        .fl-create .fl-input {
          flex: 1;
        }
        .fl-search {
          flex: 1 1 220px;
        }
        .fl-input::placeholder {
          color: var(--text-muted, #6b7280);
        }
        .fl-input:focus-visible,
        .fl-btn:focus-visible,
        .fl-btn-small:focus-visible,
        .fl-open:focus-visible,
        .fl-link:focus-visible,
        .fl-back-btn:focus-visible {
          outline: 2px solid var(--forest, #14213d);
          outline-offset: 2px;
        }
        .fl-btn {
          font: inherit;
          font-size: 15px;
          font-weight: 600;
          padding: 10px 18px;
          border: 0;
          border-radius: 10px;
          background: var(--forest, #14213d);
          color: #fff;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.15s;
        }
        .fl-btn:hover:not(:disabled) {
          opacity: 0.88;
        }
        .fl-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .fl-btn-small {
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid var(--border, #e3e6ec);
          background: var(--card, #fff);
          color: var(--forest, #14213d);
          cursor: pointer;
        }
        .fl-btn-small:hover {
          border-color: var(--forest, #14213d);
        }

        /* error */
        .fl-error {
          margin-bottom: 16px;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
          color: var(--danger, #b42318);
          background: var(--danger-bg, #fdecea);
          border: 1px solid var(--danger, #b42318);
        }

        /* grid + cards */
        .fl-grid {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 18px;
        }
        .fl-card {
          display: flex;
          flex-direction: column;
          background: var(--card, #fff);
          border: 1px solid var(--border, #e3e6ec);
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .fl-card:hover,
        .fl-card:focus-within {
          border-color: #c8cdd8;
          box-shadow: 0 6px 18px rgba(20, 33, 61, 0.08);
        }
        .fl-open {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          text-align: left;
          width: 100%;
          padding: 22px 20px 12px;
          border: 0;
          background: transparent;
          font: inherit;
          color: inherit;
          cursor: pointer;
        }
        .fl-name {
          font-size: 17px;
          font-weight: 700;
          color: var(--forest, #14213d);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fl-meta {
          margin-top: 4px;
          font-size: 13px;
          color: var(--text-muted, #6b7280);
        }
        .fl-card-actions {
          display: flex;
          justify-content: flex-end;
          padding: 4px 16px 12px;
          min-height: 34px;
        }

        /* the folder drawing */
        .fl-art {
          position: relative;
          height: 104px;
          margin-bottom: 16px;
        }
        .fl-back {
          position: absolute;
          left: 0;
          right: 0;
          top: 10px;
          bottom: 0;
          border-radius: 4px 12px 12px 12px;
          background: color-mix(in srgb, var(--a) 70%, #000);
        }
        .fl-back::before {
          content: "";
          position: absolute;
          left: 0;
          top: -10px;
          width: 42%;
          height: 12px;
          border-radius: 8px 8px 0 0;
          background: inherit;
        }
        .fl-sheet {
          position: absolute;
          left: 14px;
          right: 14px;
          top: 20px;
          height: 70px;
          border-radius: 6px;
          border: 1px solid rgba(20, 33, 61, 0.1);
          background: #fff
            repeating-linear-gradient(to bottom, transparent 0 11px, #e8ebf1 11px 12px);
          background-position: 0 14px;
          transition: transform 0.22s ease;
        }
        .fl-s1 {
          transform: rotate(-1.2deg);
        }
        .fl-s2 {
          transform: translateY(-7px) rotate(1.4deg);
        }
        .fl-s3 {
          transform: translateY(-14px) rotate(-0.4deg);
        }
        .fl-front {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 60px;
          border-radius: 10px 12px 12px 12px;
          background: var(--a);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
          transition: transform 0.22s ease;
        }
        .fl-open:hover .fl-front,
        .fl-open:focus-visible .fl-front {
          transform: translateY(4px);
        }
        .fl-open:hover .fl-s1,
        .fl-open:focus-visible .fl-s1 {
          transform: translateY(-8px) rotate(-1.2deg);
        }
        .fl-open:hover .fl-s2,
        .fl-open:focus-visible .fl-s2 {
          transform: translateY(-16px) rotate(1.4deg);
        }
        .fl-open:hover .fl-s3,
        .fl-open:focus-visible .fl-s3 {
          transform: translateY(-24px) rotate(-0.4deg);
        }

        /* delete controls */
        .fl-link {
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          padding: 4px 6px;
          border: 0;
          background: transparent;
          color: var(--forest, #14213d);
          cursor: pointer;
          border-radius: 6px;
        }
        .fl-link:hover {
          text-decoration: underline;
        }
        .fl-link-quiet {
          color: var(--text-muted, #6b7280);
          font-weight: 500;
        }
        .fl-link-quiet:hover,
        .fl-link-danger {
          color: var(--danger, #b42318);
        }
        .fl-confirm {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--forest, #14213d);
        }

        /* open folder view */
        .fl-back-btn {
          font: inherit;
          font-size: 14px;
          font-weight: 600;
          padding: 6px 4px;
          border: 0;
          background: transparent;
          color: var(--forest, #14213d);
          cursor: pointer;
          margin-bottom: 14px;
        }
        .fl-back-btn:hover {
          text-decoration: underline;
        }
        .fl-open-head {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          padding: 20px;
          margin-bottom: 18px;
          background: var(--card, #fff);
          border: 1px solid var(--border, #e3e6ec);
          border-radius: 14px;
        }
        .fl-open-art {
          width: 120px;
          flex: none;
        }
        .fl-open-art .fl-art {
          margin-bottom: 0;
        }
        .fl-open-info {
          flex: 1 1 200px;
          min-width: 0;
        }
        .fl-open-title {
          margin: 0 0 4px;
          font-size: 22px;
          color: var(--forest, #14213d);
          overflow-wrap: anywhere;
        }
        .fl-list {
          list-style: none;
          margin: 0;
          padding: 0;
          background: var(--card, #fff);
          border: 1px solid var(--border, #e3e6ec);
          border-radius: 14px;
          overflow: hidden;
        }
        .fl-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          border-top: 1px solid var(--border, #e3e6ec);
        }
        .fl-row:first-child {
          border-top: 0;
        }
        .fl-ext {
          flex: none;
          width: 44px;
          padding: 6px 0;
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          border-radius: 8px;
          color: var(--forest, #14213d);
          background: #eef1f6;
        }
        .fl-file-name {
          flex: 1;
          min-width: 0;
          font-size: 15px;
          color: var(--forest, #14213d);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fl-file-size {
          flex: none;
          font-size: 13px;
          color: var(--text-muted, #6b7280);
        }

        /* empty + loading */
        .fl-empty {
          text-align: center;
          padding: 48px 20px;
          background: var(--card, #fff);
          border: 1px dashed #c8cdd8;
          border-radius: 14px;
        }
        .fl-empty-art {
          width: 140px;
          margin: 0 auto 20px;
        }
        .fl-empty-title {
          margin: 0 0 6px;
          font-size: 18px;
          font-weight: 700;
          color: var(--forest, #14213d);
        }
        .fl-skel-card {
          height: 218px;
          border-radius: 14px;
          background: linear-gradient(90deg, #eef1f6 25%, #f6f8fb 50%, #eef1f6 75%);
          background-size: 200% 100%;
          animation: fl-shimmer 1.4s linear infinite;
        }
        .fl-skel-row {
          height: 56px;
          background: linear-gradient(90deg, #eef1f6 25%, #f6f8fb 50%, #eef1f6 75%);
          background-size: 200% 100%;
          animation: fl-shimmer 1.4s linear infinite;
        }
        @keyframes fl-shimmer {
          from {
            background-position: 200% 0;
          }
          to {
            background-position: -200% 0;
          }
        }

        @media (max-width: 560px) {
          .fl-create {
            flex-basis: 100%;
            max-width: none;
          }
          .fl-grid {
            grid-template-columns: 1fr;
          }
          .fl-open-head {
            padding: 16px;
          }
          .fl-file-size {
            display: none;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .fl-sheet,
          .fl-front,
          .fl-card,
          .fl-btn {
            transition: none;
          }
          .fl-open:hover .fl-front,
          .fl-open:hover .fl-s1,
          .fl-open:hover .fl-s2,
          .fl-open:hover .fl-s3 {
            transform: none;
          }
          .fl-skel-card,
          .fl-skel-row {
            animation: none;
          }
        }
      `}</style>
    </Layout>
  );
}