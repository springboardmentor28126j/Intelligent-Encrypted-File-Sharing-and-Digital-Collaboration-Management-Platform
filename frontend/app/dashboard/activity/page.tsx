"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { getActivity, getNotifications, markNotificationRead } from "@/lib/api";
import { 
  Bell, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  Loader2, 
  LogIn, 
  Upload, 
  Info,
  Check,
  Share2,
  FileText,
  Lock
} from "lucide-react";

interface ActivityItem {
  _id?: string;
  action: string;
  status: string;
  timestamp: string;
}

interface NotificationItem {
  id: string;
  kind?: string;
  title?: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function ActivityPage() {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [readingId, setReadingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [actData, notifData] = await Promise.all([
        getActivity(100),
        getNotifications(50),
      ]);
      setActivity(actData || []);
      setNotifications(notifData || []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load activity details."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkRead = async (id: string) => {
    try {
      setReadingId(id);
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((x) => (x.id === id ? { ...x, is_read: true } : x))
      );
    } catch (err) {
      console.error("Failed to mark as read:", err);
    } finally {
      setReadingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadItems = notifications.filter((n) => !n.is_read);
    if (unreadItems.length === 0) return;

    try {
      await Promise.all(unreadItems.map((n) => markNotificationRead(n.id)));
      setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.is_read);
    if (filter === "read") return notifications.filter((n) => n.is_read);
    return notifications;
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getActionIcon = (action: string) => {
    const act = action?.toUpperCase();
    if (act?.includes("LOGIN")) return <LogIn className="w-4 h-4 text-indigo-600" />;
    if (act?.includes("UPLOAD")) return <Upload className="w-4 h-4 text-emerald-600" />;
    return <Activity className="w-4 h-4 text-slate-500" />;
  };

  const getStatusBadge = (status: string) => {
    const isSuccess = status?.toLowerCase() === "success";
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
          isSuccess
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-rose-50 text-rose-700 border border-rose-200"
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
        )}
        <span className="capitalize">{status}</span>
      </span>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Security Activity
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Recent access logs, security events, and notification history.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-rose-800">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-rose-700 underline hover:text-rose-900"
          >
            Try Again
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 gap-2.5">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span className="text-sm font-medium text-slate-600">Loading security logs...</span>
        </div>
      ) : (
        <>
          {/* Notifications Section */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header & Mark All Read */}
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Notifications
                </h2>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Mark all as read
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-100 pb-2">
              <FilterTab
                label="All"
                count={notifications.length}
                active={filter === "all"}
                onClick={() => setFilter("all")}
              />
              <FilterTab
                label="Unread"
                count={unreadCount}
                active={filter === "unread"}
                onClick={() => setFilter("unread")}
              />
              <FilterTab
                label="Read"
                count={notifications.length - unreadCount}
                active={filter === "read"}
                onClick={() => setFilter("read")}
              />
            </div>

            {/* Notification Items List */}
            <div className="p-5">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                  <Info className="w-8 h-8 text-slate-400 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-semibold text-slate-600">
                    No notifications found
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {filter === "unread"
                      ? "You have read all your notifications."
                      : "When security alerts or share events trigger, they will appear here."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredNotifications.map((n) => {
                    const isUnread = !n.is_read;
                    const notificationTitle = n.title || n.kind || "Notification";

                    return (
                      <div
                        key={n.id}
                        className={`relative flex items-start justify-between gap-4 rounded-xl border p-4 shadow-sm transition-all ${
                          isUnread
                            ? "border-blue-200 bg-blue-50/40"
                            : "border-slate-200 bg-slate-50/40 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <NotificationIcon kind={n.kind} isUnread={isUnread} />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-900 capitalize">
                                {notificationTitle.replace(/_/g, " ")}
                              </h3>
                              {isUnread && (
                                <span className="h-2 w-2 rounded-full bg-blue-600" />
                              )}
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {n.message}
                            </p>
                            <time className="block text-[11px] font-medium text-slate-400 pt-1">
                              {formatTimeAgo(n.created_at)}
                            </time>
                          </div>
                        </div>

                        {isUnread && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            disabled={readingId === n.id}
                            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50"
                          >
                            {readingId === n.id ? (
                              <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                            ) : (
                              "Mark read"
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Activity Log Table Section */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Activity Log
                </h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200/60 rounded-full">
                {activity.length} Events
              </span>
            </div>

            {activity.length === 0 ? (
              <div className="p-10 text-center">
                <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3 stroke-[1.5]" />
                <p className="text-sm font-semibold text-slate-700">
                  No activity recorded
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Actions you perform in TrustShare will be logged here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-xs tracking-wider uppercase">
                      <th className="py-3.5 px-6">Action</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {activity.map((e, idx) => (
                      <tr key={e._id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-6 font-medium text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-slate-100 border border-slate-200/60 rounded-lg">
                              {getActionIcon(e.action)}
                            </div>
                            <span className="uppercase tracking-wider text-xs font-bold text-slate-800">
                              {e.action?.replace(/_/g, " ")}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-6">{getStatusBadge(e.status)}</td>
                        <td className="py-3.5 px-6 text-right text-slate-500 text-xs font-medium">
                          {new Date(e.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
          active
            ? "bg-slate-700 text-white"
            : "bg-slate-100 text-slate-600 border border-slate-200/60"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function NotificationIcon({
  kind,
  isUnread,
}: {
  kind?: string;
  isUnread: boolean;
}) {
  const iconKind = kind?.toLowerCase() || "";
  
  let IconComponent = ShieldAlert;
  let colorClass = isUnread
    ? "bg-blue-50 text-blue-600 border border-blue-100"
    : "bg-slate-100 text-slate-500 border border-slate-200";

  if (iconKind.includes("security") || iconKind.includes("mfa") || iconKind.includes("auth")) {
    IconComponent = Lock;
    colorClass = isUnread
      ? "bg-amber-50 text-amber-600 border border-amber-100"
      : colorClass;
  } else if (iconKind.includes("share")) {
    IconComponent = Share2;
    colorClass = isUnread
      ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
      : colorClass;
  } else if (iconKind.includes("file")) {
    IconComponent = FileText;
    colorClass = isUnread
      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
      : colorClass;
  }

  return (
    <div
      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
    >
      <IconComponent className="h-4 w-4" />
    </div>
  );
}

function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return dateString;
  }
}