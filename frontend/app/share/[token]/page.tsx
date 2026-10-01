"use client";

import {
  useEffect,
  useState,
} from "react";

import { useParams } from "next/navigation";

import {
  publicShareInfo,
  publicShareDownload,
} from "@/lib/api";

export default function ShareLinkPage() {
  const params = useParams();

  const token =
    params.token as string;

  const [data, setData] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        const result =
          await publicShareInfo(
            token
          );

        setData(result);
      } catch (err: any) {
        setError(
          err?.message ||
            "Invalid or expired share link"
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  async function handleDownload() {
    if (!data?.file_id) return;

    try {
      /*
       * If your backend provides a public
       * share-link download endpoint,
       * use that endpoint here.
       *
       * Do not use the authenticated
       * /files/{id}/download endpoint
       * for anonymous users.
       */

      const blob = await publicShareDownload(token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(
        err?.message ||
          "Download failed"
      );
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        Validating share link...
      </div>
    );
  }

  if (error) {
    return (
      <main className="share-page">
        <div className="auth-card">
          <h1>Invalid Share Link</h1>

          <p>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="share-page">
      <div className="auth-card">
        <h1>Shared File</h1>

        <p>
          This file was shared securely
          through TrustShare.
        </p>

        {data?.filename && (
          <p>
            <strong>
              {data.filename}
            </strong>
          </p>
        )}

        <button onClick={handleDownload} disabled={!data?.can_download}>
          {data?.can_download ? "Download File" : "Download Disabled"}
        </button>
      </div>
    </main>
  );
}