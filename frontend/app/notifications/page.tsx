"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Notifications() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      setLoading(true);

      const email = localStorage.getItem("userEmail") || "";

      if (!email) {
        console.error("User email not found.");
        setNotifications([]);
        return;
      }

      const response = await fetch(
        `http://127.0.0.1:8000/notifications?email=${encodeURIComponent(
          email
        )}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      console.log("Notifications API response:", data);

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to load notifications"
        );
      }

      // Backend returns:
      // { notifications: [...] }
      setNotifications(
        Array.isArray(data.notifications) ? data.notifications : []
      );
    } catch (error) {
      console.error("Notification loading error:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: number) => {
    try {
      const email = localStorage.getItem("userEmail") || "";

      if (!email) {
        alert("User email not found. Please login again.");
        return;
      }

      const response = await fetch(
        `http://127.0.0.1:8000/notifications/${id}/read?email=${encodeURIComponent(
          email
        )}`,
        {
          method: "PUT",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to mark notification as read"
        );
      }

      // Reload notifications after marking as read
      await loadNotifications();
    } catch (error) {
      console.error("Mark read error:", error);
      alert("Unable to mark notification as read.");
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>
              <h1 className="text-3xl font-bold text-blue-600">
                Notifications
              </h1>

              <p className="text-gray-600 mt-2">
                Security alerts and system notifications
              </p>
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Back to Dashboard
            </button>

          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl shadow-lg p-6">

          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl font-semibold text-gray-800">
              Your Notifications
            </h2>

            <button
              onClick={loadNotifications}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="text-center py-10">
              <p className="text-gray-500">
                Loading notifications...
              </p>
            </div>

          ) : notifications.length === 0 ? (

            /* No notifications */
            <div className="text-center py-10">
              <p className="text-gray-500">
                No notifications available.
              </p>
            </div>

          ) : (

            /* Notification list */
            <div className="space-y-4">

              {notifications.map((item) => (

                <div
                  key={item.id}
                  className={`border rounded-xl p-5 ${
                    item.is_read
                      ? "bg-gray-50 border-gray-200"
                      : "bg-blue-50 border-blue-200"
                  }`}
                >

                  <div className="flex flex-col md:flex-row md:justify-between gap-4">

                    <div className="flex-1">

                      {/* Notification type */}
                      <div className="flex items-center gap-2">

                        <span className="text-xl">
                          {item.notification_type === "SECURITY_ALERT"
                            ? "🚨"
                            : "🔔"}
                        </span>

                        <p className="font-semibold text-gray-800">
                          {item.notification_type}
                        </p>

                        {!item.is_read && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                            NEW
                          </span>
                        )}

                      </div>

                      {/* Message */}
                      <p className="text-gray-600 mt-2">
                        {item.message}
                      </p>

                      {/* Date */}
                      <p className="text-xs text-gray-400 mt-3">
                        {item.created_at}
                      </p>

                    </div>

                    {/* Mark Read */}
                    {!item.is_read && (
                      <button
                        onClick={() => markRead(item.id)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 h-fit"
                      >
                        Mark Read
                      </button>
                    )}

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