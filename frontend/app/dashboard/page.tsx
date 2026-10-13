"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

/* =========================================================
   API
========================================================= */

const API_URL = "http://127.0.0.1:8000";

/* =========================================================
   TYPES
========================================================= */

type Section =
  | "dashboard"
  | "files"
  | "sharing"
  | "manage-shared"
  | "shared"
  | "security"
  | "activity"
  | "reports"
  | "analytics";

type FileItem = {
  id: number;
  filename: string;
  stored_filename?: string;
  file_path?: string;
  owner_id?: number;
  cloudinary_public_id?: string;
};

type SharedFile = {
  id: number;
  share_id?: number;
  file_id: number;
  filename: string;
  owner_id: number;

  owner_name?: string;
  owner_email?: string;

  shared_by?: string;
  shared_by_email?: string;

  permission?: string;
  expires_at?: string | null;
  expired?: boolean;
  created_at?: string | null;
};
type ActivityItem = {
  id: string;
  user_id: number;
  action: string;
  filename: string | null;
  status: string;
  details: string | null;
  target_user: string | null;
  timestamp: string;
};

type SecurityAlert = {
  id: string;
  user_id: number;
  alert_type: string;
  severity: string;
  message: string;
  filename?: string | null;
  ip_address?: string | null;
  read: boolean;
  timestamp?: string | null;
};
const formatDateTime = (
  timestamp: string | null | undefined
) => {
  if (!timestamp) {
    return "-";
  }

  // Backend timestamps without a timezone are stored as UTC.
  // Add Z so JavaScript does not interpret them as local India time.
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp);
  const normalizedTimestamp = hasTimezone
    ? timestamp
    : `${timestamp}Z`;
  const parsedDate = new Date(normalizedTimestamp);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};
/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function DashboardPage() {
  const router = useRouter();

  /* =======================================================
     USER
  ======================================================= */

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  /* =======================================================
     NOTIFICATIONS
  ======================================================= */

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const [activeSection, setActiveSection] =
    useState<Section>("dashboard");

  /* =======================================================
     DATA
  ======================================================= */

const [files, setFiles] =
  useState<FileItem[]>([]);

const [sharedFiles, setSharedFiles] =
  useState<SharedFile[]>([]);

const [myShares, setMyShares] =
  useState<any[]>([]);

const [activities, setActivities] =
  useState<ActivityItem[]>([]);

const [securityAlerts, setSecurityAlerts] =
  useState<SecurityAlert[]>([]);

const [storageAnalytics, setStorageAnalytics] =
  useState<any>(null);

const [analyticsLoading, setAnalyticsLoading] =
  useState(false);

const [activityLoading, setActivityLoading] =
  useState(false);

const [activityReport, setActivityReport] =
  useState<ActivityItem[]>([]);

const [securityReport, setSecurityReport] =
  useState<SecurityAlert[]>([]);
const [suspiciousActivity, setSuspiciousActivity] = useState<any>(null);
const [suspiciousLoading, setSuspiciousLoading] = useState(false);

const [reportLoading, setReportLoading] =
  useState(false);
  /* =======================================================
     UI
  ======================================================= */

  const [loading, setLoading] =
    useState(true);

  // Re-render periodically so expired shares update without a page refresh.
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const [uploading, setUploading] =
    useState(false);

  const [sharing, setSharing] =
    useState(false);

  // Public share-link form state
  const [publicLinkFileId, setPublicLinkFileId] =
    useState<number | "">("");
  const [publicLinkPermission, setPublicLinkPermission] =
    useState("download");
  const [publicLinkExpiration, setPublicLinkExpiration] =
    useState("60");
  const [creatingPublicLink, setCreatingPublicLink] =
    useState(false);
  const [generatedPublicLink, setGeneratedPublicLink] =
    useState("");

  const [searchText, setSearchText] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  /* =======================================================
     SHARE FORM
  ======================================================= */

  const [selectedFileId, setSelectedFileId] =
    useState<number | "">("");

  const [recipientEmail, setRecipientEmail] =
    useState("");

  const [permission, setPermission] =
    useState("view");

  const [expiration, setExpiration] =
    useState("");

  /* =======================================================
     LOAD USER
  ======================================================= */

  useEffect(() => {
    const storedName =
      localStorage.getItem("user_name");

    const storedEmail =
      localStorage.getItem("user_email");

    const storedRole =
      localStorage.getItem("user_role");

    if (storedName) {
      setUserName(storedName);
    }

    if (storedEmail) {
      setUserEmail(storedEmail);
    }

    if (storedRole) {
      setUserRole(storedRole);
    }
  }, []);

  /* =======================================================
     AUTHENTICATION
  ======================================================= */

  useEffect(() => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.push("/");
      return;
    }

    loadAllData();
    loadNotifications();
  }, [router]);

  useEffect(() => {
  if (activeSection === "activity") {
    loadActivities();
  }

  if (activeSection === "security") {
    loadSecurityAlerts();
  }

  if (activeSection === "reports") {
    loadReports();
  }

  if (activeSection === "analytics") {
    loadStorageAnalytics();
  }
  if (activeSection === "security") {
  loadSuspiciousActivity();
}
}, [activeSection]);

  /* =======================================================
     LOAD MY FILES
  ======================================================= */

  const loadFiles = async () => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.push("/");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/files/`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (response.status === 401) {
        localStorage.clear();
        router.push("/");
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Unable to load files."
        );
      }

      const data =
        await response.json();

      /*
        Backend may return:
        [
          ...
        ]

        or:
        {
          success: true,
          files: [...]
        }
      */

      if (Array.isArray(data)) {
        setFiles(data);
      } else if (
        Array.isArray(data?.files)
      ) {
        setFiles(data.files);
      } else {
        setFiles([]);
      }

    } catch (err) {
      console.error(
        "Load files error:",
        err
      );

      setError(
        "Unable to load your files."
      );
    }
  };

  /* =======================================================
     LOAD SHARED WITH ME
  ======================================================= */

  const loadSharedFiles = async () => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      return;
    }

    try {
      const response =
        await fetch(
          `${API_URL}/sharing/shared-with-me`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

      if (
        response.status === 401
      ) {
        localStorage.clear();
        router.push("/");
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Unable to load shared files."
        );
      }

      const data =
        await response.json();

      /*
        Backend returns:

        {
          success: true,
          files: [...]
        }
      */

      if (
        Array.isArray(data)
      ) {
        setSharedFiles(data);
      } else if (
        Array.isArray(data?.files)
      ) {
        setSharedFiles(
          data.files
        );
      } else {
        setSharedFiles([]);
      }

    } catch (err) {
      console.error(
        "Load shared files error:",
        err
      );

      setError(
        "Unable to load shared files."
      );
    }
  };
    /* =======================================================
     LOAD MY SHARED FILES
  ======================================================= */

  const loadMyShares = async () => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.push("/");
      return;
    }

    try {
      const response =
        await fetch(
          `${API_URL}/sharing/my-shares`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

      if (
        response.status === 401
      ) {
        localStorage.clear();
        router.push("/");
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Unable to load your shared files."
        );
      }

      const data =
        await response.json();

      if (
        Array.isArray(data?.files)
      ) {
        setMyShares(
          data.files
        );
      } else {
        setMyShares([]);
      }

    } catch (err) {
      console.error(
        "Load my shares error:",
        err
      );

      setMyShares([]);
    }
  };

  /* =======================================================
     LOAD ACTIVITY
  ======================================================= */

  const loadActivities = async () => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.push("/");
      return;
    }

    try {
      setActivityLoading(true);

      const response =
        await fetch(
          `${API_URL}/activity/`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

      if (response.status === 401) {
        localStorage.clear();
        router.push("/");
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Unable to load activity."
        );
      }

      const data =
        await response.json();

      setActivities(
        Array.isArray(data?.activities)
          ? data.activities
          : []
      );

    } catch (err) {
      console.error(
        "Load activity error:",
        err
      );

      setActivities([]);

    } finally {
      setActivityLoading(false);
    }
  };

  /* =======================================================
     LOAD SECURITY ALERTS
  ======================================================= */

  const loadSecurityAlerts = async () => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.push("/");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/security/alerts`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (response.status === 401) {
        localStorage.clear();
        router.push("/");
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Unable to load security alerts."
        );
      }

      const data = await response.json();

      if (Array.isArray(data?.alerts)) {
        setSecurityAlerts(data.alerts);
      } else {
        setSecurityAlerts([]);
      }
    } catch (err) {
      console.error(
        "Load security alerts error:",
        err
      );

      setSecurityAlerts([]);
    }
  };
    /* =======================================================
     LOAD SUSPICIOUS ACTIVITY
  ======================================================= */

  const loadSuspiciousActivity = async () => {
    try {
      setSuspiciousLoading(true);

      const token =
        localStorage.getItem("access_token");

      if (!token) {
        router.push("/");
        return;
      }

      const response = await fetch(
        `${API_URL}/suspicious/detect`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (response.status === 401) {
        localStorage.clear();
        router.push("/");
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Unable to detect suspicious activity."
        );
      }

      const data = await response.json();

      if (data?.success) {
        setSuspiciousActivity(data);
      } else {
        setSuspiciousActivity(null);
      }
    } catch (err) {
      console.error(
        "Load suspicious activity error:",
        err
      );

      setSuspiciousActivity(null);
    } finally {
      setSuspiciousLoading(false);
    }
  };
    /* =======================================================
     LOAD STORAGE ANALYTICS
  ======================================================= */

  const loadStorageAnalytics = async () => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.push("/");
      return;
    }

    try {
      setAnalyticsLoading(true);

      const response = await fetch(
        `${API_URL}/analytics/storage`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (response.status === 401) {
        localStorage.clear();
        router.push("/");
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Unable to load storage analytics."
        );
      }

      const data = await response.json();

      if (data?.success) {
        setStorageAnalytics(data);
      } else {
        setStorageAnalytics(null);
      }
    } catch (err) {
      console.error(
        "Load storage analytics error:",
        err
      );

      setStorageAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  /* =======================================================
     LOAD REPORTS
  ======================================================= */

  const loadReports = async () => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.push("/");
      return;
    }

    setReportLoading(true);

    try {
      const [
        activityResponse,
        securityResponse,
      ] = await Promise.all([
        fetch(
          `${API_URL}/reports/activity`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        ),

        fetch(
          `${API_URL}/reports/security`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        ),
      ]);

      if (
        activityResponse.status === 401 ||
        securityResponse.status === 401
      ) {
        localStorage.clear();
        router.push("/");
        return;
      }

      if (
        !activityResponse.ok ||
        !securityResponse.ok
      ) {
        throw new Error(
          "Unable to load reports."
        );
      }

      const activityData =
        await activityResponse.json();

      const securityData =
        await securityResponse.json();

      setActivityReport(
        Array.isArray(
          activityData?.activities
        )
          ? activityData.activities
          : []
      );

      setSecurityReport(
        Array.isArray(
          securityData?.alerts
        )
          ? securityData.alerts
          : []
      );

    } catch (err) {
      console.error(
        "Load reports error:",
        err
      );

      setActivityReport([]);
      setSecurityReport([]);

    } finally {
      setReportLoading(false);
    }
  };

  /* =======================================================
     LOAD EVERYTHING
  ======================================================= */

  const loadAllData = async () => {
    setLoading(true);

    setError("");

    await Promise.all([
      loadFiles(),
      loadSharedFiles(),
      loadMyShares(),
      loadSecurityAlerts(),
    ]);

    setLoading(false);
  };

  /* =======================================================
     NOTIFICATIONS
  ======================================================= */

  const loadNotifications = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/notifications/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.error("Unable to load notifications:", response.status);
        return;
      }

      const data = await response.json();
      const items = Array.isArray(data?.notifications)
        ? data.notifications
        : [];

      setNotifications(items);
      setUnreadCount(items.filter((item: any) => !item.is_read).length);
    } catch (err) {
      console.error("Load notifications error:", err);
    }
  };

  const markNotificationRead = async (notificationId: number) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error("Unable to mark notification as read:", response.status);
        return;
      }

      await loadNotifications();
    } catch (err) {
      console.error("Mark notification read error:", err);
    }
  };

  const markAllNotificationsRead = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/notifications/mark-all-read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error("Unable to mark all notifications as read:", response.status);
        return;
      }

      await loadNotifications();
    } catch (err) {
      console.error("Mark all notifications read error:", err);
    }
  };

  /* =======================================================
     UPLOAD
  ======================================================= */

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.push("/");
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile
      );

      const response =
        await fetch(
          `${API_URL}/files/upload`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            body: formData,
          }
        );

      const data =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Upload failed."
        );
      }

      setMessage(
        "File uploaded and encrypted successfully."
      );

      await loadFiles();

    } catch (err: any) {
      console.error(
        "Upload error:",
        err
      );

      setError(
        err.message ||
          "File upload failed."
      );

    } finally {
      setUploading(false);

      event.target.value = "";
    }
  };

  /* =======================================================
     DOWNLOAD MY FILE
  ======================================================= */

  const handleDownload = async (
    fileId: number,
    filename: string
  ) => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.push("/");
      return;
    }

    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          `${API_URL}/files/download/${fileId}`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (!response.ok) {
        const data =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          data?.detail ||
            "Download failed."
        );
      }

      const blob =
        await response.blob();

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement("a");

      link.href = url;

      link.download = filename;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        url
      );

      setMessage(
        "File downloaded successfully."
      );

    } catch (err: any) {
      console.error(
        "Download error:",
        err
      );

      setError(
        err.message ||
          "Download failed."
      );
    }
  };

  /* =======================================================
     DELETE FILE
  ======================================================= */

  const handleDelete = async (
    fileId: number
  ) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this file?"
      );

    if (!confirmed) {
      return;
    }

    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.push("/");
      return;
    }

    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          `${API_URL}/files/${fileId}`,
          {
            method: "DELETE",
            headers: {
              Authorization:
                `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

      const data =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Delete failed."
        );
      }

      setMessage(
        "File deleted successfully."
      );

      await loadFiles();

    } catch (err: any) {
      console.error(
        "Delete error:",
        err
      );

      setError(
        err.message ||
          "Delete failed."
      );
    }
  };

  /* =======================================================
     SHARE FILE
  ======================================================= */

  const handleShare = async () => {
    if (!selectedFileId) {
      setError(
        "Please select a file."
      );
      return;
    }

    if (!recipientEmail.trim()) {
      setError(
        "Please enter the recipient email."
      );
      return;
    }

    if (!expiration) {
      setError(
        "Please select an expiration time."
      );
      return;
    }

    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.push("/");
      return;
    }

    const expirationMap:
      Record<string, number> = {
        "5": 5,
        "10": 10,
        "30": 30,
        "60": 60,
        "1440": 1440,
      };

    const expiresInMinutes =
      expirationMap[expiration];

    if (!expiresInMinutes) {
      setError(
        "Invalid expiration time."
      );
      return;
    }

    setSharing(true);
    setMessage("");
    setError("");

    try {
      const url =
        `${API_URL}/sharing/files/${selectedFileId}/share` +
        `?recipient_email=${encodeURIComponent(
          recipientEmail.trim()
        )}` +
        `&permission=${encodeURIComponent(
          permission
        )}` +
        `&expires_in_minutes=${expiresInMinutes}`;

      const response =
        await fetch(url, {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${token}`,
            Accept: "application/json",
          },
        });

      const data =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Sharing failed."
        );
      }

      setMessage(
        "File shared successfully."
      );

      setRecipientEmail("");

      setSelectedFileId("");

      setExpiration("");

      setPermission("view");

      await loadSharedFiles();

    } catch (err: any) {
      console.error(
        "Share error:",
        err
      );

      setError(
        err.message ||
          "Unable to share file."
      );

    } finally {
      setSharing(false);
    }
  };
  /* =========================================================
     CREATE PUBLIC SHARE LINK
  ========================================================= */
  const handleCreatePublicLink = async () => {
    if (publicLinkFileId === "") {
      setError("Please select a file for the public link.");
      return;
    }

    const authToken = localStorage.getItem("access_token");
    if (!authToken) {
      router.push("/");
      return;
    }

    setCreatingPublicLink(true);
    setMessage("");
    setError("");
    setGeneratedPublicLink("");

    try {
      const query = new URLSearchParams({
        permission: publicLinkPermission,
        expires_in_minutes: publicLinkExpiration,
      });
      const response = await fetch(
        `${API_URL}/sharing/files/${publicLinkFileId}/link?${query.toString()}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: "application/json",
          },
        }
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || "Unable to create public share link.");
      }
      if (!data?.share_url) {
        throw new Error("The server did not return a share URL.");
      }

      setGeneratedPublicLink(data.share_url);
      setMessage("Public share link created successfully.");
    } catch (err: any) {
      console.error("Create public share link error:", err);
      setError(err?.message || "Unable to create public share link.");
    } finally {
      setCreatingPublicLink(false);
    }
  };

  const handleCopyPublicLink = async () => {
    if (!generatedPublicLink) return;
    try {
      await navigator.clipboard.writeText(generatedPublicLink);
      setMessage("Public share link copied to clipboard.");
      setError("");
    } catch (err) {
      setError("Unable to copy automatically. Select and copy the link manually.");
    }
  };

  /* =======================================================
   REVOKE FILE SHARE
======================================================= */

const handleRevokeShare = async (
  fileId: number,
  shareId: number
) => {
  const confirmed = window.confirm(
    "Are you sure you want to revoke this file share?"
  );

  if (!confirmed) {
    return;
  }

  const token =
    localStorage.getItem("access_token");

  if (!token) {
    router.push("/");
    return;
  }

  setMessage("");
  setError("");

  try {
    const response = await fetch(
      `${API_URL}/sharing/files/${fileId}/share/${shareId}`,
      {
        method: "DELETE",
        headers: {
          Authorization:
            `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    const data =
      await response
        .json()
        .catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.detail ||
          "Unable to revoke file sharing."
      );
    }

    setMessage(
      "File sharing revoked successfully."
    );

    await loadMyShares();
    await loadSharedFiles();
    await loadActivities();

  } catch (err: any) {
    console.error(
      "Revoke share error:",
      err
    );

    setError(
      err.message ||
        "Unable to revoke file sharing."
    );
  }
};


  /* =======================================================
     VIEW SHARED FILE
  ======================================================= */

  const handleViewShared = async (
    shareId: number
  ) => {
    const token =
      localStorage.getItem("access_token");

    if (!token) {
      router.push("/");
      return;
    }

    /*
      Open window immediately so
      browser popup blockers do not
      block the secure viewer.
    */

    const newWindow =
      window.open(
        "",
        "_blank"
      );

    if (!newWindow) {
      setError(
        "Please allow pop-ups to view the file."
      );
      return;
    }

    /* =====================================================
       LOADING VIEWER
    ===================================================== */

    newWindow.document.write(`
      <!DOCTYPE html>

      <html>

        <head>

          <title>
            Trust Share - Secure Viewer
          </title>

          <style>

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              background: #f5f7fb;
              font-family: Arial, sans-serif;

              user-select: none;
              -webkit-user-select: none;
              -moz-user-select: none;
              -ms-user-select: none;
            }

            .header {
              background: #111827;
              color: white;
              padding: 20px 28px;
              font-size: 19px;
              font-weight: 600;
            }

            .content {
              max-width: 1000px;
              margin: 35px auto;
              background: white;
              padding: 30px;
              border-radius: 18px;

              box-shadow:
                0 10px 35px
                rgba(0, 0, 0, 0.08);
            }

            .badge {
              display: inline-block;
              background: #ecfdf5;
              color: #047857;
              padding: 7px 13px;
              border-radius: 999px;
              font-size: 12px;
              font-weight: 600;
              margin-bottom: 20px;
            }

            .loading {
              color: #6b7280;
              font-size: 14px;
            }

          </style>

        </head>

        <body>

          <div class="header">
            Trust Share • Secure Viewer
          </div>

          <div class="content">

            <span class="badge">
              View Only • Secure Access
            </span>

            <p class="loading">
              Loading secure file...
            </p>

          </div>

        </body>

      </html>
    `);

    /* =====================================================
       PROTECTION BEFORE FILE LOAD
    ===================================================== */

    const preventEvent = (
      event: Event
    ) => {
      event.preventDefault();
      event.stopPropagation();
    };

    newWindow.document.addEventListener(
      "contextmenu",
      preventEvent
    );

    newWindow.document.addEventListener(
      "copy",
      preventEvent
    );

    newWindow.document.addEventListener(
      "cut",
      preventEvent
    );

    newWindow.document.addEventListener(
      "selectstart",
      preventEvent
    );

    newWindow.document.addEventListener(
      "dragstart",
      preventEvent
    );

    newWindow.document.addEventListener(
      "keydown",
      (event) => {
        const key =
          event.key.toLowerCase();

        /*
          Block:

          Ctrl+C
          Ctrl+X
          Ctrl+A
          Ctrl+S
          Ctrl+P
          Ctrl+U

          Ctrl+Shift+I
          Ctrl+Shift+J
          Ctrl+Shift+C

          F12
        */

        if (
          event.ctrlKey ||
          event.metaKey
        ) {
          if (
            key === "c" ||
            key === "x" ||
            key === "a" ||
            key === "s" ||
            key === "p" ||
            key === "u"
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
        }

        if (
          event.key === "F12"
        ) {
          event.preventDefault();
          event.stopPropagation();
        }

        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.shiftKey &&
          (
            key === "i" ||
            key === "j" ||
            key === "c"
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    );

    try {
      /* ===================================================
         REQUEST SHARED FILE
      =================================================== */

      const response =
        await fetch(
          `${API_URL}/files/view-shared/${shareId}`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
              Accept: "*/*",
            },
          }
        );

      if (!response.ok) {
        const data =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          data?.detail ||
            "Unable to view shared file."
        );
      }

      /* ===================================================
         GET DECRYPTED CONTENT
      =================================================== */

      const blob =
        await response.blob();

      const text =
        await blob.text();

      /* ===================================================
         ESCAPE HTML
      =================================================== */

      const escapedText =
        text
          .replace(
            /&/g,
            "&amp;"
          )
          .replace(
            /</g,
            "&lt;"
          )
          .replace(
            />/g,
            "&gt;"
          )
          .replace(
            /"/g,
            "&quot;"
          )
          .replace(
            /'/g,
            "&#039;"
          );

      /* ===================================================
         SECURE VIEWER
      =================================================== */

      newWindow.document.open();

      newWindow.document.write(`
        <!DOCTYPE html>

        <html>

          <head>

            <title>
              Trust Share - Secure Viewer
            </title>

            <style>

              * {
                box-sizing: border-box;
              }

              body {
                margin: 0;
                background: #f5f7fb;
                font-family: Arial, sans-serif;

                user-select: none !important;
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;

                -webkit-touch-callout: none;
              }

              .header {
                background: #111827;
                color: white;
                padding: 20px 28px;
                font-size: 19px;
                font-weight: 600;
              }

              .content {
                max-width: 1000px;
                margin: 35px auto;
                background: white;
                padding: 30px;
                border-radius: 18px;

                box-shadow:
                  0 10px 35px
                  rgba(0, 0, 0, 0.08);
              }

              .badge {
                display: inline-block;
                background: #ecfdf5;
                color: #047857;
                padding: 7px 13px;
                border-radius: 999px;
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 18px;
              }

              .security {
                margin-bottom: 20px;
                padding: 13px 15px;
                border-radius: 10px;

                background: #f0fdf4;
                color: #166534;

                font-size: 12px;
                line-height: 1.5;
              }

              .file-content {
                white-space: pre-wrap;
                word-break: break-word;

                background: #f8fafc;

                padding: 22px;

                border-radius: 12px;

                line-height: 1.6;

                font-family:
                  Consolas,
                  "Courier New",
                  monospace;

                font-size: 14px;

                user-select: none !important;
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;

                -webkit-touch-callout: none;
                -webkit-user-drag: none;
              }

            </style>

          </head>

          <body>

            <div class="header">
              Trust Share • Secure Viewer
            </div>

            <div class="content">

              <span class="badge">
                View Only • Secure Access
              </span>

              <div class="security">
                🔒
                View-only protection is enabled.
                Normal copying, selection and
                downloading are restricted.
              </div>

              <div
                class="file-content"
                oncopy="return false"
                oncut="return false"
                onselectstart="return false"
                oncontextmenu="return false"
                ondragstart="return false"
              >${escapedText}</div>

            </div>

          </body>

        </html>
      `);

      newWindow.document.close();

      /* ===================================================
         RE-APPLY SECURITY
      =================================================== */

      newWindow.document.addEventListener(
        "contextmenu",
        preventEvent
      );

      newWindow.document.addEventListener(
        "copy",
        preventEvent
      );

      newWindow.document.addEventListener(
        "cut",
        preventEvent
      );

      newWindow.document.addEventListener(
        "selectstart",
        preventEvent
      );

      newWindow.document.addEventListener(
        "dragstart",
        preventEvent
      );

      newWindow.document.addEventListener(
        "keydown",
        (event) => {
          const key =
            event.key.toLowerCase();

          if (
            event.ctrlKey ||
            event.metaKey
          ) {
            if (
              key === "c" ||
              key === "x" ||
              key === "a" ||
              key === "s" ||
              key === "p" ||
              key === "u"
            ) {
              event.preventDefault();
              event.stopPropagation();
            }
          }

          if (
            event.key === "F12"
          ) {
            event.preventDefault();
            event.stopPropagation();
          }

          if (
            (event.ctrlKey ||
              event.metaKey) &&
            event.shiftKey &&
            (
              key === "i" ||
              key === "j" ||
              key === "c"
            )
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
      );

    } catch (err: any) {
      console.error(
        "View shared file error:",
        err
      );

      newWindow.document.open();

      newWindow.document.write(`
        <!DOCTYPE html>

        <html>

          <head>

            <title>
              Trust Share - Error
            </title>

          </head>

          <body
            style="
              font-family: Arial, sans-serif;
              padding: 40px;
              background: #f8fafc;
            "
          >

            <h2>
              Unable to open file
            </h2>

            <p>
              ${
                err.message ||
                "Something went wrong."
              }
            </p>

          </body>

        </html>
      `);

      newWindow.document.close();

      setError(
        err.message ||
          "Unable to view shared file."
      );
    }
  };

  /* =======================================================
     DOWNLOAD SHARED FILE
  ======================================================= */
  const handleDownloadShared = async (
    shareId: number,
    filename: string
  ) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/");
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/sharing/shared/${shareId}/download`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/octet-stream, application/json, */*",
          },
        }
      );

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        let detail = "Download failed.";
        if (contentType.includes("application/json")) {
          const data = await response.json().catch(() => null);
          detail = data?.detail || detail;
        } else {
          const text = await response.text().catch(() => "");
          if (text) detail = text.slice(0, 300);
        }
        throw new Error(detail);
      }

      const blob = await response.blob();
      if (!blob.size) {
        throw new Error("The server returned an empty file.");
      }

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename || "download";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);

      setMessage(`Downloaded ${filename || "file"} successfully.`);
    } catch (err: any) {
      console.error("Shared file download error:", err);
      setError(err?.message || "Unable to download shared file.");
    }
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout = () => {
    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem(
      "user_id"
    );

    localStorage.removeItem(
      "user_email"
    );

    localStorage.removeItem(
      "user_name"
    );

    localStorage.removeItem(
      "user_role"
    );

    router.push("/");
  };

  /* =======================================================
     SEARCH MY FILES
  ======================================================= */

  const filteredFiles =
    useMemo(() => {
      const search =
        searchText
          .toLowerCase()
          .trim();

      if (!search) {
        return files;
      }

      return files.filter(
        (file) =>
          file.filename
            .toLowerCase()
            .includes(search)
      );
    }, [
      files,
      searchText,
    ]);

  /* =======================================================
     SEARCH SHARED FILES
  ======================================================= */

  const filteredSharedFiles =
    useMemo(() => {
      const search =
        searchText
          .toLowerCase()
          .trim();

      if (!search) {
        return sharedFiles;
      }

      return sharedFiles.filter(
        (file) =>
          file.filename
            .toLowerCase()
            .includes(search) ||
          (
            file.shared_by ||
            ""
          )
            .toLowerCase()
            .includes(search) ||
          (
            file.shared_by_email ||
            ""
          )
            .toLowerCase()
            .includes(search)
      );
    }, [
      sharedFiles,
      searchText,
    ]);

  /* =======================================================
     EXPIRING SOON
  ======================================================= */

  const expiringSoonCount =
    sharedFiles.filter(
      (file) => {
        if (
          !file.expires_at
        ) {
          return false;
        }

        const expirationDate =
          new Date(
            file.expires_at
          );

        const difference =
          expirationDate.getTime() -
          Date.now();

        return (
          difference > 0 &&
          difference <=
            24 *
              60 *
              60 *
              1000
        );
      }
    ).length;

const navigationItems = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "files", label: "My Files", icon: "▣" },
  { id: "sharing", label: "File Sharing", icon: "↗" },
  { id: "manage-shared", label: "Manage Shared Files", icon: "⚙" },
  { id: "shared", label: "Shared With Me", icon: "🔗" },
  { id: "security", label: "Security", icon: "◇" },
  { id: "activity", label: "Activity", icon: "≡" },
  { id: "reports", label: "Reports", icon: "▤" },
  { id: "analytics", label: "Storage Analytics", icon: "◫" },
];
  /* =======================================================
     DATE FORMAT
  ======================================================= */

  const formatDate = (
    date?: string | null
  ) => {
    if (!date) {
      return "No expiration";
    }

    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return "No expiration";
    }

    return parsedDate.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  /* =======================================================
     INITIALS
  ======================================================= */

  const getInitials = () => {
    if (!userName) {
      return "U";
    }

    const initials =
      userName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(
          (part) =>
            part
              .charAt(0)
              .toUpperCase()
        )
        .join("");

    return initials || "U";
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] flex items-center justify-center">
        <div className="text-center">

          <div
            className="
              mx-auto
              h-12
              w-12
              animate-spin
              rounded-full
              border-4
              border-gray-200
              border-t-gray-900
            "
          />

          <p className="mt-4 text-sm text-gray-500">
            Loading Trust Share...
          </p>

        </div>
      </main>
    );
  }

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-gray-900">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        className="
          fixed
          left-0
          top-0
          z-30
          hidden
          h-screen
          w-[250px]
          flex-col
          border-r
          border-gray-200
          bg-white
          md:flex
        "
      >

        {/* BRAND */}

        <div
          className="
            flex
            h-[86px]
            items-center
            border-b
            border-gray-100
            px-6
          "
        >

          <div className="flex items-center gap-3">

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-gray-900
                text-sm
                font-bold
                text-white
              "
            >
              TS
            </div>

            <div>

              <h1 className="text-lg font-bold">
                Trust Share
              </h1>

              <p className="text-[10px] text-gray-400">
                Secure file workspace
              </p>

            </div>

          </div>

        </div>

        {/* NAVIGATION */}

        <div className="px-4 py-7">

          <p
            className="
              mb-3
              px-3
              text-[10px]
              font-bold
              uppercase
              tracking-[0.2em]
              text-gray-400
            "
          >
            Workspace
          </p>

          <nav className="space-y-1">

            {navigationItems.map(
              (item) => {
                const isActive =
                  activeSection ===
                  item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id as Section);

                      setMessage("");
                      setError("");
                    }}
                    className={`
                      flex
                      w-full
                      items-center
                      gap-3
                      rounded-xl
                      px-4
                      py-3
                      text-sm
                      font-medium
                      transition

                      ${
                        isActive
                          ? "bg-gray-900 text-white shadow-sm"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                      }
                    `}
                  >

                    <span className="w-5 text-center text-lg">
                      {item.icon}
                    </span>

                    <span>
                      {item.label}
                    </span>

                    {item.id ===
                      "shared" &&
                      sharedFiles.length >
                        0 && (
                        <span
                          className={`
                            ml-auto
                            rounded-full
                            px-2
                            py-0.5
                            text-[10px]

                            ${
                              isActive
                                ? "bg-white/15 text-white"
                                : "bg-gray-100 text-gray-500"
                            }
                          `}
                        >
                          {
                            sharedFiles.length
                          }
                        </span>
                      )}

                  </button>
                );
              }
            )}

          </nav>

        </div>

        {/* SECURITY CARD */}

        <div className="mt-auto p-4">

          <div className="rounded-2xl bg-gray-50 p-5">

            <div className="flex items-center justify-between">

              <div
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-xl
                  bg-white
                  text-sm
                  shadow-sm
                "
              >
                ✓
              </div>

              <span
                className="
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-wider
                  text-emerald-600
                "
              >
                Protected
              </span>

            </div>

            <h3 className="mt-4 text-sm font-bold">
              Secure Storage
            </h3>

            <p className="mt-1 text-xs leading-5 text-gray-400">
              Files are encrypted before secure storage.
            </p>

          </div>

        </div>

      </aside>

      {/* =================================================
          MAIN AREA
      ================================================= */}

      <div className="md:ml-[250px]">

        {/* HEADER */}

        <header
          className="
            sticky
            top-0
            z-20
            border-b
            border-gray-200
            bg-white/95
            backdrop-blur
          "
        >

          <div
            className="
              flex
              h-[76px]
              items-center
              justify-between
              px-5
              md:px-8
            "
          >

            {/* SEARCH */}

            <div
              className="
                relative
                w-full
                max-w-md
              "
            >

              <span
                className="
                  absolute
                  left-4
                  top-1/2
                  -translate-y-1/2
                  text-lg
                  text-gray-400
                "
              >
                ⌕
              </span>

              <input
                type="text"
                placeholder="Search files..."
                value={searchText}
                onChange={(e) =>
                  setSearchText(
                    e.target.value
                  )
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-200
                  bg-gray-50
                  py-3
                  pl-11
                  pr-4
                  text-sm
                  outline-none
                  transition
                  focus:border-gray-400
                  focus:bg-white
                "
              />

            </div>

            {/* USER AND NOTIFICATIONS */}

            <div className="ml-5 flex items-center gap-3">
              {/* NOTIFICATION BELL */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    const next = !showNotifications;
                    setShowNotifications(next);
                    if (next) {
                      loadNotifications();
                    }
                  }}
                  aria-label="Notifications"
                  aria-expanded={showNotifications}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-100"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                    <path d="M10 21h4" />
                  </svg>

                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 top-12 z-50 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Notifications
                      </h3>

                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-gray-500">
                          No notifications yet.
                        </p>
                      ) : (
                        notifications.map((notification: any) => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => {
                              if (!notification.is_read) {
                                markNotificationRead(notification.id);
                              }
                            }}
                            className={`block w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${
                              notification.is_read ? "bg-white" : "bg-blue-50"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {!notification.is_read && (
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                              )}

                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-800">
                                  {notification.message}
                                </p>
                                <p className="mt-1 text-xs text-gray-400">
                                  {notification.created_at
                                    ? formatDateTime(notification.created_at)
                                    : ""}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* USER NAME AND ROLE */}
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold">
                  {userName || "User"}
                </p>
                <p className="text-xs text-gray-400">
                  {userRole || "User"}
                </p>
              </div>

              {/* USER AVATAR */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                {getInitials()}
              </div>

              {/* LOGOUT */}
              <button
                onClick={handleLogout}
                className="hidden rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900 sm:block"
              >
                Logout
              </button>
            </div>

          </div>

        </header>

        {/* CONTENT */}

        <div
          className="
            px-5
            py-7
            md:px-8
            md:py-9
          "
        >

          {/* MESSAGES */}

          {message && (
            <div
              className="
                mb-6
                rounded-xl
                border
                border-emerald-200
                bg-emerald-50
                px-4
                py-3
                text-sm
                text-emerald-700
              "
            >
              ✓ {message}
            </div>
          )}

          {error && (
            <div
              className="
                mb-6
                rounded-xl
                border
                border-red-200
                bg-red-50
                px-4
                py-3
                text-sm
                text-red-700
              "
            >
              {error}
            </div>
          )}

          {/* =================================================
              DASHBOARD
          ================================================= */}

          {activeSection ===
            "dashboard" && (
            <section>

              <div
                className="
                  mb-8
                  flex
                  flex-col
                  justify-between
                  gap-5
                  lg:flex-row
                  lg:items-end
                "
              >

                <div>

                  <p
                    className="
                      text-xs
                      font-bold
                      uppercase
                      tracking-[0.2em]
                      text-gray-400
                    "
                  >
                    Secure workspace
                  </p>

                  <h2
                    className="
                      mt-2
                      text-3xl
                      font-bold
                      tracking-tight
                      md:text-4xl
                    "
                  >
                    Welcome back,{" "}
                    {userName
                      ? userName.split(
                          " "
                        )[0]
                      : "User"}
                  </h2>

                  <p
                    className="
                      mt-2
                      max-w-xl
                      text-sm
                      leading-6
                      text-gray-500
                    "
                  >
                    Manage your encrypted files,
                    sharing permissions and
                    secure access from one place.
                  </p>

                </div>

                <label
                  className="
                    inline-flex
                    cursor-pointer
                    items-center
                    justify-center
                    rounded-xl
                    bg-gray-900
                    px-5
                    py-3
                    text-sm
                    font-semibold
                    text-white
                    hover:bg-gray-800
                  "
                >

                  {uploading
                    ? "Uploading..."
                    : "+ Upload File"}

                  <input
                    type="file"
                    className="hidden"
                    onChange={
                      handleUpload
                    }
                    disabled={
                      uploading
                    }
                  />

                </label>

              </div>

              {/* STATISTICS */}

              <div
                className="
                  grid
                  gap-4
                  sm:grid-cols-2
                  xl:grid-cols-4
                "
              >

                <StatCard
                  icon="▣"
                  title="My Files"
                  value={
                    files.length
                  }
                  subtitle="Encrypted files"
                />

                <StatCard
                  icon="↗"
                  title="Shared With Me"
                  value={
                    sharedFiles.length
                  }
                  subtitle="Files shared with you"
                />

                <StatCard
                  icon="◷"
                  title="Expiring Soon"
                  value={
                    expiringSoonCount
                  }
                  subtitle="Within 24 hours"
                />

                <StatCard
                  icon="✓"
                  title="Protection"
                  value="AES-256"
                  subtitle="Encryption active"
                />

              </div>

              {/* RECENT FILES */}

              <div
                className="
                  mt-7
                  grid
                  gap-6
                  xl:grid-cols-[1.45fr_1fr]
                "
              >

                <div
                  className="
                    overflow-hidden
                    rounded-2xl
                    border
                    border-gray-200
                    bg-white
                  "
                >

                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      border-b
                      border-gray-100
                      px-6
                      py-5
                    "
                  >

                    <div>

                      <h3 className="font-bold">
                        Recent Files
                      </h3>

                      <p className="mt-1 text-xs text-gray-400">
                        Your recently uploaded files
                      </p>

                    </div>

                    <button
                      onClick={() =>
                        setActiveSection(
                          "files"
                        )
                      }
                      className="
                        text-xs
                        font-semibold
                        text-gray-500
                        hover:text-gray-900
                      "
                    >
                      View all →
                    </button>

                  </div>

                  {files.length ===
                  0 ? (
                    <EmptyState
                      icon="▣"
                      title="No files yet"
                      description="Upload your first file to start using Trust Share."
                    />
                  ) : (
                    <div className="overflow-x-auto">

                      <table className="w-full text-left">

                        <thead>

                          <tr
                            className="
                              border-b
                              border-gray-100
                              text-[10px]
                              uppercase
                              tracking-wider
                              text-gray-400
                            "
                          >

                            <th className="px-6 py-3">
                              File
                            </th>

                            <th className="px-6 py-3">
                              Security
                            </th>

                            <th className="px-6 py-3 text-right">
                              Action
                            </th>

                          </tr>

                        </thead>

                        <tbody>

                          {files
                            .slice(0, 5)
                            .map(
                              (file) => (
                                <tr
                                  key={
                                    file.id
                                  }
                                  className="
                                    border-b
                                    border-gray-50
                                    last:border-0
                                    hover:bg-gray-50
                                  "
                                >

                                  <td className="px-6 py-4">

                                    <div className="flex items-center gap-3">

                                      <div
                                        className="
                                          flex
                                          h-10
                                          w-10
                                          items-center
                                          justify-center
                                          rounded-xl
                                          bg-gray-100
                                        "
                                      >
                                        ▤
                                      </div>

                                      <div className="min-w-0">

                                        <p
                                          className="
                                            max-w-[230px]
                                            truncate
                                            text-sm
                                            font-semibold
                                          "
                                        >
                                          {
                                            file.filename
                                          }
                                        </p>

                                        <p className="text-xs text-gray-400">
                                          ID #{file.id}
                                        </p>

                                      </div>

                                    </div>

                                  </td>

                                  <td className="px-6 py-4">

                                    <span
                                      className="
                                        rounded-full
                                        bg-emerald-50
                                        px-3
                                        py-1
                                        text-[10px]
                                        font-bold
                                        text-emerald-700
                                      "
                                    >
                                      AES-256
                                    </span>

                                  </td>

                                  <td className="px-6 py-4 text-right">

                                    <button
                                      onClick={() =>
                                        handleDownload(
                                          file.id,
                                          file.filename
                                        )
                                      }
                                      className="
                                        rounded-lg
                                        border
                                        border-gray-200
                                        px-3
                                        py-2
                                        text-xs
                                        font-semibold
                                        hover:bg-gray-100
                                      "
                                    >
                                      Download
                                    </button>

                                  </td>

                                </tr>
                              )
                            )}

                        </tbody>

                      </table>

                    </div>
                  )}

                </div>

                {/* SECURITY */}

                <div
                  className="
                    rounded-2xl
                    bg-gray-900
                    p-7
                    text-white
                  "
                >

                  <div
                    className="
                      flex
                      items-start
                      justify-between
                    "
                  >

                    <div>

                      <p
                        className="
                          text-xs
                          font-bold
                          uppercase
                          tracking-[0.18em]
                          text-gray-400
                        "
                      >
                        Security Center
                      </p>

                      <h3 className="mt-3 text-2xl font-bold">
                        Protected
                      </h3>

                    </div>

                    <div
                      className="
                        flex
                        h-11
                        w-11
                        items-center
                        justify-center
                        rounded-xl
                        bg-white/10
                      "
                    >
                      ✓
                    </div>

                  </div>

                  <p
                    className="
                      mt-4
                      text-sm
                      leading-6
                      text-gray-400
                    "
                  >
                    Trust Share uses multiple security
                    layers to protect files and control
                    access.
                  </p>

                  <div className="mt-7 space-y-3">

                    <SecurityRow
                      title="AES-256-GCM"
                      value="Active"
                    />

                    <SecurityRow
                      title="JWT Authentication"
                      value="Active"
                    />

                    <SecurityRow
                      title="Password Hashing"
                      value="Protected"
                    />

                    <SecurityRow
                      title="Temporary Access"
                      value="Enabled"
                    />

                  </div>

                  <button
                    onClick={() =>
                      setActiveSection(
                        "security"
                      )
                    }
                    className="
                      mt-7
                      w-full
                      rounded-xl
                      bg-white
                      px-4
                      py-3
                      text-sm
                      font-semibold
                      text-gray-900
                      hover:bg-gray-100
                    "
                  >
                    Security Details
                  </button>

                </div>

              </div>

            </section>
          )}

          {/* =================================================
              MY FILES
          ================================================= */}

          {activeSection ===
            "files" && (
            <section>

              <PageHeading
                eyebrow="File management"
                title="My Files"
                description="Manage the files you uploaded and securely stored in Trust Share."
              />

              <div className="mb-6 flex justify-end">

                <label
                  className="
                    cursor-pointer
                    rounded-xl
                    bg-gray-900
                    px-5
                    py-3
                    text-sm
                    font-semibold
                    text-white
                    hover:bg-gray-800
                  "
                >

                  {uploading
                    ? "Uploading..."
                    : "+ Upload File"}

                  <input
                    type="file"
                    className="hidden"
                    onChange={
                      handleUpload
                    }
                    disabled={
                      uploading
                    }
                  />

                </label>

              </div>

              <div
                className="
                  overflow-hidden
                  rounded-2xl
                  border
                  border-gray-200
                  bg-white
                "
              >

                {filteredFiles.length ===
                0 ? (
                  <EmptyState
                    icon="▣"
                    title="No files found"
                    description="Upload a file or change your search."
                  />
                ) : (
                  <div className="overflow-x-auto">

                    <table className="w-full text-left">

                      <thead>

                        <tr
                          className="
                            border-b
                            border-gray-100
                            bg-gray-50/70
                            text-[10px]
                            uppercase
                            tracking-wider
                            text-gray-400
                          "
                        >

                          <th className="px-6 py-4">
                            File
                          </th>

                          <th className="px-6 py-4">
                            Encryption
                          </th>

                          <th className="px-6 py-4">
                            Storage
                          </th>

                          <th className="px-6 py-4 text-right">
                            Actions
                          </th>

                        </tr>

                      </thead>

                      <tbody>

                        {filteredFiles.map(
                          (file) => (
                            <tr
                              key={
                                file.id
                              }
                              className="
                                border-b
                                border-gray-50
                                last:border-0
                                hover:bg-gray-50
                              "
                            >

                              <td className="px-6 py-5">

                                <div className="flex items-center gap-3">

                                  <div
                                    className="
                                      flex
                                      h-11
                                      w-11
                                      items-center
                                      justify-center
                                      rounded-xl
                                      bg-gray-100
                                    "
                                  >
                                    ▤
                                  </div>

                                  <div>

                                    <p className="text-sm font-semibold">
                                      {
                                        file.filename
                                      }
                                    </p>

                                    <p className="mt-1 text-xs text-gray-400">
                                      File ID:{" "}
                                      {
                                        file.id
                                      }
                                    </p>

                                  </div>

                                </div>

                              </td>

                              <td className="px-6 py-5">

                                <span
                                  className="
                                    rounded-full
                                    bg-emerald-50
                                    px-3
                                    py-1.5
                                    text-[10px]
                                    font-bold
                                    text-emerald-700
                                  "
                                >
                                  AES-256-GCM
                                </span>

                              </td>

                              <td className="px-6 py-5 text-xs text-gray-500">

                                {file.cloudinary_public_id
                                  ? "Cloud Storage"
                                  : "Server Storage"}

                              </td>

                              <td className="px-6 py-5">

                                <div
                                  className="
                                    flex
                                    justify-end
                                    gap-2
                                  "
                                >

                                  <button
                                    onClick={() =>
                                      handleDownload(
                                        file.id,
                                        file.filename
                                      )
                                    }
                                    className="
                                      rounded-lg
                                      border
                                      border-gray-200
                                      px-3
                                      py-2
                                      text-xs
                                      font-semibold
                                      hover:bg-gray-100
                                    "
                                  >
                                    Download
                                  </button>

                                  <button
                                    onClick={() => {
                                      setSelectedFileId(
                                        file.id
                                      );

                                      setActiveSection(
                                        "sharing"
                                      );

                                      window.scrollTo({
                                        top: 0,
                                        behavior:
                                          "smooth",
                                      });
                                    }}
                                    className="
                                      rounded-lg
                                      border
                                      border-gray-200
                                      px-3
                                      py-2
                                      text-xs
                                      font-semibold
                                      hover:bg-gray-100
                                    "
                                  >
                                    Share
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleDelete(
                                        file.id
                                      )
                                    }
                                    className="
                                      rounded-lg
                                      border
                                      border-red-100
                                      px-3
                                      py-2
                                      text-xs
                                      font-semibold
                                      text-red-600
                                      hover:bg-red-50
                                    "
                                  >
                                    Delete
                                  </button>

                                </div>

                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>
                )}

              </div>

            </section>
          )}

          {/* =================================================
              FILE SHARING
          ================================================= */}

          {activeSection ===
            "sharing" && (
            <section>

              <PageHeading
                eyebrow="Secure collaboration"
                title="File Sharing"
                description="Share your encrypted files with another registered Trust Share user using temporary access."
              />

              <div
                className="
                  rounded-2xl
                  border
                  border-gray-200
                  bg-white
                  p-6
                  md:p-8
                "
              >

                <div className="mb-7">

                  <h3 className="text-xl font-bold">
                    Share a File
                  </h3>

                  <p className="mt-2 text-sm text-gray-500">
                    Select your file, enter the registered
                    recipient email, choose permission and
                    expiration time.
                  </p>

                </div>

                <ShareForm
                  files={files}
                  selectedFileId={
                    selectedFileId
                  }
                  setSelectedFileId={
                    setSelectedFileId
                  }
                  recipientEmail={
                    recipientEmail
                  }
                  setRecipientEmail={
                    setRecipientEmail
                  }
                  permission={
                    permission
                  }
                  setPermission={
                    setPermission
                  }
                  expiration={
                    expiration
                  }
                  setExpiration={
                    setExpiration
                  }
                  handleShare={
                    handleShare
                  }
                  sharing={sharing}
                />

              </div>

              {/* PUBLIC SHARE LINK */}
              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 md:p-8">
                <div className="mb-6">
                  <h3 className="text-xl font-bold">Share by Link</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Create a secure link for anyone, including people who do not have a TrustShare account.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block text-sm font-medium text-gray-700">
                    File
                    <select
                      value={publicLinkFileId}
                      onChange={(event) => setPublicLinkFileId(event.target.value ? Number(event.target.value) : "")}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-400"
                    >
                      <option value="">Select file</option>
                      {files.map((file) => (
                        <option key={file.id} value={file.id}>{file.filename}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-gray-700">
                    Permission
                    <select
                      value={publicLinkPermission}
                      onChange={(event) => setPublicLinkPermission(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-400"
                    >
                      <option value="view">View Only</option>
                      <option value="download">Download</option>
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-gray-700">
                    Expires After
                    <select
                      value={publicLinkExpiration}
                      onChange={(event) => setPublicLinkExpiration(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-400"
                    >
                      <option value="5">5 minutes</option>
                      <option value="10">10 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="1440">24 hours</option>
                      <option value="10080">7 days</option>
                    </select>
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleCreatePublicLink}
                      disabled={creatingPublicLink || files.length === 0}
                      className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creatingPublicLink ? "Creating Link..." : "Create Share Link"}
                    </button>
                  </div>
                </div>

                {generatedPublicLink && (
                  <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-800">Your public share link is ready</p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input
                        aria-label="Generated public share link"
                        readOnly
                        value={generatedPublicLink}
                        onFocus={(event) => event.currentTarget.select()}
                        className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-700"
                      />
                      <button
                        type="button"
                        onClick={handleCopyPublicLink}
                        className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                      >
                        Copy Link
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      Anyone with this link can access the file according to the selected permission until it expires.
                    </p>
                  </div>
                )}
              </div>

              <div
                className="
                  mt-6
                  rounded-2xl
                  border
                  border-gray-200
                  bg-white
                  p-6
                "
              >

                <h3 className="font-bold">
                  How File Sharing Works
                </h3>

                <div
                  className="
                    mt-5
                    grid
                    gap-4
                    md:grid-cols-4
                  "
                >

                  <InfoStep
                    number="01"
                    title="Select"
                    description="Choose one of your encrypted files."
                  />

                  <InfoStep
                    number="02"
                    title="Recipient"
                    description="Enter the email of a registered user."
                  />

                  <InfoStep
                    number="03"
                    title="Permission"
                    description="Choose View Only access."
                  />

                  <InfoStep
                    number="04"
                    title="Expiration"
                    description="Set when the shared access expires."
                  />

                </div>

              </div>

            </section>
          )}

          {/* =================================================
              SHARED WITH ME
          ================================================= */}

          {activeSection ===
            "shared" && (
            <section>

              <PageHeading
                eyebrow="Secure collaboration"
                title="Shared With Me"
                description="Files that other Trust Share users have shared with your account."
              />

              <div
                className="
                  overflow-hidden
                  rounded-2xl
                  border
                  border-gray-200
                  bg-white
                "
              >

                {filteredSharedFiles.length ===
                0 ? (
                  <EmptyState
                    icon="🔗"
                    title="No shared files"
                    description="Files shared with your account will appear here."
                  />
                ) : (
                  <div className="overflow-x-auto">

                    <table className="w-full text-left">

                      <thead>

                        <tr
                          className="
                            border-b
                            border-gray-100
                            bg-gray-50/70
                            text-[10px]
                            uppercase
                            tracking-wider
                            text-gray-400
                          "
                        >

                          <th className="px-6 py-4">
                            File
                          </th>

                          <th className="px-6 py-4">
                            Shared By
                          </th>

                          <th className="px-6 py-4">
                            Permission
                          </th>

                          <th className="px-6 py-4">
                            Expiration
                          </th>

                          <th className="px-6 py-4 text-right">
                            Action
                          </th>

                        </tr>

                      </thead>

                      <tbody>

                        {filteredSharedFiles.map(
                          (shared) => {

                            /*
                              IMPORTANT:

                              Backend returns:

                              share_id = FileShare.id
                              id       = FileShare.id

                              Prefer share_id when
                              available.
                            */

                            const actualShareId =
                              shared.share_id ??
                              shared.id;

                            const expired =
                              shared.expired === true ||
                              (
                                !!shared.expires_at &&
                                new Date(
                                  shared.expires_at
                                ).getTime() <=
                                  Date.now()
                              );

                            return (
                              <tr
                                key={
                                  actualShareId
                                }
                                className="
                                  border-b
                                  border-gray-50
                                  last:border-0
                                  hover:bg-gray-50
                                "
                              >

                                <td className="px-6 py-5">

                                  <div className="flex items-center gap-3">

                                    <div
                                      className="
                                        flex
                                        h-11
                                        w-11
                                        items-center
                                        justify-center
                                        rounded-xl
                                        bg-gray-100
                                      "
                                    >
                                      ▤
                                    </div>

                                    <div>

                                      <p
                                        className="
                                          max-w-[220px]
                                          truncate
                                          text-sm
                                          font-semibold
                                        "
                                      >
                                        {
                                          shared.filename
                                        }
                                      </p>

                                      <p className="text-xs text-gray-400">
                                        Share #{
                                          actualShareId
                                        }
                                      </p>

                                    </div>

                                  </div>

                                </td>

                                <td className="px-6 py-5">

                                  <p className="text-sm font-medium">
                                    {
                                      shared.shared_by ||
                                      shared.shared_by_email ||
                                      "Trust Share user"
                                    }
                                  </p>

                                  {shared.shared_by_email &&
                                    shared.shared_by &&
                                    (
                                      <p className="mt-1 text-xs text-gray-400">
                                        {
                                          shared.shared_by_email
                                        }
                                      </p>
                                    )}

                                </td>

                                <td className="px-6 py-5">

                                  <span
                                    className="
                                      rounded-full
                                      bg-blue-50
                                      px-3
                                      py-1.5
                                      text-[10px]
                                      font-bold
                                      text-blue-700
                                    "
                                  >
                                    {shared.permission ===
                                    "download"
                                      ? "Download"
                                      : "View Only"}
                                  </span>

                                </td>

                                <td className="px-6 py-5">

                                  <span
                                    className={`
                                      text-xs
                                      font-medium

                                      ${
                                        expired
                                          ? "text-red-600"
                                          : "text-gray-500"
                                      }
                                    `}
                                  >
                                    {expired
                                      ? "Expired"
                                      : formatDate(
                                          shared.expires_at
                                        )}
                                  </span>

                                </td>

                                <td className="px-6 py-5 text-right">

                                  {expired ? (
                                    <button
                                      type="button"
                                      disabled
                                      className="cursor-not-allowed rounded-lg bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-400"
                                    >
                                      Expired
                                    </button>
                                  ) : (shared.permission || "view").trim().toLowerCase() === "download" ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadShared(actualShareId, shared.filename)}
                                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                                    >
                                      Download
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleViewShared(actualShareId)}
                                      className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                                    >
                                      View
                                    </button>
                                  )}

                                </td>

                              </tr>
                            );
                          }
                        )}

                      </tbody>

                    </table>

                  </div>
                )}

              </div>

            </section>
          )}

          {/* =================================================
              SECURITY
          ================================================= */}

          {activeSection ===
            "security" && (
            <section>

              <PageHeading
                eyebrow="Protection"
                title="Security Center"
                description="Review the security mechanisms and security alerts detected in your Trust Share workspace."
              />

              <div
                className="
                  grid
                  gap-5
                  lg:grid-cols-2
                "
              >

                <SecurityLargeCard
                  icon="◇"
                  title="AES-256-GCM Encryption"
                  description="Uploaded files are encrypted before being stored."
                  status="Active"
                />

                <SecurityLargeCard
                  icon="◆"
                  title="JWT Authentication"
                  description="Authenticated API requests are protected using JWT access tokens."
                  status="Active"
                />

                <SecurityLargeCard
                  icon="●"
                  title="Password Protection"
                  description="User passwords are stored using secure password hashing."
                  status="Protected"
                />

                <SecurityLargeCard
                  icon="◷"
                  title="Temporary File Access"
                  description="Shared access can automatically expire after the selected duration."
                  status="Enabled"
                />

              </div>

              {/* SECURITY ALERTS */}

              <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">

                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">

                  <div>
                    <h3 className="font-bold">
                      Security Alerts
                    </h3>

                    <p className="mt-1 text-xs text-gray-400">
                      Security events detected for your account.
                    </p>
                  </div>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-bold text-gray-600">
                    {securityAlerts.length} Alert{securityAlerts.length === 1 ? "" : "s"}
                  </span>

                </div>

                {securityAlerts.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-600">
                      ✓
                    </div>
                    <h4 className="mt-4 text-sm font-bold">
                      No security alerts
                    </h4>
                    <p className="mt-1 text-xs text-gray-400">
                      No suspicious security events have been detected.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {securityAlerts.map((alert) => {
                      const severity =
                        (alert.severity || "medium").toLowerCase();

                      const severityClass =
                        severity === "high"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : severity === "medium"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-blue-50 text-blue-700 border-blue-200";

                      return (
                        <div
                          key={alert.id}
                          className="px-6 py-5 hover:bg-gray-50"
                        >

                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                            <div className="flex min-w-0 gap-4">

                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${severityClass}`}>
                                {severity === "high" ? "!" : "•"}
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-semibold text-gray-900">
                                    {alert.alert_type
                                      ? alert.alert_type
                                          .replace(/_/g, " ")
                                          .replace(/\b\w/g, (char) => char.toUpperCase())
                                      : "Security Alert"}
                                  </h4>

                                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${severityClass}`}>
                                    {severity}
                                  </span>
                                </div>

                                <p className="mt-2 text-sm leading-6 text-gray-600">
                                  {alert.message}
                                </p>

                                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400">
                                  {alert.filename && (
                                    <span>
                                      File: {alert.filename}
                                    </span>
                                  )}

                                  {alert.ip_address && (
                                    <span>
                                      IP: {alert.ip_address}
                                    </span>
                                  )}

                                  {alert.timestamp && (
                                    <span>
                                      {formatDateTime(alert.timestamp)}
                                    </span>
                                  )}
                                </div>
                              </div>

                            </div>

                            <span
                              className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold ${
                                alert.read
                                  ? "bg-gray-100 text-gray-500"
                                  : "bg-gray-900 text-white"
                              }`}
                            >
                              {alert.read ? "Read" : "New"}
                            </span>

                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* SUSPICIOUS ACTIVITY DETECTION */}

              <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">

                <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

                  <div>
                    <h3 className="font-bold">
                      Suspicious Activity Detection
                    </h3>

                    <p className="mt-1 text-xs text-gray-400">
                      Automatically detects unusual security activity in the last 10 minutes.
                    </p>
                  </div>

                  <button
                    onClick={loadSuspiciousActivity}
                    disabled={suspiciousLoading}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {suspiciousLoading ? "Checking..." : "Refresh"}
                  </button>

                </div>

                {suspiciousLoading ? (

                  <div className="px-6 py-10 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
                    <p className="mt-4 text-sm text-gray-500">
                      Checking for suspicious activity...
                    </p>
                  </div>

                ) : suspiciousActivity?.suspicious ? (

                  <div className="p-6">
                    {Array.isArray(suspiciousActivity.events) &&
                      suspiciousActivity.events.map((event: any, index: number) => {
                        const severity = (event.severity || "medium").toLowerCase();

                        const severityClass =
                          severity === "high"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : severity === "medium"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-blue-200 bg-blue-50 text-blue-700";

                        return (
                          <div
                            key={`${event.type || "event"}-${index}`}
                            className="rounded-xl border p-5"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex min-w-0 gap-4">
                                <div
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg font-bold ${severityClass}`}
                                >
                                  !
                                </div>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="text-sm font-semibold text-gray-900">
                                      {event.type || "Suspicious Activity"}
                                    </h4>

                                    <span
                                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${severityClass}`}
                                    >
                                      {severity}
                                    </span>
                                  </div>

                                  <p className="mt-2 text-sm leading-6 text-gray-600">
                                    {event.message || "Suspicious activity was detected."}
                                  </p>

                                  {event.count !== undefined && (
                                    <p className="mt-2 text-xs font-semibold text-gray-400">
                                      Detected events: {event.count}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                ) : (

                  <div className="px-6 py-10 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-600">
                      ✓
                    </div>

                    <h4 className="mt-4 text-sm font-bold">
                      No Suspicious Activity
                    </h4>

                    <p className="mt-1 text-xs text-gray-400">
                      No suspicious activity was detected during the current monitoring period.
                    </p>
                  </div>

                )}

              </div>

              <div className="mt-6 rounded-2xl bg-gray-900 p-7 text-white">

                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
                  Trust Share
                </p>

                <h3 className="mt-3 text-2xl font-bold">
                  Multiple layers of protection
                </h3>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
                  Trust Share combines authentication,
                  encryption, access control, security
                  monitoring and temporary sharing to provide
                  a secure file-sharing workflow.
                </p>

                <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    "Authentication",
                    "Encryption",
                    "Access Control",
                    "Security Monitoring",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                        ✓
                      </div>
                      <p className="text-sm font-semibold">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>

              </div>

            </section>
          )}

{/* =================================================
    MANAGE SHARED FILES
================================================= */}

{activeSection === "manage-shared" && (
  <section>

    <PageHeading
      eyebrow="Sharing management"
      title="Manage Shared Files"
      description="View and manage the files you have shared with other Trust Share users."
    />

    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">

      {myShares.length === 0 ? (

        <EmptyState
          icon="↗"
          title="No shared files"
          description="Files you share with other users will appear here."
        />

      ) : (

        <div className="overflow-x-auto">

          <table className="w-full text-left">

            <thead>

              <tr
                className="
                  border-b
                  border-gray-100
                  bg-gray-50/70
                  text-[10px]
                  uppercase
                  tracking-wider
                  text-gray-400
                "
              >

                <th className="px-6 py-4">
                  File
                </th>

                <th className="px-6 py-4">
                  Shared With
                </th>

                <th className="px-6 py-4">
                  Permission
                </th>

                <th className="px-6 py-4">
                  Expiration
                </th>

                <th className="px-6 py-4">
                  Shared On
                </th>

                <th className="px-6 py-4 text-right">
                  Action
                </th>

              </tr>

            </thead>

            <tbody>

              {myShares.map((share) => {

                const expired =
                  share.expired === true ||
                  (
                    share.expires_at &&
                    new Date(share.expires_at).getTime() <=
                      currentTime
                  );

                return (

                  <tr
                    key={share.share_id ?? share.id}
                    className="
                      border-b
                      border-gray-50
                      last:border-0
                      hover:bg-gray-50
                    "
                  >

                    {/* FILE */}

                    <td className="px-6 py-5">

                      <div className="flex items-center gap-3">

                        <div
                          className="
                            flex
                            h-10
                            w-10
                            items-center
                            justify-center
                            rounded-xl
                            bg-gray-100
                          "
                        >
                          ▤
                        </div>

                        <div className="min-w-0">

                          <p
                            className="
                              max-w-[220px]
                              truncate
                              text-sm
                              font-semibold
                            "
                          >
                            {share.filename || "Unknown file"}
                          </p>

                          <p className="text-xs text-gray-400">
                            File ID #{share.file_id}
                          </p>

                        </div>

                      </div>

                    </td>

                    {/* SHARED WITH */}

                    <td className="px-6 py-5">

                      <p className="text-sm font-medium">
                        {share.recipient_name ||
                          "Trust Share User"}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {share.recipient_email || "-"}
                      </p>

                    </td>

                    {/* PERMISSION */}

                    <td className="px-6 py-5">

                      <span
                        className={`
                          rounded-full
                          px-3
                          py-1.5
                          text-[10px]
                          font-bold
                          ${
                            share.permission === "download"
                              ? "bg-purple-50 text-purple-700"
                              : "bg-blue-50 text-blue-700"
                          }
                        `}
                      >
                        {share.permission === "download"
                          ? "Download"
                          : "View Only"}
                      </span>

                    </td>

                    {/* EXPIRATION */}

                    <td className="px-6 py-5">

                      <span
                        className={`
                          text-xs
                          font-medium
                          ${
                            expired
                              ? "text-red-600"
                              : "text-gray-500"
                          }
                        `}
                      >
                        {expired
                          ? "Expired"
                          : formatDate(
                              share.expires_at
                            )}
                      </span>

                    </td>

                    {/* SHARED DATE */}

                    <td className="px-6 py-5">

                      <span className="text-xs text-gray-400">
                        {share.created_at
                          ? formatDateTime(share.created_at)
                          : "-"}
                      </span>

                    </td>

                    {/* REVOKE */}

                    <td className="px-6 py-5 text-right">

                      <button
                        type="button"
                        disabled={expired}
                        onClick={() =>
                          handleRevokeShare(
                            share.file_id,
                            share.share_id ?? share.id
                          )
                        }
                        title={expired ? "This share has expired" : "Revoke access to this share"}
                        className={`
                          rounded-lg
                          px-4
                          py-2
                          text-xs
                          font-semibold
                          ${
                            expired
                              ? "cursor-not-allowed bg-gray-100 text-gray-400"
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          }
                        `}
                      >
                        {expired ? "Expired" : "Revoke Access"}
                      </button>

                    </td>

                  </tr>

                );
              })}

            </tbody>

          </table>

        </div>

      )}

    </div>

  </section>
)}
          {/* =================================================
              ACTIVITY
          ================================================= */}

          {activeSection ===
            "activity" && (
            <section>

              <PageHeading
                eyebrow="Security monitoring"
                title="Activity Monitoring"
                description="Monitor your recent file and security activities recorded by Trust Share."
              />

              <div
                className="
                  overflow-hidden
                  rounded-2xl
                  border
                  border-gray-200
                  bg-white
                "
              >

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    border-b
                    border-gray-100
                    px-6
                    py-5
                  "
                >

                  <div>
                    <h3 className="font-bold">
                      Recent Activity
                    </h3>

                    <p className="mt-1 text-xs text-gray-400">
                      Real activity records from Trust Share
                    </p>
                  </div>

                  <button
                    onClick={loadActivities}
                    disabled={activityLoading}
                    className="
                      rounded-lg
                      border
                      border-gray-200
                      px-3
                      py-2
                      text-xs
                      font-semibold
                      text-gray-600
                      hover:bg-gray-50
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    {activityLoading
                      ? "Refreshing..."
                      : "Refresh"}
                  </button>

                </div>

                {activityLoading ? (

                  <div className="px-6 py-16 text-center">
                    <div
                      className="
                        mx-auto
                        h-8
                        w-8
                        animate-spin
                        rounded-full
                        border-4
                        border-gray-200
                        border-t-gray-900
                      "
                    />

                    <p className="mt-4 text-sm text-gray-500">
                      Loading activity...
                    </p>
                  </div>

                ) : activities.length === 0 ? (

                  <EmptyState
                    icon="≡"
                    title="No activity yet"
                    description="Your file and security activities will appear here."
                  />

                ) : (

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">

                      <thead>
                        <tr
                          className="
                            border-b
                            border-gray-100
                            bg-gray-50/70
                            text-[10px]
                            uppercase
                            tracking-wider
                            text-gray-400
                          "
                        >
                          <th className="px-6 py-4">
                            Action
                          </th>

                          <th className="px-6 py-4">
                            File
                          </th>

                          <th className="px-6 py-4">
                            Status
                          </th>

                          <th className="px-6 py-4">
                            Details
                          </th>

                          <th className="px-6 py-4">
                            Time
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {activities.map(
                          (activity) => {
                            const actionText =
                              activity.action
                                .replaceAll("_", " ")
                                .replace(
                                  /\b\w/g,
                                  (char) =>
                                    char.toUpperCase()
                                );

                            const normalizedAction =
                              activity.action.toLowerCase();

                            const icon =
                              normalizedAction.includes("upload")
                                ? "↑"
                                : normalizedAction.includes("download")
                                ? "↓"
                                : normalizedAction.includes("share")
                                ? "↗"
                                : normalizedAction.includes("delete")
                                ? "×"
                                : normalizedAction.includes("view")
                                ? "◉"
                                : "≡";

                            return (
                              <tr
                                key={activity.id}
                                className="
                                  border-b
                                  border-gray-50
                                  last:border-0
                                  hover:bg-gray-50
                                "
                              >

                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="
                                        flex
                                        h-10
                                        w-10
                                        items-center
                                        justify-center
                                        rounded-xl
                                        bg-gray-100
                                        text-sm
                                        font-bold
                                      "
                                    >
                                      {icon}
                                    </div>

                                    <span className="text-sm font-semibold">
                                      {actionText}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-6 py-5">
                                  <span className="text-sm text-gray-600">
                                    {activity.filename || "-"}
                                  </span>
                                </td>

                                <td className="px-6 py-5">
                                  <span
                                    className={`
                                      rounded-full
                                      px-3
                                      py-1.5
                                      text-[10px]
                                      font-bold
                                      ${
                                        activity.status.toLowerCase() ===
                                        "success"
                                          ? "bg-emerald-50 text-emerald-700"
                                          : "bg-red-50 text-red-700"
                                      }
                                    `}
                                  >
                                    {activity.status}
                                  </span>
                                </td>

                                <td className="px-6 py-5">
                                  <div className="max-w-[250px]">
                                    <p className="truncate text-sm text-gray-500">
                                      {activity.details || "-"}
                                    </p>

                                    {activity.target_user && (
                                      <p className="mt-1 truncate text-xs text-gray-400">
                                        To: {activity.target_user}
                                      </p>
                                    )}
                                  </div>
                                </td>

                                <td className="px-6 py-5">
                                  <span className="whitespace-nowrap text-xs text-gray-400">
                                    {activity.timestamp
                                      ? formatDateTime(activity.timestamp)
                                      : "-"}
                                  </span>
                                </td>

                              </tr>
                            );
                          }
                        )}
                      </tbody>

                    </table>
                  </div>
                )}

              </div>

              <div
                className="
                  mt-6
                  rounded-2xl
                  border
                  border-gray-200
                  bg-white
                  p-6
                "
              >
                <h3 className="font-bold">
                  Activity Logging
                </h3>

                <p
                  className="
                    mt-2
                    max-w-3xl
                    text-sm
                    leading-6
                    text-gray-500
                  "
                >
                  Trust Share records important file
                  operations in MongoDB, including uploads,
                  downloads, sharing and shared-file access.
                  These records provide the foundation for
                  audit logging, security alerts and analytics.
                </p>
              </div>

            </section>
          )}

          {/* =================================================
              REPORTS
          ================================================= */}

          {activeSection ===
            "reports" && (
            <section>

              <PageHeading
                eyebrow="Reports"
                title="Activity & Security Reports"
                description="Review file activity and security events recorded in your Trust Share workspace."
              />

              <div className="mb-6 flex justify-end">
                <button
                  onClick={loadReports}
                  disabled={reportLoading}
                  className="
                    rounded-xl
                    bg-gray-900
                    px-5
                    py-3
                    text-sm
                    font-semibold
                    text-white
                    hover:bg-gray-800
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  {reportLoading
                    ? "Refreshing..."
                    : "Refresh Reports"}
                </button>
              </div>

              {/* FILE ACTIVITY REPORT */}

              <div
                className="
                  mb-6
                  overflow-hidden
                  rounded-2xl
                  border
                  border-gray-200
                  bg-white
                "
              >

                <div
                  className="
                    border-b
                    border-gray-100
                    px-6
                    py-5
                  "
                >
                  <h3 className="font-bold">
                    File Activity Report
                  </h3>

                  <p className="mt-1 text-xs text-gray-400">
                    Recent file operations recorded for your account.
                  </p>
                </div>

                {reportLoading ? (

                  <div className="px-6 py-16 text-center">
                    <div
                      className="
                        mx-auto
                        h-8
                        w-8
                        animate-spin
                        rounded-full
                        border-4
                        border-gray-200
                        border-t-gray-900
                      "
                    />

                    <p className="mt-4 text-sm text-gray-500">
                      Loading activity report...
                    </p>
                  </div>

                ) : activityReport.length === 0 ? (

                  <EmptyState
                    icon="≡"
                    title="No activity records"
                    description="No file activity has been recorded for your account yet."
                  />

                ) : (

                  <div className="overflow-x-auto">

                    <table className="w-full text-left">

                      <thead>
                        <tr
                          className="
                            border-b
                            border-gray-100
                            text-[10px]
                            uppercase
                            tracking-wider
                            text-gray-400
                          "
                        >
                          <th className="px-6 py-4">
                            Action
                          </th>

                          <th className="px-6 py-4">
                            File
                          </th>

                          <th className="px-6 py-4">
                            Status
                          </th>

                          <th className="px-6 py-4">
                            Details
                          </th>

                          <th className="px-6 py-4">
                            Time
                          </th>
                        </tr>
                      </thead>

                      <tbody>

                        {activityReport.map(
                          (activity) => (
                            <tr
                              key={activity.id}
                              className="
                                border-b
                                border-gray-50
                                last:border-0
                                hover:bg-gray-50
                              "
                            >

                              <td className="px-6 py-4">
                                <span className="text-sm font-semibold">
                                  {activity.action
                                    ? activity.action
                                        .replaceAll(
                                          "_",
                                          " "
                                        )
                                        .replace(
                                          /\b\w/g,
                                          (char) =>
                                            char.toUpperCase()
                                        )
                                    : "-"}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <span className="text-sm">
                                  {activity.filename ||
                                    "-"}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <span
                                  className="
                                    rounded-full
                                    bg-emerald-50
                                    px-3
                                    py-1
                                    text-[10px]
                                    font-bold
                                    text-emerald-700
                                  "
                                >
                                  {activity.status ||
                                    "-"}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <span className="text-xs text-gray-500">
                                  {activity.details ||
                                    "-"}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <span className="whitespace-nowrap text-xs text-gray-400">
                                  {activity.timestamp
                                    ? formatDateTime(activity.timestamp)
                                    : "-"}
                                </span>
                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                )}

              </div>

              {/* SECURITY REPORT */}

              <div
                className="
                  overflow-hidden
                  rounded-2xl
                  border
                  border-gray-200
                  bg-white
                "
              >

                <div
                  className="
                    border-b
                    border-gray-100
                    px-6
                    py-5
                  "
                >
                  <h3 className="font-bold">
                    Security Report
                  </h3>

                  <p className="mt-1 text-xs text-gray-400">
                    Security alerts detected for your account.
                  </p>
                </div>

                {reportLoading ? (

                  <div className="px-6 py-16 text-center">
                    <p className="text-sm text-gray-500">
                      Loading security report...
                    </p>
                  </div>

                ) : securityReport.length === 0 ? (

                  <EmptyState
                    icon="◇"
                    title="No security alerts"
                    description="No security alerts have been recorded for your account."
                  />

                ) : (

                  <div className="overflow-x-auto">

                    <table className="w-full text-left">

                      <thead>
                        <tr
                          className="
                            border-b
                            border-gray-100
                            text-[10px]
                            uppercase
                            tracking-wider
                            text-gray-400
                          "
                        >
                          <th className="px-6 py-4">
                            Alert
                          </th>

                          <th className="px-6 py-4">
                            Severity
                          </th>

                          <th className="px-6 py-4">
                            Message
                          </th>

                          <th className="px-6 py-4">
                            File
                          </th>

                          <th className="px-6 py-4">
                            IP Address
                          </th>

                          <th className="px-6 py-4">
                            Time
                          </th>
                        </tr>
                      </thead>

                      <tbody>

                        {securityReport.map(
                          (alert) => (
                            <tr
                              key={alert.id}
                              className="
                                border-b
                                border-gray-50
                                last:border-0
                                hover:bg-gray-50
                              "
                            >

                              <td className="px-6 py-4">
                                <span className="text-sm font-semibold">
                                  {alert.alert_type
                                    ? alert.alert_type
                                        .replaceAll(
                                          "_",
                                          " "
                                        )
                                        .replace(
                                          /\b\w/g,
                                          (char) =>
                                            char.toUpperCase()
                                        )
                                    : "Security Alert"}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <span
                                  className={`
                                    rounded-full
                                    border
                                    px-3
                                    py-1
                                    text-[10px]
                                    font-bold
                                    ${
                                      alert.severity
                                        ?.toLowerCase() ===
                                      "high"
                                        ? "border-red-200 bg-red-50 text-red-700"
                                        : alert.severity
                                            ?.toLowerCase() ===
                                          "medium"
                                        ? "border-amber-200 bg-amber-50 text-amber-700"
                                        : "border-blue-200 bg-blue-50 text-blue-700"
                                    }
                                  `}
                                >
                                  {alert.severity ||
                                    "medium"}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <span className="text-xs text-gray-500">
                                  {alert.message ||
                                    "-"}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <span className="text-xs text-gray-500">
                                  {alert.filename ||
                                    "-"}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <span className="text-xs text-gray-500">
                                  {alert.ip_address ||
                                    "-"}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <span className="whitespace-nowrap text-xs text-gray-400">
                                  {alert.timestamp
                                    ? formatDateTime(alert.timestamp)
                                    : "-"}
                                </span>
                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                )}

              </div>

            </section>
          )}

          {/* =================================================
              STORAGE ANALYTICS
          ================================================= */}

          {activeSection === "analytics" && (
            <section>

              <PageHeading
                eyebrow="Storage monitoring"
                title="Storage Analytics"
                description="Monitor your file storage usage and analyze the size and storage location of your encrypted files."
              />

              {analyticsLoading ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
                  <p className="mt-4 text-sm text-gray-500">
                    Loading storage analytics...
                  </p>
                </div>
              ) : storageAnalytics ? (
                <>
                  {/* STORAGE SUMMARY */}

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                    <StatCard
                      icon="▣"
                      title="Total Files"
                      value={storageAnalytics.total_files ?? 0}
                      subtitle="Files in your workspace"
                    />

                    <StatCard
                      icon="◫"
                      title="Total Storage"
                      value={`${storageAnalytics.total_mb ?? 0} MB`}
                      subtitle={`${storageAnalytics.total_bytes ?? 0} bytes used`}
                    />

                    <StatCard
                      icon="☁"
                      title="Cloud Storage"
                      value={
                        storageAnalytics.files?.filter(
                          (file: any) =>
                            file.storage_type === "Cloud Storage"
                        ).length ?? 0
                      }
                      subtitle="Files stored in cloud storage"
                    />

                    <StatCard
                      icon="✓"
                      title="Encryption"
                      value="AES-256"
                      subtitle="Encrypted before storage"
                    />

                  </div>

                  {/* STORAGE DETAILS */}

                  <div className="mt-7 overflow-hidden rounded-2xl border border-gray-200 bg-white">

                    <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

                      <div>
                        <h3 className="font-bold">
                          File Storage Usage
                        </h3>

                        <p className="mt-1 text-xs text-gray-400">
                          Storage consumption for each uploaded file.
                        </p>
                      </div>

                      <button
                        onClick={loadStorageAnalytics}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      >
                        Refresh Analytics
                      </button>

                    </div>

                    {storageAnalytics.files?.length === 0 ? (
                      <EmptyState
                        icon="◫"
                        title="No storage data"
                        description="Upload a file to start tracking storage usage."
                      />
                    ) : (
                      <div className="overflow-x-auto">

                        <table className="w-full text-left">

                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/70 text-[10px] uppercase tracking-wider text-gray-400">

                              <th className="px-6 py-4">
                                File
                              </th>

                              <th className="px-6 py-4">
                                Size
                              </th>

                              <th className="px-6 py-4">
                                Storage
                              </th>

                              <th className="px-6 py-4">
                                File ID
                              </th>

                            </tr>
                          </thead>

                          <tbody>

                            {storageAnalytics.files?.map(
                              (file: any) => (
                                <tr
                                  key={file.id}
                                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                                >

                                  <td className="px-6 py-5">
                                    <div className="flex items-center gap-3">

                                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-sm">
                                        ▤
                                      </div>

                                      <div>
                                        <p className="text-sm font-semibold">
                                          {file.filename}
                                        </p>

                                        <p className="mt-1 text-xs text-gray-400">
                                          Encrypted file
                                        </p>
                                      </div>

                                    </div>
                                  </td>

                                  <td className="px-6 py-5">
                                    <div className="text-sm font-semibold">
                                      {file.size_kb ?? 0} KB
                                    </div>

                                    <p className="mt-1 text-xs text-gray-400">
                                      {file.size_bytes ?? 0} bytes
                                    </p>
                                  </td>

                                  <td className="px-6 py-5">
                                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">
                                      {file.storage_type || "Server Storage"}
                                    </span>
                                  </td>

                                  <td className="px-6 py-5 text-xs text-gray-500">
                                    #{file.id}
                                  </td>

                                </tr>
                              )
                            )}

                          </tbody>

                        </table>

                      </div>
                    )}

                  </div>

                  {/* STORAGE SUMMARY DETAILS */}

                  <div className="mt-7 rounded-2xl border border-gray-200 bg-white p-6">

                    <div className="mb-5">
                      <h3 className="font-bold">
                        Storage Summary
                      </h3>

                      <p className="mt-1 text-xs text-gray-400">
                        Current storage usage calculated from your encrypted files.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                      <div className="rounded-xl bg-gray-50 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Files
                        </p>

                        <p className="mt-2 text-2xl font-bold">
                          {storageAnalytics.total_files ?? 0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Bytes
                        </p>

                        <p className="mt-2 text-2xl font-bold">
                          {storageAnalytics.total_bytes ?? 0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Kilobytes
                        </p>

                        <p className="mt-2 text-2xl font-bold">
                          {storageAnalytics.total_kb ?? 0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Megabytes
                        </p>

                        <p className="mt-2 text-2xl font-bold">
                          {storageAnalytics.total_mb ?? 0}
                        </p>
                      </div>

                    </div>

                  </div>

                </>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">

                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-xl">
                    ◫
                  </div>

                  <h3 className="mt-4 text-sm font-bold">
                    Storage analytics unavailable
                  </h3>

                  <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-gray-400">
                    We could not load your storage information. Please try again.
                  </p>

                  <button
                    onClick={loadStorageAnalytics}
                    className="mt-5 rounded-xl bg-gray-900 px-5 py-3 text-xs font-semibold text-white hover:bg-gray-800"
                  >
                    Retry
                  </button>

                </div>
              )}

            </section>
          )}

        </div>

      </div>

    </main>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: string;
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-gray-200
        bg-white
        p-5
      "
    >

      <div className="flex items-start justify-between">

        <div
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            bg-gray-100
            text-lg
          "
        >
          {icon}
        </div>

        <span
          className="
            text-[10px]
            font-bold
            uppercase
            tracking-wider
            text-emerald-600
          "
        >
          Secure
        </span>

      </div>

      <p
        className="
          mt-6
          text-3xl
          font-bold
          tracking-tight
        "
      >
        {value}
      </p>

      <p className="mt-1 text-sm font-semibold">
        {title}
      </p>

      <p className="mt-1 text-xs text-gray-400">
        {subtitle}
      </p>

    </div>
  );
}

/* =========================================================
   PAGE HEADING
========================================================= */

function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">

      <p
        className="
          text-xs
          font-bold
          uppercase
          tracking-[0.2em]
          text-gray-400
        "
      >
        {eyebrow}
      </p>

      <h2
        className="
          mt-2
          text-3xl
          font-bold
          tracking-tight
        "
      >
        {title}
      </h2>

      <p
        className="
          mt-2
          max-w-2xl
          text-sm
          leading-6
          text-gray-500
        "
      >
        {description}
      </p>

    </div>
  );
}

/* =========================================================
   SECURITY ROW
========================================================= */

function SecurityRow({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div
      className="
        flex
        items-center
        justify-between
        border-b
        border-white/10
        pb-3
      "
    >

      <span className="text-sm text-gray-400">
        {title}
      </span>

      <span className="text-xs font-semibold text-white">
        {value}
      </span>

    </div>
  );
}

/* =========================================================
   SECURITY CARD
========================================================= */

function SecurityLargeCard({
  icon,
  title,
  description,
  status,
}: {
  icon: string;
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-gray-200
        bg-white
        p-6
      "
    >

      <div
        className="
          flex
          items-start
          justify-between
        "
      >

        <div
          className="
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-xl
            bg-gray-900
            text-white
          "
        >
          {icon}
        </div>

        <span
          className="
            rounded-full
            bg-emerald-50
            px-3
            py-1.5
            text-[10px]
            font-bold
            text-emerald-700
          "
        >
          {status}
        </span>

      </div>

      <h3 className="mt-6 text-lg font-bold">
        {title}
      </h3>

      <p
        className="
          mt-2
          text-sm
          leading-6
          text-gray-500
        "
      >
        {description}
      </p>

    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div
      className="
        px-6
        py-16
        text-center
      "
    >

      <div
        className="
          mx-auto
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-2xl
          bg-gray-100
          text-xl
        "
      >
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-bold">
        {title}
      </h3>

      <p
        className="
          mx-auto
          mt-2
          max-w-sm
          text-xs
          leading-5
          text-gray-400
        "
      >
        {description}
      </p>

    </div>
  );
}

/* =========================================================
   INFO STEP
========================================================= */

function InfoStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div
      className="
        rounded-xl
        border
        border-gray-200
        bg-gray-50
        p-5
      "
    >

      <span
        className="
          text-[10px]
          font-bold
          tracking-widest
          text-gray-400
        "
      >
        {number}
      </span>

      <h4 className="mt-3 text-sm font-bold">
        {title}
      </h4>

      <p
        className="
          mt-2
          text-xs
          leading-5
          text-gray-500
        "
      >
        {description}
      </p>

    </div>
  );
}

/* =========================================================
   SHARE FORM
========================================================= */

function ShareForm({
  files,
  selectedFileId,
  setSelectedFileId,
  recipientEmail,
  setRecipientEmail,
  permission,
  setPermission,
  expiration,
  setExpiration,
  handleShare,
  sharing,
}: {
  files: FileItem[];

  selectedFileId:
    number | "";

  setSelectedFileId:
    (value: number | "") => void;

  recipientEmail:
    string;

  setRecipientEmail:
    (value: string) => void;

  permission:
    string;

  setPermission:
    (value: string) => void;

  expiration:
    string;

  setExpiration:
    (value: string) => void;

  handleShare:
    () => void;

  sharing:
    boolean;
}) {
  return (
    <div
      className="
        grid
        gap-4
        md:grid-cols-2
        xl:grid-cols-5
      "
    >

      {/* FILE */}

      <div>

        <label
          className="
            mb-2
            block
            text-xs
            font-semibold
            text-gray-600
          "
        >
          File
        </label>

        <select
          value={selectedFileId}
          onChange={(e) =>
            setSelectedFileId(
              e.target.value
                ? Number(
                    e.target.value
                  )
                : ""
            )
          }
          className="
            w-full
            rounded-xl
            border
            border-gray-200
            bg-white
            px-3
            py-3
            text-sm
            outline-none
            focus:border-gray-400
          "
        >

          <option value="">
            Select file
          </option>

          {files.map(
            (file) => (
              <option
                key={
                  file.id
                }
                value={
                  file.id
                }
              >
                {
                  file.filename
                }
              </option>
            )
          )}

        </select>

      </div>

      {/* EMAIL */}

      <div>

        <label
          className="
            mb-2
            block
            text-xs
            font-semibold
            text-gray-600
          "
        >
          Recipient Email
        </label>

        <input
          type="email"
          placeholder="user@example.com"
          value={
            recipientEmail
          }
          onChange={(e) =>
            setRecipientEmail(
              e.target.value
            )
          }
          className="
            w-full
            rounded-xl
            border
            border-gray-200
            px-3
            py-3
            text-sm
            outline-none
            focus:border-gray-400
          "
        />

      </div>

      {/* PERMISSION */}

      <div>

        <label
          className="
            mb-2
            block
            text-xs
            font-semibold
            text-gray-600
          "
        >
          Permission
        </label>

        <select
          value={
            permission
          }
          onChange={(e) =>
            setPermission(
              e.target.value
            )
          }
          className="
            w-full
            rounded-xl
            border
            border-gray-200
            bg-white
            px-3
            py-3
            text-sm
            outline-none
            focus:border-gray-400
          "
        >

          <option value="view">
            View Only
          </option>

          <option value="download">
            Download
          </option>

        </select>

      </div>

      {/* EXPIRATION */}

      <div>

        <label
          className="
            mb-2
            block
            text-xs
            font-semibold
            text-gray-600
          "
        >
          Expires After
        </label>

        <select
          value={
            expiration
          }
          onChange={(e) =>
            setExpiration(
              e.target.value
            )
          }
          className="
            w-full
            rounded-xl
            border
            border-gray-200
            bg-white
            px-3
            py-3
            text-sm
            outline-none
            focus:border-gray-400
          "
        >

          <option value="">
            Select expiration
          </option>

          <option value="5">
            5 Minutes
          </option>

          <option value="10">
            10 Minutes
          </option>

          <option value="30">
            30 Minutes
          </option>

          <option value="60">
            1 Hour
          </option>

          <option value="1440">
            1 Day
          </option>

        </select>

      </div>

      {/* BUTTON */}

      <div className="flex items-end">

        <button
          onClick={
            handleShare
          }
          disabled={
            sharing
          }
          className="
            w-full
            rounded-xl
            bg-gray-900
            px-4
            py-3
            text-sm
            font-semibold
            text-white
            hover:bg-gray-800
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {sharing
            ? "Sharing..."
            : "Share Securely"}
        </button>

      </div>

    </div>
  );
}