"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { getActivityReport } from "@/lib/api";
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Download,
  Search,
  FileText,
  RefreshCw,
} from "lucide-react";

interface ReportEvent {
  action: string;
  status: string;
  count: number;
}

export default function ReportsPage() {
  const [days, setDays] = useState<number>(30);
  const [report, setReport] = useState<{ events?: ReportEvent[] } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getActivityReport(days);
      setReport(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load activity reports."
      );
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const events = report?.events || [];

  const totalEvents = useMemo(() => {
    return events.reduce((sum, e) => sum + Number(e.count || 0), 0);
  }, [events]);

  const successfulEvents = useMemo(() => {
    return events
      .filter((e) => e.status?.toLowerCase() === "success")
      .reduce((sum, e) => sum + Number(e.count || 0), 0);
  }, [events]);

  const failedEvents = useMemo(() => {
    return events
      .filter((e) => e.status?.toLowerCase() !== "success")
      .reduce((sum, e) => sum + Number(e.count || 0), 0);
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const query = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.action.toLowerCase().includes(query) ||
        e.status.toLowerCase().includes(query)
    );
  }, [events, searchQuery]);

  const exportCSV = () => {
    if (!events.length) return;
    const headers = ["Action", "Status", "Count"];
    const rows = events.map((e) => [
      `"${e.action}"`,
      `"${e.status}"`,
      e.count,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `activity_report_${days}_days.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Activity Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Aggregated audit events and telemetry for secure file-sharing workflows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 1 year</option>
          </select>

          <button
            onClick={exportCSV}
            disabled={loading || !events.length}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ReportMetricCard
          title="Total Events"
          value={totalEvents}
          subtitle={`Recorded over ${days} days`}
          icon={BarChart3}
          iconBg="bg-indigo-50 text-indigo-600 border-indigo-100"
        />
        <ReportMetricCard
          title="Successful Executions"
          value={successfulEvents}
          subtitle={`${
            totalEvents > 0
              ? ((successfulEvents / totalEvents) * 100).toFixed(1)
              : 0
          }% success rate`}
          icon={CheckCircle2}
          iconBg="bg-emerald-50 text-emerald-600 border-emerald-100"
        />
        <ReportMetricCard
          title="Errors & Warnings"
          value={failedEvents}
          subtitle="Anomalies or failed attempts"
          icon={AlertTriangle}
          iconBg="bg-rose-50 text-rose-600 border-rose-100"
        />
      </div>

      {/* Main Table Section */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {days}-Day Audit Event Log
              </h2>
              <p className="text-xs text-slate-500">
                Breakdown of user actions and automated system triggers.
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Filter actions or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
            />
            <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center bg-rose-50/50">
            <p className="text-sm font-semibold text-rose-800">{error}</p>
            <button
              onClick={load}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 underline hover:text-indigo-800"
            >
              <RefreshCw className="w-3 h-3" />
              Reload report
            </button>
          </div>
        ) : loading ? (
          <TableSkeleton />
        ) : filteredEvents.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3 stroke-[1.5]" />
            <p className="text-sm font-semibold text-slate-700">
              No audit events found
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery
                ? "Try adjusting your search criteria."
                : "No telemetry data recorded for the selected timeframe."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-xs tracking-wider uppercase">
                  <th className="px-6 py-3.5">Action</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Event Weight</th>
                  <th className="px-6 py-3.5 text-right">Total Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredEvents.map((e, idx) => {
                  const isSuccess = e.status?.toLowerCase() === "success";
                  const percentage =
                    totalEvents > 0 ? (Number(e.count) / totalEvents) * 100 : 0;

                  return (
                    <tr
                      key={`${e.action}-${e.status}-${idx}`}
                      className="transition hover:bg-slate-50/60"
                    >
                      <td className="px-6 py-3.5 font-bold text-slate-800 uppercase tracking-wider text-xs">
                        {e.action?.replace(/_/g, " ")}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                            isSuccess
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 w-1/3">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isSuccess ? "bg-indigo-600" : "bg-rose-500"
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-[11px] font-semibold text-slate-500">
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right font-bold text-slate-900 text-sm">
                        {e.count.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ReportMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  iconBg: string;
}) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
          {value.toLocaleString()}
        </p>
        <span className="mt-1 block text-xs text-slate-500">
          {subtitle}
        </span>
      </div>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}