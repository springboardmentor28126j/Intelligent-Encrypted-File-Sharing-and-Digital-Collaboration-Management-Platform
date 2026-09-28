"use client";

import { useEffect, useState } from "react";

export default function Analytics() {
  const [storage, setStorage] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const [storageResponse, usageResponse] = await Promise.all([
        fetch("http://127.0.0.1:8000/analytics/storage", {
          cache: "no-store",
        }),
        fetch("http://127.0.0.1:8000/analytics/usage", {
          cache: "no-store",
        }),
      ]);

      const storageData = await storageResponse.json();
      const usageData = await usageResponse.json();

      setStorage(storageData);
      setUsage(usageData);
    } catch (error) {
      console.error("Analytics loading error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Loading analytics...</p>
      </main>
    );
  }

  const usageData = usage?.action_summary || [];

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-blue-600">
            TrustShare Analytics
          </h1>

          <p className="text-gray-600 mt-2">
            Storage and system usage monitoring
          </p>

          <button
            onClick={loadAnalytics}
            className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
          >
            Refresh Analytics
          </button>
        </div>

        {/* STORAGE SUMMARY */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-500 text-sm">
              Total Files
            </p>

            <p className="text-3xl font-bold text-blue-600 mt-2">
              {storage?.total_files ?? 0}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-500 text-sm">
              Storage Used
            </p>

            <p className="text-3xl font-bold text-purple-600 mt-2">
              {storage?.total_storage_mb ?? 0}
              <span className="text-base ml-1">MB</span>
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-500 text-sm">
              Uploads
            </p>

            <p className="text-3xl font-bold text-green-600 mt-2">
              {storage?.uploads ?? 0}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-500 text-sm">
              Downloads
            </p>

            <p className="text-3xl font-bold text-indigo-600 mt-2">
              {storage?.downloads ?? 0}
            </p>
          </div>

        </div>

        {/* ADDITIONAL STORAGE DATA */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">

          <h2 className="text-2xl font-semibold mb-5">
            Storage Overview
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="border rounded-xl p-4 bg-gray-50">
              <p className="text-gray-500">
                Shared Files
              </p>

              <p className="text-2xl font-bold mt-1">
                {storage?.shared_files ?? 0}
              </p>
            </div>

            <div className="border rounded-xl p-4 bg-red-50 border-red-200">
              <p className="text-gray-500">
                Security Events
              </p>

              <p className="text-2xl font-bold text-red-600 mt-1">
                {storage?.security_events ?? 0}
              </p>
            </div>

          </div>
        </div>

        {/* USAGE ANALYTICS */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">

          <h2 className="text-2xl font-semibold mb-2">
            Usage Analytics
          </h2>

          <p className="text-gray-500 mb-5">
            System activity by action type
          </p>

          {usageData.length === 0 ? (
            <p className="text-gray-500">
              No usage data available.
            </p>
          ) : (
            <div className="space-y-4">

              {usageData.map((item: any, index: number) => (
                <div
                  key={index}
                  className="border rounded-xl p-4"
                >
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">
                      {item.action}
                    </span>

                    <span className="font-bold text-blue-600">
                      {item.total}
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full"
                      style={{
                        width: `${Math.min(
                          Number(item.total) * 10,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}

            </div>
          )}

        </div>

        {/* FILE DETAILS */}
        <div className="bg-white rounded-2xl shadow-lg p-6">

          <h2 className="text-2xl font-semibold mb-4">
            File Storage Details
          </h2>

          {storage?.files?.length ? (
            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead>
                  <tr className="border-b text-left">
                    <th className="p-3">
                      File
                    </th>

                    <th className="p-3">
                      Size
                    </th>

                    <th className="p-3">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {storage.files.map(
                    (file: any, index: number) => (
                      <tr
                        key={index}
                        className="border-b"
                      >
                        <td className="p-3 font-medium">
                          {file.filename || file.name || "-"}
                        </td>

                        <td className="p-3">
                          {file.size_mb ?? file.size ?? "-"}
                          {file.size_mb !== undefined && " MB"}
                        </td>

                        <td className="p-3 text-green-600">
                          Stored
                        </td>
                      </tr>
                    )
                  )}
                </tbody>

              </table>

            </div>
          ) : (
            <p className="text-gray-500">
              No file storage details available.
            </p>
          )}

        </div>

      </div>
    </main>
  );
}