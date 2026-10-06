"use client";

import { useEffect, useState } from "react";

interface AuditLog {
  id: number;
  user_email: string;
  action: string;
  filename: string | null;
  status: string;
  details: string | null;
  created_at: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const getLogs = async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/logs?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to load audit logs"
        );
      }

      setLogs(
  Array.isArray(data.audit_logs)
    ? data.audit_logs
    : Array.isArray(data.logs)
    ? data.logs
    : []
);
    } catch (error) {
      console.error("Audit log error:", error);
      setMessage("Unable to load audit logs from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getLogs();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                TrustShare Audit Logs
              </h1>

              <p className="text-gray-600 mt-2">
                Activity monitoring and security audit records.
              </p>
            </div>

            <button
              onClick={getLogs}
              disabled={loading}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh Logs"}
            </button>
          </div>
        </div>

        {message && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
            {message}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl font-semibold text-gray-800">
              Activity Records
            </h2>

            <span className="text-sm text-gray-500">
              {logs.length} record{logs.length !== 1 ? "s" : ""}
            </span>
          </div>

          {loading ? (
            <p className="text-gray-600">
              Loading audit logs...
            </p>
          ) : logs.length === 0 ? (
            <p className="text-gray-600">
              No audit logs found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="border px-3 py-3 text-sm">
                      Time
                    </th>

                    <th className="border px-3 py-3 text-sm">
                      User Email
                    </th>

                    <th className="border px-3 py-3 text-sm">
                      Action
                    </th>

                    <th className="border px-3 py-3 text-sm">
                      File
                    </th>

                    <th className="border px-3 py-3 text-sm">
                      Status
                    </th>

                    <th className="border px-3 py-3 text-sm">
                      Details
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="border px-3 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {new Date(
                          log.created_at
                        ).toLocaleString()}
                      </td>

                      <td className="border px-3 py-3 text-sm text-gray-700">
                        {log.user_email || "-"}
                      </td>

                      <td className="border px-3 py-3 text-sm font-medium text-gray-800">
                        {log.action || "-"}
                      </td>

                      <td className="border px-3 py-3 text-sm text-gray-700">
                        {log.filename || "-"}
                      </td>

                      <td className="border px-3 py-3 text-sm">
                        <span
                          className={`font-semibold ${
                            log.status === "SUCCESS"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {log.status || "-"}
                        </span>
                      </td>

                      <td className="border px-3 py-3 text-sm text-gray-700 min-w-[260px]">
                        {log.details || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => window.history.back()}
            className="bg-gray-700 text-white px-5 py-2 rounded-lg hover:bg-gray-800"
          >
            Back to Dashboard
          </button>
        </div>

      </div>
    </main>
  );
}