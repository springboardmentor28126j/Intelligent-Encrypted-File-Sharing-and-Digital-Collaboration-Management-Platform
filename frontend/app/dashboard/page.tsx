"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [shareFile, setShareFile] = useState("");
  const [allowedEmail, setAllowedEmail] = useState("");
  const [permission, setPermission] = useState("view");
  const [expiryMinutes, setExpiryMinutes] = useState("60");
  const [shareLoading, setShareLoading] = useState(false);

  // ==========================================
  // LOAD FILES
  // ==========================================
  const getFiles = async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/files?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to get files"
        );
      }

      setFiles(Array.isArray(data.files) ? data.files : []);
    } catch (error) {
      console.error("File loading error:", error);
      setMessage("Unable to load files from backend.");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getFiles();
  }, []);

  // ==========================================
  // DELETE FILE
  // ==========================================
  const handleDelete = async (file: string) => {
    const email = localStorage.getItem("userEmail") || "";

    if (!email) {
      alert("User email not found. Please login again.");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${file}"?`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/delete/${encodeURIComponent(
          file
        )}?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(
          typeof data.message === "string"
            ? data.message
            : "File deleted successfully."
        );

        getFiles();
      } else {
        alert(
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data, null, 2)
        );
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Unable to delete file.");
    }
  };

  // ==========================================
  // SHARE FILE
  // ==========================================
  const handleShare = async () => {
    if (!shareFile) {
      alert("Please select a file.");
      return;
    }

    if (!allowedEmail) {
      alert("Please enter allowed user's email.");
      return;
    }

    const ownerEmail = localStorage.getItem("userEmail") || "";

    if (!ownerEmail) {
      alert("User email not found. Please login again.");
      return;
    }

    setShareLoading(true);

    try {
      const params = new URLSearchParams();

      params.append("filename", shareFile);
      params.append("owner_email", ownerEmail);
      params.append("allowed_email", allowedEmail);
      params.append("permission", permission);
      params.append("expiry_minutes", expiryMinutes);

      const response = await fetch(
        `http://127.0.0.1:8000/share?${params.toString()}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      console.log("FULL SHARE RESPONSE:", data);

      // ------------------------------------------
      // ERROR
      // ------------------------------------------
      if (!response.ok) {
        let errorText = "";

        if (typeof data.detail === "string") {
          errorText = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorText = data.detail
            .map((item: any) => {
              if (typeof item === "string") {
                return item;
              }

              if (item?.msg) {
                return item.msg;
              }

              return JSON.stringify(item);
            })
            .join("\n");
        } else {
          errorText = JSON.stringify(data, null, 2);
        }

        alert(`Share Error:\n\n${errorText}`);
        return;
      }

      // ------------------------------------------
      // SUCCESS
      // ------------------------------------------
      let successText = "";

      if (typeof data.message === "string") {
        successText += `${data.message}\n\n`;
      }

      if (data.share_token) {
        successText += `Token:\n${data.share_token}`;
      } else {
        successText += JSON.stringify(data, null, 2);
      }

      alert(`Share Response:\n\n${successText}`);

      // Reset
      setShareFile("");
      setAllowedEmail("");
      setPermission("view");
      setExpiryMinutes("60");
    } catch (error) {
      console.error("Share request error:", error);

      let errorText = "Unable to connect to backend.";

      if (error instanceof Error) {
        errorText = error.message;
      }

      alert(`Share Request Error:\n\n${errorText}`);
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* ==========================================
            HEADER
        ========================================== */}
        <div className="bg-white p-8 rounded-2xl shadow-lg mb-6">

          <h1 className="text-4xl font-bold text-blue-600 text-center">
            TrustShare
          </h1>

          <p className="text-center text-gray-600 mt-2">
            Secure File-Sharing and Digital Collaboration Platform
          </p>

          <h2 className="text-2xl font-semibold mt-8">
            File Management Dashboard
          </h2>

          <div className="flex flex-wrap gap-3 mt-5">

            <button
              onClick={() => router.push("/upload")}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
            >
              Upload File
            </button>

            <button
              onClick={getFiles}
              disabled={loading}
              className="bg-gray-600 text-white px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Files"}
            </button>

            <button
              onClick={() => router.push("/")}
              className="bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700"
            >
              Home
            </button>

          </div>

          {message && (
            <p className="text-red-500 mt-4">
              {message}
            </p>
          )}
        </div>

        {/* ==========================================
            SECURITY STATUS
        ========================================== */}
        <div className="bg-white p-6 rounded-2xl shadow-lg mb-6">

          <h2 className="text-xl font-semibold mb-4">
            Security Status
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div className="bg-green-50 border border-green-200 p-4 rounded-xl">
              <p className="font-semibold text-green-700">
                AES-256 Encryption
              </p>

              <p className="text-sm text-gray-600 mt-1">
                Files are encrypted before storage.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
              <p className="font-semibold text-blue-700">
                Secure Sharing
              </p>

              <p className="text-sm text-gray-600 mt-1">
                Permission-based temporary sharing.
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl">
              <p className="font-semibold text-purple-700">
                Key Management
              </p>

              <p className="text-sm text-gray-600 mt-1">
                Unique file encryption keys are managed securely.
              </p>
            </div>

          </div>
        </div>

        {/* ==========================================
            MY FILES
        ========================================== */}
        <div className="bg-white p-6 rounded-2xl shadow-lg mb-6">

          <div className="flex justify-between items-center mb-5">

            <h2 className="text-xl font-semibold">
              My Files
            </h2>

            <span className="text-sm text-gray-500">
              {files.length} file{files.length !== 1 ? "s" : ""}
            </span>

          </div>

          {!loading && files.length === 0 && !message && (
            <p className="text-gray-600">
              No files uploaded yet.
            </p>
          )}

          {files.length > 0 && (
            <div className="space-y-3">

              {files.map((file, index) => (

                <div
                  key={index}
                  className="border p-4 rounded-xl bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >

                  {/* FILE NAME */}
                  <div>

                    <p className="font-medium text-gray-800">
                      📄 {file}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      Securely stored file
                    </p>

                  </div>

                  {/* ACTIONS */}
                  <div className="flex flex-wrap gap-2">

                    {/* DOWNLOAD */}
                    <a
                      href={`http://127.0.0.1:8000/download/${encodeURIComponent(
                        file
                      )}?email=${encodeURIComponent(
                        localStorage.getItem("userEmail") || ""
                      )}`}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                      Download
                    </a>

                    {/* SHARE */}
                    <button
                      onClick={() => {
                        setShareFile(file);

                        window.scrollTo({
                          top: document.body.scrollHeight,
                          behavior: "smooth",
                        });
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Share
                    </button>

                    {/* DELETE */}
                    <button
                      onClick={() => handleDelete(file)}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                    >
                      Delete
                    </button>

                  </div>
                </div>

              ))}

            </div>
          )}

        </div>

        {/* ==========================================
            SECURE FILE SHARING
        ========================================== */}
        <div className="bg-white p-6 rounded-2xl shadow-lg mb-6">

          <h2 className="text-xl font-semibold mb-2">
            Secure File Sharing
          </h2>

          <p className="text-gray-600 text-sm mb-5">
            Create a temporary share link with permission and expiry control.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* FILE */}
            <div>

              <label className="block text-sm font-medium mb-1">
                Select File
              </label>

              <select
                value={shareFile}
                onChange={(e) => setShareFile(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >

                <option value="">
                  Select a file
                </option>

                {files.map((file, index) => (
                  <option key={index} value={file}>
                    {file}
                  </option>
                ))}

              </select>

            </div>

            {/* EMAIL */}
            <div>

              <label className="block text-sm font-medium mb-1">
                Allowed User Email
              </label>

              <input
                type="email"
                value={allowedEmail}
                onChange={(e) => setAllowedEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full border rounded-lg px-3 py-2"
              />

            </div>

            {/* PERMISSION */}
            <div>

              <label className="block text-sm font-medium mb-1">
                Permission
              </label>

              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >

                <option value="view">
                  View
                </option>

                <option value="download">
                  Download
                </option>

              </select>

            </div>

            {/* EXPIRY */}
            <div>

              <label className="block text-sm font-medium mb-1">
                Link Expiry
              </label>

              <select
                value={expiryMinutes}
                onChange={(e) => setExpiryMinutes(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >

                <option value="15">
                  15 minutes
                </option>

                <option value="30">
                  30 minutes
                </option>

                <option value="60">
                  1 hour
                </option>

                <option value="120">
                  2 hours
                </option>

                <option value="1440">
                  24 hours
                </option>

              </select>

            </div>

          </div>

          {/* SHARE BUTTON */}
          <button
            onClick={handleShare}
            disabled={shareLoading}
            className="mt-5 bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {shareLoading
              ? "Creating Share Link..."
              : "Create Share Link"}
          </button>

        </div>

        {/* ==========================================
            ACTIVITY MONITORING
        ========================================== */}
        <div className="bg-white p-6 rounded-2xl shadow-lg">

          <h2 className="text-xl font-semibold mb-2">
            Activity Monitoring
          </h2>

          <p className="text-gray-600 text-sm">
            File upload, download, sharing and access activities are recorded
            in the backend audit log.
          </p>

          <button
            onClick={() => router.push("/audit-logs")}
            className="mt-4 bg-gray-800 text-white px-5 py-2 rounded-lg hover:bg-gray-900"
          >
            View Audit Logs
          </button>

        </div>

      </div>
    </main>
  );
}