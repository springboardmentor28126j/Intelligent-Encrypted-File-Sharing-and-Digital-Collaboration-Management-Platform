
// TrustShare - My Files


const API_URL = "http://127.0.0.1:8000";


const filesTableBody =
    document.getElementById("filesTableBody");

const searchInput =
    document.getElementById("searchInput");

const categoryFilter =
    document.getElementById("categoryFilter");


let allFiles = [];
let currentShareId = null;

// -----------------------------
// Load files from FastAPI
// -----------------------------

async function loadFiles() {

    const token =
        localStorage.getItem("access_token");


    // Check login
    if (!token) {

        filesTableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    Please login to view your files.
                </td>
            </tr>
        `;

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/files`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            "Bearer " + token
                    }
                }
            );


        const result =
            await response.json();


        // -----------------------------
        // Authentication error
        // -----------------------------

        if (response.status === 401) {

            filesTableBody.innerHTML = `
                <tr>
                    <td colspan="5">
                        Session expired.
                        Please login again.
                    </td>
                </tr>
            `;

            return;
        }


        // -----------------------------
        // Other errors
        // -----------------------------

        if (!response.ok) {

            filesTableBody.innerHTML = `
                <tr>
                    <td colspan="5">
                        ${result.detail || "Could not load files."}
                    </td>
                </tr>
            `;

            return;
        }


        // Save files
        allFiles =
            result.files || [];


        displayFiles(allFiles);

    }

    catch (error) {

        console.error(
            "Files error:",
            error
        );

        filesTableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    Could not connect to the TrustShare server.
                </td>
            </tr>
        `;
    }
}


// -----------------------------
// Display files
// -----------------------------

function displayFiles(files) {

    filesTableBody.innerHTML = "";


    // No files
    if (files.length === 0) {

        filesTableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    No files uploaded yet.
                </td>
            </tr>
        `;

        return;
    }


    files.forEach(function (file) {

        const row =
            document.createElement("tr");


        // Format file size
        const fileSize =
            formatFileSize(file.file_size);


        // Format date
        const fileDate =
            new Date(
                file.uploaded_at
            ).toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            );


        row.innerHTML = `

            <td>
                ${file.filename}
            </td>

            <td>
                ${file.category}
            </td>

            <td>
                ${fileSize}
            </td>

            <td>
                ${fileDate}
            </td>

            <td>

                <button
                    class="table-btn"
                    onclick="downloadFile(${file.id})"
                >
                    Download
                </button>

                <button
                    class="table-btn"
                    onclick="openShareModal(${file.id})"
                >
                    Share
                </button>

            </td>

        `;


        filesTableBody.appendChild(row);

    });
}


// -----------------------------
// Format file size
// -----------------------------

function formatFileSize(bytes) {

    if (bytes === 0) {
        return "0 Bytes";
    }


    if (!bytes) {
        return "Unknown";
    }


    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];


    const i =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (
        parseFloat(
            (
                bytes /
                Math.pow(1024, i)
            ).toFixed(2)
        )
        + " "
        + units[i]
    );
}


// -----------------------------
// Download file
// -----------------------------

async function downloadFile(fileId) {

    const token =
        localStorage.getItem("access_token");


    if (!token) {

        alert(
            "Please login first."
        );

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/files/${fileId}/download`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            "Bearer " + token
                    }
                }
            );


        if (!response.ok) {

            const result =
                await response.json();

            alert(
                result.detail ||
                "Download failed."
            );

            return;
        }


        // Convert response to Blob
        const blob =
            await response.blob();


        // Create temporary URL
        const url =
            window.URL.createObjectURL(blob);


        // Create download link
        const link =
            document.createElement("a");


        link.href = url;


        // Get filename from current file
        const file =
            allFiles.find(
                item => item.id === fileId
            );


        link.download =
            file
                ? file.filename
                : "download";


        document.body.appendChild(link);

        link.click();

        link.remove();


        // Remove temporary URL
        window.URL.revokeObjectURL(url);

    }

    catch (error) {

        console.error(
            "Download error:",
            error
        );

        alert(
            "Could not connect to the server."
        );
    }
}


// -----------------------------
// Share File
// -----------------------------

function openShareModal(fileId) {

    const modal =
        document.getElementById("shareModal");

    const fileIdInput =
        document.getElementById("shareFileId");

    const fileName =
        document.getElementById("shareFileName");

    const shareResult =
        document.getElementById("shareResult");

    const shareMessage =
        document.getElementById("shareMessage");

    const shareEmail =
        document.getElementById("shareEmail");

    const maxDownloads =
        document.getElementById("shareMaxDownloads");


    // Find selected file
    const file =
        allFiles.find(
            item => item.id === fileId
        );


    if (!file) {

        alert("File not found.");

        return;
    }


    // Store file ID
    fileIdInput.value = fileId;


    // Show filename
    fileName.textContent =
        "Create a secure sharing link for: "
        + file.filename;


    // Clear previous values
    shareEmail.value = "";

    maxDownloads.value = "";

    shareResult.style.display = "none";

    shareMessage.textContent = "";
    currentShareId = null;


    // Show modal
    modal.style.display = "flex";
}


// -----------------------------
// Close Share Modal
// -----------------------------

function closeShareModal() {

    const modal =
        document.getElementById("shareModal");

    modal.style.display = "none";
}


// -----------------------------
// Generate Share Link
// -----------------------------

async function generateShareLink() {

    const token =
        localStorage.getItem("access_token");


    if (!token) {

        alert("Please login first.");

        return;
    }


    const fileId =
        document.getElementById(
            "shareFileId"
        ).value;


    const recipientEmail =
        document.getElementById(
            "shareEmail"
        ).value.trim();


    const expiresIn =
        parseInt(
            document.getElementById(
                "shareExpiration"
            ).value
        );


    const maxDownloadsValue =
        document.getElementById(
            "shareMaxDownloads"
        ).value;


    const maxDownloads =
        maxDownloadsValue
            ? parseInt(maxDownloadsValue)
            : null;


    const shareMessage =
        document.getElementById(
            "shareMessage"
        );


    const generateButton =
        document.getElementById(
            "generateShareBtn"
        );


    // Clear previous message
    shareMessage.textContent =
        "Generating secure link...";


    generateButton.disabled = true;


    try {

        const response =
            await fetch(
                `${API_URL}/share`,
                {
                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            "Bearer " + token
                    },

                    body: JSON.stringify({

                        file_id:
                            parseInt(fileId),

                        recipient_email:
                            recipientEmail || null,

                        expires_in:
                            expiresIn,

                        max_downloads:
                            maxDownloads

                    })

                }
            );


        const result =
            await response.json();


        // Authentication error
        if (response.status === 401) {

            shareMessage.textContent =
                "Session expired. Please login again.";

            return;
        }


        // Other backend errors
        if (!response.ok) {

            shareMessage.textContent =
                result.detail ||
                "Could not create sharing link.";

            console.error(
                "Share API error:",
                result
            );

            return;
        }


        console.log(
            "Share response:",
            result
        );


        // -----------------------------
        // IMPORTANT:
        // Always create the frontend
        // URL using share.html.
        // Do NOT use result.share_link,
        // result.link, or result.url.
        // -----------------------------

        if (!result.token) {

            shareMessage.textContent =
                "Link was created, but the server did not return a sharing token.";

            console.error(
                "No token returned by backend:",
                result
            );

            return;
        }

        // Store the share ID for revoking
        currentShareId = result.share_id;
        // Create URL to the actual share.html page
        const sharePage =
            new URL(
                "shared-file`.html",
                window.location.href
            ).href;


        const shareLink =
            sharePage +
            "?token=" +
            encodeURIComponent(
                result.token
            );


        console.log(
            "Generated frontend share link:",
            shareLink
        );


        // Put link in input
        document.getElementById(
            "shareLink"
        ).value = shareLink;


        // Show result
        document.getElementById(
            "shareResult"
        ).style.display = "block";


        shareMessage.textContent =
            "Secure sharing link created successfully.";

    }

    catch (error) {

        console.error(
            "Share error:",
            error
        );

        shareMessage.textContent =
            "Could not connect to the TrustShare server.";

    }

    finally {

        generateButton.disabled = false;

    }
}


// -----------------------------
// Copy Share Link
// -----------------------------

async function copyShareLink() {

    const shareLink =
        document.getElementById(
            "shareLink"
        );


    if (!shareLink.value) {

        alert(
            "No sharing link available."
        );

        return;
    }


    try {

        await navigator.clipboard.writeText(
            shareLink.value
        );


        document.getElementById(
            "copyLinkBtn"
        ).textContent = "Copied!";


        setTimeout(function () {

            document.getElementById(
                "copyLinkBtn"
            ).textContent = "Copy";

        }, 2000);

    }

    catch (error) {

        console.error(
            "Copy error:",
            error
        );


        // Fallback
        shareLink.select();

        document.execCommand("copy");

        alert("Link copied.");

    }
}


// -----------------------------
// Open Share Link
// -----------------------------

function openShareLink() {

    const shareLink =
        document.getElementById(
            "shareLink"
        ).value;


    if (!shareLink) {

        alert(
            "No sharing link available."
        );

        return;
    }


    window.open(
        shareLink,
        "_blank"
    );
}



// -----------------------------
// Revoke Share Link
// -----------------------------

async function revokeShareLink() {

    const token =
        localStorage.getItem("access_token");

    if (!token) {
        alert("Please login first.");
        return;
    }

    if (!currentShareId) {
        alert("No active sharing link selected.");
        return;
    }

    const confirmRevoke =
        confirm(
            "Are you sure you want to revoke this sharing link?\n\n" +
            "The recipient will no longer be able to download the file."
        );

    if (!confirmRevoke) {
        return;
    }

    const revokeButton =
        document.getElementById("revokeShareBtn");

    revokeButton.disabled = true;
    revokeButton.textContent = "Revoking...";

    try {

        const response =
            await fetch(
                `${API_URL}/share/${currentShareId}/revoke`,
                {
                    method: "POST",

                    headers: {
                        "Authorization":
                            "Bearer " + token
                    }
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            throw new Error(
                result.detail ||
                "Could not revoke sharing link."
            );
        }

        // Link successfully revoked
        document.getElementById(
            "shareMessage"
        ).textContent =
            "Sharing link revoked successfully.";

        revokeButton.textContent =
            "Link Revoked";

        revokeButton.disabled = true;

        // Disable other link actions
        document.getElementById(
            "openShareLinkBtn"
        ).disabled = true;

        document.getElementById(
            "copyLinkBtn"
        ).disabled = true;

        console.log(
            "Share revoked:",
            result
        );

    }

    catch (error) {

        console.error(
            "Revoke error:",
            error
        );

        alert(
            error.message ||
            "Could not revoke sharing link."
        );

        revokeButton.disabled = false;
        revokeButton.textContent =
            "Revoke Link";
    }
}
// -----------------------------
// Search files
// -----------------------------

function filterFiles() {

    const searchText =
        searchInput.value
            .toLowerCase()
            .trim();


    const selectedCategory =
        categoryFilter.value;


    const filteredFiles =
        allFiles.filter(function (file) {

            const matchesSearch =
                file.filename
                    .toLowerCase()
                    .includes(searchText);


            const matchesCategory =
                selectedCategory === "all"
                ||
                file.category === selectedCategory;


            return (
                matchesSearch &&
                matchesCategory
            );

        });


    displayFiles(filteredFiles);
}


// -----------------------------
// Search event
// -----------------------------

if (searchInput) {

    searchInput.addEventListener(
        "input",
        filterFiles
    );
}


// -----------------------------
// Category filter event
// -----------------------------

if (categoryFilter) {

    categoryFilter.addEventListener(
        "change",
        filterFiles
    );
}


// -----------------------------
// Load files when page opens
// -----------------------------

loadFiles();

