"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import MFASetup from "@/components/MFASetup";
import { getSessions, revokeSession, logoutAllSessions } from "@/lib/api";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    getSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Manage your account, MFA and active sessions.</p>
        </div>
      </div>

      <section className="panel">
        <h2>Profile</h2>
        <div className="profile-grid">
          <div>
            <span>Name</span>
            <strong>{user?.name ?? "—"}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{user?.email ?? "—"}</strong>
          </div>
          <div>
            <span>Role</span>
            <strong>{user?.role ?? "—"}</strong>
          </div>
          <div>
            <span>Storage</span>
            <strong>
              {((user?.used_storage ?? 0) / 1024 / 1024).toFixed(1)} MB /{" "}
              {((user?.storage_quota ?? 0) / 1024 / 1024 / 1024).toFixed(1)} GB
            </strong>
          </div>
        </div>
      </section>

      <MFASetup enabled={user?.mfa_enabled ?? false} onChanged={refreshUser} />

      <section className="panel">
        <div className="page-header">
          <div>
            <h2>Active sessions</h2>
            <p>Revoke devices you no longer recognize.</p>
          </div>
          <button
            onClick={async () => {
              if (confirm("Sign out all other sessions?")) {
                await logoutAllSessions();
                load();
              }
            }}
          >
            Revoke all
          </button>
        </div>

        {loading ? (
          <p>Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p>No active sessions.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>IP</th>
                  <th>Created</th>
                  <th>Last seen</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.user_agent || "Unknown device"}</td>
                    <td>{s.ip_address || "—"}</td>
                    <td>{new Date(s.created_at).toLocaleString()}</td>
                    <td>{"—"}</td>
                    <td>{s.current ? "Current" : "Active"}</td>
                    <td>
                      {!s.current && (
                        <button
                          onClick={async () => {
                            await revokeSession(s.id);
                            load();
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}