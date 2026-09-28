"use client";

import { useEffect, useState } from "react";

export default function SecurityAlerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        "http://127.0.0.1:8000/security/suspicious",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to load security alerts"
        );
      }

      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
    } catch (error) {
      console.error("Security alert error:", error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-red-600">
            Security Alerts
          </h1>

          <p className="text-gray-600 mt-2">
            Monitor suspicious and unauthorized activities
          </p>

          <button
            onClick={loadAlerts}
            className="mt-4 bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700"
          >
            Refresh Alerts
          </button>
        </div>

        {/* STATUS */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">
                Suspicious Events
              </p>

              <p className="text-4xl font-bold text-red-600 mt-1">
                {alerts.length}
              </p>
            </div>

            <div
              className={`px-4 py-2 rounded-full font-semibold ${
                alerts.length === 0
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {alerts.length === 0
                ? "No Active Alerts"
                : "Attention Required"}
            </div>
          </div>
        </div>

        {/* ALERT LIST */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-5">
            Suspicious Activity
          </h2>

          {loading ? (
            <p className="text-gray-500">
              Checking security events...
            </p>
          ) : alerts.length === 0 ? (
            <div className="border border-green-200 bg-green-50 rounded-xl p-6">
              <p className="font-semibold text-green-700">
                ✓ No suspicious activity detected
              </p>

              <p className="text-sm text-gray-600 mt-1">
                The system has not detected any recent suspicious
                security events.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className="border border-red-200 bg-red-50 rounded-xl p-5"
                >
                  <div className="flex flex-col md:flex-row md:justify-between gap-3">

                    <div>
                      <p className="font-bold text-red-700">
                        ⚠ {alert.action || "Security Event"}
                      </p>

                      <p className="text-gray-700 mt-2">
                        <span className="font-medium">
                          User:
                        </span>{" "}
                        {alert.user_email || "-"}
                      </p>

                      <p className="text-gray-700">
                        <span className="font-medium">
                          File:
                        </span>{" "}
                        {alert.filename || "-"}
                      </p>

                      <p className="text-gray-700">
                        <span className="font-medium">
                          Status:
                        </span>{" "}
                        {alert.status || "-"}
                      </p>

                      {alert.details && (
                        <p className="text-gray-600 mt-2">
                          {alert.details}
                        </p>
                      )}
                    </div>

                    <div className="text-sm text-gray-500">
                      {alert.created_at || "-"}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}