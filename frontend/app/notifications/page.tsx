"use client";

import { useEffect, useState } from "react";

type Notification = {
  id: number;
  user_email: string;
  notification_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================
  // LOAD NOTIFICATIONS
  // ==========================================

  const loadNotifications = async () => {
    await fetch(
  "http://127.0.0.1:8000/notifications/expiration-reminders",
  {
    method: "POST",
  }
);
    try {
      const email =
        localStorage.getItem("userEmail") || "";

      if (!email) {
        setError(
          "User email not found. Please login again."
        );
        setLoading(false);
        return;
      }

      const response = await fetch(
        `http://127.0.0.1:8000/notifications?email=${encodeURIComponent(
          email
        )}&t=${Date.now()}`,
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
            : "Failed to load notifications"
        );
      }

      // Backend returns:
      // { notifications: [...] }

      setNotifications(
        Array.isArray(data.notifications)
          ? data.notifications
          : []
      );

      setError("");
    } catch (error) {
      console.error(
        "Notification loading error:",
        error
      );

      setError(
        "Unable to load notifications from backend."
      );

      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // MARK AS READ
  // ==========================================

  const markAsRead = async (
    notificationId: number
  ) => {
    try {
      const email =
        localStorage.getItem("userEmail") || "";

      if (!email) {
        return;
      }

      const response = await fetch(
        `http://127.0.0.1:8000/notifications/${notificationId}/read?email=${encodeURIComponent(
          email
        )}`,
        {
          method: "PUT",
        }
      );

      if (!response.ok) {
        return;
      }

      // Update UI immediately
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                is_read: true,
              }
            : notification
        )
      );
    } catch (error) {
      console.error(
        "Mark notification read error:",
        error
      );
    }
  };

  // ==========================================
  // INITIAL LOAD + AUTO REFRESH
  // ==========================================

  useEffect(() => {
    loadNotifications();

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      loadNotifications();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // ==========================================
  // NOTIFICATION ICON
  // ==========================================

  const getIcon = (type: string) => {
    switch (type) {
      case "FILE_SHARED":
        return "📤";

      case "FILE_DOWNLOADED":
        return "📥";

      case "ACCESS_ALERT":
        return "👁️";

      case "SECURITY_ALERT":
        return "⚠️";

      default:
        return "🔔";
    }
  };

  // ==========================================
  // NOTIFICATION TITLE
  // ==========================================

  const getTitle = (type: string) => {
    switch (type) {
      case "FILE_SHARED":
        return "File Shared";

      case "FILE_DOWNLOADED":
        return "File Downloaded";

      case "ACCESS_ALERT":
        return "File Access Alert";

      case "SECURITY_ALERT":
        return "Security Alert";

      default:
        return "Notification";
    }
  };

  // ==========================================
  // FORMAT DATE
  // ==========================================

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleString();
    } catch {
      return date;
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">

        {/* ======================================
            HEADER
        ====================================== */}

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">

          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">

            <div>
              <h1 className="text-3xl font-bold text-blue-600">
                Notifications
              </h1>

              <p className="text-gray-600 mt-1">
                File sharing, download and security alerts
              </p>
            </div>

            <button
              onClick={() => {
                setLoading(true);
                loadNotifications();
              }}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
            >
              Refresh
            </button>

          </div>

        </div>

        {/* ======================================
            ERROR
        ====================================== */}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
            {error}
          </div>
        )}

        {/* ======================================
            LOADING
        ====================================== */}

        {loading && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-600">
              Loading notifications...
            </p>
          </div>
        )}

        {/* ======================================
            EMPTY
        ====================================== */}

        {!loading &&
          !error &&
          notifications.length === 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">

              <div className="text-5xl mb-4">
                🔔
              </div>

              <h2 className="text-xl font-semibold text-gray-800">
                No notifications
              </h2>

              <p className="text-gray-500 mt-2">
                You do not have any notifications yet.
              </p>

            </div>
          )}

        {/* ======================================
            NOTIFICATION LIST
        ====================================== */}

        {!loading &&
          notifications.length > 0 && (
            <div className="space-y-4">

              {notifications.map(
                (notification) => (
                  <div
                    key={notification.id}
                    className={`bg-white rounded-2xl shadow-lg p-5 border-l-4 ${
                      notification.is_read
                        ? "border-gray-300"
                        : "border-blue-600"
                    }`}
                  >

                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">

                      {/* LEFT SIDE */}

                      <div className="flex gap-4">

                        <div className="text-3xl">
                          {getIcon(
                            notification.notification_type
                          )}
                        </div>

                        <div>

                          <div className="flex flex-wrap items-center gap-2">

                            <h2 className="font-semibold text-lg text-gray-800">
                              {getTitle(
                                notification.notification_type
                              )}
                            </h2>

                            {!notification.is_read && (
                              <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                                NEW
                              </span>
                            )}

                          </div>

                          <p className="text-gray-700 mt-2">
                            {notification.message}
                          </p>

                          <p className="text-xs text-gray-500 mt-3">
                            {formatDate(
                              notification.created_at
                            )}
                          </p>

                        </div>

                      </div>

                      {/* RIGHT SIDE */}

                      {!notification.is_read && (
                        <button
                          onClick={() =>
                            markAsRead(
                              notification.id
                            )
                          }
                          className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 whitespace-nowrap"
                        >
                          Mark as Read
                        </button>
                      )}

                    </div>

                  </div>
                )
              )}

            </div>
          )}

      </div>
    </main>
  );
}