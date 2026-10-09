import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";

function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const Card = ({ title, children }) => (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>{title}</h3>
        {children}
    </div>
);

export default function Admin() {
    const [forbidden, setForbidden] = useState(false);
    const [logs, setLogs] = useState(null);
    const [suspicious, setSuspicious] = useState(null);
    const [storage, setStorage] = useState(null);
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        // Each card fetches and renders independently now — previously this used
        // Promise.all, which meant every card stayed on "Loading..." until the
        // SLOWEST of the four calls finished, even if the other three had
        // already come back. A cold backend (free-tier spin-down) made that
        // wait feel like the whole page was frozen.
        const onForbidden = (err) => {
            if (err.response && err.response.status === 403) setForbidden(true);
        };

        api.get("/admin/audit-logs?limit=25").then((res) => setLogs(res.data)).catch(onForbidden);
        api.get("/admin/security/suspicious-logins").then((res) => setSuspicious(res.data)).catch(onForbidden);
        api.get("/admin/analytics/storage").then((res) => setStorage(res.data)).catch(onForbidden);
        api.get("/admin/reports/security-summary").then((res) => setSummary(res.data)).catch(onForbidden);
    }, []);

    if (forbidden) {
        return (
            <Layout active="admin" eyebrow="Secure file sharing" title="Admin">
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                    Admin access required. This section is only visible to accounts with the admin role.
                </div>
            </Layout>
        );
    }

    return (
        <Layout active="admin" eyebrow="Secure file sharing" title="Admin dashboard">
            <Card title="Security summary (last 7 days)">
                {summary ? (
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                        {Object.entries(summary.action_counts).map(([action, count]) => (
                            <div key={action}>
                                <div style={{ fontSize: 22, fontWeight: 700 }}>{count}</div>
                                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{action.replace(/_/g, " ")}</div>
                            </div>
                        ))}
                        {Object.keys(summary.action_counts).length === 0 && (
                            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No activity in this period.</div>
                        )}
                    </div>
                ) : (
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
                )}
            </Card>

            <Card title="Suspicious logins">
                {suspicious && suspicious.flagged_users.length === 0 && (
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                        No accounts currently flagged (threshold: {suspicious.threshold}+ failed attempts in 15 minutes).
                    </div>
                )}
                {suspicious &&
                    suspicious.flagged_users.map((u) => (
                        <div key={u.user_id} style={{ padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                            <strong>{u.email}</strong> — {u.failed_login_count} failed attempts in the last {u.window_minutes} minutes
                        </div>
                    ))}
                {!suspicious && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>}
            </Card>

            <Card title="Storage usage by user">
                {!storage && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>}
                {storage && (
                    <>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                            Platform total: {storage.platform_total.file_count} files, {formatBytes(storage.platform_total.total_bytes)}
                        </div>
                        {storage.by_user.map((u) => (
                            <div
                                key={u.user_id}
                                style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}
                            >
                                <span>{u.email}</span>
                                <span style={{ color: "var(--text-muted)" }}>
                                    {u.file_count} files · {formatBytes(u.total_bytes)}
                                </span>
                            </div>
                        ))}
                    </>
                )}
            </Card>

            <Card title="Recent audit log (all users)">
                {logs === null && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>}
                {logs !== null && logs.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No activity yet.</div>}
                {logs !== null && logs.map((log, idx) => (
                    <div
                        key={idx}
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "8px 0",
                            borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                            fontSize: 13,
                        }}
                    >
                        <span>
                            {log.action}
                            {log.category === "security" && (
                                <span style={{ marginLeft: 8, color: "var(--danger)", fontSize: 11, fontWeight: 700 }}>SECURITY</span>
                            )}
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                ))}
            </Card>
        </Layout>
    );
}