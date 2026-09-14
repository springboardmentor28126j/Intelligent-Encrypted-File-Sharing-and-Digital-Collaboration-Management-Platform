import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [receivedFiles, setReceivedFiles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [receivedLoading, setReceivedLoading] = useState(false);

  const [shareUserId, setShareUserId] = useState("");
  const [shareExpiry, setShareExpiry] = useState("");
  const [selectedFileId, setSelectedFileId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (token) {
      getCurrentUser(token);
    }
  }, []);

  const getCurrentUser = async (token) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        localStorage.removeItem("access_token");
        setUser(null);
        return;
      }

      const data = await response.json();

      setUser(data);

      await getMyFiles(token);
      await getMyShares(token);
      await getReceivedShares(token);
    } catch (error) {
      console.error("Failed to get user:", error);
      setError("Unable to connect to TrustShare server.");
    }
  };

  const getMyFiles = async (
    token = localStorage.getItem("access_token")
  ) => {
    if (!token) {
      return;
    }

    setFilesLoading(true);

    try {
      const response = await fetch(`${API_URL}/files/`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Unable to load files.");
        return;
      }

      setFiles(data.files || []);
    } catch (error) {
      console.error("Failed to load files:", error);
      setError("Unable to connect to TrustShare server.");
    } finally {
      setFilesLoading(false);
    }
  };

  const getMyShares = async (
    token = localStorage.getItem("access_token")
  ) => {
    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/files/shared-by-me`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Unable to load shares:",
          data.detail
        );
        return;
      }

      setSharedFiles(data || []);
    } catch (error) {
      console.error(
        "Failed to load shared files:",
        error
      );
    }
  };

  const getReceivedShares = async (
    token = localStorage.getItem("access_token")
  ) => {
    if (!token) {
      return;
    }

    setReceivedLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/files/shared-with-me`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Unable to load received shares:",
          data.detail
        );
        return;
      }

      setReceivedFiles(data || []);
    } catch (error) {
      console.error(
        "Failed to load received shares:",
        error
      );
    } finally {
      setReceivedLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            email: email,
            password: password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Login failed.");
        return;
      }

      localStorage.setItem(
        "access_token",
        data.access_token
      );

      setMessage("Login successful.");

      await getCurrentUser(
        data.access_token
      );

      setPassword("");
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      setError(
        "Unable to connect to TrustShare server."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");

    setUser(null);
    setFiles([]);
    setSharedFiles([]);
    setReceivedFiles([]);

    setEmail("");
    setPassword("");

    setMessage("");
    setError("");
  };

  const handleUpload = async (event) => {
    const selectedFile = event.target.files[0];

    if (!selectedFile) {
      return;
    }

    const token =
      localStorage.getItem("access_token");

    if (!token) {
      setError("You are not logged in.");
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();

      formData.append(
        "uploaded_file",
        selectedFile
      );

      const response = await fetch(
        `${API_URL}/files/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.detail || "File upload failed."
        );
        return;
      }

      setMessage(
        "File uploaded and encrypted successfully."
      );

      await getMyFiles(token);
    } catch (error) {
      console.error(
        "Upload error:",
        error
      );

      setError(
        "Unable to upload file."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDownload = async (file) => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      setError("You are not logged in.");
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/files/${file.id}/download`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let data = {};

        try {
          data = await response.json();
        } catch {
          data = {};
        }

        setError(
          data.detail || "Download failed."
        );

        return;
      }

      const blob = await response.blob();

      const downloadUrl =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = downloadUrl;
      link.download = file.filename;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        downloadUrl
      );

      setMessage(
        "File downloaded successfully."
      );
    } catch (error) {
      console.error(
        "Download error:",
        error
      );

      setError(
        "Unable to download file."
      );
    }
  };

  const handleDownloadSharedFile = async (
    share
  ) => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      setError("You are not logged in.");
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/files/${share.file_id}/download`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let data = {};

        try {
          data = await response.json();
        } catch {
          data = {};
        }

        setError(
          data.detail ||
            "Unable to download shared file."
        );

        return;
      }

      const blob = await response.blob();

      const downloadUrl =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = downloadUrl;

      const contentDisposition =
        response.headers.get(
          "Content-Disposition"
        );

      let filename =
        share.filename ||
        `shared-file-${share.file_id}`;

      if (contentDisposition) {
        const match =
          contentDisposition.match(
            /filename="([^"]+)"/
          );

        if (match) {
          filename = match[1];
        }
      }

      link.download = filename;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        downloadUrl
      );

      setMessage(
        "Shared file downloaded successfully."
      );
    } catch (error) {
      console.error(
        "Shared download error:",
        error
      );

      setError(
        "Unable to download shared file."
      );
    }
  };

  const handleDelete = async (fileId) => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      setError("You are not logged in.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this file?"
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/files/${fileId}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.detail || "Delete failed."
        );
        return;
      }

      setMessage(
        "File deleted successfully."
      );

      await getMyFiles(token);
      await getMyShares(token);
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      setError(
        "Unable to delete file."
      );
    }
  };

  const handleShare = async (fileId) => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      setError("You are not logged in.");
      return;
    }

    if (!shareUserId) {
      setError(
        "Please enter the User ID to share with."
      );
      return;
    }

    const targetUserId =
      Number(shareUserId);

    if (!Number.isInteger(targetUserId)) {
      setError(
        "User ID must be a valid number."
      );
      return;
    }

    setSharing(true);
    setMessage("");
    setError("");

    try {
      const requestBody = {
        file_id: fileId,
        shared_with_user_id: targetUserId,
        permission: "view",
      };

      if (shareExpiry) {
        requestBody.expires_at = shareExpiry;
      }

      const response = await fetch(
        `${API_URL}/files/share`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.detail ||
            "File sharing failed."
        );
        return;
      }

      setMessage(
        `File shared successfully with User #${targetUserId}.`
      );

      setShareUserId("");
      setShareExpiry("");
      setSelectedFileId(null);

      await getMyShares(token);
    } catch (error) {
      console.error(
        "Share error:",
        error
      );

      setError(
        "Unable to share file."
      );
    } finally {
      setSharing(false);
    }
  };

  const handleRevokeShare = async (
    shareId
  ) => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      setError("You are not logged in.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to revoke this file share?"
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/files/share/${shareId}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.detail ||
            "Unable to revoke sharing."
        );
        return;
      }

      setMessage(
        "File sharing revoked successfully."
      );

      await getMyShares(token);
      await getReceivedShares(token);
    } catch (error) {
      console.error(
        "Revoke share error:",
        error
      );

      setError(
        "Unable to revoke file sharing."
      );
    }
  };

  const formatExpiry = (expiresAt) => {
    if (!expiresAt) {
      return "No expiration";
    }

    const expiryDate =
      new Date(expiresAt);

    if (Number.isNaN(expiryDate.getTime())) {
      return "Invalid expiration";
    }

    return expiryDate.toLocaleString();
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) {
      return false;
    }

    const expiryDate =
      new Date(expiresAt);

    return (
      !Number.isNaN(expiryDate.getTime()) &&
      expiryDate.getTime() <= Date.now()
    );
  };

  if (user) {
    return (
      <div className="dashboard">

        <header className="dashboard-header">
          <div>
            <h1>TrustShare</h1>

            <p>
              Secure File Sharing Platform
            </p>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </header>

        <main className="dashboard-content">

          <section className="welcome-section">

            <h2>
              Welcome, {user.name} 👋
            </h2>

            <p>
              Manage your files securely
              and collaborate with your team.
            </p>

          </section>

          {message && (
            <div className="success-message">
              {message}
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <section className="stats-grid">

            <div className="stat-card">

              <div className="stat-icon">
                📄
              </div>

              <div>
                <h3>
                  {files.length}
                </h3>

                <p>
                  My Files
                </p>
              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon">
                🔗
              </div>

              <div>
                <h3>
                  {sharedFiles.length}
                </h3>

                <p>
                  Shared By Me
                </p>
              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon">
                📥
              </div>

              <div>
                <h3>
                  {receivedFiles.length}
                </h3>

                <p>
                  Shared With Me
                </p>
              </div>

            </div>

          </section>

          <section className="files-section">

            <div className="section-header">

              <div>
                <h2>
                  My Files
                </h2>

                <p>
                  Your uploaded files are encrypted
                  before being stored.
                </p>
              </div>

              <label className="upload-button">

                {uploading
                  ? "Uploading..."
                  : "+ Upload File"}

                <input
                  type="file"
                  onChange={handleUpload}
                  disabled={uploading}
                  hidden
                />

              </label>

            </div>

            {filesLoading ? (

              <div className="empty-files">

                <div className="empty-icon">
                  ⏳
                </div>

                <h3>
                  Loading files...
                </h3>

              </div>

            ) : files.length === 0 ? (

              <div className="empty-files">

                <div className="empty-icon">
                  📂
                </div>

                <h3>
                  No files yet
                </h3>

                <p>
                  Upload your first file
                  to start using TrustShare.
                </p>

                <label className="upload-button">

                  Upload Your First File

                  <input
                    type="file"
                    onChange={handleUpload}
                    disabled={uploading}
                    hidden
                  />

                </label>

              </div>

            ) : (

              <div className="file-list">

                {files.map((file) => (

                  <div
                    className="file-card"
                    key={file.id}
                  >

                    <div className="file-info">

                      <div className="file-icon">
                        📄
                      </div>

                      <div>

                        <h3>
                          {file.filename}
                        </h3>

                        <p>
                          {file.file_size} bytes
                        </p>

                        <p>
                          🔐 Encrypted at rest
                        </p>

                      </div>

                    </div>

                    <div className="file-actions">

                      <button
                        onClick={() =>
                          handleDownload(file)
                        }
                      >
                        Download
                      </button>

                      <button
                        onClick={() => {
                          setSelectedFileId(
                            selectedFileId === file.id
                              ? null
                              : file.id
                          );

                          setShareUserId("");
                          setShareExpiry("");

                          setError("");
                          setMessage("");
                        }}
                      >
                        🔗 Share
                      </button>

                      <button
                        className="delete-button"
                        onClick={() =>
                          handleDelete(file.id)
                        }
                      >
                        Delete
                      </button>

                    </div>

                    {selectedFileId === file.id && (

                      <div className="share-panel">

                        <h4>
                          Share "{file.filename}"
                        </h4>

                        <p>
                          Enter the User ID and
                          optional expiration time.
                        </p>

                        <div className="share-form">

                          <input
                            type="number"
                            min="1"
                            placeholder="Enter User ID"
                            value={shareUserId}
                            onChange={(event) =>
                              setShareUserId(
                                event.target.value
                              )
                            }
                          />

                          <input
                            type="datetime-local"
                            value={shareExpiry}
                            min={
                              new Date(
                                Date.now() + 60000
                              )
                                .toISOString()
                                .slice(0, 16)
                            }
                            onChange={(event) =>
                              setShareExpiry(
                                event.target.value
                              )
                            }
                          />

                          <button
                            onClick={() =>
                              handleShare(file.id)
                            }
                            disabled={sharing}
                          >
                            {sharing
                              ? "Sharing..."
                              : "Share File"}
                          </button>

                        </div>

                        <small>
                          Expiration is optional.
                          Leave it empty for permanent
                          access until revoked.
                        </small>

                      </div>

                    )}

                  </div>

                ))}

              </div>

            )}

          </section>

          <section className="files-section">

            <div className="section-header">

              <div>

                <h2>
                  🔗 Shared By Me
                </h2>

                <p>
                  Files you have shared with
                  other users.
                </p>

              </div>

            </div>

            {sharedFiles.length === 0 ? (

              <div className="empty-files">

                <div className="empty-icon">
                  🔗
                </div>

                <h3>
                  No shared files
                </h3>

                <p>
                  Files that you share with
                  other users will appear here.
                </p>

              </div>

            ) : (

              <div className="file-list">

                {sharedFiles.map((share) => (

                  <div
                    className="file-card"
                    key={share.id}
                  >

                    <div className="file-info">

                      <div className="file-icon">
                        🔗
                      </div>

                      <div>

                        <h3>
                          File #{share.file_id}
                        </h3>

                        <p>
                          Shared with User #
                          {share.shared_with_user_id}
                        </p>

                        <p>
                          Permission:{" "}
                          {share.permission}
                        </p>

                        <p>
                          ⏰ Expires:{" "}
                          {formatExpiry(
                            share.expires_at
                          )}
                        </p>

                        {isExpired(
                          share.expires_at
                        ) && (
                          <p>
                            ⚠️ Share expired
                          </p>
                        )}

                      </div>

                    </div>

                    <div className="file-actions">

                      <button
                        className="delete-button"
                        onClick={() =>
                          handleRevokeShare(
                            share.id
                          )
                        }
                      >
                        Revoke
                      </button>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </section>

          <section className="files-section">

            <div className="section-header">

              <div>

                <h2>
                  📥 Shared With Me
                </h2>

                <p>
                  Files other users have shared
                  with your account.
                </p>

              </div>

            </div>

            {receivedLoading ? (

              <div className="empty-files">

                <div className="empty-icon">
                  ⏳
                </div>

                <h3>
                  Loading shared files...
                </h3>

              </div>

            ) : receivedFiles.length === 0 ? (

              <div className="empty-files">

                <div className="empty-icon">
                  📥
                </div>

                <h3>
                  No files shared with you
                </h3>

                <p>
                  Files shared with your account
                  will appear here.
                </p>

              </div>

            ) : (

              <div className="file-list">

                {receivedFiles.map((share) => {

                  const expired =
                    isExpired(
                      share.expires_at
                    );

                  return (
                    <div
                      className="file-card"
                      key={share.id}
                    >

                      <div className="file-info">

                        <div className="file-icon">
                          📥
                        </div>

                        <div>

                          <h3>
                            {share.filename}
                          </h3>

                          <p>
                            👤 Shared by{" "}
                            <strong>
                              {share.owner_name}
                            </strong>
                          </p>

                          <p>
                            Permission:{" "}
                            {share.permission}
                          </p>

                          <p>
                            ⏰ Expires:{" "}
                            {formatExpiry(
                              share.expires_at
                            )}
                          </p>

                          {expired && (
                            <p>
                              ⚠️ Access expired
                            </p>
                          )}

                        </div>

                      </div>

                      <div className="file-actions">

                        <button
                          onClick={() =>
                            handleDownloadSharedFile(
                              share
                            )
                          }
                          disabled={expired}
                        >
                          {expired
                            ? "Expired"
                            : "Download"}
                        </button>

                      </div>

                    </div>
                  );
                })}

              </div>

            )}

          </section>

          <section className="account-section">

            <h2>
              Account Information
            </h2>

            <div className="account-card">

              <div>
                <span>
                  Name
                </span>

                <strong>
                  {user.name}
                </strong>
              </div>

              <div>
                <span>
                  Email
                </span>

                <strong>
                  {user.email}
                </strong>
              </div>

              <div>
                <span>
                  Account ID
                </span>

                <strong>
                  #{user.id}
                </strong>
              </div>

              <div>
                <span>
                  Status
                </span>

                <strong className="status-active">
                  ● Active
                </strong>
              </div>

            </div>

          </section>

        </main>

      </div>
    );
  }

  return (
    <div className="app">

      <div className="login-container">

        <div className="login-card">

          <div className="logo-section">

            <h1>
              TrustShare
            </h1>

            <p>
              Secure File Sharing Platform
            </p>

          </div>

          <form onSubmit={handleLogin}>

            <div className="form-group">

              <label>
                Email
              </label>

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
              />

            </div>

            <div className="form-group">

              <label>
                Password
              </label>

              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
              />

            </div>

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Sign In"}
            </button>

          </form>

          {message && (
            <p className="login-message">
              {message}
            </p>
          )}

          {error && (
            <p className="login-error">
              {error}
            </p>
          )}

          <div className="security-note">

            🔒 Your connection is protected by
            secure authentication.

          </div>

        </div>

      </div>

    </div>
  );
}

export default App;