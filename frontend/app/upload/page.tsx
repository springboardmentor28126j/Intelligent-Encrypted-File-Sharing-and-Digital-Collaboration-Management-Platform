"use client";

import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file.");
      return;
    }

    const email = localStorage.getItem("userEmail") || "";

    if (!email) {
      setMessage("User email not found. Please login again.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("email", email);

    setUploading(true);
    setMessage("");

    try {
      const response = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || "File uploaded successfully.");
        setFile(null);
      } else {
        setMessage(data.message || "File upload failed.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      setMessage("Backend is not connected.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-blue-600 text-center">
          TrustShare
        </h1>

        <p className="text-center text-gray-600 mt-2">
          Secure File Upload
        </p>

        <div className="mt-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select File
          </label>

          <input
            type="file"
            accept=".txt,.pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0] || null;
              setFile(selectedFile);
              setMessage("");
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-3"
          />

          {file && (
            <p className="text-sm text-gray-600 mt-3">
              Selected: {file.name}
            </p>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload File"}
          </button>

          {message && (
            <p
              className={`mt-4 text-center ${
                message.toLowerCase().includes("failed") ||
                message.toLowerCase().includes("not connected") ||
                message.toLowerCase().includes("not found") ||
                message.toLowerCase().includes("permission")
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
