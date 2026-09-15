import requests

import cloudinary_storage
import cloudinary.utils


# =========================================================
# TEST CLOUDINARY PUBLIC ID
# =========================================================

PUBLIC_ID = "trust_share_6c5c0e50a78c482da2589d24a8e407d0"


# =========================================================
# GENERATE CLOUDINARY URL
# =========================================================

url, options = cloudinary.utils.cloudinary_url(

    PUBLIC_ID,

    resource_type="raw",

    type="upload",

    secure=True

)

print("Cloudinary URL generated successfully.")


# =========================================================
# DOWNLOAD ENCRYPTED FILE
# =========================================================

response = requests.get(
    url,
    timeout=30
)


print(
    "HTTP status:",
    response.status_code
)

print(
    "Downloaded bytes:",
    len(response.content)
)


# =========================================================
# CHECK RESULT
# =========================================================

if response.status_code == 200:

    print(
        "Encrypted file retrieved successfully."
    )

else:

    print(
        "Unable to retrieve encrypted file."
    )