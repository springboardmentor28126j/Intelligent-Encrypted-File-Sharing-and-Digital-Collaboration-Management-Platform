import React, { useEffect, useState } from "react";
import "./App.css";
import "./dark-theme.css";
import { Icon } from "./icons.jsx";

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
function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || bytes === 0) {
    return "0 Bytes";
  }

  const units = [
    "Bytes",
    "KB",
    "MB",
    "GB",
    "TB"
  ];

  const index = Math.floor(
    Math.log(bytes) / Math.log(1024)
  );

  const size = bytes / Math.pow(1024, index);

  return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}


function App() {
  // =====================================================
  // AUTH STATE
  // =====================================================

  const [page, setPage] = useState("login");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // MFA (login challenge)
  const [loginWarning, setLoginWarning] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [securityNotice, setSecurityNotice] = useState(0);
  const [mfaCode, setMfaCode] = useState("");

  // MFA (settings)
  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaSetupCode, setMfaSetupCode] = useState("");
  const [mfaBackupCodes, setMfaBackupCodes] = useState([]);
  const [mfaDisableOpen, setMfaDisableOpen] = useState(false);
  const [mfaDisablePassword, setMfaDisablePassword] = useState("");
  const [mfaDisableCode, setMfaDisableCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMessage, setMfaMessage] = useState("");

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
  // RECYCLE BIN
  // =====================================================
  const [recycleBin, setRecycleBin] = useState([]);
  const [recycleLoading, setRecycleLoading] = useState(false);
  const [recycleMessage, setRecycleMessage] = useState("");
  const [permanentDeletePopup, setPermanentDeletePopup] = useState({ open: false, fileId: null, fileName: "" });

  // =====================================================
  // PROFILE MENU
  // =====================================================

  const [profileOpen, setProfileOpen] = useState(false);

  // =====================================================
  // PROFILE IMAGE
  // =====================================================

  const [profileImage, setProfileImage] = useState(
    localStorage.getItem("trustshare_profile_image") || ""
  );

  // Dashboard top-bar search
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

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
    icon: "bell",
  });

  const [sharedRemovePopup, setSharedRemovePopup] = useState({
    open: false,
    shareId: null,
  });

  // =====================================================
  // RECENT FILE ACTION MENU
  // =====================================================

  const [fileActionMenu, setFileActionMenu] = useState({
    open: false,
    fileId: null,
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
  const [shareMode, setShareMode] = useState("account");

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
  // AI ASSISTANT
  // =====================================================
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiSources, setAiSources] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiInsights, setAiInsights] = useState(null);
  const [aiFileId, setAiFileId] = useState("");
  const [aiTab, setAiTab] = useState("ask");
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [aiError, setAiError] = useState("");


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

  // =====================================================
  // PUBLIC SECURE SHARE LINK
  // =====================================================
  const [publicShareToken, setPublicShareToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("trustshare_share") || "";
  });
  const [publicShareInfo, setPublicShareInfo] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("trustshare_share");
    if (!token) return null;
    return {
      filename: params.get("filename") || "Shared file",
      permission: params.get("permission") === "download" ? "download" : "view",
      expires_at: params.get("expires_at") || null,
    };
  });
  const [publicShareLoading, setPublicShareLoading] = useState(false);
  const [publicShareError, setPublicShareError] = useState("");
  const [publicShareBusy, setPublicShareBusy] = useState(false);

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
  // PUBLIC SECURE SHARE LINK
  // =====================================================
  // The secure-link landing page uses display metadata carried in the
  // link, so it does not depend on a cross-origin fetch just to render.
  // The token itself remains the credential and the backend still
  // enforces expiry, revocation, permission and download limits.

  function openPublicSecureShare() {
    if (!publicShareToken || !publicShareInfo) return;

    setPublicShareBusy(true);
    setPublicShareError("");

    const directUrl = `${API_URL}/share/${encodeURIComponent(publicShareToken)}`;

    // Let the browser navigate directly to the FastAPI secure-share
    // endpoint. This avoids a frontend fetch/CORS failure and lets the
    // backend enforce the token, expiry, permission and download limit.
    window.location.href = directUrl;
  }

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
    setLoginWarning("");
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

      if (data.mfa_required) {
        setMfaToken(data.mfa_token);
        setMfaCode("");
        setMessage("");
        return;
      }

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
          mfa_enabled: Boolean(data.mfa_enabled),
        };

        setUser(loggedUser);
        setSecurityNotice(Number(data.recent_failed_logins) || 0);

        setEmail("");
        setPassword("");
        setMessage("");

        setPage("dashboard");

        loadFiles(data.user_id, data.access_token);
      } else {
        setMessage(data.message);
        setLoginWarning(data.security_warning || "");
      }
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // MFA: LOGIN STEP 2
  // =====================================================

  async function verifyMfaLogin(e) {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const formData = new URLSearchParams();

      formData.append("mfa_token", mfaToken);
      formData.append("code", mfaCode);

      const response = await fetch(`${API_URL}/login/mfa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("trustshare_token", data.access_token);

        setToken(data.access_token);

        setUser({
          user_id: data.user_id,
          username: data.username,
          email: data.email,
          role: data.role,
          mfa_enabled: true,
        });

        setSecurityNotice(Number(data.recent_failed_logins) || 0);

        setEmail("");
        setPassword("");
        setMfaToken("");
        setMfaCode("");
        setMessage("");

        setPage("dashboard");

        loadFiles(data.user_id, data.access_token);
      } else {
        setMessage(data.message);
        setMfaCode("");

        if (data.mfa_expired) {
          setMfaToken("");
        }
      }
    } catch (error) {
      console.error("MFA login error:", error);
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  function cancelMfaLogin() {
    setLoginWarning("");
    setMfaToken("");
    setMfaCode("");
    setPassword("");
    setMessage("");
  }

  // =====================================================
  // MFA: SETTINGS (enable / disable)
  // =====================================================

  function resetMfaSettingsState() {
    setMfaSetup(null);
    setMfaSetupCode("");
    setMfaBackupCodes([]);
    setMfaDisableOpen(false);
    setMfaDisablePassword("");
    setMfaDisableCode("");
    setMfaMessage("");
  }

  async function startMfaSetup() {
    setMfaBusy(true);
    setMfaMessage("");

    try {
      const response = await fetch(`${API_URL}/mfa/setup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMfaSetup(data);
        setMfaSetupCode("");
      } else {
        setMfaMessage(data.detail || data.message || "Could not start MFA setup.");
      }
    } catch (error) {
      console.error("MFA setup error:", error);
      setMfaMessage("Unable to connect to the server.");
    } finally {
      setMfaBusy(false);
    }
  }

  async function confirmMfaEnable(e) {
    e.preventDefault();

    setMfaBusy(true);
    setMfaMessage("");

    try {
      const formData = new URLSearchParams();
      formData.append("code", mfaSetupCode);

      const response = await fetch(`${API_URL}/mfa/enable`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMfaBackupCodes(data.backup_codes || []);
        setMfaSetup(null);
        setMfaSetupCode("");
        setMfaMessage("MFA is now enabled. Save your backup codes below.");
        setUser((current) => ({ ...current, mfa_enabled: true }));
      } else {
        setMfaMessage(data.detail || data.message || "Invalid code.");
      }
    } catch (error) {
      console.error("MFA enable error:", error);
      setMfaMessage("Unable to connect to the server.");
    } finally {
      setMfaBusy(false);
    }
  }

  async function disableMfa(e) {
    e.preventDefault();

    setMfaBusy(true);
    setMfaMessage("");

    try {
      const formData = new URLSearchParams();
      formData.append("password", mfaDisablePassword);
      formData.append("code", mfaDisableCode);

      const response = await fetch(`${API_URL}/mfa/disable`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        resetMfaSettingsState();
        setMfaMessage("MFA has been disabled.");
        setUser((current) => ({ ...current, mfa_enabled: false }));
      } else {
        setMfaMessage(data.detail || data.message || "Could not disable MFA.");
      }
    } catch (error) {
      console.error("MFA disable error:", error);
      setMfaMessage("Unable to connect to the server.");
    } finally {
      setMfaBusy(false);
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

  async function loadFiles(userId = user?.user_id, tokenOverride = "") {
    // Right after login the `token` state has not updated yet, so the
    // fresh token is passed in explicitly.
    const authToken = tokenOverride || token;

    if (!userId || !authToken) return;

    try {
      const response = await fetch(
        `${API_URL}/files/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
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
  // VIEW OFFICE FILE
  // XLSX / PPT / PPTX only.
  // Download behavior is unchanged.
  // =====================================================

  async function viewFile(fileId, filename) {
    try {
      const extension =
        String(filename || "")
          .toLowerCase()
          .split(".")
          .pop();

      if (!["xlsx", "ppt", "pptx"].includes(extension)) {
        return;
      }

      const response = await fetch(
        `${API_URL}/preview/${fileId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let errorMessage = "Unable to preview file.";
        try {
          const data = await response.json();
          errorMessage = data.detail || errorMessage;
        } catch (_) {}

        setSystemPopup({
          open: true,
          title: "Preview Failed",
          message: errorMessage,
          tone: "general",
          icon: "alert",
        });
        return;
      }

      const previewHtml = await response.text();
      const previewBlob = new Blob(
        [previewHtml],
        { type: "text/html" }
      );
      const previewUrl = window.URL.createObjectURL(previewBlob);

      window.open(
        previewUrl,
        "_blank",
        "noopener,noreferrer"
      );

      setTimeout(() => {
        window.URL.revokeObjectURL(previewUrl);
      }, 60000);

    } catch (error) {
      console.error("View file error:", error);
      setSystemPopup({
        open: true,
        title: "Preview Failed",
        message: error.message || "Unable to preview file.",
        tone: "general",
        icon: "alert",
      });
    }
  }

  // =====================================================
  // RECENT FILE ACTION MENU
  // =====================================================

  function toggleFileActionMenu(fileId) {
    setFileActionMenu((previous) => ({
      open: previous.fileId !== fileId || !previous.open,
      fileId: fileId,
    }));
  }

  function closeFileActionMenu() {
    setFileActionMenu({
      open: false,
      fileId: null,
    });
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
          icon: "alert",
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
        icon: "alert",
      });
    }
  }
  

  // =====================================================
  // OPEN DELETE POPUP
  // =====================================================

  function openDeletePopup(fileId, fileName) {
  console.log("=================================");
  console.log("DELETE BUTTON CLICKED");
  console.log("OPEN DELETE POPUP");
  console.log("File ID:", fileId);
  console.log("File Name:", fileName);
  console.log("=================================");

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
    console.log("CLOSE DELETE POPUP");
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

  console.log("=================================");
  console.log("CONFIRM DELETE BUTTON CLICKED");
  console.log("=================================");

  const fileId = deletePopup.fileId;
  const fileName = deletePopup.fileName;

  console.log("File ID:", fileId);
  console.log("File Name:", fileName);

  const authToken =
    token ||
    localStorage.getItem("trustshare_token");

  console.log(
    "Token exists:",
    !!authToken
  );

  if (!fileId) {
    console.error(
      "DELETE FAILED: File ID is missing."
    );

    closeDeletePopup();
    return;
  }

  if (!authToken) {
    console.error(
      "DELETE FAILED: Authentication token is missing."
    );

    closeDeletePopup();

    setSystemPopup({
      open: true,
      title: "Authentication Required",
      message:
        "Your TrustShare session has expired. Please login again.",
      tone: "general",
      icon: "lock",
    });

    return;
  }

  try {

    setLoading(true);

    console.log(
      "DELETE REQUEST STARTED"
    );

    console.log(
      "DELETE URL:",
      `${API_URL}/files/${fileId}`
    );

    const response = await fetch(
      `${API_URL}/files/${fileId}`,
      {
        method: "DELETE",

        headers: {
          Authorization:
            `Bearer ${authToken}`,

          Accept:
            "application/json",
        },
      }
    );

    console.log(
      "DELETE STATUS:",
      response.status
    );

    const responseText =
      await response.text();

    console.log(
      "DELETE RAW RESPONSE:",
      responseText
    );

    let data = {};

    if (responseText) {
      try {
        data = JSON.parse(
          responseText
        );
      } catch (jsonError) {
        console.error(
          "DELETE JSON PARSE ERROR:",
          jsonError
        );
      }
    }

    console.log(
      "DELETE RESPONSE:",
      data
    );

    if (!response.ok) {

      if (response.status === 401) {
        throw new Error(
          "Your TrustShare session has expired. Please login again."
        );
      }

      if (response.status === 403) {
        throw new Error(
          data.detail ||
          "You do not have permission to delete this file."
        );
      }

      if (response.status === 404) {
        throw new Error(
          data.detail ||
          "File was not found."
        );
      }

      throw new Error(
        data.detail ||
        data.message ||
        `Delete failed with status ${response.status}.`
      );
    }

    // ============================================
    // REMOVE FILE FROM FRONTEND
    // ============================================

    setFiles((previousFiles) =>
      previousFiles.filter(
        (file) =>
          String(file.id) !==
          String(fileId)
      )
    );

    // ============================================
    // CLOSE POPUP
    // ============================================

    closeDeletePopup();

    setMessage(
      data.message ||
      `"${fileName}" deleted successfully.`
    );

    // ============================================
    // REFRESH DATA
    // ============================================

    await loadFiles();

    await loadActivity();

    await loadNotifications();

    await loadAnalytics();

    console.log(
      "FILE DELETE COMPLETED SUCCESSFULLY"
    );

  } catch (error) {

    console.error(
      "================================="
    );

    console.error(
      "DELETE FILE ERROR:",
      error
    );

    console.error(
      "================================="
    );

    closeDeletePopup();

    setSystemPopup({
      open: true,
      title: "Delete Failed",
      message:
        error.message ||
        "Unable to delete the file.",
      tone: "general",
      icon: "alert",
    });

  } finally {

    setLoading(false);

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
    setShareMode("account");
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
    setShareMode("account");
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

      // The secure link must point directly to the FastAPI protected
      // endpoint. The token is the credential; the backend decides whether
      // the file is displayed inline (view) or downloaded (download).
      const fullShareLink = `${API_URL}/share/${encodeURIComponent(data.share_token)}`;
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
  // RECYCLE BIN
  // =====================================================

  async function loadRecycleBin() {
    if (!token) return;

    setRecycleLoading(true);
    setRecycleMessage("");

    try {
      const response = await fetch(`${API_URL}/recycle-bin`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to load the Recycle Bin.");
      }

      setRecycleBin(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Recycle Bin error:", error);
      setRecycleBin([]);
      setRecycleMessage(error.message || "Unable to load the Recycle Bin.");
    } finally {
      setRecycleLoading(false);
    }
  }

  async function restoreRecycleFile(fileId) {
    try {
      setRecycleLoading(true);
      const response = await fetch(`${API_URL}/recycle-bin/${fileId}/restore`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to restore the file.");
      }

      setRecycleMessage(data.message || "File restored successfully.");
      await loadRecycleBin();
      await loadFiles();
      await loadActivity();
      await loadNotifications();
      await loadAnalytics();
    } catch (error) {
      console.error("Restore file error:", error);
      setRecycleMessage(error.message || "Unable to restore the file.");
      setRecycleLoading(false);
    }
  }

  function openPermanentDeletePopup(fileId, fileName) {
    setPermanentDeletePopup({ open: true, fileId, fileName: fileName || "this file" });
  }

  function closePermanentDeletePopup() {
    setPermanentDeletePopup({ open: false, fileId: null, fileName: "" });
  }

  async function permanentlyDeleteRecycleFile(fileId) {
    try {
      setRecycleLoading(true);
      const response = await fetch(`${API_URL}/recycle-bin/${fileId}/permanent`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const raw = await response.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.detail || `Permanent delete failed (HTTP ${response.status}).`
        );
      }

      setPermanentDeletePopup({ open: false, fileId: null, fileName: "" });
      setRecycleMessage(data.message || "File permanently deleted.");
      await loadRecycleBin();
      await loadActivity();
      await loadNotifications();
      await loadAnalytics();
    } catch (error) {
      console.error("Permanent delete error:", error);
      setRecycleMessage(error.message || "Unable to permanently delete the file.");
      setRecycleLoading(false);
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
      const extension =
        String(filename || "")
          .toLowerCase()
          .split(".")
          .pop();

      // Office View files use the dedicated preview endpoint.
      if (
        permission === "view" &&
        ["xlsx", "ppt", "pptx"].includes(extension)
      ) {
        const previewResponse = await fetch(
          `${API_URL}/shared-with-me/${shareId}/preview`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!previewResponse.ok) {
          let errorMessage = "Unable to preview shared file.";
          try {
            const previewData = await previewResponse.json();
            errorMessage = previewData.detail || errorMessage;
          } catch (_) {}
          throw new Error(errorMessage);
        }

        const previewHtml = await previewResponse.text();
        const previewBlob = new Blob(
          [previewHtml],
          { type: "text/html" }
        );
        const previewUrl = window.URL.createObjectURL(previewBlob);

        window.open(
          previewUrl,
          "_blank",
          "noopener,noreferrer"
        );

        setTimeout(() => {
          window.URL.revokeObjectURL(previewUrl);
        }, 60000);

        loadSharedFiles();
        return;
      }

      // Existing behavior for every other shared file is unchanged.
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
          title: errorMessage.toLowerCase().includes("expired")
            ? "Access Expired"
            : "Unable to Access File",
          message: errorMessage,
          tone: errorMessage.toLowerCase().includes("expired")
            ? "access"
            : "general",
          icon: errorMessage.toLowerCase().includes("expired")
            ? "clock"
            : "alert",
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
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60000);

      loadSharedFiles();

    } catch (error) {
      console.error(
        "Shared file access error:",
        error
      );

      const message =
        error?.message ||
        "Unable to access the shared file. Please check that the backend server is running.";

      setSystemPopup({
        open: true,
        title: "Unable to Access File",
        message,
        tone: "general",
        icon: "alert",
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
        icon: "alert",
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
      return { icon: "shield", tone: "security", label: "Security Alert" };
    }
    if (title.includes("access") && (title.includes("revok") || message.includes("revok"))) {
      return { icon: "lock", tone: "access", label: "Access Control" };
    }
    if (title.includes("download") || title.includes("accessed") || message.includes("downloaded")) {
      return { icon: "download", tone: "download", label: "File Access" };
    }
    if (title.includes("view") || message.includes("viewed")) {
      return { icon: "eye", tone: "view", label: "File View" };
    }
    if (title.includes("share") || message.includes("shared")) {
      return { icon: "arrow-up-right", tone: "share", label: "File Share" };
    }
    return { icon: "bell", tone: "general", label: "TrustShare" };
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
      const [analyticsResponse, ownedFilesResponse, sharedFilesResponse] =
        await Promise.all([
          fetch(`${API_URL}/analytics`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          user?.user_id
            ? fetch(`${API_URL}/files/${user.user_id}`, {
                headers: { Authorization: `Bearer ${token}` }
              })
            : Promise.resolve(null),
          fetch(`${API_URL}/shared-with-me`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

      const data = await analyticsResponse.json();

      if (!analyticsResponse.ok) {
        throw new Error(
          data.detail || "Unable to load analytics."
        );
      }

      // =====================================================
      // TOTAL FILES
      // Count ONLY files owned/uploaded by the logged-in user.
      // Shared files are counted separately under Shared Files.
      // =====================================================
      let totalOwnedFiles = Number(data.total_files || 0);

      if (ownedFilesResponse?.ok) {
        const ownedData = await ownedFilesResponse.json();
        totalOwnedFiles = Array.isArray(ownedData)
          ? ownedData.length
          : totalOwnedFiles;
      }

      setAnalytics({
        ...data,
        total_files: totalOwnedFiles,
      });
    } catch (error) {
      console.error("Analytics error:", error);
      setM3Error(
        error.message || "Unable to load analytics."
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }


  // =====================================================
  // AI ASSISTANT API
  // =====================================================

  async function askTrustShareAI() {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiAnswer("");
    setAiSources([]);
    try {
      const form = new FormData();
      form.append("question", aiQuestion.trim());
      if (aiFileId) form.append("file_id", aiFileId);
      const response = await fetch(`${API_URL}/ai/ask`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "AI assistant request failed.");
      setAiAnswer(data.answer || "No answer returned.");
      setAiSources(data.sources || []);
    } catch (error) {
      setAiError(error.message || "Unable to contact the AI assistant.");
    } finally {
      setAiLoading(false);
    }
  }

  async function generateAISummary() {
    if (!aiFileId) {
      setAiError("Select a file first.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    try {
      const response = await fetch(`${API_URL}/ai/file/${aiFileId}/summary`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to generate summary.");
      setAiSummary(data.summary || "No summary returned.");
    } catch (error) {
      setAiError(error.message || "Unable to generate summary.");
    } finally {
      setAiLoading(false);
    }
  }

  async function generateAIInsights() {
    if (!aiFileId) {
      setAiError("Select a file first.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    try {
      const response = await fetch(`${API_URL}/ai/file/${aiFileId}/insights`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to generate insights.");
      setAiInsights(data);
    } catch (error) {
      setAiError(error.message || "Unable to generate insights.");
    } finally {
      setAiLoading(false);
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

    setMfaToken("");
    setMfaCode("");
    setLoginWarning("");
    setSecurityNotice(0);
    resetMfaSettingsState();

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

    if (targetPage === "recycle" && user) {
      loadRecycleBin();
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
      loadActivity();
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
  // PROFILE IMAGE HANDLERS
  // =====================================================

  async function handleProfileImageChange(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select an image file.");
      return;
    }

    try {
      const reader = new FileReader();

      reader.onload = () => {
        const image = new Image();

        image.onload = () => {
          const size = 256;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;

          const context = canvas.getContext("2d");
          context.clearRect(0, 0, size, size);

          const scale = Math.max(
            size / image.width,
            size / image.height
          );

          const width = image.width * scale;
          const height = image.height * scale;
          const x = (size - width) / 2;
          const y = (size - height) / 2;

          context.drawImage(image, x, y, width, height);

          const imageData = canvas.toDataURL("image/jpeg", 0.85);

          setProfileImage(imageData);
          localStorage.setItem(
            "trustshare_profile_image",
            imageData
          );
        };

        image.src = reader.result;
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Profile image error:", error);
      setMessage("Unable to set profile image.");
    } finally {
      e.target.value = "";
    }
  }

  function removeProfileImage() {
    setProfileImage("");
    localStorage.removeItem("trustshare_profile_image");
  }

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

          <div className="logo auth-lock" aria-label="Secure TrustShare">🔒</div>

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

          {mfaToken ? (
            <form onSubmit={verifyMfaLogin}>

              <p className="mfa-login-help">
                Open your authenticator app and enter the 6-digit code
                for TrustShare. You can also use a backup code.
              </p>

              <input
                id="mfaCode"
                name="code"
                type="text"
                inputMode="numeric"
                placeholder="6-digit code or backup code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                autoComplete="one-time-code"
                autoFocus
                required
              />

              <button
                className="main-button"
                type="submit"
                disabled={loading || !mfaCode.trim()}
              >
                {loading ? "Verifying..." : "Verify & Login"}
              </button>

              <button
                type="button"
                className="forgot-button"
                onClick={cancelMfaLogin}
              >
                <Icon name="arrow-left" /> Back to login
              </button>

            </form>
          ) : (
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
          )}

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          {page === "login" && loginWarning && (
            <div className="security-warning" role="alert">
              <strong>Security alert</strong>
              <span>{loginWarning}</span>
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

          <div className="logo auth-lock" aria-label="Secure TrustShare">🔒</div>

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

          {page === "login" && loginWarning && (
            <div className="security-warning" role="alert">
              <strong>Security alert</strong>
              <span>{loginWarning}</span>
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
            <Icon name="key" />
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

          {page === "login" && loginWarning && (
            <div className="security-warning" role="alert">
              <strong>Security alert</strong>
              <span>{loginWarning}</span>
            </div>
          )}

          <button
            className="link-button full-link"
            onClick={() => {
              setMessage("");
              setPage("login");
            }}
          >
            <Icon name="arrow-left" /> Back to Login
          </button>

        </div>

      </div>
    );
  }

  // =====================================================
  // MAIN APPLICATION
  // =====================================================

  // =====================================================
  // SEARCH FILTERING (top-bar search)
  // =====================================================

  const searchQuery = globalSearch.trim().toLowerCase();

  const matchesSearch = (...values) =>
    !searchQuery ||
    values.some((value) =>
      String(value ?? "").toLowerCase().includes(searchQuery)
    );

  const filteredFiles = files.filter((file) =>
    matchesSearch(file.filename, file.category, file.content_type)
  );

  const filteredSharedFiles = sharedFiles.filter((item) =>
    matchesSearch(
      item.filename,
      item.owner?.username,
      item.owner?.email,
      item.permission
    )
  );

  const filteredSentFiles = sentFiles.filter((item) =>
    matchesSearch(
      item.filename,
      item.recipient?.username,
      item.recipient?.email,
      item.permission
    )
  );

  const filteredActivityLogs = activityLogs.filter((item) =>
    matchesSearch(item.filename, item.action, item.description, item.ip_address)
  );

  if (publicShareToken) {
    return (
      <div className="public-share-page">
        <div className="public-share-card">
          <div className="public-share-logo">TrustShare</div>
          <div className="public-share-lock">🔒</div>
          <h1>Secure File Sharing</h1>
          {publicShareLoading ? (
            <p>Checking secure link...</p>
          ) : publicShareError ? (
            <>
              <div className="public-share-error">{publicShareError}</div>
              <button type="button" className="main-button" onClick={() => {
                window.history.replaceState({}, "", window.location.pathname);
                setPublicShareToken("");
              }}>Back to TrustShare</button>
            </>
          ) : publicShareInfo ? (
            <>
              <h2>{publicShareInfo.filename}</h2>
              <p className="public-share-description">This file was shared securely through TrustShare.</p>
              <div className="public-share-meta">
                <span>Permission: <strong>{publicShareInfo.permission === "download" ? "Download" : "View"}</strong></span>
                {publicShareInfo.expires_at && <span>Expires: {formatDateTime(publicShareInfo.expires_at)}</span>}
              </div>
              <button type="button" className="main-button public-share-button" onClick={openPublicSecureShare} disabled={publicShareBusy}>
                {publicShareBusy ? "Opening..." : publicShareInfo.permission === "download" ? "Download File" : "View File"}
              </button>
              {publicShareInfo.permission === "view" && <small className="public-share-note">View permission does not grant download access.</small>}
              {publicShareError && <div className="public-share-error">{publicShareError}</div>}
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {securityNotice > 0 && (
        <div className="security-toast" role="alert">
          <span className="security-toast-icon"><Icon name="shield" /></span>
          <div className="security-toast-body">
            <strong>Security alert</strong>
            <p>
              {securityNotice} failed login attempt{securityNotice === 1 ? "" : "s"} on
              your account in the last 24 hours. If this wasn't you, change your password.
            </p>
            <div className="security-toast-actions">
              <button
                type="button"
                className="security-toast-view"
                onClick={() => {
                  navigateTo("security");
                  setSecurityNotice(0);
                }}
              >
                View security alerts
              </button>
              <button
                type="button"
                className="security-toast-dismiss"
                onClick={() => setSecurityNotice(0)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}


      {/* =================================================
          LEFT SIDEBAR
      ================================================= */}

      <aside className="trustshare-sidebar">

        <div className="sidebar-brand sidebar-brand-text-only">
          <div className="sidebar-brand-copy">
            <strong>TrustShare</strong>
            <strong><span>Secure Workspace</span></strong>
          </div>
        </div>

        {/* =================================================
            SIDEBAR PROFILE
            Moved from the top-right profile menu.
        ================================================= */}
        <div className={`sidebar-profile ${profileOpen ? "open" : ""}`}>

          <button
            type="button"
            className="sidebar-profile-button"
            onClick={() => setProfileOpen(!profileOpen)}
            title="Account menu"
            aria-expanded={profileOpen}
          >
            <span className="sidebar-profile-avatar">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="sidebar-profile-image"
                />
              ) : (
                userInitial
              )}
            </span>

            <span className="sidebar-profile-info">
              <strong>{user?.username || "Afrin"}</strong>
              <small>{user?.email || ""}</small>
            </span>

            <span className="sidebar-profile-arrow">
              <Icon name={profileOpen ? "chevron-up" : "chevron-down"} size="14px" />
            </span>
          </button>

          {profileOpen && (
            <div className="sidebar-profile-panel">

              <label
                htmlFor="profileImageInput"
                className="sidebar-change-image-button"
                title="Choose a profile image"
              >
                <Icon name="image" /> Change Image
              </label>

              <input
                id="profileImageInput"
                type="file"
                accept="image/*"
                className="hidden-file-input"
                onChange={handleProfileImageChange}
              />

              {profileImage && (
                <button
                  type="button"
                  className="sidebar-remove-image-button"
                  onClick={removeProfileImage}
                >
                  Remove Image
                </button>
              )}

              <div className="sidebar-profile-divider"></div>

              <div className="sidebar-profile-note">
                Profile image only.
              </div>

            </div>
          )}

        </div>

        <div className="sidebar-section-label">
          MAIN MENU
        </div>

        <nav className="sidebar-menu">

          <button
            className={`sidebar-item ${page === "dashboard" ? "active" : ""}`}
            onClick={() => navigateTo("dashboard")}
          >
            <span className="sidebar-icon"><Icon name="home" /></span>
            <span>Dashboard</span>
          </button>

          <button
            className={`sidebar-item ${page === "files" ? "active" : ""}`}
            onClick={() => navigateTo("files")}
          >
            <span className="sidebar-icon"><Icon name="folder" /></span>
            <span>My Files</span>
          </button>

          <button
            className={`sidebar-item ${page === "shared" ? "active" : ""}`}
            onClick={() => navigateTo("shared")}
          >
            <span className="sidebar-icon"><Icon name="users" /></span>
            <span>Shared With Me</span>
          </button>

          <button
            className={`sidebar-item ${page === "sent" ? "active" : ""}`}
            onClick={() => navigateTo("sent")}
          >
            <span className="sidebar-icon"><Icon name="upload" /></span>
            <span>Sent Files</span>
          </button>

          <button
            className={`sidebar-item ${page === "activity" ? "active" : ""}`}
            onClick={() => navigateTo("activity")}
          >
            <span className="sidebar-icon"><Icon name="clipboard" /></span>
            <span>Activity</span>
          </button>

          <button
            className={`sidebar-item ${page === "notifications" ? "active" : ""}`}
            onClick={() => navigateTo("notifications")}
          >
            <span className="sidebar-icon"><Icon name="bell" /></span>
            <span>Notifications</span>
            {analytics.unread_notifications > 0 && (
              <span className="sidebar-badge">
                {analytics.unread_notifications}
              </span>
            )}
          </button>

          <button
            className={`sidebar-item ${page === "security" ? "active" : ""}`}
            onClick={() => navigateTo("security")}
          >
            <span className="sidebar-icon"><Icon name="shield" /></span>
            <span>Security Alerts</span>
          </button>

          <button
            className={`sidebar-item ${page === "analytics" ? "active" : ""}`}
            onClick={() => navigateTo("analytics")}
          >
            <span className="sidebar-icon"><Icon name="bar-chart" /></span>
            <span>Analytics</span>
          </button>

          <button
            className={`sidebar-item ${page === "ai" ? "active" : ""}`}
            onClick={() => navigateTo("ai")}
          >
            <span className="sidebar-icon"><Icon name="bot" /></span>
            <span>AI Assistant</span>
          </button>

          <button
            className={`sidebar-item ${page === "profile" ? "active" : ""}`}
            onClick={() => navigateTo("profile")}
          >
            <span className="sidebar-icon"><Icon name="user" /></span>
            <span>My Profile</span>
          </button>

          <button
            className={`sidebar-item ${page === "settings" ? "active" : ""}`}
            onClick={() => navigateTo("settings")}
          >
            <span className="sidebar-icon"><Icon name="settings" /></span>
            <span>Settings</span>
          </button>

          <button
            className={`sidebar-item ${page === "recycle" ? "active" : ""}`}
            onClick={() => navigateTo("recycle")}
          >
            <span className="sidebar-icon"><Icon name="trash" /></span>
            <span>Recycle Bin</span>
          </button>

          <button
            type="button"
            className="sidebar-item logout-item"
            onClick={logout}
          >
            <span className="sidebar-icon"><Icon name="logout" /></span>
            <span>Logout</span>
          </button>

        </nav>

      </aside>

      {/* =================================================
          MAIN CONTENT AREA
      ================================================= */}

      <div className="dashboard-main">

        <nav className="trustshare-topbar">

          <div className="topbar-spacer"></div>

          <div className="topbar-right">

            <div className="topbar-search">
              <span className="topbar-search-icon"><Icon name="search" /></span>
              <input
                type="text"
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                onFocus={() => {
                  setSearchFocused(true);
                  if (user) {
                    loadFiles();
                    loadSharedFiles();
                    loadSentFiles();
                  }
                }}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && searchQuery) {
                    navigateTo("files");
                    setSearchFocused(false);
                  }
                  if (event.key === "Escape") {
                    setGlobalSearch("");
                    setSearchFocused(false);
                  }
                }}
                placeholder="Search files, users, or activity..."
                aria-label="Search files, users, or activity"
                autoComplete="off"
              />
              {globalSearch && (
                <button
                  type="button"
                  className="topbar-search-clear"
                  onClick={() => setGlobalSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}

              {searchFocused && searchQuery && (
                <div className="topbar-search-results" role="listbox">
                  {filteredFiles.length === 0 &&
                    filteredSharedFiles.length === 0 &&
                    filteredSentFiles.length === 0 && (
                      <div className="topbar-search-empty">
                        No results for "{globalSearch.trim()}"
                      </div>
                    )}

                  {filteredFiles.length > 0 && (
                    <div className="topbar-search-group">
                      <div className="topbar-search-group-title">My Files</div>
                      {filteredFiles.slice(0, 6).map((file) => (
                        <button
                          type="button"
                          key={`f-${file.id}`}
                          className="topbar-search-item"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            navigateTo("files");
                            setSearchFocused(false);
                          }}
                        >
                          <span><Icon name="file" /></span>
                          <span className="topbar-search-item-name">{file.filename}</span>
                          <small>{file.category || "Other"}</small>
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredSharedFiles.length > 0 && (
                    <div className="topbar-search-group">
                      <div className="topbar-search-group-title">Shared With Me</div>
                      {filteredSharedFiles.slice(0, 6).map((item) => (
                        <button
                          type="button"
                          key={`s-${item.share_id}`}
                          className="topbar-search-item"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            navigateTo("shared");
                            setSearchFocused(false);
                          }}
                        >
                          <span><Icon name="users" /></span>
                          <span className="topbar-search-item-name">{item.filename}</span>
                          <small>{item.owner?.username || ""}</small>
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredSentFiles.length > 0 && (
                    <div className="topbar-search-group">
                      <div className="topbar-search-group-title">Sent Files</div>
                      {filteredSentFiles.slice(0, 6).map((item) => (
                        <button
                          type="button"
                          key={`t-${item.share_id}`}
                          className="topbar-search-item"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            navigateTo("sent");
                            setSearchFocused(false);
                          }}
                        >
                          <span><Icon name="upload" /></span>
                          <span className="topbar-search-item-name">{item.filename}</span>
                          <small>{item.recipient?.username || ""}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="topbar-notification-button"
              onClick={() => navigateTo("notifications")}
              title="Notifications"
              aria-label="Notifications"
            >
              <span><Icon name="bell" /></span>
              {analytics.unread_notifications > 0 && (
                <b>{analytics.unread_notifications}</b>
              )}
            </button>

            <div className="security-status topbar-security">
              <span className="status-dot"></span>
              Secure
            </div>


          </div>

        </nav>

        <div className="dashboard-content">

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
              DASHBOARD STATISTICS
          ================================================= */}

          <section className="stats-grid">
            <div className="stat-card"><div className="stat-icon"><Icon name="file" /></div><div><span className="stat-number">{analytics.total_files}</span><span className="stat-label">Total Files</span></div></div>
            <div className="stat-card"><div className="stat-icon"><Icon name="link" /></div><div><span className="stat-number">{analytics.total_shared}</span><span className="stat-label">Shared Files</span></div></div>
            <div className="stat-card"><div className="stat-icon"><Icon name="download" /></div><div><span className="stat-number">{analytics.total_downloads}</span><span className="stat-label">Total Downloads</span></div></div>
            <div className="stat-card"><div className="stat-icon"><Icon name="eye" /></div><div><span className="stat-number">{analytics.total_views}</span><span className="stat-label">Total Views</span></div></div>
          </section>

          <section className="dashboard-upload-card">
            <div className="dashboard-section-heading upload-heading">
              <div>
                <h3>Upload a File</h3>
                <p>Securely upload your files to TrustShare.</p>
              </div>
              <span className="upload-security-pill"><Icon name="lock" /> Encrypted</span>
            </div>

            <div className={`upload-dropzone ${selectedFile ? "has-file" : ""}`}>
              <input
                id="fileInput"
                name="file"
                type="file"
                className="hidden-file-input"
                onChange={handleFileSelect}
              />
              <label htmlFor="fileInput" className="upload-drop-content">
                <div className="upload-cloud-icon"><Icon name="cloud-upload" /></div>
                <strong>{selectedFile ? selectedFile.name : "Choose a file"}</strong>
                <span>{selectedFile ? formatFileSize(selectedFile.size) : "Select a file from your computer."}</span>
                <span className="browse-files-button">Browse Files</span>
              </label>
            </div>

            <button
              className="upload-submit-button"
              onClick={uploadFile}
              disabled={!selectedFile || loading}
            >
              {loading ? "Uploading..." : "Upload File"}
            </button>

            {message && <div className="upload-message">{message}</div>}
          </section>

          {/* =================================================
              RECENT FILES
          ================================================= */}
          <section className="recent-files-card">
            <div className="dashboard-section-heading">
              <div><h3>Recent Files</h3><p>Your latest uploaded files.</p></div>
              <button className="view-all-button" onClick={() => navigateTo("files")}>View All</button>
            </div>
            {files.length === 0 ? (
              <div className="recent-empty"><span><Icon name="folder" /></span><p>No files uploaded yet.</p></div>
            ) : filteredFiles.length === 0 ? (
              <div className="empty-files">
                <div className="empty-icon"><Icon name="search" /></div>
                <h3>No Results Found</h3>
                <p>No files match "{globalSearch.trim()}".</p>
              </div>
            ) : (
              <div className="recent-files-table-wrap">
                <table className="recent-files-table">
                  <thead><tr><th>File Name</th><th>Size</th><th>Category</th><th>Uploaded</th><th>Actions</th></tr></thead>
                  <tbody>{(searchQuery ? filteredFiles : filteredFiles.slice(0,5)).map((file) => (
                    <tr key={file.id}>
                      <td><div className="recent-file-name"><span className="recent-file-icon"><Icon name="file" /></span><span>{file.filename}</span></div></td>
                      <td>{formatFileSize(file.size)}</td>
                      <td><span className="category-pill">{file.category || "Other"}</span></td>
                      <td>{file.created_at ? formatDateTime(file.created_at) : "-"}</td>
                      <td style={{ position: "relative" }}>
                        <button
                          type="button"
                          className="file-more-button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFileActionMenu(file.id);
                          }}
                          title="File Actions"
                        >
                          ⋯
                        </button>

                        {fileActionMenu.open &&
                          fileActionMenu.fileId === file.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: "absolute",
                                right: 0,
                                top: "calc(100% + 6px)",
                                zIndex: 1000,
                                minWidth: "145px",
                                padding: "6px",
                                background: "#ffffff",
                                border: "1px solid #e5e7eb",
                                borderRadius: "10px",
                                boxShadow: "0 10px 25px rgba(15,23,42,.15)",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  closeFileActionMenu();
                                  openShareModal(file);
                                }}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  padding: "9px 11px",
                                  border: 0,
                                  borderRadius: "7px",
                                  background: "transparent",
                                  textAlign: "left",
                                  cursor: "pointer",
                                  fontWeight: 700,
                                }}
                              >
                                <Icon name="link" /> Share
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  closeFileActionMenu();
                                  downloadFile(file.id, file.filename);
                                }}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  padding: "9px 11px",
                                  border: 0,
                                  borderRadius: "7px",
                                  background: "transparent",
                                  textAlign: "left",
                                  cursor: "pointer",
                                  fontWeight: 700,
                                }}
                              >
                                <Icon name="download" /> Download
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  closeFileActionMenu();
                                  openDeletePopup(file.id, file.filename);
                                }}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  padding: "9px 11px",
                                  border: 0,
                                  borderRadius: "7px",
                                  background: "transparent",
                                  color: "#dc2626",
                                  textAlign: "left",
                                  cursor: "pointer",
                                  fontWeight: 700,
                                }}
                              >
                                <Icon name="trash" /> Delete
                              </button>
                            </div>
                          )}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>

          {/* =================================================
              STORAGE + RECENT ACTIVITY
          ================================================= */}
          <section className="dashboard-bottom-grid">
            <div className="storage-card">
              <div className="dashboard-section-heading compact-heading">
                <div><h3>Storage Usage</h3><p>Secure TrustShare storage</p></div>
                <span className="storage-percent">{Math.min(100, Math.round(((analytics.storage_bytes || 0) / 1073741824) * 100))}%</span>
              </div>
              <div className="storage-summary"><strong>{formatFileSize(analytics.storage_bytes || 0)}</strong><span>of 1 GB used</span></div>
              <div className="storage-track"><div className="storage-fill" style={{width: `${Math.min(100, ((analytics.storage_bytes || 0) / 1073741824) * 100)}%`}}></div></div>
              <div className="storage-footer"><span>{analytics.total_files} files</span><span>{100 - Math.min(100, Math.round(((analytics.storage_bytes || 0) / 1073741824) * 100))}% available</span></div>
            </div>

            <div className="recent-activity-card">
              <div className="dashboard-section-heading compact-heading">
                <div><h3>Recent Activity</h3><p>Latest account and file activity.</p></div>
                <button className="view-all-button" onClick={() => navigateTo("activity")}>View All</button>
              </div>
              {activityLogs.length === 0 ? (
                <div className="recent-empty small-empty"><span><Icon name="clipboard" /></span><p>No recent activity.</p></div>
              ) : (
                <div className="recent-activity-list">{activityLogs.slice(0,5).map((item) => (
                  <div className="recent-activity-item" key={item.id}>
                    <div className="activity-icon-circle"><Icon name={item.action === "LOGIN_SUCCESS" ? "lock" : item.action === "UPLOAD" ? "upload" : item.action === "DOWNLOAD" || item.action === "SHARED_DOWNLOAD" ? "download" : item.action.includes("SHARE") ? "users" : "clipboard"} /></div>
                    <div className="activity-item-content"><strong>{item.description || item.action}</strong><span>{item.created_at ? formatDateTime(item.created_at) : "-"}</span></div>
                  </div>
                ))}</div>
              )}
            </div>
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
                  <Icon name="folder-open" />
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

            ) : filteredFiles.length === 0 ? (
              <div className="empty-files">
                <div className="empty-icon"><Icon name="search" /></div>
                <h3>No Results Found</h3>
                <p>No files match "{globalSearch.trim()}".</p>
              </div>
            ) : (

              <div className="file-list">

                {filteredFiles.map((file) => (

                  <div
                    className="file-item"
                    key={file.id}
                  >

                    <div className="file-info">

                      <div className="file-icon">
                        <Icon name="file" />
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
                        <Icon name="link" /> Share
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
                        <Icon name="download" /> Download
                      </button>

                     <button
                        type="button"
                        className="delete-button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          openDeletePopup(
                            file.id,
                            file.filename
                          );
                        }}
                      >
                        <Icon name="trash" /> Delete
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
          RECYCLE BIN
      ================================================= */}
      {page === "recycle" && (
        <main className="dashboard-container">
          <section className="page-heading">
            <div className="welcome-small">FILE MANAGEMENT</div>
            <h2>Recycle Bin</h2>
            <p>Restore deleted files or permanently remove them from TrustShare.</p>
          </section>

          {recycleMessage && (
            <div className="dashboard-message">{recycleMessage}</div>
          )}

          <section className="files-card">
            {recycleLoading && recycleBin.length === 0 ? (
              <div className="empty-files"><h3>Loading Recycle Bin...</h3></div>
            ) : recycleBin.length === 0 ? (
              <div className="empty-files">
                <div className="empty-icon"><Icon name="trash" /></div>
                <h3>Recycle Bin is Empty</h3>
                <p>Deleted files will appear here and can be restored.</p>
              </div>
            ) : (
              <div className="file-list">
                {recycleBin.map((file) => (
                  <div className="file-item" key={file.id}>
                    <div className="file-info">
                      <div className="file-icon"><Icon name="trash" /></div>
                      <div>
                        <strong>{file.filename}</strong>
                        <span>{formatFileSize(file.size)} • Deleted: {file.deleted_at ? formatDateTime(file.deleted_at) : "-"}</span>
                      </div>
                    </div>
                    <div className="file-actions">
                      <button
                        type="button"
                        className="share-button"
                        onClick={() => restoreRecycleFile(file.id)}
                        disabled={recycleLoading}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        className="delete-button"
                        onClick={() => openPermanentDeletePopup(file.id, file.filename)}
                        disabled={recycleLoading}
                      >
                        <Icon name="trash" /> Delete Permanently
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
                <div className="empty-icon"><Icon name="users" /></div>
                <h3>No Shared Files</h3>
                <p>Files shared with your account will appear here.</p>
              </div>
            ) : filteredSharedFiles.length === 0 ? (
              <div className="empty-files">
                <div className="empty-icon"><Icon name="search" /></div>
                <h3>No Results Found</h3>
                <p>No shared files match "{globalSearch.trim()}".</p>
              </div>
            ) : (
              <div className="shared-files-list">
                {filteredSharedFiles.map((item) => (
                  <div className="shared-file-item" key={item.share_id}>
                    <div className="shared-file-main">
                      <div className="shared-file-icon"><Icon name="file" /></div>
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
                        {item.permission === "download" ? (<><Icon name="download" /> Download</>) : (<><Icon name="eye" /> View</>)}
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
                <div className="empty-icon"><Icon name="upload" /></div>
                <h3>No Sent Files</h3>
                <p>Files you share with other TrustShare users will appear here.</p>
              </div>
            ) : filteredSentFiles.length === 0 ? (
              <div className="empty-files">
                <div className="empty-icon"><Icon name="search" /></div>
                <h3>No Results Found</h3>
                <p>No sent files match "{globalSearch.trim()}".</p>
              </div>
            ) : (
              <div className="shared-files-list">
                {filteredSentFiles.map((item) => (
                  <div className="shared-file-item sent-file-item" key={item.share_id}>
                    <div className="shared-file-main">
                      <div className="shared-file-icon"><Icon name="file" /></div>
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
                <div className="empty-icon"><Icon name="clipboard" /></div>
                <h3>No Activity Yet</h3>
                <p>Your file and account activities will appear here.</p>
              </div>
            ) : filteredActivityLogs.length === 0 ? (
              <div className="empty-files">
                <div className="empty-icon"><Icon name="search" /></div>
                <h3>No Results Found</h3>
                <p>No activity records match "{globalSearch.trim()}".</p>
              </div>
            ) : (
              <div className="m3-table-wrap">
                <table className="m3-table">
                  <thead><tr><th>Time</th><th>Action</th><th>File</th><th>Description</th><th>IP Address</th></tr></thead>
                  <tbody>
                    {filteredActivityLogs.map((item) => (
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

      {page === "notifications" && (() => {
        const withMeta = notifications.map((item) => ({ item, meta: notificationMeta(item) }));
        const unreadCount = notifications.filter((n) => !n.is_read).length;
        const securityCount = withMeta.filter((x) => x.meta.tone === "security").length;
        const fileTones = ["download", "view", "share", "access"];
        const fileCount = withMeta.filter((x) => fileTones.includes(x.meta.tone)).length;

        const visible = withMeta.filter(({ item, meta }) => {
          if (notificationFilter === "unread") return !item.is_read;
          if (notificationFilter === "security") return meta.tone === "security";
          if (notificationFilter === "files") return fileTones.includes(meta.tone);
          return true;
        });

        const dayLabel = (value) => {
          const d = new Date(value);
          if (Number.isNaN(d.getTime())) return "Earlier";
          const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
          const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
          if (diffDays <= 0) return "Today";
          if (diffDays === 1) return "Yesterday";
          return "Earlier";
        };

        const groups = [];
        visible.forEach((entry) => {
          const label = dayLabel(entry.item.created_at);
          let group = groups.find((g) => g.label === label);
          if (!group) {
            group = { label, entries: [] };
            groups.push(group);
          }
          group.entries.push(entry);
        });

        const tabs = [
          { key: "all", label: "All", count: notifications.length },
          { key: "unread", label: "Unread", count: unreadCount },
          { key: "security", label: "Security", count: securityCount },
          { key: "files", label: "File activity", count: fileCount },
        ];

        const emptyText = {
          all: "New sharing, file access and security updates will appear here.",
          unread: "You have no unread notifications.",
          security: "No security notifications right now.",
          files: "No file activity notifications yet.",
        }[notificationFilter];

        return (
          <main className="dashboard-container notifications-page">
            <section className="nt-header">
              <div>
                <span className="nt-eyebrow">TRUSTSHARE</span>
                <h2>Notifications</h2>
                <p>Stay informed about file activity, sharing and account security.</p>
              </div>
              <button
                className="nt-refresh"
                onClick={loadNotifications}
                disabled={notificationsLoading}
              >
                {notificationsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </section>

            {m3Error && <div className="dashboard-message">{m3Error}</div>}

            <section className="nt-panel">
              <div className="nt-toolbar">
                <div className="nt-tabs" role="tablist" aria-label="Filter notifications">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={notificationFilter === tab.key}
                      className={`nt-tab ${notificationFilter === tab.key ? "active" : ""}`}
                      onClick={() => setNotificationFilter(tab.key)}
                    >
                      {tab.label}
                      <span className="nt-tab-count">{tab.count}</span>
                    </button>
                  ))}
                </div>
                <div className="nt-summary">
                  <strong>{unreadCount}</strong> unread
                </div>
              </div>

              {notificationsLoading && notifications.length === 0 ? (
                <div className="nt-empty">
                  <h3>Loading notifications</h3>
                  <p>Please wait while we retrieve your latest TrustShare updates.</p>
                </div>
              ) : visible.length === 0 ? (
                <div className="nt-empty">
                  <h3>{notificationFilter === "all" ? "You're all caught up" : "Nothing here"}</h3>
                  <p>{emptyText}</p>
                </div>
              ) : (
                groups.map((group) => (
                  <div className="nt-group" key={group.label}>
                    <div className="nt-group-title">{group.label}</div>
                    {group.entries.map(({ item, meta }) => (
                      <article
                        key={item.id}
                        className={`nt-item nt-${meta.tone} ${item.is_read ? "is-read" : "is-unread"}`}
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
                        <div className="nt-body">
                          <div className="nt-title-row">
                            <h3>{item.title}</h3>
                            {!item.is_read && <span className="nt-new">New</span>}
                          </div>
                          <p>{item.message}</p>
                          <div className="nt-meta">
                            <span className="nt-tag">{meta.label}</span>
                            <span className="nt-date">
                              {item.created_at ? formatDateTime(item.created_at) : ""}
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ))
              )}
            </section>
          </main>
        );
      })()}

      {/* =================================================
          NOTIFICATION DETAILS POPUP
      ================================================= */}
      {notificationPopup.open && notificationPopup.notification && (() => {
        const item = notificationPopup.notification;
        const meta = notificationMeta(item);
        return (
          <div className="professional-modal-overlay" onClick={closeNotificationPopup}>
            <div
              className="professional-notification-modal nt-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="professional-modal-close"
                onClick={closeNotificationPopup}
                aria-label="Close notification"
              >
                ×
              </button>

              <div className="nt-modal-tags">
                <span className={`nt-tag nt-tag-${meta.tone}`}>{meta.label}</span>
                <span className={`nt-modal-status ${item.is_read ? "read" : "unread"}`}>
                  {item.is_read ? "Read" : "New"}
                </span>
              </div>

              <h2>{item.title}</h2>
              <p className="nt-modal-message">{item.message}</p>
              <small className="nt-modal-date">
                {item.created_at ? formatDateTime(item.created_at) : ""}
              </small>

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
            <div className={`professional-modal-icon ${systemPopup.tone}`}><Icon name={systemPopup.icon} /></div>
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
            <div className="professional-modal-icon access"><Icon name="trash" /></div>
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
            <p>Detection of unusual account activity.</p>
          </section>

          {m3Error && <div className="dashboard-message">{m3Error}</div>}
          <div className="m3-toolbar">
            <button className="secondary-button" onClick={loadSecurityAlerts}>Refresh</button>
          </div>
          <section className="files-card">
            {alertsLoading ? (
              <div className="empty-files">
                <h3>Checking security...</h3>
              </div>
            ) : securityAlerts.length === 0 ? (
              <div className="empty-files">
                <div className="empty-icon"><Icon name="shield" /></div>
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
      {page === "analytics" && (() => {
        const storageUsed = Number(analytics.storage_bytes || 0);
        const storageQuota = Number(user?.storage_quota || 1073741824);
        const storagePercent = storageQuota > 0
          ? Math.min(100, Math.round((storageUsed / storageQuota) * 100))
          : 0;

        const activityCounts = activityLogs.reduce((counts, item) => {
          const action = String(item?.action || "").toUpperCase();
          counts[action] = (counts[action] || 0) + 1;
          return counts;
        }, {});

        const uploadCount = activityCounts.UPLOAD || 0;
        const viewCount = (activityCounts.VIEW || 0) + (activityCounts.SHARED_VIEW || 0);
        const downloadCount = (activityCounts.DOWNLOAD || 0) + (activityCounts.SHARED_DOWNLOAD || 0);
        const shareCount = activityCounts.SHARE_CREATED || 0;
        const loginSuccessCount = activityCounts.LOGIN_SUCCESS || 0;
        const failedLoginCount = activityCounts.LOGIN_FAILED || 0;

        const activityTotal = Math.max(
          uploadCount + viewCount + downloadCount + shareCount + loginSuccessCount + failedLoginCount,
          1
        );

        const securityStatus = analytics.security_alerts > 0
          ? "Attention required"
          : failedLoginCount >= 3
            ? "Monitor activity"
            : "Protected";

        return (
          <main className="dashboard-container analytics-page">
            <section className="analytics-hero">
              <div className="analytics-hero-copy">
                <div className="welcome-small">TRUSTSHARE SECURITY CENTER</div>
                <h2>Security &amp; Storage Analytics</h2>
                <p>
                  A live overview of your files, sharing, access activity, storage usage, and security status.
                </p>
              </div>

              <div className="analytics-hero-actions">
                <span className="analytics-live-pill">
                  <span className="analytics-live-dot"></span> Live data
                </span>
                <button
                  type="button"
                  className="analytics-refresh-button"
                  onClick={() => {
                    loadAnalytics();
                    loadActivity();
                  }}
                  disabled={analyticsLoading}
                >
                  <span><Icon name="refresh" /></span> {analyticsLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </section>

            {m3Error && <div className="dashboard-message">{m3Error}</div>}

            <section className="analytics-kpi-grid">
              <div className="analytics-kpi-card">
                <div className="analytics-kpi-icon purple"><Icon name="folder" /></div>
                <div><strong>{analytics.total_files}</strong><span>Total Files</span></div>
                <small>Owned by you</small>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-icon green"><Icon name="arrow-up-right" /></div>
                <div><strong>{analytics.total_shared}</strong><span>Files Shared</span></div>
                <small>Account-to-account</small>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-icon blue"><Icon name="download" /></div>
                <div><strong>{analytics.total_downloads}</strong><span>Downloads</span></div>
                <small>Recorded access</small>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-icon orange"><Icon name="eye" /></div>
                <div><strong>{analytics.total_views}</strong><span>Views</span></div>
                <small>File views</small>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-icon violet"><Icon name="bell" /></div>
                <div><strong>{analytics.unread_notifications}</strong><span>Unread</span></div>
                <small>Notifications</small>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-icon red"><Icon name="shield" /></div>
                <div><strong>{analytics.security_alerts}</strong><span>Security Alerts</span></div>
                <small>Unresolved</small>
              </div>
            </section>

            <section className="analytics-detail-grid">
              <div className="analytics-panel analytics-storage-panel">
                <div className="analytics-panel-heading">
                  <div>
                    <span className="analytics-panel-icon"><Icon name="database" /></span>
                    <div>
                      <h3>Storage Overview</h3>
                      <p>Your TrustShare storage capacity</p>
                    </div>
                  </div>
                  <strong>{storagePercent}%</strong>
                </div>

                <div className="analytics-storage-values">
                  <div><span>Used</span><strong>{formatFileSize(storageUsed)}</strong></div>
                  <div><span>Available</span><strong>{formatFileSize(Math.max(0, storageQuota - storageUsed))}</strong></div>
                  <div><span>Quota</span><strong>{formatFileSize(storageQuota)}</strong></div>
                </div>

                <div className="analytics-progress-track">
                  <div className="analytics-progress-fill" style={{ width: `${storagePercent}%` }}></div>
                </div>

                <div className="analytics-storage-footer">
                  <span>{storagePercent < 80 ? "Storage level is healthy." : "Storage usage is getting high."}</span>
                  <span>{storagePercent}% used</span>
                </div>
              </div>

              <div className="analytics-panel analytics-security-panel">
                <div className="analytics-panel-heading">
                  <div>
                    <span className="analytics-panel-icon security"><Icon name="shield" /></span>
                    <div>
                      <h3>Security Posture</h3>
                      <p>Current account protection status</p>
                    </div>
                  </div>
                  <span className={`analytics-security-badge ${analytics.security_alerts > 0 ? "warning" : "safe"}`}>
                    {securityStatus}
                  </span>
                </div>

                <div className="security-posture-grid">
                  <div><strong>{analytics.security_alerts}</strong><span>Active alerts</span></div>
                  <div><strong>{failedLoginCount}</strong><span>Failed logins</span></div>
                  <div><strong>{analytics.unread_notifications}</strong><span>Unread notices</span></div>
                </div>

                <div className="security-posture-message">
                  {analytics.security_alerts > 0
                    ? "Review the Security Alerts section for unresolved events."
                    : "No unresolved security alerts are currently reported."}
                </div>
              </div>
            </section>

            <section className="analytics-panel analytics-activity-panel">
              <div className="analytics-panel-heading activity-heading">
                <div>
                  <span className="analytics-panel-icon"><Icon name="trending-up" /></span>
                  <div>
                    <h3>Activity Snapshot</h3>
                    <p>Actions recorded in your recent audit activity</p>
                  </div>
                </div>
                <button type="button" className="analytics-text-button" onClick={() => navigateTo("activity")}>View Activity <Icon name="arrow-right" /></button>
              </div>

              <div className="analytics-activity-grid">
                {[
                  ["Uploads", uploadCount, "upload", "purple"],
                  ["Views", viewCount, "eye", "orange"],
                  ["Downloads", downloadCount, "download", "blue"],
                  ["Shares", shareCount, "arrow-up-right", "green"],
                  ["Successful Logins", loginSuccessCount, "check", "violet"],
                  ["Failed Logins", failedLoginCount, "alert", "red"]
                ].map(([label, value, icon, tone]) => {
                  const percent = Math.min(100, Math.round((Number(value) / activityTotal) * 100));
                  return (
                    <div className="analytics-activity-row" key={label}>
                      <div className={`analytics-activity-icon ${tone}`}><Icon name={icon} /></div>
                      <div className="analytics-activity-main">
                        <div className="analytics-activity-label"><span>{label}</span><strong>{value}</strong></div>
                        <div className="analytics-mini-track"><div className={`analytics-mini-fill ${tone}`} style={{ width: `${percent}%` }}></div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="analytics-insight-grid">
              <div className="analytics-insight-card">
                <span className="analytics-insight-icon"><Icon name="lock" /></span>
                <div>
                  <h4>Encryption</h4>
                  <p>Your uploaded files are protected by TrustShare's encrypted storage workflow.</p>
                </div>
                <span className="analytics-insight-status">Protected</span>
              </div>

              <div className="analytics-insight-card">
                <span className="analytics-insight-icon"><Icon name="users" /></span>
                <div>
                  <h4>Sharing</h4>
                  <p>{analytics.total_shared} unique file{analytics.total_shared === 1 ? "" : "s"} currently recorded as shared by you.</p>
                </div>
                <span className="analytics-insight-status">Monitored</span>
              </div>

              <div className="analytics-insight-card">
                <span className="analytics-insight-icon"><Icon name="clipboard" /></span>
                <div>
                  <h4>Audit Trail</h4>
                  <p>{activityLogs.length} recent activity record{activityLogs.length === 1 ? "" : "s"} available for review.</p>
                </div>
                <span className="analytics-insight-status">Tracked</span>
              </div>
            </section>

            {analyticsLoading && (
              <div className="dashboard-message">Refreshing analytics...</div>
            )}
          </main>
        );
      })()}

      {page === "ai" && (
        <main className="dashboard-container">
          <section className="page-heading">
            <h2>TrustShare AI Assistant</h2>
            <p>Ask questions about your authorized files, generate summaries, and inspect document insights.</p>
          </section>

          <section className="ai-unified-wrap">
            <div className="ai-card ai-unified">
              <div className="ai-unified-head">
                <h3>Your document assistant</h3>
                <p>The assistant only uses files you are authorized to access.</p>
              </div>

              <label className="form-label" htmlFor="aiFileSelect">File</label>
              <select
                id="aiFileSelect"
                className="form-input"
                value={aiFileId}
                onChange={(e) => setAiFileId(e.target.value)}
              >
                <option value="">All my files</option>
                {files.map((file) => (
                  <option key={file.id} value={file.id}>{file.filename}</option>
                ))}
              </select>

              <div className="ai-tabs" role="tablist" aria-label="AI tools">
                {[
                  { key: "ask", label: "Ask a question" },
                  { key: "summary", label: "Summary" },
                  { key: "insights", label: "Insights" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={aiTab === tab.key}
                    className={`ai-tab ${aiTab === tab.key ? "active" : ""}`}
                    onClick={() => setAiTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {aiTab === "ask" && (
                <div className="ai-tab-panel">
                  <textarea
                    className="ai-input"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="Example: Summarize my latest project report"
                    rows="5"
                  />
                  <button
                    className="upload-button"
                    onClick={askTrustShareAI}
                    disabled={aiLoading || !aiQuestion.trim()}
                  >
                    {aiLoading ? "Thinking..." : "Ask AI"}
                  </button>

                  {aiAnswer && (
                    <div className="ai-answer">
                      <h4>AI Response</h4>
                      <div className="ai-answer-text">{aiAnswer}</div>
                      {aiSources.length > 0 && (
                        <div className="ai-sources"><strong>Sources:</strong> {aiSources.join(", ")}</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {aiTab === "summary" && (
                <div className="ai-tab-panel">
                  {!aiFileId && (
                    <p className="ai-hint">Select a file above to generate its summary.</p>
                  )}
                  <button
                    className="upload-button"
                    onClick={generateAISummary}
                    disabled={aiLoading || !aiFileId}
                  >
                    {aiLoading ? "Working..." : "Generate summary"}
                  </button>

                  {aiSummary && (
                    <div className="ai-answer">
                      <h4>Summary</h4>
                      <div className="ai-answer-text">{aiSummary}</div>
                    </div>
                  )}
                </div>
              )}

              {aiTab === "insights" && (
                <div className="ai-tab-panel">
                  {!aiFileId && (
                    <p className="ai-hint">Select a file above to see its topics and suggested tags.</p>
                  )}
                  <button
                    className="upload-button"
                    onClick={generateAIInsights}
                    disabled={aiLoading || !aiFileId}
                  >
                    {aiLoading ? "Working..." : "Generate insights"}
                  </button>

                  {aiInsights && (
                    <div className="ai-answer">
                      <h4>Document Insights</h4>
                      <p><strong>Category:</strong> {aiInsights.category}</p>
                      <p><strong>Size:</strong> {(Number(aiInsights.size || 0) / 1024).toFixed(1)} KB</p>
                      <p><strong>Topics:</strong> {(aiInsights.topics || []).join(", ") || "No topics detected"}</p>
                      <p><strong>Suggested tags:</strong> {(aiInsights.suggested_tags || []).join(" ")}</p>
                    </div>
                  )}
                </div>
              )}

              {aiError && <div className="dashboard-message">{aiError}</div>}
            </div>
          </section>
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
                <Icon name="palette" />
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
                    <Icon name="sun" /> Light
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
                    <Icon name="moon" /> Dark
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
                    <Icon name="monitor" /> System
                  </button>

                </div>

              </div>

            </div>

            <div className="settings-divider"></div>

            {/* SECURITY */}

            <div className="settings-section">

              <div className="settings-icon">
                <Icon name="lock" />
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

                <div className="mfa-panel">

                  <div className="security-setting">
                    <span>Multi-Factor Authentication (MFA)</span>
                    <strong className={user?.mfa_enabled ? "mfa-on" : "mfa-off"}>
                      {user?.mfa_enabled ? "Enabled" : "Disabled"}
                    </strong>
                  </div>

                  <p className="mfa-hint">
                    Add a second step at login using an authenticator app
                    such as Google Authenticator, Microsoft Authenticator or Authy.
                  </p>

                  {mfaMessage && (
                    <div className="mfa-message">{mfaMessage}</div>
                  )}

                  {mfaBackupCodes.length > 0 && (
                    <div className="mfa-backup">
                      <h4>Your backup codes</h4>
                      <p>
                        Each code works once if you lose your phone. They will
                        not be shown again — store them somewhere safe.
                      </p>
                      <div className="mfa-backup-grid">
                        {mfaBackupCodes.map((code) => (
                          <code key={code}>{code}</code>
                        ))}
                      </div>
                      <div className="mfa-actions">
                        <button
                          type="button"
                          className="mfa-button secondary"
                          onClick={() =>
                            navigator.clipboard?.writeText(mfaBackupCodes.join("\n"))
                          }
                        >
                          Copy codes
                        </button>
                        <button
                          type="button"
                          className="mfa-button"
                          onClick={() => {
                            setMfaBackupCodes([]);
                            setMfaMessage("");
                          }}
                        >
                          I've saved them
                        </button>
                      </div>
                    </div>
                  )}

                  {!user?.mfa_enabled && !mfaSetup && (
                    <button
                      type="button"
                      className="mfa-button"
                      onClick={startMfaSetup}
                      disabled={mfaBusy}
                    >
                      {mfaBusy ? "Please wait..." : "Enable MFA"}
                    </button>
                  )}

                  {!user?.mfa_enabled && mfaSetup && (
                    <form className="mfa-form" onSubmit={confirmMfaEnable}>
                      <p>
                        <strong>1.</strong> Scan this QR code with your authenticator app.
                      </p>
                      <img
                        className="mfa-qr"
                        src={mfaSetup.qr_code}
                        alt="MFA QR code"
                      />
                      <p className="mfa-hint">
                        Can't scan? Enter this key manually:
                        <code className="mfa-secret">{mfaSetup.secret}</code>
                      </p>
                      <p>
                        <strong>2.</strong> Enter the 6-digit code it shows.
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="123456"
                        maxLength={7}
                        value={mfaSetupCode}
                        onChange={(e) => setMfaSetupCode(e.target.value)}
                        autoComplete="one-time-code"
                        required
                      />
                      <div className="mfa-actions">
                        <button
                          type="submit"
                          className="mfa-button"
                          disabled={mfaBusy || !mfaSetupCode.trim()}
                        >
                          {mfaBusy ? "Verifying..." : "Verify & Enable"}
                        </button>
                        <button
                          type="button"
                          className="mfa-button secondary"
                          onClick={() => {
                            setMfaSetup(null);
                            setMfaSetupCode("");
                            setMfaMessage("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {user?.mfa_enabled && !mfaDisableOpen && (
                    <button
                      type="button"
                      className="mfa-button danger"
                      onClick={() => {
                        setMfaDisableOpen(true);
                        setMfaMessage("");
                      }}
                    >
                      Disable MFA
                    </button>
                  )}

                  {user?.mfa_enabled && mfaDisableOpen && (
                    <form className="mfa-form" onSubmit={disableMfa}>
                      <p>Confirm your password and a current code to turn MFA off.</p>
                      <input
                        type="password"
                        placeholder="Password"
                        value={mfaDisablePassword}
                        onChange={(e) => setMfaDisablePassword(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="6-digit code or backup code"
                        value={mfaDisableCode}
                        onChange={(e) => setMfaDisableCode(e.target.value)}
                        autoComplete="one-time-code"
                        required
                      />
                      <div className="mfa-actions">
                        <button
                          type="submit"
                          className="mfa-button danger"
                          disabled={mfaBusy}
                        >
                          {mfaBusy ? "Disabling..." : "Disable MFA"}
                        </button>
                        <button
                          type="button"
                          className="mfa-button secondary"
                          onClick={() => {
                            setMfaDisableOpen(false);
                            setMfaDisablePassword("");
                            setMfaDisableCode("");
                            setMfaMessage("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                </div>

              </div>

            </div>

            <div className="settings-divider"></div>

            {/* STORAGE */}

            <div className="settings-section">

              <div className="settings-icon">
                <Icon name="database" />
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
                <Icon name="user" />
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
                  <Icon name="logout" /> Logout
                </button>

              </div>

            </div>

          </section>

        </main>

      )}

      {/* =================================================
          DELETE CONFIRMATION POPUP
      ================================================= */}
      
{deletePopup.open && (
  <div
    className="modal-overlay"
    onClick={closeDeletePopup}
  >
    <div
      className="revoke-modal delete-confirm-modal"
      onClick={(e) => e.stopPropagation()}
    >

      <div className="delete-modal-icon">
        <Icon name="trash" />
      </div>

      <h2>
        Delete File?
      </h2>

      <p>
        Are you sure you want to delete this file?
      </p>

      <div className="revoke-file-name">
        <Icon name="file" />{" "}
        <span>
          {deletePopup.fileName}
        </span>
      </div>

      <p className="revoke-warning delete-warning">
        This file will be removed from your TrustShare files.
      </p>

      <div className="modal-actions">

        <button
          type="button"
          className="cancel-delete-button"
          onClick={closeDeletePopup}
        >
          Cancel
        </button>

        <button
          type="button"
          className="confirm-delete-button"
          onClick={confirmDelete}
        >
          <Icon name="trash" /> Delete File
        </button>

      </div>

    </div>
  </div>
)}
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
            <div className="revoke-modal-icon"><Icon name="lock" /></div>

            <h2>Revoke Access?</h2>

            <p>
              Are you sure you want to revoke access to this shared file?
            </p>

            <div className="revoke-file-name">
              <Icon name="file" /> <span>{revokePopup.fileName}</span>
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
                <Icon name="lock" /> Revoke Access
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
              <Icon name="lock" />
            </div>

            <h2>
              Secure File Sharing
            </h2>

            <p className="share-file-title">
              {shareFile?.filename}
            </p>

            <div className="permission-options share-mode-options">
              <label className={`permission-option ${shareMode === "account" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="shareMode"
                  value="account"
                  checked={shareMode === "account"}
                  onChange={() => setShareMode("account")}
                />
                <span>TrustShare Account</span>
              </label>
              <label className={`permission-option ${shareMode === "link" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="shareMode"
                  value="link"
                  checked={shareMode === "link"}
                  onChange={() => setShareMode("link")}
                />
                <span>Secure Link</span>
              </label>
            </div>

            {shareMode === "account" && (
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
            )}

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
                    <Icon name="eye" /> View
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
                    <Icon name="download" /> Download
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

            {shareLink && shareMode === "link" && (
              <div className="share-generated-link">
                <label htmlFor="generatedShareLink">Secure Share Link</label>
                <div className="share-generated-link-row">
                  <input id="generatedShareLink" value={shareLink} readOnly />
                  <button type="button" className="secondary-button" onClick={copyShareLink}>Copy</button>
                </div>
                <small className="share-help-text">This link expires according to the temporary access setting above.</small>
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
                onClick={shareMode === "link" ? createShareLink : shareFileWithAccount}
                disabled={shareLoading}
              >
                {shareLoading
                  ? (shareMode === "link" ? "Creating..." : "Sharing...")
                  : (shareMode === "link" ? "Create Secure Link" : "Share File")}
              </button>

            </div>

          </div>

        </div>

      )}

        </div>

      </div>


      {permanentDeletePopup.open && (
        <div className="professional-modal-overlay" onClick={closePermanentDeletePopup}>
          <div
            className="professional-modal permanent-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="permanent-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="professional-modal-icon security">
              <Icon name="trash" />
            </div>
            <div className="professional-modal-content">
              <h2 id="permanent-delete-title">Permanently Delete File?</h2>
              <p>
                Are you sure you want to permanently delete
                <strong> {permanentDeletePopup.fileName}</strong>?
              </p>
              <p className="permanent-delete-warning">
                This action cannot be undone. The file will be permanently removed from TrustShare.
              </p>
              <div className="professional-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closePermanentDeletePopup}
                  disabled={recycleLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="delete-button permanent-delete-confirm"
                  onClick={() => permanentlyDeleteRecycleFile(permanentDeletePopup.fileId)}
                  disabled={recycleLoading}
                >
                  {recycleLoading ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
