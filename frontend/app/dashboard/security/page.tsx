"use client";

import { useEffect, useState, useCallback } from "react";
import { getSecurityMonitoring } from "@/lib/api";
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Lock,
  Download,
  Ban,
  AlertTriangle,
} from "lucide-react";

interface Thresholds {
  failed_logins: number;
  downloads: number;
  denied_actions: number;
}

interface AlertItem {
  type: string;
  title: string;
  description: string;
  severity: string;
  top_ips?: [string, number][];
}

interface SecurityData {
  thresholds: Thresholds;
  alerts: AlertItem[];
}

export default function SecurityPage() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getSecurityMonitoring();
      setData(res);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load security monitoring data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeAlertsCount = data?.alerts?.length || 0;

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Security Monitoring
            </h1>
            {!loading && !error && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  activeAlertsCount > 0
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    activeAlertsCount > 0
                      ? "bg-rose-500 animate-pulse"
                      : "bg-emerald-500"
                  }`}
                />
                {activeAlertsCount > 0
                  ? `${activeAlertsCount} Active ${
                      activeAlertsCount === 1 ? "Alert" : "Alerts"
                    }`
                  : "All Systems Normal"}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Threshold-based suspicious activity detection and automated threat monitoring.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start sm:self-auto rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          Refresh Telemetry
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-8 text-center shadow-sm">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-rose-900">Telemetry Error</h2>
          <p className="mt-1 text-sm text-rose-600 max-w-md mx-auto">{error}</p>
          <button
            onClick={loadData}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry Connection
          </button>
        </div>
      ) : loading ? (
        <SecuritySkeleton />
      ) : (
        <>
          {/* Detection Threshold Rules */}
          <section className="space-y-3">
            <div>
              <h2 className="text-xs font-bold tracking-wider uppercase text-slate-500">
                Detection Threshold Rules (10 min window)
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <RuleCard
                title="Failed Logins"
                threshold={`≥ ${data?.thresholds.failed_logins ?? 0}`}
                description="Triggers alert on repeated auth failures"
                icon={Lock}
                iconBg="bg-indigo-50 text-indigo-600 border-indigo-100"
              />
              <RuleCard
                title="Mass Downloads"
                threshold={`≥ ${data?.thresholds.downloads ?? 0}`}
                description="Triggers on high volume file downloads"
                icon={Download}
                iconBg="bg-blue-50 text-blue-600 border-blue-100"
              />
              <RuleCard
                title="Denied Actions"
                threshold={`≥ ${data?.thresholds.denied_actions ?? 0}`}
                description="Triggers on repeated permission denials"
                icon={Ban}
                iconBg="bg-rose-50 text-rose-600 border-rose-100"
              />
            </div>
          </section>

          {/* Current Security Alerts */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Current Alerts
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Anomalies detected within the active monitoring evaluation window.
              </p>
            </div>

            {!data?.alerts?.length ? (
              <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3 border border-emerald-200">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  No suspicious activity detected
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  All security metric thresholds are operating within healthy limits.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.alerts.map((a, idx) => (
                  <AlertCard key={`${a.type}-${idx}`} alert={a} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function RuleCard({
  title,
  threshold,
  description,
  icon: Icon,
  iconBg,
}: {
  title: string;
  threshold: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md flex items-start gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            {threshold}
          </span>
          <span className="text-[10px] text-slate-400 uppercase font-mono font-medium">/ 10m</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {description}
        </p>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const severity = alert.severity?.toLowerCase() || "medium";

  const severityStyles: Record<string, string> = {
    critical: "bg-rose-100 text-rose-800 border-rose-300",
    high: "bg-rose-50 text-rose-700 border-rose-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm transition-all hover:border-slate-300 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {alert.title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
            {alert.description}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            severityStyles[severity] || severityStyles.medium
          }`}
        >
          {alert.severity}
        </span>
      </div>

      {alert.top_ips && alert.top_ips.length > 0 && (
        <div className="pt-3 border-t border-slate-200/80">
          <span className="text-[11px] font-medium text-slate-500 block mb-2">
            Flagged Source IP Addresses:
          </span>
          <div className="flex flex-wrap gap-2">
            {alert.top_ips.map(([ip, count]) => (
              <span
                key={ip}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[11px] font-mono text-slate-700 border border-slate-200 shadow-2xs"
              >
                <span>{ip}</span>
                <span className="rounded-full bg-slate-100 border border-slate-200/80 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                  {count} {count === 1 ? "event" : "events"}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SecuritySkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white shadow-sm" />
        ))}
      </div>
      <div className="h-64 rounded-xl border border-slate-200 bg-white shadow-sm" />
    </div>
  );
}