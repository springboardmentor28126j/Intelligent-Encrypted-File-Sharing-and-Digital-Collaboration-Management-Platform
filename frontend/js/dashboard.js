const API_URL = "http://127.0.0.1:8000";
let selectedFile = null;

document.addEventListener("DOMContentLoaded", () => {

    loadFiles();
    setupDragAndDrop();
    loadNotifications();
    loadActivity();
    checkSecurityActivity();
    loadSecurityAlerts();
    loadSecurityReport();
    loadStorageAnalytics();

});

function getToken() {
    return localStorage.getItem("access_token");
}

async function loadFiles() {
    const token = getToken();

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/files`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (response.status === 401) {
            localStorage.removeItem("access_token");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load files.");
        }

        const data = await response.json();
        const files = data.files || data;

        displayFiles(files);
    } catch (error) {
        console.error("Load files error:", error);
        showUploadStatus("Unable to load your files.", "error");
    }
}
async function loadNotifications() {

    const token = getToken();

    if (!token) {
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/notifications`,
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        if (response.status === 401) {

            localStorage.removeItem("access_token");
            window.location.href = "login.html";

            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load notifications.");
        }

        const data = await response.json();

        const notifications = data.notifications || [];

        displayNotifications(notifications);

    } catch (error) {

        console.error(
            "Notification loading error:",
            error
        );

        const list =
            document.getElementById("notificationsList");

        if (list) {

            list.innerHTML = `
                <p class="notification-error">
                    Unable to load notifications.
                </p>
            `;

        }
    }
}

// ---------------------------------
// Mark All Notifications As Read
// ---------------------------------

async function markAllNotificationsAsRead() {

    const token = getToken();

    if (!token) {
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/notifications/read-all`,
            {
                method: "PUT",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        if (response.status === 401) {

            localStorage.removeItem("access_token");

            window.location.href = "login.html";

            return;
        }

        if (!response.ok) {

            throw new Error(
                "Unable to mark notifications as read."
            );
        }

        const data = await response.json();

        console.log(
            "Notifications marked as read:",
            data
        );

        // Reload notifications
        await loadNotifications();

    } catch (error) {

        console.error(
            "Mark all notifications error:",
            error
        );

    }
}



// ---------------------------------
// Load My Activity
// ---------------------------------
async function loadActivity() {

    const token = getToken();

    if (!token) {
        console.log("No access token found.");
        return;
    }

    try {

        console.log("Loading activity...");

        const response = await fetch(
            `${API_URL}/activity`,
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        console.log("Activity response status:", response.status);

        if (response.status === 401) {

            localStorage.removeItem("access_token");

            window.location.href = "login.html";

            return;
        }

        if (!response.ok) {

            throw new Error(
                "Activity request failed with status " +
                response.status
            );
        }

        const data = await response.json();

        console.log("Activity API response:", data);

        const activities = Array.isArray(data.activities)
            ? data.activities
            : [];

        console.log("Activities received:", activities);

        displayActivity(activities);

    } catch (error) {

        console.error(
            "ACTIVITY ERROR:",
            error
        );

        const container =
            document.getElementById(
                "activityContainer"
            );

        if (container) {

            container.innerHTML = `
                <div class="activity-error">
                    Unable to load activity.
                </div>
            `;
        }
    }
}
async function loadAllActivity() {
    const token = getToken();

    if (!token) {
        console.log("No access token found.");
        return;
    }

    const tableBody = document.getElementById("activityTableBody");

    if (!tableBody) {
        console.error("activityTableBody not found.");
        return;
    }

    try {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="activity-table-loading">
                    Loading activity...
                </td>
            </tr>
        `;

        const response = await fetch(`${API_URL}/activity/all`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (response.status === 401) {
            localStorage.removeItem("access_token");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error(
                "Activity history request failed with status " +
                response.status
            );
        }

        const data = await response.json();

        console.log("All activity response:", data);

        displayAllActivity(data.activities || []);

    } catch (error) {
        console.error("ALL ACTIVITY ERROR:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="activity-table-error">
                    Unable to load activity history.
                </td>
            </tr>
        `;
    }
}


// ---------------------------------
// Display My Activity
// ---------------------------------

function displayActivity(activities) {

    const container =
        document.getElementById("activityContainer");

    const emptyState =
        document.getElementById("activityEmpty");

    if (!container) {
        console.error("activityContainer not found.");
        return;
    }

    if (!activities || activities.length === 0) {

        container.innerHTML = "";

        if (emptyState) {
            emptyState.style.display = "block";
        }

        return;
    }

    if (emptyState) {
        emptyState.style.display = "none";
    }

    container.innerHTML = activities.map(activity => {

        const action =
            escapeHtml(activity.action || "ACTIVITY");

        const filename =
            escapeHtml(activity.filename || "");

        const details =
            escapeHtml(activity.details || "");

        const date = activity.created_at
            ? new Date(activity.created_at).toLocaleString()
            : "";

        let icon = "📋";
let iconClass = "activity-icon";

if (activity.action === "LOGIN_SUCCESS") {
    icon = "🔐";
    iconClass += " activity-login";
} else if (activity.action === "LOGIN_FAILED") {
    icon = "⚠️";
    iconClass += " activity-warning";
} else if (activity.action === "FILE_UPLOADED") {
    icon = "📤";
    iconClass += " activity-upload";
} else if (
    activity.action === "FILE_DOWNLOADED" ||
    activity.action === "SHARED_FILE_DOWNLOADED"
) {
    icon = "📥";
    iconClass += " activity-download";
} else if (activity.action === "FILE_SHARED") {
    icon = "🔗";
    iconClass += " activity-share";
} else if (activity.action === "SHARE_REVOKED") {
    icon = "🚫";
    iconClass += " activity-warning";
} else if (activity.action === "DELETE") {
    icon = "🗑️";
    iconClass += " activity-warning";
} else if (activity.action === "SECURITY_ALERT") {
    icon = "🚨";
    iconClass += " activity-security";
}

        return `
            <div class="activity-item">

                <div class="${iconClass}">${icon}</div>

                <div class="activity-content">

                    <div class="activity-title">
                        ${action}
                    </div>

                    ${filename ? `
                        <div class="activity-file">
                            ${filename}
                        </div>
                    ` : ""}

                    ${details ? `
                        <div class="activity-details">
                            ${details}
                        </div>
                    ` : ""}

                    <div class="activity-time">
                        ${date}
                    </div>

                </div>

            </div>
        `;

    }).join("");
}

function displayAllActivity(activities) {
    const tableBody = document.getElementById("activityTableBody");
    const emptyState = document.getElementById("activityHistoryEmpty");

    if (!tableBody) {
        return;
    }

    if (!activities || activities.length === 0) {
        tableBody.innerHTML = "";

        if (emptyState) {
            emptyState.style.display = "block";
        }

        return;
    }

    if (emptyState) {
        emptyState.style.display = "none";
    }

    tableBody.innerHTML = activities.map(activity => {
        const action = escapeHtml(
            activity.action || "ACTIVITY"
        );

        const filename = escapeHtml(
            activity.filename || "—"
        );

        const details = escapeHtml(
            activity.details || "—"
        );

        const date = activity.created_at
            ? new Date(activity.created_at).toLocaleString()
            : "—";

        return `
            <tr>
                <td>${date}</td>

                <td>
                    <span class="activity-action-badge">
                        ${action}
                    </span>
                </td>

                <td>${filename}</td>

                <td>${details}</td>
            </tr>
        `;
    }).join("");
}

async function checkSecurityActivity() {
    const token = getToken();

    if (!token) {
        console.log("No access token found.");
        return;
    }

    try {
        console.log("Checking security activity...");

        const response = await fetch(`${API_URL}/security/check`, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        console.log("Security check response:", response.status);

        if (response.status === 401) {
            localStorage.removeItem("access_token");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error(
                "Security check failed with status " + response.status
            );
        }

        const data = await response.json();

        console.log("Security check result:", data);

        if (data.alerts_created && data.alerts_created.length > 0) {
            console.log(
                "Security alerts created:",
                data.alerts_created
            );

            // Refresh notifications so the new alert appears immediately
            await loadNotifications();

            // Refresh recent activity
            await loadActivity();
        }

    } catch (error) {
        console.error("SECURITY CHECK ERROR:", error);
    }
}

async function loadSecurityAlerts() {
    const token = getToken();

    if (!token) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/security/analytics`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (response.status === 401) {
            localStorage.removeItem("access_token");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load security alerts.");
        }

        const data = await response.json();

        displaySecurityAlerts(data.alerts || []);

    } catch (error) {
        console.error("SECURITY ALERT ERROR:", error);

        const container =
            document.getElementById("securityAlertsContainer");
        

        if (container) {
            container.innerHTML =
                `<div class="security-alert-error">
                    Unable to load security alerts.
                </div>`;
        }
    }
}

function displaySecurityAlerts(alerts) {
    const container =
        document.getElementById("securityAlertsContainer");
    const securityStatus = 
        document.getElementById("securityStatus");
    if (!container) {
        return;
    }

    if (!alerts || alerts.length === 0) {
        container.innerHTML = `
            <div class="security-alert-safe">
                <span class="security-safe-icon">✓</span>
                <div>
                    <strong>No security alerts</strong>
                    <p>No potentially suspicious activity was detected.</p>
                </div>
            </div>
        `;
        if (securityStatus) {
            securityStatus.textContent = "Secure";
            securityStatus.classList.remove("security-warning");
            securityStatus.classList.add("security-status-safe");
        }

        if (securityStatusDescription) {
             securityStatusDescription.textContent =
            "No suspicious activity detected";
        }
        return;
    }
     if (securityStatus) {
        securityStatus.textContent = "Attention Needed";
        securityStatus.classList.remove("security-status-safe");
        securityStatus.classList.add("security-warning");
    }

    if (securityStatusDescription) {
        securityStatusDescription.textContent =
        "Suspicious activity detected";
    }


    container.innerHTML = alerts.map(alert => `
        <div class="security-alert-item ${alert.severity.toLowerCase()}">
            <div class="security-alert-icon">⚠️</div>

            <div class="security-alert-content">
                <strong>${escapeHtml(alert.title)}</strong>
                <p>${escapeHtml(alert.message)}</p>
            </div>
        </div>
    `).join("");
}


function displayNotifications(notifications) {

    const topList =
        document.getElementById("topNotificationsList");

    const oldList =
        document.getElementById("notificationsList");

    const topBadge =
        document.getElementById("topNotificationBadge");

    const oldBadge =
        document.getElementById("sidebarNotificationBadge") ||
        document.getElementById("notificationBadge");

    // Use top notification list if available
    const list = topList || oldList;

    if (!list) {
        console.log("Notification list element not found.");
        return;
    }

    /*
     * Count unread notifications
     */
    const unreadCount =
        notifications.filter(
            notification => !notification.is_read
        ).length;


    /*
     * Update top badge
     */
    if (topBadge) {

        topBadge.textContent = unreadCount;

        topBadge.style.display =
            unreadCount === 0 ? "none" : "flex";
    }


    /*
     * Update old sidebar badge if it still exists
     */
    if (oldBadge) {

        oldBadge.textContent = unreadCount;

        oldBadge.style.display =
            unreadCount === 0 ? "none" : "flex";
    }


    /*
     * No notifications
     */

    if (notifications.length === 0) {

        list.innerHTML = `
            <div class="no-notifications">

                <div class="no-notification-icon">
                    🔔
                </div>

                <p>
                    No notifications yet.
                </p>

            </div>
        `;

        return;
    }


    /*
     * Clear old notifications
     */

    list.innerHTML = "";


    /*
     * Display notifications
     */

    notifications.forEach(notification => {

        const item =
            document.createElement("div");

        item.className =
            "notification-item" +
            (!notification.is_read
                ? " unread"
                : "");


        const date =
            notification.created_at
                ? new Date(
                    notification.created_at
                  ).toLocaleString()
                : "";

        item.innerHTML = `

            <div class="notification-icon">
                🔔
            </div>

            <div class="notification-content">

                <strong>
                    ${escapeHtml(
                        notification.title || "Notification"
                    )}
                </strong>

                <p>
                    ${escapeHtml(
                        notification.message || ""
                    )}
                </p>

                <small>
                    ${date}
                </small>

            </div>

        `;

        // ---------------------------------
        // Mark notification as read
        // when clicked
        // ---------------------------------

        item.addEventListener("click", () => {

            markNotificationAsRead(
                notification.id
            );

        });

        list.appendChild(item);

    });

}
function toggleTopNotifications() {

    const dropdown =
        document.getElementById("topNotificationDropdown");

    if (!dropdown) {
        return;
    }

    dropdown.classList.toggle("show");
}
document.addEventListener("click", function(event) {

    const dropdown =
        document.getElementById("topNotificationDropdown");

    const button =
        document.getElementById("topNotificationButton");

    if (!dropdown || !button) {
        return;
    }

    if (
        !dropdown.contains(event.target) &&
        !button.contains(event.target)
    ) {
        dropdown.classList.remove("show");
    }

});
// ---------------------------------
// Mark Notification as Read
// ---------------------------------

async function markNotificationAsRead(
    notificationId
) {

    const token = getToken();

    if (!token) {
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/notifications/${notificationId}/read`,
            {
                method: "PUT",
                headers: {
                    "Authorization":
                        "Bearer " + token
                }
            }
        );

        if (!response.ok) {

            throw new Error(
                "Unable to mark notification as read"
            );

        }

        // Reload notifications
        // so unread badge is updated

        loadNotifications();

    } catch (error) {

        console.error(
            "Mark notification read error:",
            error
        );

    }

}


// ---------------------------------
// Toggle Notifications
// ---------------------------------

function toggleNotifications() {

    const dropdown =
        document.getElementById(
            "notificationDropdown"
        );

    if (!dropdown) return;

    dropdown.classList.toggle("active");

}

function displayFiles(files) {
    const container = document.getElementById("filesContainer");
    const emptyState = document.getElementById("emptyState");

    if (!container) return;

    container.innerHTML = "";

    // Update top statistics
    const totalFiles = document.getElementById("totalFiles");
    const storageUsed = document.getElementById("storageUsed");

    if (totalFiles) {
        totalFiles.textContent = files.length;
    }

    let totalBytes = 0;

    files.forEach(file => {
        totalBytes += Number(file.file_size || 0);
    });

    if (storageUsed) {
        storageUsed.textContent = formatFileSize(totalBytes);
    }

    // No files
    if (files.length === 0) {
        if (emptyState) {
            emptyState.style.display = "block";
        }
        return;
    }

    if (emptyState) {
        emptyState.style.display = "none";
    }

    // Show only recent 10 files
    files.slice(0, 10).forEach(file => {
        const row = document.createElement("div");
        row.className = "file-row";

        const date = file.uploaded_at
            ? new Date(file.uploaded_at).toLocaleDateString()
            : "-";

        row.innerHTML = `
            <span class="dashboard-file-name" title="${escapeHtml(file.filename)}">
                ${escapeHtml(file.filename)}
            </span>

            <span class="file-size">
                ${formatFileSize(Number(file.file_size || 0))}
            </span>

            <span class="file-date">
                ${date}
            </span>

            <span class="file-actions">
                <button
                    class="table-btn"
                    onclick="showFileMetadata(${file.id})">
                    Details
                </button>

                <button
                    class="table-btn"
                    onclick="downloadFile(${file.id})">
                    Download
                </button>

                <button
                    class="table-btn share-btn"
                    onclick="openShareModal(${file.id}, '${escapeJs(file.filename)}')">
                    Share
                </button>

                <button
                    class="table-btn delete-btn"
                    onclick="deleteFile(${file.id}, '${escapeJs(file.filename)}')">
                    Delete
                </button>
            </span>
        `;

        container.appendChild(row);
    });
}

function setupDragAndDrop() {
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("fileInput");

    if (!dropZone || !fileInput) return;

    fileInput.addEventListener("change", function () {
        if (this.files.length > 0) {
            handleFile(this.files[0]);
        }
    });

    dropZone.addEventListener("dragover", event => {
        event.preventDefault();
        dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", event => {
        event.preventDefault();
        dropZone.classList.remove("drag-over");

        if (event.dataTransfer.files.length > 0) {
            handleFile(event.dataTransfer.files[0]);
        }
    });
}

function handleFile(file) {
    selectedFile = file;

    const name = document.getElementById("selectedFileName");
    const size = document.getElementById("selectedFileSize");
    const selected = document.getElementById("selectedFile");
    const status = document.getElementById("uploadStatus");

    if (name) name.textContent = file.name;
    if (size) size.textContent = formatFileSize(file.size);
    if (selected) selected.style.display = "flex";
    if (status) status.innerHTML = "";
}

function removeSelectedFile() {
    selectedFile = null;

    const selected = document.getElementById("selectedFile");
    const input = document.getElementById("fileInput");

    if (selected) {
        selected.style.display = "none";
    }

    if (input) {
        input.value = "";
    }
}

async function uploadFile() {
    if (!selectedFile) {
        showUploadStatus("Please select a file first.", "error");
        return;
    }

    const token = getToken();

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const categoryElement = document.getElementById("fileCategory");
    const button = document.getElementById("uploadButton");

    const category = categoryElement
        ? categoryElement.value
        : "other";

    if (button) {
        button.disabled = true;
        button.textContent = "Uploading...";
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("category", category);

    try {
        const response = await fetch(`${API_URL}/upload`, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "File upload failed."
            );
        }

        showUploadStatus(
            "File uploaded successfully!",
            "success"
        );

        removeSelectedFile();
        await loadFiles();

    } catch (error) {
        console.error("Upload error:", error);
        showUploadStatus(error.message, "error");
    }

    if (button) {
        button.disabled = false;
        button.textContent = "Upload File";
    }
}

async function downloadFile(fileId) {
    const token = getToken();

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/files/${fileId}/download`,
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        if (!response.ok) {
            throw new Error("Download failed.");
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = "download";

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
        console.error("Download error:", error);
        alert("Unable to download file.");
    }
}

async function deleteFile(fileId, fileName) {
    const confirmed = confirm(
        `Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    const token = getToken();

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/files/${fileId}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "Unable to delete file."
            );
        }

        alert(`"${fileName}" was deleted successfully.`);

        await loadFiles();

    } catch (error) {
        console.error("Delete error:", error);
        alert(error.message);
    }
}

function showUploadStatus(message, type) {
    const status = document.getElementById("uploadStatus");

    if (!status) return;

    status.textContent = message;
    status.className = "upload-status " + type;
}

function openShareModal(fileId, fileName) {
    const modal = document.getElementById("shareModal");
    const id = document.getElementById("shareFileId");
    const name = document.getElementById("shareFileName");
    const email = document.getElementById("shareEmail");
    const result = document.getElementById("shareResult");
    const button = document.getElementById("generateShareBtn");

    if (id) id.value = fileId;
    if (name) name.textContent = fileName;
    if (email) email.value = "";
    if (result) result.style.display = "none";
    if (button) button.style.display = "block";

    if (modal) {
        modal.classList.add("active");
    }
}

function closeShareModal() {
    const modal = document.getElementById("shareModal");

    if (modal) {
        modal.classList.remove("active");
    }
}

async function submitShare() {
    const fileId = document.getElementById("shareFileId").value;
    const recipientEmail =
        document.getElementById("shareEmail").value.trim();

    const expirationElement =
        document.getElementById("shareExpiration");

    const expiresIn = expirationElement
        ? expirationElement.value
        : "24";

    if (!recipientEmail) {
        alert("Please enter the recipient email.");
        return;
    }

    const token = getToken();

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const button =
        document.getElementById("generateShareBtn");

    if (button) {
        button.disabled = true;
        button.textContent = "Generating...";
    }

    try {
        const response = await fetch(`${API_URL}/share`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                file_id: parseInt(fileId),
                recipient_email: recipientEmail,
                expires_in: parseInt(expiresIn)
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail ||
                "Unable to create sharing link."
            );
        }

        const shareLink =
            document.getElementById("shareLink");

        const shareExpiry =
            document.getElementById("shareExpiry");

        const shareResult =
            document.getElementById("shareResult");

        if (shareLink) {
            shareLink.value = data.share_link;
        }

        if (shareExpiry) {
            shareExpiry.textContent =
                new Date(data.expires_at).toLocaleString();
        }

        if (shareResult) {
            shareResult.style.display = "block";
        }
        if (button) {
    button.style.display = "none";
}

// Update Shared Files count
const sharedCount = document.getElementById("sharedFiles");

if (sharedCount) {
    const currentCount = parseInt(
        sharedCount.textContent || "0"
    );

    sharedCount.textContent = currentCount + 1;
}

// Refresh dashboard files
await loadFiles();

    } catch (error) {
        console.error("Share error:", error);
        alert(error.message);
    }

    if (button) {
        button.disabled = false;
        button.textContent = "Generate Secure Link";
    }
}

function copyShareLink() {
    const input = document.getElementById("shareLink");

    if (!input) return;

    navigator.clipboard.writeText(input.value)
        .then(() => {
            const button =
                document.getElementById("copyLinkBtn");

            if (button) {
                button.textContent = "Copied!";

                setTimeout(() => {
                    button.textContent = "Copy Link";
                }, 2000);
            }
        })
        .catch(() => {
            input.select();
            document.execCommand("copy");
            alert("Link copied!");
        });
}

async function showFileMetadata(fileId) {
    const token = getToken();

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/files/${fileId}`,
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                "Unable to load file details."
            );
        }

        const file = await response.json();

        setText("metadataFileId", file.id || "-");
        setText("metadataFileName", file.filename || "-");

        setText(
            "metadataFileType",
            file.file_type ||
            getFileType(file.filename || "")
        );

        setText(
            "metadataFileSize",
            formatFileSize(Number(file.file_size || 0))
        );

        setText(
            "metadataCategory",
            file.category || "-"
        );

        setText(
            "metadataFileCategory",
            file.category || "-"
        );

        setText(
            "metadataUploadedAt",
            file.uploaded_at
                ? new Date(file.uploaded_at).toLocaleString()
                : "-"
        );

        setText(
            "metadataOwner",
            file.owner_name ||
            file.owner_email ||
            "You"
        );

        setText(
            "metadataFilePath",
            file.file_path || "-"
        );

        const modal =
            document.getElementById("metadataModal");

        if (modal) {
            modal.classList.add("active");
        }

    } catch (error) {
        console.error("Metadata error:", error);
        alert(error.message);
    }
}

function closeMetadataModal() {
    const modal =
        document.getElementById("metadataModal");

    if (modal) {
        modal.classList.remove("active");
    }
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function getFileType(filename) {
    if (!filename) return "FILE";

    const extension = filename
        .split(".")
        .pop()
        .toLowerCase();

    const types = {
        pdf: "PDF",
        doc: "DOC",
        docx: "DOCX",
        xls: "XLS",
        xlsx: "XLSX",
        ppt: "PPT",
        pptx: "PPTX",
        jpg: "JPG",
        jpeg: "JPEG",
        png: "PNG",
        gif: "GIF",
        webp: "WEBP",
        mp4: "MP4",
        avi: "AVI",
        mkv: "MKV",
        mp3: "MP3",
        wav: "WAV",
        zip: "ZIP",
        rar: "RAR",
        "7z": "7Z",
        txt: "TXT",
        csv: "CSV"
    };

    return types[extension] || extension.toUpperCase();
}

function formatFileSize(bytes) {
    if (!bytes || bytes <= 0) {
        return "0 Bytes";
    }

    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];

    const index = Math.floor(
        Math.log(bytes) / Math.log(1024)
    );

    return (
        parseFloat(
            (
                bytes /
                Math.pow(1024, index)
            ).toFixed(2)
        ) +
        " " +
        units[index]
    );
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeJs(value) {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
}

async function loadSecurityReport() {
    const token = getToken();

    if (!token) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/security/report`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (response.status === 401) {
            localStorage.removeItem("access_token");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error(
                "Security report failed with status " + response.status
            );
        }

        const data = await response.json();

        console.log("Security report response:", data);

        displaySecurityReport(data);

    } catch (error) {
        console.error("SECURITY REPORT ERROR:", error);

        const container =
            document.getElementById("securityReportContainer");

        if (container) {
            container.innerHTML = `
                <div class="security-report-error">
                    Unable to load security report.
                </div>
            `;
        }
    }
}

async function loadSecurityReport() {
    const token = getToken();

    if (!token) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/security/report`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (response.status === 401) {
            localStorage.removeItem("access_token");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error(
                "Security report failed with status " + response.status
            );
        }

        const data = await response.json();

        console.log("Security report response:", data);

        displaySecurityReport(data);

    } catch (error) {
        console.error("SECURITY REPORT ERROR:", error);

        const container =
            document.getElementById("securityReportContainer");

        if (container) {
            container.innerHTML = `
                <div class="security-report-error">
                    Unable to load security report.
                </div>
            `;
        }
    }
}

function displaySecurityReport(data) {
    const container =
        document.getElementById("securityReportContainer");

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="security-report-grid">

            <div class="security-stat-card">
                <div class="security-stat-icon">📊</div>
                <div class="security-stat-value">
                    ${data.total_activities || 0}
                </div>
                <div class="security-stat-label">
                    Total Activities
                </div>
            </div>

            <div class="security-stat-card">
                <div class="security-stat-icon">⚠️</div>
                <div class="security-stat-value">
                    ${data.failed_logins || 0}
                </div>
                <div class="security-stat-label">
                    Failed Logins
                </div>
            </div>

            <div class="security-stat-card">
                <div class="security-stat-icon">🔐</div>
                <div class="security-stat-value">
                    ${data.security_events || 0}
                </div>
                <div class="security-stat-label">
                    Security Events
                </div>
            </div>

            <div class="security-stat-card">
                <div class="security-stat-icon">📤</div>
                <div class="security-stat-value">
                    ${data.uploads || 0}
                </div>
                <div class="security-stat-label">
                    Uploads
                </div>
            </div>

            <div class="security-stat-card">
                <div class="security-stat-icon">📥</div>
                <div class="security-stat-value">
                    ${data.downloads || 0}
                </div>
                <div class="security-stat-label">
                    Downloads
                </div>
            </div>

            <div class="security-stat-card">
                <div class="security-stat-icon">🔗</div>
                <div class="security-stat-value">
                    ${data.shares || 0}
                </div>
                <div class="security-stat-label">
                    Shares
                </div>
            </div>

        </div>
    `;
}
async function loadStorageAnalytics() {
    const token = getToken();

    if (!token) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/storage/analytics`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (response.status === 401) {
            localStorage.removeItem("access_token");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error(
                "Storage analytics failed with status " + response.status
            );
        }

        const data = await response.json();

        console.log("Storage analytics response:", data);

        displayStorageAnalytics(data);

    } catch (error) {
        console.error("STORAGE ANALYTICS ERROR:", error);

        const container =
            document.getElementById("storageAnalyticsContainer");

        if (container) {
            container.innerHTML = `
                <div class="storage-analytics-error">
                    Unable to load storage analytics.
                </div>
            `;
        }
    }
}


function displayStorageAnalytics(data) {
    const container =
        document.getElementById("storageAnalyticsContainer");

    if (!container) {
        return;
    }

    const storageBytes =
        Number(data.storage_used_bytes || 0);

    const storageMB =
        (storageBytes / (1024 * 1024)).toFixed(2);

    const categories =
        data.files_by_category || {};

    let categoryHTML = "";

    Object.entries(categories).forEach(
        ([category, count]) => {

            categoryHTML += `
                <div class="storage-category-item">
                    <span>${escapeHtml(category)}</span>
                    <strong>${count}</strong>
                </div>
            `;
        }
    );

    if (!categoryHTML) {
        categoryHTML = `
            <div class="storage-category-empty">
                No categories available.
            </div>
        `;
    }

    container.innerHTML = `
        <div class="storage-stat-grid">

            <div class="storage-stat-card">
                <div class="storage-stat-icon">📁</div>
                <div class="storage-stat-value">
                    ${data.total_files || 0}
                </div>
                <div class="storage-stat-label">
                    Total Files
                </div>
            </div>

            <div class="storage-stat-card">
                <div class="storage-stat-icon">💾</div>
                <div class="storage-stat-value">
                    ${storageMB} MB
                </div>
                <div class="storage-stat-label">
                    Storage Used
                </div>
            </div>

            <div class="storage-category-card">
                <div class="storage-category-title">
                    Files by Category
                </div>

                <div class="storage-category-list">
                    ${categoryHTML}
                </div>
            </div>

        </div>
    `;
}// =========================================
// SIDEBAR MENU
// =========================================

function toggleSidebarMenu(menuId, button) {

    const menu = document.getElementById(menuId);

    if (!menu) {
        return;
    }

    const isOpen = menu.classList.contains("open");

    // Close all sidebar submenus

    document.querySelectorAll(".sidebar-submenu").forEach(submenu => {
        submenu.classList.remove("open");
    });

    document.querySelectorAll(".sidebar-menu-button").forEach(btn => {
        btn.classList.remove("menu-open");
    });

    // Open selected menu

    if (!isOpen) {

        menu.classList.add("open");

        if (button) {
            button.classList.add("menu-open");
        }

    }

}
function toggleDarkMode() {

    document.body.classList.toggle("dark-mode");

    const isDarkMode =
        document.body.classList.contains("dark-mode");

    localStorage.setItem(
        "trustshare_dark_mode",
        isDarkMode ? "enabled" : "disabled"
    );

    const themeToggle =
        document.getElementById("themeToggle");

    if (themeToggle) {
        themeToggle.textContent =
            isDarkMode ? "☀️" : "🌙";
    }
}
document.addEventListener("DOMContentLoaded", function() {

    const savedTheme =
        localStorage.getItem("trustshare_dark_mode");

    const themeToggle =
        document.getElementById("themeToggle");

    if (savedTheme === "enabled") {

        document.body.classList.add("dark-mode");

        if (themeToggle) {
            themeToggle.textContent = "☀️";
        }

    } else {

        if (themeToggle) {
            themeToggle.textContent = "🌙";
        }
    }

});