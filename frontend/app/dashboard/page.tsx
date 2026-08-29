"use client";

import { useEffect, useState } from "react";

interface FileItem {
  id: number;
  filename: string;
  stored_filename: string;
  file_path: string;
  owner_id: number;
}

export default function DashboardPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const API_URL = "http://127.0.0.1:8000";

  // ==========================================
  // GET TOKEN
  // ==========================================

  const getToken = () => {
    if (typeof window === "undefined") {
      return null;
    }

    return localStorage.getItem("access_token");
  };

  // ==========================================
  // CHECK LOGIN
  // ==========================================

  useEffect(() => {
    const token = getToken();

    if (!token) {
      window.location.href = "/";
      return;
    }

    loadFiles();
  }, []);

  // ==========================================
  // GET FILES
  // ==========================================

  const loadFiles = async () => {
    const token = getToken();

    if (!token) {
      window.location.href = "/";
      return;
    }

    setLoadingFiles(true);

    try {
      const response = await fetch(
        `${API_URL}/files/`,
        {
          method: "GET",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        window.location.href = "/";
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to load files"
        );
      }

      setFiles(data);

      setMessage("");

    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to load files."
      );

    } finally {
      setLoadingFiles(false);
    }
  };

  // ==========================================
  // UPLOAD FILE
  // ==========================================

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage(
        "Please select a file."
      );
      return;
    }

    const token = getToken();

    if (!token) {
      setMessage(
        "Please login again."
      );

      window.location.href = "/";
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();

      formData.append(
        "file",
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

      if (response.status === 401) {
        localStorage.removeItem(
          "access_token"
        );

        window.location.href = "/";
        return;
      }

      if (!response.ok) {
        setMessage(
          data.detail || "Upload failed."
        );
        return;
      }

      setMessage(
        "File uploaded successfully."
      );

      setSelectedFile(null);

      // Reset file input
      const input =
        document.getElementById(
          "fileInput"
        ) as HTMLInputElement;

      if (input) {
        input.value = "";
      }

      // Refresh file list
      await loadFiles();

    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to connect to the backend."
      );

    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // DOWNLOAD FILE
  // ==========================================

  const handleDownload = async (
    fileId: number,
    filename: string
  ) => {
    const token = getToken();

    if (!token) {
      window.location.href = "/";
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/files/download/${fileId}`,
        {
          method: "GET",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        localStorage.removeItem(
          "access_token"
        );

        window.location.href = "/";
        return;
      }

      if (!response.ok) {
        const data = await response.json();

        setMessage(
          data.detail || "Download failed."
        );

        return;
      }

      // Convert response into a file
      const blob =
        await response.blob();

      // Create temporary URL
      const url =
        window.URL.createObjectURL(
          blob
        );

      // Create download link
      const link =
        document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

      // Free memory
      window.URL.revokeObjectURL(
        url
      );

    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to download file."
      );
    }
  };

  // ==========================================
  // DELETE FILE
  // ==========================================

  const handleDelete = async (
    fileId: number
  ) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this file?"
      );

    if (!confirmed) {
      return;
    }

    const token = getToken();

    if (!token) {
      window.location.href = "/";
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/files/${fileId}`,
        {
          method: "DELETE",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (response.status === 401) {
        localStorage.removeItem(
          "access_token"
        );

        window.location.href = "/";
        return;
      }

      if (!response.ok) {
        setMessage(
          data.detail || "Delete failed."
        );

        return;
      }

      setMessage(
        "File deleted successfully."
      );

      await loadFiles();

    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to connect to the backend."
      );
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = () => {
    localStorage.removeItem(
      "access_token"
    );

    window.location.href = "/";
  };

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <main className="min-h-screen bg-gray-100">

      {/* ======================================
          HEADER
      ====================================== */}

      <header className="bg-black text-white px-6 py-4">

        <div className="max-w-6xl mx-auto flex items-center justify-between">

          <h1 className="text-2xl font-bold">
            Intelligent File Sharing
          </h1>

          <button
            onClick={handleLogout}
            className="bg-white text-black px-5 py-2 rounded-lg font-semibold hover:bg-gray-200"
          >
            Logout
          </button>

        </div>

      </header>


      {/* ======================================
          MAIN CONTENT
      ====================================== */}

      <div className="max-w-6xl mx-auto px-6 py-10">

        <h2 className="text-3xl font-bold text-black mb-2">
          Dashboard
        </h2>

        <p className="text-gray-600 mb-8">
          Upload and manage your files.
        </p>


        {/* ====================================
            UPLOAD
        ==================================== */}

        <div className="bg-white rounded-2xl shadow p-6 mb-8">

          <h3 className="text-xl font-bold text-black mb-4">
            Upload File
          </h3>

          <div className="flex flex-col md:flex-row gap-4">

            <input
              id="fileInput"
              type="file"
              onChange={(e) => {

                const file =
                  e.target.files?.[0] ||
                  null;

                setSelectedFile(file);
              }}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-black bg-white"
            />

            <button
              onClick={handleUpload}
              disabled={loading}
              className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {loading
                ? "Uploading..."
                : "Upload"}
            </button>

          </div>

        </div>


        {/* ====================================
            MESSAGE
        ==================================== */}

        {message && (

          <div className="bg-white rounded-lg shadow p-4 mb-8 text-black font-semibold">

            {message}

          </div>

        )}


        {/* ====================================
            FILES
        ==================================== */}

        <div className="bg-white rounded-2xl shadow p-6">

          <div className="flex items-center justify-between mb-5">

            <h3 className="text-xl font-bold text-black">
              Your Files
            </h3>

            <button
              onClick={loadFiles}
              disabled={loadingFiles}
              className="border border-gray-300 px-4 py-2 rounded-lg text-black font-semibold hover:bg-gray-100 disabled:opacity-50"
            >
              {loadingFiles
                ? "Loading..."
                : "Refresh"}
            </button>

          </div>


          {/* No files */}

          {!loadingFiles &&
          files.length === 0 ? (

            <div className="text-center py-10 text-gray-500">

              No files uploaded yet.

            </div>

          ) : null}


          {/* Files */}

          {files.length > 0 ? (

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>

                  <tr className="border-b border-gray-200">

                    <th className="text-left py-3 px-3 text-gray-700">
                      File Name
                    </th>

                    <th className="text-right py-3 px-3 text-gray-700">
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {files.map(
                    (file) => (

                      <tr
                        key={file.id}
                        className="border-b border-gray-100"
                      >

                        <td className="py-4 px-3 text-black font-medium">
                          {file.filename}
                        </td>

                        <td className="py-4 px-3 text-right">

                          <div className="flex justify-end gap-3">

                            <button
                              onClick={() =>
                                handleDownload(
                                  file.id,
                                  file.filename
                                )
                              }
                              className="bg-black text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-800"
                            >
                              Download
                            </button>

                            <button
                              onClick={() =>
                                handleDelete(
                                  file.id
                                )
                              }
                              className="border border-red-500 text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-50"
                            >
                              Delete
                            </button>

                          </div>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          ) : null}

        </div>

      </div>

    </main>
  );
}