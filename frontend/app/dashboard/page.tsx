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
  | "shared"
  | "security"
  | "activity";

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
  title: string;
  description: string;
  icon: string;
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

  /* =======================================================
     UI
  ======================================================= */

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [sharing, setSharing] =
    useState(false);

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
  }, [router]);

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
     LOAD EVERYTHING
  ======================================================= */

  const loadAllData = async () => {
    setLoading(true);

    setError("");

    await Promise.all([
      loadFiles(),
      loadSharedFiles(),
    ]);

    setLoading(false);
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

  /* =======================================================
     ACTIVITY
  ======================================================= */

  const activity:
    ActivityItem[] = [
      ...files
        .slice(0, 5)
        .map((file) => ({
          id:
            `file-${file.id}`,

          title:
            "File available",

          description:
            file.filename,

          icon: "↑",
        })),

      ...sharedFiles
        .slice(0, 5)
        .map((file) => ({
          id:
            `share-${file.id}`,

          title:
            "Shared file received",

          description:
            `${file.filename} • ${
              file.shared_by ||
              file.shared_by_email ||
              "Trust Share user"
            }`,

          icon: "↗",
        })),

      {
        id: "security",

        title:
          "Encryption enabled",

        description:
          "AES-256-GCM server-side encryption",

        icon: "✓",
      },
    ];

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const navigationItems:
    {
      id: Section;
      label: string;
      icon: string;
    }[] = [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: "⌂",
      },

      {
        id: "files",
        label: "My Files",
        icon: "▣",
      },

      {
        id: "sharing",
        label: "File Sharing",
        icon: "↗",
      },

      {
        id: "shared",
        label: "Shared With Me",
        icon: "🔗",
      },

      {
        id: "security",
        label: "Security",
        icon: "◇",
      },

      {
        id: "activity",
        label: "Activity",
        icon: "≡",
      },
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

    return parsedDate.toLocaleString();
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
                      setActiveSection(
                        item.id
                      );

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

            {/* USER */}

            <div
              className="
                ml-5
                flex
                items-center
                gap-3
              "
            >

              <div className="hidden text-right sm:block">

                <p className="text-sm font-semibold">
                  {userName || "User"}
                </p>

                <p className="text-xs text-gray-400">
                  {userRole || "User"}
                </p>

              </div>

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-full
                  bg-gray-900
                  text-xs
                  font-bold
                  text-white
                "
              >
                {getInitials()}
              </div>

              <button
                onClick={handleLogout}
                className="
                  hidden
                  rounded-lg
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-gray-500
                  hover:bg-gray-100
                  hover:text-gray-900
                  sm:block
                "
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

              {/* QUICK SHARE */}

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

                <div className="mb-6">

                  <p
                    className="
                      text-xs
                      font-bold
                      uppercase
                      tracking-[0.18em]
                      text-gray-400
                    "
                  >
                    Quick Action
                  </p>

                  <h3 className="mt-2 text-xl font-bold">
                    Secure File Sharing
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Share a file with a registered user
                    using temporary view-only access.
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

                                  <button
                                    disabled={
                                      expired
                                    }
                                    onClick={() =>
                                      handleViewShared(
                                        actualShareId
                                      )
                                    }
                                    className={`
                                      rounded-lg
                                      px-4
                                      py-2
                                      text-xs
                                      font-semibold

                                      ${
                                        expired
                                          ? "cursor-not-allowed bg-gray-100 text-gray-400"
                                          : "bg-gray-900 text-white hover:bg-gray-800"
                                      }
                                    `}
                                  >
                                    {expired
                                      ? "Expired"
                                      : "View"}
                                  </button>

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
                description="Review the security mechanisms implemented in your Trust Share workspace."
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

              <div
                className="
                  mt-6
                  rounded-2xl
                  bg-gray-900
                  p-7
                  text-white
                "
              >

                <p
                  className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-[0.18em]
                    text-gray-400
                  "
                >
                  Trust Share
                </p>

                <h3 className="mt-3 text-2xl font-bold">
                  Multiple layers of protection
                </h3>

                <p
                  className="
                    mt-3
                    max-w-2xl
                    text-sm
                    leading-6
                    text-gray-400
                  "
                >
                  Trust Share combines authentication,
                  encryption, access control and
                  temporary sharing to provide a secure
                  file-sharing workflow.
                </p>

                <div
                  className="
                    mt-7
                    grid
                    gap-3
                    sm:grid-cols-2
                    lg:grid-cols-4
                  "
                >

                  {[
                    "Authentication",
                    "Encryption",
                    "Access Control",
                    "Expiration",
                  ].map(
                    (item) => (
                      <div
                        key={item}
                        className="
                          rounded-xl
                          border
                          border-white/10
                          bg-white/5
                          p-4
                        "
                      >

                        <div
                          className="
                            mb-3
                            flex
                            h-8
                            w-8
                            items-center
                            justify-center
                            rounded-lg
                            bg-white/10
                          "
                        >
                          ✓
                        </div>

                        <p className="text-sm font-semibold">
                          {item}
                        </p>

                      </div>
                    )
                  )}

                </div>

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
                eyebrow="Workspace history"
                title="Activity"
                description="Review the latest file and sharing information available in your workspace."
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
                    border-b
                    border-gray-100
                    px-6
                    py-5
                  "
                >

                  <h3 className="font-bold">
                    Recent Activity
                  </h3>

                  <p className="mt-1 text-xs text-gray-400">
                    File and sharing activity
                  </p>

                </div>

                {activity.length ===
                0 ? (
                  <EmptyState
                    icon="≡"
                    title="No activity"
                    description="Activity will appear as you use Trust Share."
                  />
                ) : (
                  <div
                    className="
                      divide-y
                      divide-gray-100
                    "
                  >

                    {activity.map(
                      (item) => (
                        <div
                          key={
                            item.id
                          }
                          className="
                            flex
                            items-center
                            gap-4
                            px-6
                            py-5
                          "
                        >

                          <div
                            className="
                              flex
                              h-10
                              w-10
                              shrink-0
                              items-center
                              justify-center
                              rounded-xl
                              bg-gray-100
                              text-sm
                              font-bold
                            "
                          >
                            {
                              item.icon
                            }
                          </div>

                          <div className="min-w-0">

                            <p className="text-sm font-semibold">
                              {
                                item.title
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-gray-400">
                              {
                                item.description
                              }
                            </p>

                          </div>

                          <span
                            className="
                              ml-auto
                              rounded-full
                              bg-gray-50
                              px-3
                              py-1
                              text-[10px]
                              font-semibold
                              text-gray-500
                            "
                          >
                            Trust Share
                          </span>

                        </div>
                      )
                    )}

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
                    max-w-2xl
                    text-sm
                    leading-6
                    text-gray-500
                  "
                >
                  Trust Share uses backend activity
                  logging for important file operations.
                  The dashboard displays the file and
                  sharing information available through
                  the existing frontend APIs.
                </p>

              </div>

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