"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { formatBytes } from "@/lib/format";

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/analytics/storage")
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ProtectedRoute>
      <h1 className="mb-1 text-2xl font-bold text-gray-800">Analytics</h1>
      <p className="mb-6 text-sm text-gray-500">
        Storage usage, upload activity, and sharing statistics for your account.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : !data ? (
        <p className="text-sm text-red-500">Could not load analytics.</p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total Files" value={data.total_files} />
            <StatCard label="Storage Used" value={formatBytes(data.total_storage_bytes)} />
            <StatCard label="Total Downloads" value={data.total_downloads} />
            <StatCard label="Active Shares" value={data.total_active_shares} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-gray-700">
                Uploads — last 7 days
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.uploads_last_7_days}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b5bdb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-gray-700">
                Downloads — last 7 days
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.downloads_last_7_days}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2f9e6c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </ProtectedRoute>
  );
}
