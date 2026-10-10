import { useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const selectFile = (selectedFile) => {
    if (!selectedFile) return;

    setMessage("");
    setError("");

    if (selectedFile.size > 50 * 1024 * 1024) {
      setFile(null);
      setError("File size must be less than 50 MB.");
      return;
    }

    setFile(selectedFile);
  };

  const handleFileChange = (e) => {
    selectFile(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    selectFile(droppedFile);
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a file first.");
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      setError("You are not logged in. Please login again.");
      navigate("/login");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      setError("");
      setMessage("");

      const response = await axios.post(
        `${API_URL}/files/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage(response.data.message || "File uploaded successfully!");
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

    } catch (err) {
      console.error(err);

      if (err.response) {
        setError(
          err.response.data?.detail ||
            "Upload failed."
        );
      } else {
        setError(
          "Cannot connect to the TrustShare backend."
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setMessage("");
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="ts-upload-page">

      <style>{`
        * {
          box-sizing: border-box;
        }

        .ts-upload-page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 10% 10%,
              rgba(99,102,241,0.14),
              transparent 28%
            ),
            radial-gradient(
              circle at 90% 90%,
              rgba(124,58,237,0.12),
              transparent 28%
            ),
            #f8fafc;
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          color: #172033;
          padding: 30px;
        }

        .ts-upload-wrapper {
          width: 100%;
          max-width: 1050px;
          margin: 0 auto;
        }

        /* TOP BAR */

        .ts-upload-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
        }

        .ts-back-button {
          border: 0;
          background: white;
          border: 1px solid #e2e8f0;
          color: #475569;
          padding: 10px 15px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 650;
          transition: 0.2s ease;
        }

        .ts-back-button:hover {
          transform: translateX(-2px);
          border-color: #c7d2fe;
          color: #4f46e5;
        }

        .ts-upload-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ts-upload-logo {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          background:
            linear-gradient(
              135deg,
              #4f46e5,
              #7c3aed
            );
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 18px;
          box-shadow:
            0 8px 20px rgba(79,70,229,0.2);
        }

        .ts-upload-brand-name {
          font-size: 17px;
          font-weight: 750;
        }

        .ts-upload-brand-subtitle {
          color: #94a3b8;
          font-size: 8px;
          letter-spacing: 1.1px;
          margin-top: 1px;
        }

        /* MAIN GRID */

        .ts-upload-grid {
          display: grid;
          grid-template-columns: 1.45fr 0.75fr;
          gap: 20px;
        }

        .ts-upload-card {
          background: rgba(255,255,255,0.92);
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 30px;
          box-shadow:
            0 18px 45px rgba(15,23,42,0.06);
        }

        /* HEADER */

        .ts-upload-header {
          display: flex;
          align-items: flex-start;
          gap: 15px;
          margin-bottom: 25px;
        }

        .ts-upload-header-icon {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          background: #eef2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .ts-upload-header h1 {
          margin: 0;
          font-size: 25px;
          letter-spacing: -0.8px;
        }

        .ts-upload-header p {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        /* DROP ZONE */

        .ts-drop-zone {
          min-height: 245px;
          border: 2px dashed #cbd5e1;
          border-radius: 17px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 25px;
          cursor: pointer;
          background: #fafbff;
          transition: 0.2s ease;
        }

        .ts-drop-zone:hover,
        .ts-drop-zone.dragging {
          border-color: #6366f1;
          background: #f5f3ff;
        }

        .ts-drop-icon {
          width: 65px;
          height: 65px;
          border-radius: 18px;
          background: white;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 29px;
          margin-bottom: 13px;
          box-shadow:
            0 8px 20px rgba(15,23,42,0.05);
        }

        .ts-drop-title {
          font-size: 14px;
          font-weight: 750;
          color: #334155;
        }

        .ts-drop-subtitle {
          margin-top: 6px;
          font-size: 11px;
          color: #94a3b8;
        }

        .ts-browse {
          margin-top: 13px;
          padding: 8px 14px;
          border-radius: 8px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 11px;
          font-weight: 700;
        }

        .ts-file-input {
          display: none;
        }

        /* SELECTED FILE */

        .ts-selected-file {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 16px;
          padding: 13px;
          border: 1px solid #dbeafe;
          border-radius: 12px;
          background: #f8fbff;
        }

        .ts-file-type {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: #eef2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .ts-file-details {
          flex: 1;
          min-width: 0;
        }

        .ts-file-name {
          font-size: 12px;
          font-weight: 700;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .ts-file-size {
          color: #64748b;
          font-size: 10px;
          margin-top: 3px;
        }

        .ts-remove {
          border: 0;
          background: #fef2f2;
          color: #dc2626;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
        }

        .ts-remove:hover {
          background: #fee2e2;
        }

        /* BUTTON */

        .ts-secure-upload {
          width: 100%;
          height: 51px;
          margin-top: 18px;
          border: 0;
          border-radius: 11px;
          background:
            linear-gradient(
              135deg,
              #4f46e5,
              #7c3aed
            );
          color: white;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          box-shadow:
            0 10px 22px rgba(79,70,229,0.20);
          transition: 0.2s ease;
        }

        .ts-secure-upload:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow:
            0 14px 28px rgba(79,70,229,0.28);
        }

        .ts-secure-upload:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        /* MESSAGES */

        .ts-upload-message {
          margin-top: 15px;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 11px;
          text-align: center;
        }

        .ts-success {
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #15803d;
        }

        .ts-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        /* SECURITY SIDE */

        .ts-security-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ts-security-title {
          font-size: 14px;
          font-weight: 750;
          margin-bottom: 4px;
        }

        .ts-security-description {
          color: #64748b;
          font-size: 11px;
          line-height: 1.6;
          margin-bottom: 6px;
        }

        .ts-security-item {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 13px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .ts-security-item-icon {
          width: 35px;
          height: 35px;
          border-radius: 9px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .ts-security-item-title {
          font-size: 11px;
          font-weight: 700;
        }

        .ts-security-item-text {
          color: #94a3b8;
          font-size: 9px;
          margin-top: 2px;
        }

        .ts-limit {
          margin-top: 4px;
          padding: 14px;
          border-radius: 12px;
          background: #eef2ff;
          border: 1px solid #e0e7ff;
        }

        .ts-limit-top {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          font-weight: 700;
          color: #4338ca;
        }

        .ts-limit-bar {
          height: 6px;
          border-radius: 10px;
          background: #ddd6fe;
          margin-top: 9px;
          overflow: hidden;
        }

        .ts-limit-fill {
          width: 35%;
          height: 100%;
          border-radius: 10px;
          background: #6366f1;
        }

        .ts-encryption-status {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #ecfdf5;
          color: #15803d;
          font-size: 10px;
          font-weight: 650;
        }

        .ts-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 10px rgba(34,197,94,0.6);
        }

        /* FOOTER */

        .ts-upload-footer {
          text-align: center;
          margin-top: 20px;
          color: #94a3b8;
          font-size: 9px;
        }

        @media (max-width: 850px) {

          .ts-upload-page {
            padding: 20px;
          }

          .ts-upload-grid {
            grid-template-columns: 1fr;
          }

          .ts-security-panel {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
          }

          .ts-security-title,
          .ts-security-description,
          .ts-limit,
          .ts-encryption-status {
            grid-column: 1 / -1;
          }

        }

        @media (max-width: 550px) {

          .ts-upload-topbar {
            align-items: flex-start;
            gap: 15px;
          }

          .ts-upload-brand {
            display: none;
          }

          .ts-upload-card {
            padding: 20px;
          }

          .ts-security-panel {
            display: flex;
          }

          .ts-upload-header h1 {
            font-size: 22px;
          }

        }
      `}</style>

      <div className="ts-upload-wrapper">

        {/* TOP BAR */}

        <div className="ts-upload-topbar">

          <button
            className="ts-back-button"
            onClick={() => navigate("/dashboard")}
          >
            ← Back to Dashboard
          </button>

          <div className="ts-upload-brand">

            <div className="ts-upload-logo">
              T
            </div>

            <div>
              <div className="ts-upload-brand-name">
                TrustShare
              </div>

              <div className="ts-upload-brand-subtitle">
                SECURE COLLABORATION
              </div>
            </div>

          </div>

        </div>

        <div className="ts-upload-grid">

          {/* UPLOAD CARD */}

          <div className="ts-upload-card">

            <div className="ts-upload-header">

              <div className="ts-upload-header-icon">
                🔐
              </div>

              <div>

                <h1>
                  Secure File Upload
                </h1>

                <p>
                  Select a file and TrustShare will encrypt it
                  before securely storing it.
                </p>

              </div>

            </div>

            <form onSubmit={handleUpload}>

              <label
                className={`ts-drop-zone ${
                  dragging ? "dragging" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >

                <div className="ts-drop-icon">
                  {file ? "📄" : "☁️"}
                </div>

                <div className="ts-drop-title">
                  {file
                    ? "File selected"
                    : "Drag & drop your file here"}
                </div>

                <div className="ts-drop-subtitle">
                  {file
                    ? "Ready to encrypt and upload"
                    : "or click below to browse your computer"}
                </div>

                <div className="ts-browse">
                  {file ? "Choose another file" : "Browse Files"}
                </div>

                <input
                  ref={fileInputRef}
                  id="file-input"
                  className="ts-file-input"
                  type="file"
                  onChange={handleFileChange}
                />

              </label>

              {file && (
                <div className="ts-selected-file">

                  <div className="ts-file-type">
                    📄
                  </div>

                  <div className="ts-file-details">

                    <div className="ts-file-name">
                      {file.name}
                    </div>

                    <div className="ts-file-size">
                      {formatSize(file.size)}
                    </div>

                  </div>

                  <button
                    type="button"
                    className="ts-remove"
                    onClick={removeFile}
                    title="Remove file"
                  >
                    ×
                  </button>

                </div>
              )}

              <button
                type="submit"
                className="ts-secure-upload"
                disabled={uploading}
              >
                {uploading
                  ? "🔐 Encrypting & Uploading..."
                  : "🔒 Encrypt & Upload Securely"}
              </button>

            </form>

            {message && (
              <div className="ts-upload-message ts-success">
                ✅ {message}
              </div>
            )}

            {error && (
              <div className="ts-upload-message ts-error">
                ❌ {error}
              </div>
            )}

          </div>

          {/* SECURITY PANEL */}

          <div className="ts-upload-card">

            <div className="ts-security-panel">

              <div>
                <div className="ts-security-title">
                  🛡️ Upload Security
                </div>

                <div className="ts-security-description">
                  Your file is protected throughout the upload
                  process.
                </div>
              </div>

              <div className="ts-security-item">

                <div className="ts-security-item-icon">
                  🔐
                </div>

                <div>
                  <div className="ts-security-item-title">
                    AES-256-GCM
                  </div>

                  <div className="ts-security-item-text">
                    File encryption
                  </div>
                </div>

              </div>

              <div className="ts-security-item">

                <div className="ts-security-item-icon">
                  ☁️
                </div>

                <div>
                  <div className="ts-security-item-title">
                    Secure Storage
                  </div>

                  <div className="ts-security-item-text">
                    Encrypted cloud storage
                  </div>
                </div>

              </div>

              <div className="ts-security-item">

                <div className="ts-security-item-icon">
                  🧩
                </div>

                <div>
                  <div className="ts-security-item-title">
                    Protected Access
                  </div>

                  <div className="ts-security-item-text">
                    Authenticated workspace
                  </div>
                </div>

              </div>

              <div className="ts-security-item">

                <div className="ts-security-item-icon">
                  📦
                </div>

                <div>
                  <div className="ts-security-item-title">
                    50 MB Limit
                  </div>

                  <div className="ts-security-item-text">
                    Maximum file size
                  </div>
                </div>

              </div>

              <div className="ts-limit">

                <div className="ts-limit-top">
                  <span>Maximum file size</span>
                  <span>50 MB</span>
                </div>

                <div className="ts-limit-bar">
                  <div className="ts-limit-fill"></div>
                </div>

              </div>

              <div className="ts-encryption-status">

                <span className="ts-status-dot"></span>

                Encryption system ready

              </div>

            </div>

          </div>

        </div>

        <div className="ts-upload-footer">
          🔒 TrustShare · Files are encrypted before cloud storage
        </div>

      </div>

    </div>
  );
}

export default Upload;