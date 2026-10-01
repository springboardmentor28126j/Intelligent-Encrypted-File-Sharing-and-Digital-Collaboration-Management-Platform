"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { Files, Folder, Share2 } from "lucide-react";

import { getFiles, getFolders } from "@/lib/api";

import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();

  const [fileCount, setFileCount] =
    useState(0);

  const [folderCount, setFolderCount] =
    useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [
          files,
          folders,
        ] = await Promise.all([
          getFiles(),
          getFolders(),
        ]);

        setFileCount(files.length);
        setFolderCount(folders.length);
      } catch {}
    }

    load();
  }, []);

  const used =
    user?.used_storage || 0;

  const quota =
    user?.storage_quota || 1;

  const percentage = Math.min(
    100,
    (used / quota) * 100
  );

  function formatBytes(bytes: number) {
    if (!bytes) return "0 B";

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
      "TB",
    ];

    const index = Math.floor(
      Math.log(bytes) / Math.log(1024)
    );

    return `${(
      bytes /
      Math.pow(1024, index)
    ).toFixed(1)} ${units[index]}`;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            Welcome back, {user?.name}.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <Link
          href="/dashboard/files"
          className="stat-card"
        >
          <Files />
          <span>Files</span>
          <strong>{fileCount}</strong>
        </Link>

        <Link
          href="/dashboard/folders"
          className="stat-card"
        >
          <Folder />
          <span>Folders</span>
          <strong>{folderCount}</strong>
        </Link>

        <Link
          href="/dashboard/shared"
          className="stat-card"
        >
          <Share2 />
          <span>Shared</span>
          <strong>View</strong>
        </Link>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Storage</h2>

          <span>
            {formatBytes(used)} /{" "}
            {formatBytes(quota)}
          </span>
        </div>

        <div className="progress">
          <div
            className="progress-bar"
            style={{
              width: `${percentage}%`,
            }}
          />
        </div>
      </section>
    </div>
  );
}