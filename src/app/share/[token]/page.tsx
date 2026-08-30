"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getPublicShare, downloadPublicShare, PublicShareData } from "@/lib/api";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const CATEGORY_ICONS: Record<string, string> = {
  pdf: "📕",
  document: "📄",
  image: "🖼️",
  spreadsheet: "📊",
  presentation: "📽️",
  archive: "🗄️",
  other: "📁",
};

export default function SharedFilePage() {
  const params = useParams();
  const token = params?.token as string;

  const [shareData, setShareData] = useState<PublicShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchShare = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPublicShare(token);
        setShareData(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load shared file.");
      } finally {
        setLoading(false);
      }
    };

    fetchShare();
  }, [token]);

  const handleDownload = async () => {
    if (!shareData || !shareData.can_download) return;
    setDownloading(true);
    try {
      await downloadPublicShare(token, shareData.original_name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="page-center" style={{ flexDirection: "column", gap: "2rem" }}>
      {/* Brand Header */}
      <Link href="/" className="logo">
        <span className="logo-icon">🛡️</span>
        <span className="logo-text">TrustShare</span>
      </Link>

      <div className="card animate-fade-in" style={{ width: "100%", maxWidth: "520px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 1rem", borderWidth: 3 }} />
            <p className="text-muted">Decrypting shared link…</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>⚠️</div>
            <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, marginBottom: "0.75rem" }}>
              Link Inaccessible
            </h2>
            <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
              <span>✕</span>
              <span>{error}</span>
            </div>
            <p className="text-muted" style={{ fontSize: "var(--font-size-sm)", marginBottom: "2rem" }}>
              This link might have expired, reached its download limit, or been revoked by the owner.
            </p>
            <Link href="/" className="btn btn-secondary">
              Go to TrustShare Home →
            </Link>
          </div>
        ) : shareData ? (
          <div>
            {/* Security Pill */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--color-success)",
                  background: "rgba(16, 185, 129, 0.1)",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                }}
              >
                <span>🔒</span> Verified Secure Transfer
              </span>
              <span className={`cat-badge cat-${shareData.category}`}>
                {CATEGORY_ICONS[shareData.category] || "📁"} {shareData.category}
              </span>
            </div>

            {/* File Icon & Main Header */}
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div
                style={{
                  fontSize: "3.5rem",
                  marginBottom: "1rem",
                  display: "inline-block",
                  animation: "float 4s ease-in-out infinite",
                }}
              >
                {CATEGORY_ICONS[shareData.category] || "📁"}
              </div>
              <h1
                style={{
                  fontSize: "var(--font-size-xl)",
                  fontWeight: 700,
                  wordBreak: "break-all",
                  marginBottom: "0.5rem",
                }}
              >
                {shareData.original_name}
              </h1>
              <p className="text-muted" style={{ fontSize: "var(--font-size-sm)" }}>
                {formatFileSize(shareData.file_size)} • Uploaded{" "}
                {new Date(shareData.upload_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>

            {/* Metadata Box */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "1rem 1.25rem",
                marginBottom: "2rem",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span className="text-muted">Permission:</span>
                <span style={{ fontWeight: 600, color: shareData.can_download ? "var(--color-brand-accent)" : "var(--color-text-secondary)" }}>
                  {shareData.can_download ? "📥 Full Download Allowed" : "👁️ View Only"}
                </span>
              </div>
              {shareData.expires_at && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-muted">Link Expires:</span>
                  <span style={{ fontWeight: 500, color: "#fbbf24" }}>
                    {new Date(shareData.expires_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Action Download Button */}
            {shareData.can_download ? (
              <button
                id="download-shared-file-btn"
                onClick={handleDownload}
                disabled={downloading}
                className="btn btn-primary"
                style={{ width: "100%", padding: "1rem", fontSize: "1.05rem" }}
              >
                {downloading ? (
                  <>
                    <span className="spinner" />
                    Downloading securely…
                  </>
                ) : (
                  <>
                    <span>📥</span> Download File ({formatFileSize(shareData.file_size)})
                  </>
                )}
              </button>
            ) : (
              <div className="alert" style={{ background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.3)" }}>
                <span>👁️</span>
                <span>This file is shared in View-Only mode. Direct download is restricted by the owner.</span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <p className="text-muted" style={{ fontSize: "var(--font-size-xs)", textAlign: "center" }}>
        Protected by TrustShare Zero-Trust Encryption Architecture
      </p>
    </div>
  );
}
