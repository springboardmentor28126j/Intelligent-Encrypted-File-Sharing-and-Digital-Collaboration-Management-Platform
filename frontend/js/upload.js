```javascript
// TrustShare File Upload

const fileInput = document.getElementById("fileInput");
const selectedFile = document.getElementById("selectedFile");
const uploadForm = document.getElementById("uploadForm");
const uploadMessage = document.getElementById("uploadMessage");
const categoryInput = document.getElementById("category");


// -----------------------------
// Display selected file
// -----------------------------

if (fileInput) {

    fileInput.addEventListener("change", function () {

        if (fileInput.files.length > 0) {

            selectedFile.textContent =
                "Selected: " + fileInput.files[0].name;

        } else {

            selectedFile.textContent =
                "No file selected";
        }

    });
}


// -----------------------------
// Upload file to FastAPI
// -----------------------------

if (uploadForm) {

    uploadForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        // -----------------------------
        // Check JWT token
        // -----------------------------

        const token = localStorage.getItem("access_token");

        if (!token) {

            uploadMessage.textContent =
                "Please login before uploading a file.";

            uploadMessage.style.color = "red";

            return;
        }


        // -----------------------------
        // Check file
        // -----------------------------

        if (!fileInput.files || fileInput.files.length === 0) {

            uploadMessage.textContent =
                "Please select a file.";

            uploadMessage.style.color = "red";

            return;
        }


        // -----------------------------
        // Get file and category
        // -----------------------------

        const file = fileInput.files[0];
        const category = categoryInput.value;


        // -----------------------------
        // Create FormData
        // -----------------------------

        const formData = new FormData();

        formData.append("file", file);
        formData.append("category", category);


        // -----------------------------
        // Show uploading message
        // -----------------------------

        uploadMessage.textContent = "Uploading...";
        uploadMessage.style.color = "black";


        // -----------------------------
        // Send request
        // -----------------------------

        try {

            const response = await fetch(
                "http://127.0.0.1:8000/upload",
                {
                    method: "POST",

                    headers: {
                        "Authorization": "Bearer " + token
                    },

                    body: formData
                }
            );


            // -----------------------------
            // Get response safely
            // -----------------------------

            const responseText = await response.text();

            console.log("Upload status:", response.status);
            console.log("Upload response:", responseText);


            let result = {};

            try {

                result = JSON.parse(responseText);

            } catch (jsonError) {

                console.error(
                    "Server returned non-JSON response:",
                    responseText
                );

            }


            // -----------------------------
            // Successful upload
            // -----------------------------

            if (response.ok) {

                uploadMessage.textContent =
                    result.message ||
                    "File uploaded successfully.";

                uploadMessage.style.color = "green";

                uploadForm.reset();

                selectedFile.textContent =
                    "No file selected";

            }


            // -----------------------------
            // Unauthorized
            // -----------------------------

            else if (response.status === 401) {

                uploadMessage.textContent =
                    "Your login session has expired. Please login again.";

                uploadMessage.style.color = "red";

                localStorage.removeItem("access_token");

            }


            // -----------------------------
            // Validation error
            // -----------------------------

            else if (response.status === 422) {

                uploadMessage.textContent =
                    result.detail
                    ? JSON.stringify(result.detail)
                    : "Invalid upload data.";

                uploadMessage.style.color = "red";

            }


            // -----------------------------
            // Server error
            // -----------------------------

            else {

                uploadMessage.textContent =
                    result.detail ||
                    result.message ||
                    "Upload failed. Server returned status " +
                    response.status;

                uploadMessage.style.color = "red";
            }


        } catch (error) {

            console.error(
                "Upload connection error:",
                error
            );

            uploadMessage.textContent =
                "Could not connect to the TrustShare server. Check that the backend is running.";

            uploadMessage.style.color = "red";
        }

    });

}
```
