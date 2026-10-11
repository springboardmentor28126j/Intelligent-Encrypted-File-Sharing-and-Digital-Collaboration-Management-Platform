const API_URL = "http://127.0.0.1:8000";


document.addEventListener("DOMContentLoaded", () => {

    loadSharedFile();

});


async function loadSharedFile() {

    const params =
        new URLSearchParams(window.location.search);

    const token =
        params.get("token");


    if (!token) {

        showError(
            "No sharing token was provided."
        );

        return;

    }


    try {

        const response =
            await fetch(
                `${API_URL}/shared/${encodeURIComponent(token)}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                "This sharing link is unavailable."
            );

        }


        displayFile(data.file, data.expires_at, token);


    } catch (error) {

        showError(error.message);

    }

}


function displayFile(file, expiresAt, token) {

    document.getElementById("loadingState")
        .style.display = "none";


    document.getElementById("fileContent")
        .style.display = "block";


    document.getElementById("fileName")
        .textContent = file.filename;


    document.getElementById("fileCategory")
        .textContent =
        `Category: ${file.category}`;


    document.getElementById("fileSize")
        .textContent =
        `Size: ${formatFileSize(file.file_size)}`;


    if (expiresAt) {

        document.getElementById("expiresAt")
            .textContent =
            new Date(expiresAt).toLocaleString();

    } else {

        document.getElementById("expiresAt")
            .textContent = "Never";

    }


    document.getElementById("downloadButton")
        .addEventListener("click", () => {

            downloadFile(token);

        });

}


function downloadFile(token) {

    const downloadUrl =
        `${API_URL}/shared/${encodeURIComponent(token)}/download`;

    window.location.href = downloadUrl;

}


function showError(message) {

    document.getElementById("loadingState")
        .style.display = "none";


    document.getElementById("fileContent")
        .style.display = "none";


    document.getElementById("errorState")
        .style.display = "block";


    document.getElementById("errorMessage")
        .textContent = message;

}


function formatFileSize(bytes) {

    if (bytes === 0) {
        return "0 Bytes";
    }


    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];


    const index =
        Math.floor(
            Math.log(bytes) / Math.log(1024)
        );


    return (
        parseFloat(
            (bytes / Math.pow(1024, index))
                .toFixed(2)
        )
        + " "
        + units[index]
    );

}