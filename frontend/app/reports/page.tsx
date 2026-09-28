"use client";

import { useEffect, useState } from "react";

export default function Reports() {
  const [activity, setActivity] = useState<any>(null);
  const [security, setSecurity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    try {
      setLoading(true);

      const [activityResponse, securityResponse] = await Promise.all([
        fetch("http://127.0.0.1:8000/reports/activity?limit=20", {
          cache: "no-store",
        }),
        fetch("http://127.0.0.1:8000/reports/security?limit=20", {
          cache: "no-store",
        }),
      ]);

      const activityData = await activityResponse.json();
      const securityData = await securityResponse.json();

      setActivity(activityData);
      setSecurity(securityData);
    } catch (error) {
      console.error("Report loading error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Loading reports...</p>
      </main>
    );
  }

  const activitySummary = activity?.summary || [];
  const securitySummary = security?.summary || [];

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-blue-600">
            TrustShare Reports
          </h1>

          <p className="text-gray-600 mt-2">
            Activity and security monitoring reports
          </p>

          <button
            onClick={loadReports}
            className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
          >
            Refresh Reports
          </button>
        </div>

        {/* ACTIVITY REPORT */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-2">
            Activity Report
          </h2>

          <p className="text-gray-500 mb-5">
            Summary of file and user activities.
          </p>

          {activitySummary.length === 0 ? (
            <p className="text-gray-500">
              No activity data available.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activitySummary.map((item: any, index: number) => (
                <div
                  key={index}
                  className="border rounded-xl p-4 bg-blue-50"
                >
                  <p className="text-sm text-gray-500">
                    {item.action}
                  </p>

                  <p className="text-3xl font-bold text-blue-600 mt-1">
                    {item.count}
                  </p>

                  <p className="text-sm text-gray-500">
                    Status: {item.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECURITY REPORT */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-2">
            Security Report
          </h2>

          <p className="text-gray-500 mb-5">
            Failed and security-related events.
          </p>

          {securitySummary.length === 0 ? (
            <p className="text-gray-500">
              No security events available.
            </p>
          ) : (
            <div className="space-y-3">
              {securitySummary.map((item: any, index: number) => (
                <div
                  key={index}
                  className="border border-red-200 bg-red-50 rounded-xl p-4 flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold text-gray-800">
                      {item.action}
                    </p>

                    <p className="text-sm text-gray-500">
                      Failed events
                    </p>
                  </div>

                  <span className="text-2xl font-bold text-red-600">
                    {item.failed_events}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RECENT ACTIVITY */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">
            Recent Activity
          </h2>

          {activity?.recent_activity?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-3">User</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">File</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Time</th>
                  </tr>
                </thead>

                <tbody>
                  {activity.recent_activity.map(
                    (item: any, index: number) => (
                      <tr key={index} className="border-b">
                        <td className="p-3">
                          {item.user_email}
                        </td>

                        <td className="p-3 font-medium">
                          {item.action}
                        </td>

                        <td className="p-3">
                          {item.filename || "-"}
                        </td>

                        <td className="p-3">
                          {item.status}
                        </td>

                        <td className="p-3 text-gray-500">
                          {item.created_at}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">
              No recent activity available.
            </p>
          )}
        </div>

      </div>
    </main>
  );
}