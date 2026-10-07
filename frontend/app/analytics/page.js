
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

function StatCard({ label, value, icon, detail }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-5 transition duration-200 hover:-translate-y-1 hover:border-teal-400/60">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-teal-400/5 blur-2xl transition group-hover:bg-teal-400/10" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <p className="mt-3 break-words text-2xl font-bold text-white sm:text-3xl">
            {value}
          </p>
          <p className="mt-2 text-xs text-slate-500">{detail}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-teal-400/20 bg-teal-400/10 text-xl text-teal-300">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, data, color, icon }) {
  const chartData = Array.isArray(data) ? data : [];

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">{title}</h2>
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-lg">
          {icon}
        </span>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-[250px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 text-center">
          <span className="text-3xl text-slate-600">▥</span>
          <p className="mt-3 text-sm font-medium text-slate-300">
            No activity data available
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Activity will appear here when data is available.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
          >
            <CartesianGrid
              stroke="#203449"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "#8da3ba", fontSize: 11 }}
              axisLine={{ stroke: "#294056" }}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#8da3ba", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "#163044", opacity: 0.65 }}
              contentStyle={{
                backgroundColor: "#0b1b2c",
                border: "1px solid #294056",
                borderRadius: "12px",
                color: "#edf5ff",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#edf5ff", marginBottom: "4px" }}
              itemStyle={{ color }}
              formatter={(value) => [value, "Count"]}
            />
            <Bar
              dataKey="count"
              name="Count"
              fill={color}
              radius={[6, 6, 0, 0]}
              maxBarSize={38}
            />
          </BarChart>
        </ResponsiveContainer>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-slate-800 pt-4">
        <span
          className="h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-slate-400">
          Daily {title.toLowerCase()}
        </span>
      </div>
    </section>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    api
      .get("/api/analytics/storage")
      .then((res) => {
        if (mounted) setData(res.data);
      })
      .catch((err) => {
        console.error("Analytics loading failed:", err);
        if (mounted) {
          setError(
            err.response?.data?.detail ||
              "Could not load analytics. Please try again."
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const retry = () => {
    setLoading(true);
    setError("");

    api
      .get("/api/analytics/storage")
      .then((res) => setData(res.data))
      .catch((err) => {
        setError(
          err.response?.data?.detail || "Could not load analytics."
        );
      })
      .finally(() => setLoading(false));
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen space-y-7 pb-10">
        <header className="relative overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/70 p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-teal-400/10" />
          <div className="pointer-events-none absolute -right-4 -top-12 h-48 w-48 rounded-full border border-teal-400/10" />

          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-teal-300" />
                <span className="text-xs font-semibold text-teal-300">
                  TRUSTSHARE INSIGHTS
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Analytics Dashboard
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                Monitor your file storage, downloads, and sharing activity
                from one clear overview.
              </p>
            </div>

            <button
              onClick={retry}
              disabled={loading}
              className="rounded-xl border border-teal-400/40 bg-teal-400/10 px-4 py-2.5 text-sm font-semibold text-teal-300 transition hover:bg-teal-400/20 disabled:opacity-50"
            >
              {loading ? "Loading..." : "↻ Refresh data"}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-12 text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-700 border-t-teal-400" />
            <p className="mt-4 text-sm text-slate-400">
              Loading your analytics...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-slate-900 p-8 text-center">
            <div className="text-3xl">!</div>
            <h2 className="mt-3 text-lg font-bold text-white">
              Analytics unavailable
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
              {error}
            </p>
            <button
              onClick={retry}
              className="mt-5 rounded-xl bg-teal-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-300"
            >
              Try again
            </button>
          </div>
        ) : data ? (
          <>
            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Storage overview
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    A summary of your account activity and resources.
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  Based on available account data
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total Files"
                  value={data.total_files ?? 0}
                  icon="▤"
                  detail="Files in your account"
                />
                <StatCard
                  label="Storage Used"
                  value={formatBytes(data.total_storage_bytes ?? 0)}
                  icon="◫"
                  detail="Combined file size"
                />
                <StatCard
                  label="Total Downloads"
                  value={data.total_downloads ?? 0}
                  icon="↓"
                  detail="Recorded downloads"
                />
                <StatCard
                  label="Active Shares"
                  value={data.total_active_shares ?? 0}
                  icon="↗"
                  detail="Currently active share links"
                />
              </div>
            </section>

            <section>
              <div className="mb-4">
                <h2 className="text-lg font-bold text-white">
                  Activity overview
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Daily upload and download counts over the last seven days.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <ChartCard
                  title="Uploads"
                  subtitle="Uploads over the last 7 days"
                  data={data.uploads_last_7_days}
                  color="#21d4c2"
                  icon="↑"
                />
                <ChartCard
                  title="Downloads"
                  subtitle="Downloads over the last 7 days"
                  data={data.downloads_last_7_days}
                  color="#60a5fa"
                  icon="↓"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-teal-400/20 bg-teal-400/10 text-xl text-teal-300">
                  ✓
                </div>
                <div>
                  <h2 className="font-bold text-white">
                    Your account at a glance
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    You have{" "}
                    <span className="font-semibold text-teal-300">
                      {data.total_files ?? 0} files
                    </span>{" "}
                    using{" "}
                    <span className="font-semibold text-teal-300">
                      {formatBytes(data.total_storage_bytes ?? 0)}
                    </span>{" "}
                    of storage. There are{" "}
                    <span className="font-semibold text-teal-300">
                      {data.total_active_shares ?? 0} active share links
                    </span>{" "}
                    and{" "}
                    <span className="font-semibold text-teal-300">
                      {data.total_downloads ?? 0} recorded downloads
                    </span>
                    .
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    This summary reflects the analytics returned by the server.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </ProtectedRoute>
  );
}