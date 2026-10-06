"use client";

import { useEffect, useState } from "react";

export default function SharedFilePage() {
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<any>(null);

  useEffect(() => {
    const loadSharedFile = async () => {
      try {
        const params = new URLSearchParams(
          window.location.search
        );

        const token = params.get("token");
        const email =
          localStorage.getItem("userEmail") || "";

        if (!token) {
          setError("Invalid or missing share link.");
          setLoading(false);
          return;
        }

        if (!email) {
          setError("Please login again.");
          setLoading(false);
          return;
        }

        const response = await fetch(
          `http://127.0.0.1:8000/shared/${encodeURIComponent(
            token
          )}?email=${encodeURIComponent(email)}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : "Unable to access shared file."
          );
        }

        setFile({
          ...data,
          share_token: token,
        });

      } catch (err: any) {
        setError(
          err.message || "Unable to load shared file."
        );
      } finally {
        setLoading(false);
      }
    };

    loadSharedFile();
  }, []);

  const downloadFile = async () => {
    try {
      setDownloading(true);
      setError("");

      const token = file?.share_token;
      const email =
        localStorage.getItem("userEmail") || "";

      if (!token || !email) {
        setError("Invalid shared file information.");
        return;
      }

      const response = await fetch(
        `http://127.0.0.1:8000/download-shared/${encodeURIComponent(
          token
        )}?email=${encodeURIComponent(email)}`
      );

      if (!response.ok) {
        let message =
          "Unable to download shared file.";

        try {
          const data = await response.json();

          if (typeof data.detail === "string") {
            message = data.detail;
          }
        } catch {}

        throw new Error(message);
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download =
        file?.filename || "shared-file";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      setError(
        err.message || "Download failed."
      );
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8 text-center">
          <p className="text-gray-600">
            Loading shared file...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-2xl mx-auto">

        <div className="bg-white rounded-2xl shadow-lg p-8">

          <h1 className="text-3xl font-bold text-blue-600 mb-2">
            Shared File
          </h1>

          <p className="text-gray-600 mb-6">
            Secure shared file access
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
              {error}
            </div>
          )}

          {file && !error && (
            <>
              <div className="bg-gray-50 rounded-xl p-5 space-y-3">

                <div>
                  <span className="font-semibold">
                    File:
                  </span>{" "}
                  {file.filename || "Shared file"}
                </div>

                <div>
                  <span className="font-semibold">
                    Permission:
                  </span>{" "}
                  {file.permission || "View"}
                </div>

                {file.expires_at && (
                  <div>
                    <span className="font-semibold">
                      Expires:
                    </span>{" "}
                    {new Date(
                      file.expires_at
                    ).toLocaleString()}
                  </div>
                )}

              </div>

              {file.permission !== "view" &&
                file.permission !== "VIEW" && (
                  <button
                    onClick={downloadFile}
                    disabled={downloading}
                    className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {downloading
                      ? "Downloading..."
                      : "Download Shared File"}
                  </button>
                )}

              {(file.permission === "view" ||
                file.permission === "VIEW") && (
                <button
                  onClick={downloadFile}
                  disabled={downloading}
                  className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {downloading
                    ? "Downloading..."
                    : "Download Shared File"}
                </button>
              )}
            </>
          )}

        </div>

      </div>
    </main>
  );
}