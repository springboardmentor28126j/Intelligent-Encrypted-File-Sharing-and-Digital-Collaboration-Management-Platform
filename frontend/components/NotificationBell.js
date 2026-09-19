import { useEffect, useRef, useState } from "react";
import api from "../lib/api";

const TYPE_LABELS = {
    share: "Share",
    download: "Download",
    security: "Security",
};

export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const ref = useRef(null);

    const loadUnreadCount = () => {
        api
            .get("/notifications/unread-count")
            .then((res) => setUnreadCount(res.data.unread_count))
            .catch(() => { });
    };

    useEffect(() => {
        loadUnreadCount();
        // Poll every 30s so the badge updates without needing a page refresh.
        const interval = setInterval(loadUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOpen = () => {
        const next = !open;
        setOpen(next);
        if (next) {
            api.get("/notifications").then((res) => setNotifications(res.data));
        }
    };

    const markRead = (id) => {
        api.post(`/notifications/${id}/read`).then(() => {
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
            loadUnreadCount();
        });
    };

    const markAllRead = () => {
        api.post("/notifications/read-all").then(() => {
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);
        });
    };

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <button
                onClick={toggleOpen}
                style={{
                    position: "relative",
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    color: "rgba(255,255,255,0.9)",
                    fontSize: 14,
                }}
            >
                🔔
                {unreadCount > 0 && (
                    <span
                        style={{
                            position: "absolute",
                            top: -4,
                            right: -4,
                            background: "var(--danger)",
                            color: "#fff",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 700,
                            minWidth: 16,
                            height: 16,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0 3px",
                        }}
                    >
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    style={{
                        position: "absolute",
                        right: 0,
                        top: "calc(100% + 8px)",
                        width: 340,
                        maxHeight: 420,
                        overflowY: "auto",
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        boxShadow: "0 12px 32px rgba(16,36,62,0.18)",
                        zIndex: 50,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "12px 14px",
                            borderBottom: "1px solid var(--border)",
                        }}
                    >
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Notifications</span>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                style={{ background: "transparent", border: "none", color: "var(--lime-dark)", fontSize: 12 }}
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {notifications.length === 0 && (
                        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                            No notifications yet.
                        </div>
                    )}

                    {notifications.map((n) => (
                        <div
                            key={n.id}
                            onClick={() => !n.is_read && markRead(n.id)}
                            style={{
                                padding: "12px 14px",
                                borderBottom: "1px solid var(--border)",
                                background: n.is_read ? "transparent" : "rgba(245,185,66,0.08)",
                                cursor: n.is_read ? "default" : "pointer",
                            }}
                        >
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                                {TYPE_LABELS[n.type] || n.type}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--text)" }}>{n.message}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                {new Date(n.created_at).toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
