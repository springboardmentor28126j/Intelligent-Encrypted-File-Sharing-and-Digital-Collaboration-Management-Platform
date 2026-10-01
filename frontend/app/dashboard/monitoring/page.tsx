"use client";

import { useEffect, useState, useCallback } from "react";
import { getAnalytics, getActivityReport } from "@/lib/api";
import {
  Files,
  Share2,
  Link,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  PieChart,
  Shield,
  Database,
  Clock,
  Folder,
} from "lucide-react";

function formatBytes(bytesVal: number): string {
  if (!bytesVal || bytesVal <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytesVal) / Math.log(1024));
  return `${(bytesVal / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function MonitoringPage() {
  const [data, setData] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [analyticsData, reportData] = await Promise.all([
        getAnalytics(),
        getActivityReport(30),
      ]);
      setData(analyticsData);
      setReport(reportData);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load monitoring telemetry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-8 text-center shadow-sm">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-3">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-red-900">
            Telemetry Error
          </h2>
          <p className="mt-1 text-sm text-red-600 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => fetchData()}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <MonitoringSkeleton />;
  }

  const pct = Math.min(Number(data?.storage_percentage || 0), 100);
  const totalCategoryFiles = Object.values(data?.categories || {}).reduce(
    (acc: number, val: any) => acc + Number(val || 0),
    0
  );

  // Storage Health Status Indicator
  let progressBarColor = "bg-emerald-500";
  let statusBadge = "Optimal";
  let badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";

  if (pct >= 80 && pct < 90) {
    progressBarColor = "bg-amber-500";
    statusBadge = "Warning";
    badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (pct >= 90) {
    progressBarColor = "bg-rose-500";
    statusBadge = "Critical";
    badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
  }

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Monitoring & Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time storage telemetry, file metrics, and system security logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Files"
          value={data?.files ?? 0}
          icon={Files}
          iconBg="bg-blue-50 text-blue-600 border border-blue-100"
        />
        <MetricCard
          title="Shared Files"
          value={data?.shared_out ?? 0}
          icon={Share2}
          iconBg="bg-indigo-50 text-indigo-600 border border-indigo-100"
        />
        <MetricCard
          title="Active Links"
          value={data?.active_links ?? 0}
          icon={Link}
          iconBg="bg-amber-50 text-amber-600 border border-amber-100"
        />
        <MetricCard
          title="Storage Used"
          value={formatBytes(data?.used_storage)}
          subText={`of ${formatBytes(data?.storage_quota)}`}
          icon={HardDrive}
          iconBg="bg-purple-50 text-purple-600 border border-purple-100"
        />
      </div>

      {/* Storage Capacity Overview */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Storage Capacity
              </h2>
              <p className="text-xs text-slate-500">
                Allocated quota and remaining available vault space.
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeColor}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {statusBadge} ({pct.toFixed(1)}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mt-5">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/60">
            <div
              className={`h-full transition-all duration-500 ${progressBarColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Metric Cards Detail */}
        <div className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-200/80">
            <span className="text-slate-500 font-medium">Used Storage</span>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {formatBytes(data?.used_storage)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-200/80">
            <span className="text-slate-500 font-medium">Available Space</span>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {formatBytes(data?.storage_remaining)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-200/80">
            <span className="text-slate-500 font-medium">Total Quota</span>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {formatBytes(data?.storage_quota)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-200/80">
            <span className="text-slate-500 font-medium">Percentage Used</span>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {data?.storage_percentage || 0}%
            </p>
          </div>
        </div>
      </section>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Categories Breakdown */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Files by Category
                </h2>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/60">
                {totalCategoryFiles} Items
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {Object.entries(data?.categories || {}).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                  <Folder className="w-8 h-8 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-medium text-slate-500">No categorized files found.</p>
                </div>
              ) : (
                Object.entries(data?.categories || {}).map(([key, value]) => {
                  const count = Number(value || 0);
                  const categoryPct = totalCategoryFiles > 0 ? (count / totalCategoryFiles) * 100 : 0;
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="capitalize text-slate-800 font-semibold">{key}</span>
                        <span className="text-slate-500">
                          {count} file{count === 1 ? "" : "s"} ({categoryPct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/40">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                          style={{ width: `${categoryPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Audit Activity (Last 30 Days) */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  System Telemetry (30 Days)
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Audit Logs
              </span>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {(report?.events || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                  <Shield className="w-8 h-8 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-medium text-slate-500">No security events recorded in the last 30 days.</p>
                </div>
              ) : (
                (report?.events || []).slice(0, 7).map((e: any, idx: number) => {
                  const isSuccess = e.status?.toLowerCase() === "success";
                  return (
                    <div
                      key={`${e.action}-${e.status}-${idx}`}
                      className="flex items-center justify-between py-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide capitalize ${
                            isSuccess
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-600" />
                          )}
                          {e.status}
                        </span>
                        <span className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
                          {e.action?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {e.count} event{e.count === 1 ? "" : "s"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subText,
  icon: Icon,
  iconBg,
}: {
  title: string;
  value: string | number;
  subText?: string;
  icon: React.ElementType;
  iconBg: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
      <div>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </span>
          {subText && (
            <span className="text-xs font-medium text-slate-400">{subText}</span>
          )}
        </div>
      </div>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function MonitoringSkeleton() {
  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-lg bg-slate-200" />
          <div className="h-4 w-80 rounded-lg bg-slate-100" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-slate-200" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white shadow-sm" />
        ))}
      </div>

      <div className="h-52 rounded-xl border border-slate-200 bg-white shadow-sm" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-xl border border-slate-200 bg-white shadow-sm" />
        <div className="h-64 rounded-xl border border-slate-200 bg-white shadow-sm" />
      </div>
    </div>
  );
}