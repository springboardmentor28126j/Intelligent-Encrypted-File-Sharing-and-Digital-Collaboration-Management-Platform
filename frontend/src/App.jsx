import React, { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function formatDateTime(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function App() {
  // =====================================================
  // AUTH STATE
  // =====================================================

  const [page, setPage] = useState("login");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [user, setUser] = useState(null);

  const [token, setToken] = useState(
    localStorage.getItem("trustshare_token") || ""
  );

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // =====================================================
  // FILE STATE
  // =====================================================

  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  // =====================================================
  // PROFILE MENU
  // =====================================================

  const [profileOpen, setProfileOpen] = useState(false);

  // =====================================================
  // DELETE POPUP
  // =====================================================

  const [deletePopup, setDeletePopup] = useState({
    open: false,
    fileId: null,
    fileName: "",
  });

  // =====================================================
  // REVOKE ACCESS POPUP
  // =====================================================

  const [revokePopup, setRevokePopup] = useState({
    open: false,
    shareId: null,
    fileName: "",
    recipient: "",
  });

  const [notificationPopup, setNotificationPopup] = useState({
    open: false,
    notification: null,
  });


  const [systemPopup, setSystemPopup] = useState({
    open: false,
    title: "",
    message: "",
    tone: "general",
    icon: "🔔",
  });

  const [sharedRemovePopup, setSharedRemovePopup] = useState({
    open: false,
    shareId: null,
  });

  // =====================================================
  // SECURE SHARING / PERMISSIONS / TEMPORARY ACCESS
  // =====================================================

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareFile, setShareFile] = useState(null);
  const [sharePermission, setSharePermission] = useState("view");
  const [shareExpiry, setShareExpiry] = useState(24);
  const [maxDownloads, setMaxDownloads] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [existingShares, setExistingShares] = useState([]);
  const [sharesLoading, setSharesLoading] = useState(false);

  // =====================================================
  // SHARED WITH ME
  // =====================================================

  const [sharedFiles, setSharedFiles] = useState([]);
  const [sharedLoading, setSharedLoading] = useState(false);

  // SENT FILES - files shared directly with other TrustShare accounts
  const [sentFiles, setSentFiles] = useState([]);
  const [sentLoading, setSentLoading] = useState(false);

  // Account-to-account sharing recipient
  const [shareRecipient, setShareRecipient] = useState("");

  // =====================================================
  // MILESTONE 3 STATE
  // =====================================================

  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const [analytics, setAnalytics] = useState({
    total_files: 0,
    total_shared: 0,
    total_downloads: 0,
    total_views: 0,
    unread_notifications: 0,
    security_alerts: 0
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [m3Error, setM3Error] = useState("");


  // =====================================================
  // SEND FILE PAGE
  // =====================================================

  const [sendShareLink, setSendShareLink] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendMessage, setSendMessage] = useState("");

  // =====================================================
  // THEME
  // =====================================================

  const [theme, setTheme] = useState(
    localStorage.getItem("trustshare_theme") || "light"
  );

  useEffect(() => {
    localStorage.setItem("trustshare_theme", theme);

    if (theme === "system") {
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

      document.documentElement.setAttribute(
        "data-theme",
        systemDark ? "dark" : "light"
      );
    } else {
      document.documentElement.setAttribute(
        "data-theme",
        theme
      );
    }
  }, [theme]);

  // =====================================================
  // GET CURRENT USER
  // =====================================================

  useEffect(() => {
    if (token) {
      getCurrentUser();
    }
  }, []);

  async function getCurrentUser() {
    try {
      const response = await fetch(`${API_URL}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        logout();
        return;
      }

      const data = await response.json();

      setUser(data);
      setPage("dashboard");

      loadFiles(data.user_id);
    } catch (error) {
      console.error("Current user error:", error);
    }
  }

  // =====================================================
  // REGISTER
  // =====================================================

  async function register(e) {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("username", username);
      formData.append("email", email);
      formData.append("password", password);

      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setMessage(
          "Registration successful. Please login."
        );

        setUsername("");
        setEmail("");
        setPassword("");

        setTimeout(() => {
          setMessage("");
          setPage("login");
        }, 1500);
      } else {
        setMessage(data.message);
      }
    } catch (error) {
      console.error("Registration error:", error);
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOGIN
  // =====================================================

  async function login(e) {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const formData = new URLSearchParams();

      formData.append("email", email);
      formData.append("password", password);

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem(
          "trustshare_token",
          data.access_token
        );

        setToken(data.access_token);

        const loggedUser = {
          user_id: data.user_id,
          username: data.username,
          email: data.email,
          role: data.role,
        };

        setUser(loggedUser);

        setEmail("");
        setPassword("");
        setMessage("");

        setPage("dashboard");

        loadFiles(data.user_id);
      } else {
        setMessage(data.message);
      }
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // RESET PASSWORD
  // =====================================================

  async function resetPassword(e) {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("email", resetEmail);
      formData.append("new_password", newPassword);

      const response = await fetch(
        `${API_URL}/reset-password`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      setMessage(data.message);

      if (data.success) {
        setResetEmail("");
        setNewPassword("");

        setTimeout(() => {
          setMessage("");
          setPage("login");
        }, 1800);
      }
    } catch (error) {
      console.error(
        "Reset password error:",
        error
      );

      setMessage(
        "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOAD FILES
  // =====================================================

  async function loadFiles(userId = user?.user_id) {
    if (!userId || !token) return;

    try {
      const response = await fetch(
        `${API_URL}/files/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      setFiles(data);
    } catch (error) {
      console.error(
        "Load files error:",
        error
      );
    }
  }

  // =====================================================
  // FILE SELECT
  // =====================================================

  function handleFileSelect(e) {
    const file = e.target.files[0];

    if (file) {
      setSelectedFile(file);
      setMessage("");
    }
  }

  // =====================================================
  // UPLOAD FILE
  // =====================================================

  async function uploadFile() {
    if (!selectedFile) {
      setMessage(
        "Please select a file first."
      );

      return;
    }

    if (!user) {
      setMessage(
        "Please login first."
      );

      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();

      formData.append(
        "user_id",
        user.user_id
      );

      formData.append(
        "file",
        selectedFile
      );

      const response = await fetch(
        `${API_URL}/upload`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },

          body: formData,
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage(
          "File uploaded successfully."
        );

        setSelectedFile(null);

        const fileInput =
          document.getElementById(
            "fileInput"
          );

        if (fileInput) {
          fileInput.value = "";
        }

        await loadFiles();
        await loadActivity();
        await loadNotifications();
        await loadAnalytics();
      } else {
        setMessage(data.message);
      }
    } catch (error) {
      console.error(
        "Upload error:",
        error
      );

      setMessage(
        "Unable to upload file."
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // DOWNLOAD FILE
  // =====================================================

  async function downloadFile(
    fileId,
    filename
  ) {
    try {
      const response = await fetch(
        `${API_URL}/download/${fileId}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        setSystemPopup({
          open: true,
          title: "Download Failed",
          message: "Unable to download file.",
          tone: "general",
          icon: "⚠️",
        });

        return;
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

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        url
      );

      await loadActivity();
      await loadAnalytics();
      await loadNotifications();
    } catch (error) {
      console.error(
        "Download error:",
        error
      );

      setSystemPopup({
        open: true,
        title: "Download Failed",
        message: "Unable to download file.",
        tone: "general",
        icon: "⚠️",
      });
    }
  }

  // =====================================================
  // OPEN DELETE POPUP
  // =====================================================

  function openDeletePopup(
    fileId,
    fileName
  ) {
    setDeletePopup({
      open: true,
      fileId: fileId,
      fileName: fileName,
    });
  }

  // =====================================================
  // CLOSE DELETE POPUP
  // =====================================================

  function closeDeletePopup() {
    setDeletePopup({
      open: false,
      fileId: null,
      fileName: "",
    });
  }

  // =====================================================
  // CONFIRM DELETE
  // =====================================================

  async function confirmDelete() {
    const fileId =
      deletePopup.fileId;

    if (!fileId) {
      closeDeletePopup();
      return;
    }

    try {
      const response =
        await fetch(
          `${API_URL}/files/${fileId}`,
          {
            method: "DELETE",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (
        response.ok &&
        data.success
      ) {
        setFiles(
          (previousFiles) =>
            previousFiles.filter(
              (file) =>
                file.id !== fileId
            )
        );

        closeDeletePopup();

        setMessage(
          "File deleted successfully."
        );

        await loadActivity();
        await loadAnalytics();
        await loadNotifications();
      } else {
        setSystemPopup({
          open: true,
          title: "Delete Failed",
          message: data.detail || data.message || "Failed to delete file.",
          tone: "general",
          icon: "⚠️",
        });

        closeDeletePopup();
      }
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      setSystemPopup({
        open: true,
        title: "Connection Error",
        message: "Unable to connect to the server.",
        tone: "general",
        icon: "⚠️",
      });

      closeDeletePopup();
    }
  }

  // =====================================================
  // SECURE SHARE LINK
  // =====================================================

  function openShareModal(file) {
    setShareFile(file);
    setSharePermission("view");
    setShareExpiry(24);
    setMaxDownloads("");
    setShareRecipient("");
    setShareLink("");
    setShareMessage("");
    setShareModalOpen(true);
  }

  async function loadShares(fileId) {
    setSharesLoading(true);

    try {
      const response = await fetch(`${API_URL}/files/${fileId}/shares`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setExistingShares([]);
        return;
      }

      const data = await response.json();
      setExistingShares(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load share links:", error);
      setExistingShares([]);
    } finally {
      setSharesLoading(false);
    }
  }

  function openRevokePopup(shareId, fileName, recipient = "") {
    setRevokePopup({
      open: true,
      shareId,
      fileName,
      recipient,
    });
  }

  function closeRevokePopup() {
    setRevokePopup({
      open: false,
      shareId: null,
      fileName: "",
      recipient: "",
    });
  }

  async function confirmRevoke() {
    const shareId = revokePopup.shareId;

    if (!shareId) {
      closeRevokePopup();
      return;
    }

    try {
      const response = await fetch(`${API_URL}/shares/${shareId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to revoke access."
        );
      }

      closeRevokePopup();

      if (shareFile?.id) {
        await loadShares(shareFile.id);
      }

      await loadSentFiles();
      await loadActivity();
      await loadNotifications();
      await loadAnalytics();
      await loadSecurityAlerts();
    } catch (error) {
      console.error("Revoke error:", error);
      closeRevokePopup();
      setShareMessage(
        error.message || "Unable to revoke access."
      );
    }
  }

  function closeShareModal() {
    setShareModalOpen(false);
    setShareFile(null);
    setShareRecipient("");
    setShareLink("");
    setShareMessage("");
  }

  async function createShareLink() {
    if (!shareFile) return;

    if (!shareExpiry || Number(shareExpiry) <= 0) {
      setShareMessage("Please enter a valid expiry time.");
      return;
    }

    if (
      maxDownloads !== "" &&
      (Number(maxDownloads) <= 0 ||
        !Number.isInteger(Number(maxDownloads)))
    ) {
      setShareMessage("Maximum downloads must be a positive whole number.");
      return;
    }

    setShareLoading(true);
    setShareMessage("");
    setShareLink("");

    try {
      const formData = new FormData();
      formData.append("permission", sharePermission);
      formData.append("expires_in_hours", shareExpiry);

      if (maxDownloads !== "") {
        formData.append("max_downloads", maxDownloads);
      }

      const response = await fetch(
        `${API_URL}/files/${shareFile.id}/share`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to create secure share link."
        );
      }

      const fullShareLink = `${API_URL}${data.share_url}`;
      setShareLink(fullShareLink);
      setShareMessage("Secure share link created successfully.");
      await loadShares(shareFile.id);
      await loadActivity();
      await loadAnalytics();
      await loadSecurityAlerts();
    } catch (error) {
      setShareMessage(error.message || "Unable to create share link.");
    } finally {
      setShareLoading(false);
    }
  }

  async function copyShareLink() {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setShareMessage("Share link copied to clipboard.");
    } catch (error) {
      setShareMessage("Unable to copy the link.");
    }
  }


  // =====================================================
  // SHARE DIRECTLY WITH TRUSTSHARE ACCOUNT
  // =====================================================

  async function shareFileWithAccount() {
    if (!shareFile) return;

    const recipient = shareRecipient.trim();

    if (!recipient) {
      setShareMessage("Enter the recipient's TrustShare email or username.");
      return;
    }

    if (!shareExpiry || Number(shareExpiry) <= 0) {
      setShareMessage("Please enter a valid expiry time.");
      return;
    }

    if (
      maxDownloads !== "" &&
      (
        Number(maxDownloads) <= 0 ||
        !Number.isInteger(Number(maxDownloads))
      )
    ) {
      setShareMessage(
        "Maximum downloads must be a positive whole number."
      );
      return;
    }

    setShareLoading(true);
    setShareMessage("");

    try {
      const formData = new FormData();

      formData.append("recipient", recipient);
      formData.append("permission", sharePermission);
      formData.append("expires_in_hours", shareExpiry);

      if (maxDownloads !== "") {
        formData.append("max_downloads", maxDownloads);
      }

      const response = await fetch(
        `${API_URL}/files/${shareFile.id}/share-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to share the file."
        );
      }

      setShareMessage(
        data.message || "File shared successfully."
      );

      setShareRecipient("");
      setMaxDownloads("");

      await loadActivity();
      await loadNotifications();
      await loadAnalytics();
      await loadSentFiles();

      setTimeout(() => {
        closeShareModal();
      }, 1200);

    } catch (error) {
      setShareMessage(
        error.message || "Unable to share the file."
      );
    } finally {
      setShareLoading(false);
    }
  }

  // =====================================================
  // LOAD SENT FILES
  // =====================================================

  async function loadSentFiles() {
    if (!token) return;

    setSentLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/sent-files`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load sent files."
        );
      }

      setSentFiles(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error("Sent files error:", error);
      setSentFiles([]);
    } finally {
      setSentLoading(false);
    }
  }

  // =====================================================
  // LOAD SHARED WITH ME
  // =====================================================

  async function loadSharedFiles() {
    if (!token) return;

    setSharedLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/shared-with-me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load shared files."
        );
      }

      setSharedFiles(
        Array.isArray(data) ? data : []
      );

    } catch (error) {
      console.error(
        "Shared files error:",
        error
      );

      setSharedFiles([]);
    } finally {
      setSharedLoading(false);
    }
  }

  async function openSharedFile(
    shareId,
    permission,
    filename
  ) {
    try {
      const response = await fetch(
        `${API_URL}/shared-with-me/${shareId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let errorMessage = "Unable to access the shared file.";

        try {
          const data = await response.json();
          errorMessage = data.detail || errorMessage;
        } catch (_) {}

        setSystemPopup({
          open: true,
          title: errorMessage.toLowerCase().includes("expired") ? "Access Expired" : "Unable to Access File",
          message: errorMessage,
          tone: errorMessage.toLowerCase().includes("expired") ? "access" : "general",
          icon: errorMessage.toLowerCase().includes("expired") ? "⏱️" : "⚠️",
        });
        loadSharedFiles();
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      if (permission === "view") {
        window.open(
          url,
          "_blank",
          "noopener,noreferrer"
        );

        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 60000);

      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 60000);
      }

      loadSharedFiles();

    } catch (error) {
      console.error(
        "Shared file access error:",
        error
      );

      const message = error?.message || "Unable to access the shared file. Please check that the backend server is running.";
      setSystemPopup({
        open: true,
        title: "Unable to Access File",
        message,
        tone: "general",
        icon: "⚠️",
      });
    }
  }

  function openSharedRemovePopup(shareId) {
    setSharedRemovePopup({ open: true, shareId });
  }

  async function confirmSharedRemove() {
    const shareId = sharedRemovePopup.shareId;
    if (!shareId) {
      setSharedRemovePopup({ open: false, shareId: null });
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/shared-with-me/${shareId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to remove shared access.");
      }

      setSharedRemovePopup({ open: false, shareId: null });
      await loadSharedFiles();
      await loadActivity();
      await loadNotifications();
      await loadAnalytics();
    } catch (error) {
      setSharedRemovePopup({ open: false, shareId: null });
      setSystemPopup({
        open: true,
        title: "Unable to Remove File",
        message: error.message || "Unable to remove shared access.",
        tone: "general",
        icon: "⚠️",
      });
    }
  }

  // =====================================================
  // SEND FILE / EMAIL PAGE
  // =====================================================

  function openSendFilePage(link = "") {
    setSendShareLink(link || "");
    setRecipientEmail("");
    setEmailMessage("");
    setSendMessage("");
    setShareModalOpen(false);
    setShareFile(null);
    setShareLink("");
    setPage("send");
    setProfileOpen(false);
  }

  async function copySendLink() {
    if (!sendShareLink) return;

    try {
      await navigator.clipboard.writeText(sendShareLink);
      setSendMessage("Secure link copied to clipboard.");
    } catch (error) {
      setSendMessage("Unable to copy the link.");
    }
  }

  function sendFileByEmail(e) {
    e.preventDefault();
    setSendMessage("");

    const link = sendShareLink.trim();
    const email = recipientEmail.trim();

    if (!link) {
      setSendMessage("Please paste a TrustShare share link.");
      return;
    }

    if (!link.startsWith(`${API_URL}/share/`)) {
      setSendMessage("Please enter a valid TrustShare secure share link.");
      return;
    }

    if (!email) {
      setSendMessage("Please enter the recipient's email address.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setSendMessage("Please enter a valid email address.");
      return;
    }

    const subject = "A secure file has been shared with you - TrustShare";
    const body = `Hello,\n\n${user?.username || "Someone"} has securely shared a file with you through TrustShare.\n\nOpen the secure file link:\n${link}\n\n${emailMessage.trim() || "Please open the link before it expires."}\n\nThis link is protected by the sharing permissions configured by the sender.\n\nRegards,\nTrustShare`;

    const mailtoUrl =
      `mailto:${encodeURIComponent(email)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;
    setSendMessage("Your email application is opening with the secure link.");
  }

  // =====================================================
  // MILESTONE 3 API FUNCTIONS
  // =====================================================

  async function loadActivity() {
    if (!token) return;
    setActivityLoading(true);
    setM3Error("");
    try {
      const response = await fetch(`${API_URL}/activity?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load activity.");
      setActivityLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Activity error:", error);
      setActivityLogs([]);
      setM3Error(error.message || "Unable to load activity.");
    } finally {
      setActivityLoading(false);
    }
  }

  async function loadNotifications() {
    if (!token) return;
    setNotificationsLoading(true);
    setM3Error("");
    try {
      const response = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load notifications.");
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Notification error:", error);
      setNotifications([]);
      setM3Error(error.message || "Unable to load notifications.");
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function openNotificationPopup(notification) {
    let notificationToShow = notification;

    // Opening a notification marks it as read.
    if (notification && !notification.is_read) {
      try {
        const response = await fetch(
          `${API_URL}/notifications/${notification.id}/read`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          notificationToShow = {
            ...notification,
            is_read: true,
          };

          setNotifications((previousNotifications) =>
            previousNotifications.map((item) =>
              item.id === notification.id
                ? { ...item, is_read: true }
                : item
            )
          );

          // Keep the Analytics unread count in sync.
          await loadAnalytics();
        } else {
          const data = await response.json().catch(() => ({}));
          console.error(
            "Unable to mark notification as read:",
            data.detail || "Unknown error"
          );
        }
      } catch (error) {
        console.error("Mark notification read error:", error);
      }
    }

    setNotificationPopup({
      open: true,
      notification: notificationToShow,
    });
  }

  function closeNotificationPopup() {
    setNotificationPopup({ open: false, notification: null });
  }

  function notificationMeta(item) {
    const title = String(item?.title || "").toLowerCase();
    const message = String(item?.message || "").toLowerCase();
    if (title.includes("security") || message.includes("suspicious") || message.includes("failed login")) {
      return { icon: "🛡️", tone: "security", label: "Security Alert" };
    }
    if (title.includes("access") && (title.includes("revok") || message.includes("revok"))) {
      return { icon: "🔒", tone: "access", label: "Access Control" };
    }
    if (title.includes("download") || title.includes("accessed") || message.includes("downloaded")) {
      return { icon: "⬇️", tone: "download", label: "File Access" };
    }
    if (title.includes("view") || message.includes("viewed")) {
      return { icon: "👁️", tone: "view", label: "File View" };
    }
    if (title.includes("share") || message.includes("shared")) {
      return { icon: "↗", tone: "share", label: "File Share" };
    }
    return { icon: "🔔", tone: "general", label: "TrustShare" };
  }

  async function loadSecurityAlerts() {
    if (!token) return;
    setAlertsLoading(true);
    setM3Error("");
    try {
      const response = await fetch(`${API_URL}/security-alerts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load security alerts.");
      setSecurityAlerts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Security alerts error:", error);
      setSecurityAlerts([]);
      setM3Error(error.message || "Unable to load security alerts.");
    } finally {
      setAlertsLoading(false);
    }
  }

  async function loadAnalytics() {
    if (!token) return;
    setAnalyticsLoading(true);
    setM3Error("");
    try {
      const response = await fetch(`${API_URL}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load analytics.");
      setAnalytics({
        total_files: 0,
        total_shared: 0,
        total_downloads: 0,
        total_views: 0,
        unread_notifications: 0,
        security_alerts: 0,
        storage_bytes: 0,
        ...data
      });
    } catch (error) {
      console.error("Analytics error:", error);
      setM3Error(error.message || "Unable to load analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  function logout() {
    localStorage.removeItem(
      "trustshare_token"
    );

    setToken("");
    setUser(null);
    setFiles([]);
    setSelectedFile(null);

    setProfileOpen(false);

    setPage("login");

    setEmail("");
    setPassword("");

    setMessage("");
  }

  // =====================================================
  // NAVIGATION
  // =====================================================

  function navigateTo(targetPage) {
    setPage(targetPage);

    setProfileOpen(false);

    setMessage("");

    if (
      targetPage === "files" &&
      user
    ) {
      loadFiles();
    }

    if (targetPage === "shared" && user) {
      loadSharedFiles();
    }

    if (targetPage === "sent" && user) {
      loadSentFiles();
    }

    if (targetPage === "shared" && user) {
      loadSharedFiles();
    }

    if (targetPage === "activity" && user) {
      loadActivity();
    }

    if (targetPage === "notifications" && user) {
      loadNotifications();
    }

    if (targetPage === "security" && user) {
      loadSecurityAlerts();
    }

    if (targetPage === "analytics" && user) {
      loadAnalytics();
    }

    if (
      targetPage === "shared" &&
      user
    ) {
      loadSharedFiles();
    }
  }

  // =====================================================
  // USER FIRST LETTER
  // =====================================================

  const userInitial =
    user?.username
      ?.charAt(0)
      ?.toUpperCase() || "U";

  // =====================================================
  // LOGIN PAGE
  // =====================================================

  if (
    !user &&
    page === "login"
  ) {
    return (
      <div className="app">

        <div className="auth-card">

          <div className="logo">
            🔐
          </div>

          <h1>
            TrustShare
          </h1>

          <p className="subtitle">
            Secure File Sharing &
            Collaboration
          </p>

          <h2>
            Welcome
          </h2>

          <form onSubmit={login}>

            <input
              id="loginEmail"
              name="email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              autoComplete="email"
              required
            />

            <input
              id="loginPassword"
              name="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="forgot-button"
              onClick={() => {
                setMessage("");
                setPage("reset");
              }}
            >
              Forgot Password?
            </button>

            <button
              className="main-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Logging in..."
                : "Login"}
            </button>

          </form>

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          <p className="bottom-text">

            Don't have an account?

            <button
              className="link-button"
              onClick={() => {
                setMessage("");
                setPage("register");
              }}
            >
              Register
            </button>

          </p>

        </div>

      </div>
    );
  }

  // =====================================================
  // REGISTER PAGE
  // =====================================================

  if (
    !user &&
    page === "register"
  ) {
    return (
      <div className="app">

        <div className="auth-card">

          <div className="logo">
            🔐
          </div>

          <h1>
            TrustShare
          </h1>

          <p className="subtitle">
            Create your secure account
          </p>

          <h2>
            Create Account
          </h2>

          <form onSubmit={register}>

            <input
              id="registerUsername"
              name="username"
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value
                )
              }
              autoComplete="username"
              required
            />

            <input
              id="registerEmail"
              name="email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              autoComplete="email"
              required
            />

            <input
              id="registerPassword"
              name="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              autoComplete="new-password"
              required
            />

            <button
              className="main-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Creating Account..."
                : "Register"}
            </button>

          </form>

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          <p className="bottom-text">

            Already have an account?

            <button
              className="link-button"
              onClick={() => {
                setMessage("");
                setPage("login");
              }}
            >
              Login
            </button>

          </p>

        </div>

      </div>
    );
  }

  // =====================================================
  // RESET PASSWORD PAGE
  // =====================================================

  if (
    !user &&
    page === "reset"
  ) {
    return (
      <div className="app">

        <div className="auth-card">

          <div className="logo">
            🔑
          </div>

          <h1>
            Reset Password
          </h1>

          <p className="forgot-description">
            Enter your registered email
            address and create a new
            password.
          </p>

          <form
            onSubmit={resetPassword}
          >

            <input
              id="resetEmail"
              name="email"
              type="email"
              placeholder="Registered email"
              value={resetEmail}
              onChange={(e) =>
                setResetEmail(
                  e.target.value
                )
              }
              autoComplete="email"
              required
            />

            <input
              id="newPassword"
              name="new_password"
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) =>
                setNewPassword(
                  e.target.value
                )
              }
              autoComplete="new-password"
              required
            />

            <button
              className="main-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Resetting..."
                : "Reset Password"}
            </button>

          </form>

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          <button
            className="link-button full-link"
            onClick={() => {
              setMessage("");
              setPage("login");
            }}
          >
            ← Back to Login
          </button>

        </div>

      </div>
    );
  }

  // =====================================================
  // MAIN APPLICATION
  // =====================================================

  return (
    <div className="dashboard">

      {/* =================================================
          NAVBAR
      ================================================= */}

      <nav className="navbar">

        <div className="brand-area">

          <div className="brand-logo">
            🔐
          </div>

          <div className="brand">
            TrustShare
          </div>

        </div>

        <div className="nav-right">

          <div className="profile-wrapper">

            {/* USERNAME + FIRST LETTER */}

            <button
              className="profile-button"
              onClick={() =>
                setProfileOpen(
                  !profileOpen
                )
              }
              title="Account menu"
            >

              <span className="profile-letter">
                {userInitial}
              </span>

              <span className="profile-username">
                {user?.username}
              </span>

              <span className="profile-arrow">
                ▾
              </span>

            </button>

            {/* =================================================
                PROFILE MENU
            ================================================= */}

            {profileOpen && (

              <div className="profile-menu">

                <div className="menu-user">

                  <div className="menu-avatar">
                    {userInitial}
                  </div>

                  <div>
                    <strong>
                      {user?.username}
                    </strong>

                    <small>
                      {user?.email}
                    </small>
                  </div>

                </div>

                <div className="menu-divider"></div>

                <button
                  onClick={() =>
                    navigateTo(
                      "dashboard"
                    )
                  }
                >
                  🏠 Dashboard
                </button>

                <button
                  onClick={() =>
                    navigateTo(
                      "files"
                    )
                  }
                >
                  📁 My Files
                </button>

                <button onClick={() => navigateTo("shared")}>
                  🤝 Shared With Me
                </button>

                <button onClick={() => navigateTo("sent")}>
                  📤 Sent Files
                </button>

                <button onClick={() => navigateTo("activity")}>
                  📋 Activity
                </button>

                <button onClick={() => navigateTo("notifications")}>
                  🔔 Notifications
                </button>

                <button onClick={() => navigateTo("security")}>
                  🛡 Security Alerts
                </button>

                <button onClick={() => navigateTo("analytics")}>
                  📊 Analytics
                </button>

                <button
                  onClick={() =>
                    navigateTo(
                      "profile"
                    )
                  }
                >
                  👤 My Profile
                </button>

                <button
                  onClick={() =>
                    navigateTo(
                      "settings"
                    )
                  }
                >
                  ⚙ Settings
                </button>

                <div className="menu-divider"></div>

                <button
                  className="logout-menu-button"
                  onClick={logout}
                >
                  🚪 Logout
                </button>

              </div>

            )}

          </div>

        </div>

      </nav>

      {/* =================================================
          DASHBOARD
      ================================================= */}

      {page === "dashboard" && (

        <main className="dashboard-container">

          <section className="welcome-section">

            <div>

              <div className="welcome-small">
                TRUSTSHARE SECURE PLATFORM
              </div>

              <h2>
                Welcome,{" "}
                <span>
                  {user?.username}
                </span>
              </h2>

              <p>
                Manage and securely store
                your files in one place.
              </p>

            </div>

            <div className="security-status">

              <span className="status-dot"></span>

              Secure

            </div>

          </section>

          {/* =================================================
              STATISTICS
          ================================================= */}

          <section className="stats-grid">

            <div className="stat-card">

              <div className="stat-icon">
                📁
              </div>

              <div>

                <span className="stat-number">
                  {analytics.total_files}
                </span>

                <span className="stat-label">
                  Total Files
                </span>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon">
                🔐
              </div>

              <div>

                <span className="stat-number">
                  Protected
                </span>

                <span className="stat-label">
                  File Security
                </span>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon">
                👤
              </div>

              <div>

                <span className="stat-number">
                  Active
                </span>

                <span className="stat-label">
                  Account Status
                </span>

              </div>

            </div>

          </section>

          {/* =================================================
              SINGLE UPLOAD SECTION
          ================================================= */}

          <section className="upload-card">

            <div className="section-header">

              <div className="section-icon">
                ☁️
              </div>

              <div>

                <h3>
                  Upload a File
                </h3>

                <p>
                  Securely upload your
                  files to TrustShare.
                </p>

              </div>

            </div>

            <div className="upload-zone">

              <div className="upload-big-icon">
                ☁️
              </div>

              <h4>
                Choose a file
              </h4>

              <p>
                Select a file from your
                computer.
              </p>

              <label
                htmlFor="fileInput"
                className="browse-button"
              >
                Browse Files
              </label>

              <input
                id="fileInput"
                name="file"
                type="file"
                className="hidden-file-input"
                onChange={
                  handleFileSelect
                }
              />

            </div>

            {selectedFile && (

              <div className="selected-file">

                <span>
                  📄
                </span>

                <div>

                  <strong>
                    {selectedFile.name}
                  </strong>

                  <small>
                    {(
                      selectedFile.size /
                      1024
                    ).toFixed(1)} KB
                  </small>

                </div>

              </div>

            )}

            <button
              className="upload-button"
              onClick={uploadFile}
              disabled={
                !selectedFile ||
                loading
              }
            >
              {loading
                ? "Uploading..."
                : "Upload File"}
            </button>

            {message && (

              <div className="dashboard-message">
                {message}
              </div>

            )}

          </section>

        </main>

      )}

      {/* =================================================
          MY FILES
      ================================================= */}

      {page === "files" && (

        <main className="dashboard-container">

          <section className="page-heading">

            <div className="welcome-small">
              FILE MANAGEMENT
            </div>

            <h2>
              My Files
            </h2>

            <p>
              View, download and manage
              your uploaded files.
            </p>

          </section>

          <section className="files-card">

            {files.length === 0 ? (

              <div className="empty-files">

                <div className="empty-icon">
                  📂
                </div>

                <h3>
                  No Files Yet
                </h3>

                <p>
                  You haven't uploaded
                  any files yet.
                </p>

                <button
                  className="main-button small-button"
                  onClick={() =>
                    navigateTo(
                      "dashboard"
                    )
                  }
                >
                  Upload Your First File
                </button>

              </div>

            ) : (

              <div className="file-list">

                {files.map((file) => (

                  <div
                    className="file-item"
                    key={file.id}
                  >

                    <div className="file-info">

                      <div className="file-icon">
                        📄
                      </div>

                      <div>

                        <strong>
                          {file.filename}
                        </strong>

                        <span>
                          File ID: {file.id}
                        </span>

                      </div>

                    </div>

                    <div className="file-actions">

                      <button
                        className="share-button"
                        onClick={() =>
                          openShareModal(file)
                        }
                      >
                        🔗 Share
                      </button>

                      <button
                        className="download-button"
                        onClick={() =>
                          downloadFile(
                            file.id,
                            file.filename
                          )
                        }
                      >
                        ⬇ Download
                      </button>

                      <button
                        className="delete-button"
                        onClick={() =>
                          openDeletePopup(
                            file.id,
                            file.filename
                          )
                        }
                      >
                        🗑 Delete
                      </button>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </section>

        </main>

      )}

      {/* =================================================
          SEND FILE
      ================================================= */}

      {/* =================================================
          SHARED WITH ME
      ================================================= */}

      {page === "shared" && (
        <main className="dashboard-container">
          <section className="page-heading">
            <div className="welcome-small">SECURE SHARING</div>
            <h2>Shared With Me</h2>
            <p>Files shared with your TrustShare account.</p>
          </section>

          <section className="files-card">
            {sharedLoading ? (
              <div className="empty-files"><h3>Loading shared files...</h3></div>
            ) : sharedFiles.length === 0 ? (
              <div className="empty-files">
                <div className="empty-icon">🤝</div>
                <h3>No Shared Files</h3>
                <p>Files shared with your account will appear here.</p>
              </div>
            ) : (
              <div className="shared-files-list">
                {sharedFiles.map((item) => (
                  <div className="shared-file-item" key={item.share_id}>
                    <div className="shared-file-main">
                      <div className="shared-file-icon">📄</div>
                      <div>
                        <h3>{item.filename}</h3>
                        <p>Shared by <strong>{item.owner?.username}</strong></p>
                        <small>
                          Permission: {item.permission === "download" ? "Download" : "View"}
                          {item.expires_at ? ` • Expires: ${formatDateTime(item.expires_at)}` : ""}
                          {item.permission === "download" && item.max_downloads
                            ? ` • Downloads: ${item.download_count}/${item.max_downloads}`
                            : ""}
                        </small>
                      </div>
                    </div>
                    <div className="shared-file-actions">
                      <button className="secondary-button" onClick={() => openSharedFile(item.share_id, item.permission, item.filename)}>
                        {item.permission === "download" ? "⬇ Download" : "👁 View"}
                      </button>
                      <button className="danger-action" onClick={() => openSharedRemovePopup(item.share_id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      {/* =================================================
          SENT FILES
      ================================================= */}

      {page === "sent" && (
        <main className="dashboard-container">
          <section className="page-heading">
            <div className="welcome-small">SECURE SHARING</div>
            <h2>Sent Files</h2>
            <p>Files you have shared with other TrustShare users.</p>
          </section>

          <section className="files-card">
            {sentLoading ? (
              <div className="empty-files">
                <h3>Loading sent files...</h3>
              </div>
            ) : sentFiles.length === 0 ? (
              <div className="empty-files">
                <div className="empty-icon">📤</div>
                <h3>No Sent Files</h3>
                <p>Files you share with other TrustShare users will appear here.</p>
              </div>
            ) : (
              <div className="shared-files-list">
                {sentFiles.map((item) => (
                  <div className="shared-file-item sent-file-item" key={item.share_id}>
                    <div className="shared-file-main">
                      <div className="shared-file-icon">📄</div>
                      <div>
                        <h3>{item.filename}</h3>
                        <p>
                          Sent to <strong>{item.recipient?.username}</strong>
                          {item.recipient?.email ? ` (${item.recipient.email})` : ""}
                        </p>
                        <small>
                          Permission: {item.permission === "download" ? "Download" : "View"}
                          {item.expires_at
                            ? ` • Expires: ${formatDateTime(item.expires_at)}`
                            : ""}
                          {item.permission === "download" && item.max_downloads
                            ? ` • Downloads: ${item.download_count}/${item.max_downloads}`
                            : item.permission === "download"
                              ? ` • Downloads: ${item.download_count}`
                              : ""}
                          {item.revoked ? " • Revoked" : ""}
                        </small>
                      </div>
                    </div>

                    <div className="shared-file-actions">
                      {item.revoked ? (
                        <span className="share-status revoked">Revoked</span>
                      ) : (
                        <button
                          className="danger-action"
                          onClick={() =>
                            openRevokePopup(
                              item.share_id,
                              item.filename,
                              item.recipient?.username || item.recipient?.email || ""
                            )
                          }
                        >
                          Revoke Access
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      {/* =================================================
          ACTIVITY MONITORING / AUDIT LOG
      ================================================= */}

      {page === "activity" && (
        <main className="dashboard-container">
          <section className="page-heading">
            {/* <div className="welcome-small">MILESTONE 3</div> */}
            <h2>Activity & Audit Log</h2>
            <p>Monitor important actions performed on your TrustShare account.</p>
          </section>
          {m3Error && <div className="dashboard-message">{m3Error}</div>}
          <div className="m3-toolbar">
            <span>{activityLogs.length} activity records</span>
            <button className="secondary-button" onClick={loadActivity}>Refresh</button>
          </div>
          <section className="files-card">
            {activityLoading ? (
              <div className="empty-files"><h3>Loading activity...</h3></div>
            ) : activityLogs.length === 0 ? (
              <div className="empty-files">
                <div className="empty-icon">📋</div>
                <h3>No Activity Yet</h3>
                <p>Your file and account activities will appear here.</p>
              </div>
            ) : (
              <div className="m3-table-wrap">
                <table className="m3-table">
                  <thead><tr><th>Time</th><th>Action</th><th>File</th><th>Description</th><th>IP Address</th></tr></thead>
                  <tbody>
                    {activityLogs.map((item) => (
                      <tr key={item.id}>
                        <td>{item.created_at ? formatDateTime(item.created_at) : "-"}</td>
                        <td><span className="activity-badge">{item.action}</span></td>
                        <td>{item.filename || "-"}</td>
                        <td>{item.description || "-"}</td>
                        <td>{item.ip_address || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      )}

      {/* =================================================
          NOTIFICATIONS
      ================================================= */}

      {page === "notifications" && (
        <main className="dashboard-container notifications-page">
          <section className="notification-hero">
            <div className="notification-hero-icon" aria-hidden="true">🔔</div>
            <div className="notification-hero-copy">
              <div className="notification-eyebrow">TRUSTSHARE</div>
              <h2>Notifications</h2>
              <p>Stay informed about file activity, sharing and account security.</p>
            </div>
            <button
              className="notification-refresh-button notification-hero-refresh"
              onClick={loadNotifications}
              disabled={notificationsLoading}
            >
              <span className="button-icon">↻</span>
              <span>{notificationsLoading ? "Refreshing..." : "Refresh"}</span>
            </button>
          </section>

          {m3Error && <div className="dashboard-message">{m3Error}</div>}

          <section className="notifications-panel notification-center-card">
            <div className="notification-overview">
              <div className="notification-overview-main">
                <div className="notification-total-badge">{notifications.length}</div>
                <div>
                  <h3>Notification Center</h3>
                  <p>
                    {notifications.length === 0
                      ? "No new TrustShare updates"
                      : `${notifications.length} update${notifications.length === 1 ? "" : "s"} available`}
                  </p>
                </div>
              </div>
              <div className="notification-stat-group">
                <div className="notification-stat">
                  <strong>{notifications.filter((n) => !n.is_read).length}</strong>
                  <span>Unread</span>
                </div>
                <div className="notification-stat">
                  <strong>{notifications.filter((n) => n.is_read).length}</strong>
                  <span>Read</span>
                </div>
              </div>
            </div>

            <div className="notification-section-title">
              <div>
                <span className="notification-section-dot"></span>
                <strong>Recent activity</strong>
              </div>
              <span>{notifications.length} total</span>
            </div>

            {notificationsLoading ? (
              <div className="notification-empty-state notification-state-card">
                <div className="notification-loading-icon">⟳</div>
                <h3>Loading notifications</h3>
                <p>Please wait while we retrieve your latest TrustShare updates.</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty-state notification-state-card">
                <div className="notification-empty-icon">✓</div>
                <h3>You're all caught up</h3>
                <p>New sharing, file access and security updates will appear here.</p>
              </div>
            ) : (
              <div className="professional-notification-list">
                {notifications.map((item) => {
                  const meta = notificationMeta(item);
                  return (
                    <article
                      className={`professional-notification-card notification-card-v2 ${item.is_read ? "is-read" : "is-unread"}`}
                      key={item.id}
                      onClick={() => openNotificationPopup(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openNotificationPopup(item);
                        }
                      }}
                    >
                      <div className={`notification-type-icon ${meta.tone}`} aria-hidden="true">
                        {meta.icon}
                      </div>

                      <div className="notification-content">
                        <div className="notification-card-title-row">
                          <h3>{item.title}</h3>
                          <span className={`notification-status-pill ${item.is_read ? "read" : "unread"}`}>
                            {item.is_read ? "Read" : "New"}
                          </span>
                        </div>

                        <p>{item.message}</p>

                        <div className="notification-meta-row">
                          <span className={`notification-type-pill ${meta.tone}`}>
                            {meta.label}
                          </span>
                          <span className="notification-date">
                            ◷ {item.created_at ? formatDateTime(item.created_at) : ""}
                          </span>
                        </div>
                      </div>

                      <div className="notification-card-arrow" aria-hidden="true">›</div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      )}

      {/* =================================================
          NOTIFICATION DETAILS POPUP
          Read-only: no Mark as Read action
      ================================================= */}
      {notificationPopup.open && notificationPopup.notification && (() => {
        const item = notificationPopup.notification;
        const meta = notificationMeta(item);
        return (
          <div className="professional-modal-overlay" onClick={closeNotificationPopup}>
            <div
              className="professional-notification-modal notification-details-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="professional-modal-close"
                onClick={closeNotificationPopup}
                aria-label="Close notification"
              >
                ×
              </button>

              <div className={`professional-modal-icon ${meta.tone}`}>
                {meta.icon}
              </div>

              <div className={`notification-modal-status ${item.is_read ? "read" : "unread"}`}>
                {item.is_read ? "READ" : "NEW"}
              </div>

              <h2>{item.title}</h2>
              <p>Notification details</p>

              <div className="notification-modal-detail professional-detail-box">
                <div className={`notification-type-icon ${meta.tone}`}>
                  {meta.icon}
                </div>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                  <small>◷ {item.created_at ? formatDateTime(item.created_at) : ""}</small>
                </div>
              </div>

              <div className="professional-modal-actions single-action">
                <button
                  className="professional-confirm-button"
                  onClick={closeNotificationPopup}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =================================================
          PROFESSIONAL ACCESS ERROR POPUP
      ================================================= */}
      {systemPopup.open && (
        <div className="professional-modal-overlay" onClick={() => setSystemPopup({ ...systemPopup, open: false })}>
          <div className="professional-notification-modal compact" onClick={(event) => event.stopPropagation()}>
            <button className="professional-modal-close" onClick={() => setSystemPopup({ ...systemPopup, open: false })}>×</button>
            <div className={`professional-modal-icon ${systemPopup.tone}`}>{systemPopup.icon}</div>
            <h2>{systemPopup.title}</h2>
            <p>{systemPopup.message}</p>
            <div className="professional-modal-actions single-action">
              <button className="professional-confirm-button" onClick={() => setSystemPopup({ ...systemPopup, open: false })}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          REMOVE SHARED FILE POPUP
      ================================================= */}
      {sharedRemovePopup.open && (
        <div className="professional-modal-overlay" onClick={() => setSharedRemovePopup({ open: false, shareId: null })}>
          <div className="professional-notification-modal compact" onClick={(event) => event.stopPropagation()}>
            <button className="professional-modal-close" onClick={() => setSharedRemovePopup({ open: false, shareId: null })}>×</button>
            <div className="professional-modal-icon access">🗑️</div>
            <h2>Remove Shared File?</h2>
            <p>This will remove the shared file from your Shared With Me list. The original owner's file will not be deleted.</p>
            <div className="professional-modal-actions">
              <button className="professional-cancel-button" onClick={() => setSharedRemovePopup({ open: false, shareId: null })}>Cancel</button>
              <button className="professional-confirm-button danger" onClick={confirmSharedRemove}>Remove File</button>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY ALERTS */}
      {page === "security" && (
        <main className="dashboard-container">
          <section className="page-heading">
            {/* <div className="welcome-small">MILESTONE 3</div> */}
            <h2>Security Alerts</h2>
            <p>Rule-based detection of unusual account activity.</p>
          </section>

          {m3Error && <div className="dashboard-message">{m3Error}</div>}
          <div className="m3-toolbar">
            <span>{securityAlerts.length} active alerts</span>
            <button className="secondary-button" onClick={loadSecurityAlerts}>Refresh</button>
          </div>
          <section className="files-card">
            {alertsLoading ? (
              <div className="empty-files">
                <h3>Checking security...</h3>
              </div>
            ) : securityAlerts.length === 0 ? (
              <div className="empty-files">
                <div className="empty-icon">🛡️</div>
                <h3>No Security Alerts</h3>
                <p>No security alerts were found.</p>
              </div>
            ) : (
              <div className="m3-list">
                {securityAlerts.map((item) => (
                  <div
                    className="m3-alert"
                    key={item.id}
                  >
                    <div>
                      <div
                        className={
                          `severity-badge ${String(
                            item.severity || ""
                          ).toLowerCase()}`
                        }
                      >
                        {item.severity || "INFO"}
                      </div>
                      <h3>{item.alert_type}</h3>
                      <p>{item.description}</p>
                      <small>
                        {item.created_at
                          ? formatDateTime(item.created_at)
                          : ""}
                      </small>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      {/* ANALYTICS */}
      {page === "analytics" && (
        <main className="dashboard-container">
          <section className="page-heading">
            {/* <div className="welcome-small">MILESTONE 3</div> */}
            <h2>Security & Storage Analytics</h2>
            <p>
              Overview of your TrustShare file and security activity.
            </p>
          </section>

          {m3Error && <div className="dashboard-message">{m3Error}</div>}
          <div className="m3-toolbar">
            <span>Live statistics from TrustShare</span>
            <button className="secondary-button" onClick={loadAnalytics}>Refresh</button>
          </div>
          <section className="m3-analytics-grid">
            <div className="stat-card">
              <div className="stat-icon">📁</div>
              <div>
                <span className="stat-number">{analytics.total_files}</span>
                <span className="stat-label">Total Files</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">↗</div>
              <div>
                <span className="stat-number">{analytics.total_shared}</span>
                <span className="stat-label">Files Shared</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">⬇️</div>
              <div>
                <span className="stat-number">{analytics.total_downloads}</span>
                <span className="stat-label">Downloads</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">👁️</div>
              <div>
                <span className="stat-number">{analytics.total_views}</span>
                <span className="stat-label">Views</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🔔</div>
              <div>
                <span className="stat-number">
                  {analytics.unread_notifications}
                </span>
                <span className="stat-label">Unread Notifications</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🛡️</div>
              <div>
                <span className="stat-number">
                  {analytics.security_alerts}
                </span>
                <span className="stat-label">Active Security Alerts</span>
              </div>
            </div>
          </section>

          {analyticsLoading && (
            <div className="dashboard-message">
              Refreshing analytics...
            </div>
          )}
        </main>
      )}

      {page === "profile" && (

        <main className="dashboard-container">

          <section className="page-heading">

            <div className="welcome-small">
              ACCOUNT
            </div>

            <h2>
              My Profile
            </h2>

            <p>
              View your TrustShare account
              information.
            </p>

          </section>

          <section className="profile-card">

            <div className="large-profile-icon">
              {userInitial}
            </div>

            <h2>
              {user?.username}
            </h2>

            <p className="profile-role">
              {user?.role}
            </p>

            <div className="profile-details">

              <div className="detail-row">

                <span>
                  User ID
                </span>

                <strong>
                  {user?.user_id}
                </strong>

              </div>

              <div className="detail-row">

                <span>
                  Username
                </span>

                <strong>
                  {user?.username}
                </strong>

              </div>

              <div className="detail-row">

                <span>
                  Email
                </span>

                <strong>
                  {user?.email}
                </strong>

              </div>

              <div className="detail-row">

                <span>
                  Account Role
                </span>

                <strong>
                  {user?.role}
                </strong>

              </div>

              <div className="detail-row">

                <span>
                  Status
                </span>

                <strong className="active-status">
                  ● Active
                </strong>

              </div>

            </div>

          </section>

        </main>

      )}

      {/* =================================================
          SETTINGS
      ================================================= */}

      {page === "settings" && (

        <main className="dashboard-container">

          <section className="page-heading">

            <div className="welcome-small">
              PREFERENCES
            </div>

            <h2>
              Settings
            </h2>

            <p>
              Customize your TrustShare
              experience.
            </p>

          </section>

          <section className="settings-card">

            {/* THEME */}

            <div className="settings-section">

              <div className="settings-icon">
                🎨
              </div>

              <div className="settings-content">

                <h3>
                  Theme
                </h3>

                <p>
                  Choose how TrustShare
                  looks on your device.
                </p>

                <div className="theme-options">

                  <button
                    className={`theme-option ${
                      theme === "light"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setTheme("light")
                    }
                  >
                    ☀️ Light
                  </button>

                  <button
                    className={`theme-option ${
                      theme === "dark"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setTheme("dark")
                    }
                  >
                    🌙 Dark
                  </button>

                  <button
                    className={`theme-option ${
                      theme === "system"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setTheme("system")
                    }
                  >
                    💻 System
                  </button>

                </div>

              </div>

            </div>

            <div className="settings-divider"></div>

            {/* SECURITY */}

            <div className="settings-section">

              <div className="settings-icon">
                🔐
              </div>

              <div className="settings-content">

                <h3>
                  Security
                </h3>

                <p>
                  Your account is protected
                  using authentication and
                  secure access tokens.
                </p>

                <div className="security-setting">

                  <span>
                    Account Security
                  </span>

                  <strong>
                    Protected
                  </strong>

                </div>

              </div>

            </div>

            <div className="settings-divider"></div>

            {/* STORAGE */}

            <div className="settings-section">

              <div className="settings-icon">
                💾
              </div>

              <div className="settings-content">

                <h3>
                  Storage
                </h3>

                <p>
                  Manage your uploaded
                  TrustShare files.
                </p>

                <div className="storage-info">

                  <span>
                    Total Files
                  </span>

                  <strong>
                    {analytics.total_files}
                  </strong>

                </div>

              </div>

            </div>

            <div className="settings-divider"></div>

            {/* ACCOUNT */}

            <div className="settings-section">

              <div className="settings-icon">
                👤
              </div>

              <div className="settings-content">

                <h3>
                  Account
                </h3>

                <p>
                  You are currently signed
                  in as{" "}
                  <strong>
                    {user?.email}
                  </strong>
                </p>

                <button
                  className="logout-settings-button"
                  onClick={logout}
                >
                  🚪 Logout
                </button>

              </div>

            </div>

          </section>

        </main>

      )}

      {/* =================================================
          DELETE CONFIRMATION POPUP
      ================================================= */}

      {/* =================================================
          REVOKE ACCESS CONFIRMATION POPUP
      ================================================= */}

      {revokePopup.open && (
        <div
          className="modal-overlay"
          onClick={closeRevokePopup}
        >
          <div
            className="revoke-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="revoke-modal-icon">🔐</div>

            <h2>Revoke Access?</h2>

            <p>
              Are you sure you want to revoke access to this shared file?
            </p>

            <div className="revoke-file-name">
              📄 <span>{revokePopup.fileName}</span>
            </div>

            {revokePopup.recipient && (
              <p className="revoke-recipient">
                Shared with <strong>{revokePopup.recipient}</strong>
              </p>
            )}

            <p className="revoke-warning">
              The recipient will no longer be able to access this file through this share.
            </p>

            <div className="modal-actions">
              <button
                className="cancel-delete-button"
                onClick={closeRevokePopup}
              >
                Cancel
              </button>

              <button
                className="confirm-revoke-button"
                onClick={confirmRevoke}
              >
                🔒 Revoke Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          SECURE SHARING MODAL
      ================================================= */}

      {shareModalOpen && (

        <div
          className="modal-overlay"
          onClick={closeShareModal}
        >

          <div
            className="share-modal account-share-modal"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="share-modal-icon">
              🔐
            </div>

            <h2>
              Secure File Sharing
            </h2>

            <p className="share-file-title">
              {shareFile?.filename}
            </p>

            <div className="share-form-group">
              <label htmlFor="shareRecipient">
                TrustShare Recipient
              </label>

              <input
                id="shareRecipient"
                type="text"
                placeholder="Recipient email or username"
                value={shareRecipient}
                onChange={(e) =>
                  setShareRecipient(e.target.value)
                }
              />

              <small className="share-help-text">
                The recipient must already have a TrustShare account.
              </small>
            </div>

            <div className="share-form-group">
              <label>
                Permission
              </label>

              <div className="permission-options">

                <label
                  className={`permission-option ${
                    sharePermission === "view"
                      ? "selected"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="sharePermission"
                    value="view"
                    checked={sharePermission === "view"}
                    onChange={(e) =>
                      setSharePermission(e.target.value)
                    }
                  />

                  <span>
                    👁️ View
                  </span>
                </label>

                <label
                  className={`permission-option ${
                    sharePermission === "download"
                      ? "selected"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="sharePermission"
                    value="download"
                    checked={sharePermission === "download"}
                    onChange={(e) =>
                      setSharePermission(e.target.value)
                    }
                  />

                  <span>
                    ⬇️ Download
                  </span>
                </label>

              </div>
            </div>

            <div className="share-form-row">

              <div className="share-form-group">
                <label htmlFor="shareExpiry">
                  Temporary Access (Hours)
                </label>

                <input
                  id="shareExpiry"
                  type="number"
                  min="1"
                  value={shareExpiry}
                  onChange={(e) =>
                    setShareExpiry(e.target.value)
                  }
                />
              </div>

              <div className="share-form-group">
                <label htmlFor="maxDownloads">
                  Maximum Downloads
                </label>

                <input
                  id="maxDownloads"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={maxDownloads}
                  onChange={(e) =>
                    setMaxDownloads(e.target.value)
                  }
                />
              </div>

            </div>

            {shareMessage && (
              <div className="share-message">
                {shareMessage}
              </div>
            )}

            <div className="share-modal-actions">

              <button
                className="secondary-button"
                onClick={closeShareModal}
                disabled={shareLoading}
              >
                Cancel
              </button>

              <button
                className="main-button share-submit-button"
                onClick={shareFileWithAccount}
                disabled={shareLoading}
              >
                {shareLoading
                  ? "Sharing..."
                  : "Share File"}
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;
