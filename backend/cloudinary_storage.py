import os

import cloudinary
import cloudinary.uploader
import cloudinary.utils

from dotenv import load_dotenv


# Load environment variables from .env
load_dotenv(override=True)


# Read Cloudinary configuration
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")


# Validate configuration
if not CLOUDINARY_CLOUD_NAME:
    raise ValueError("CLOUDINARY_CLOUD_NAME is not configured")

if not CLOUDINARY_API_KEY:
    raise ValueError("CLOUDINARY_API_KEY is not configured")

if not CLOUDINARY_API_SECRET:
    raise ValueError("CLOUDINARY_API_SECRET is not configured")


# Configure Cloudinary
cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
    secure=True
)


# ---------------------------------------------------------
# Upload encrypted file to Cloudinary
# ---------------------------------------------------------

def upload_encrypted_file(file_data: bytes, public_id: str):
    result = cloudinary.uploader.upload(
        file_data,
        resource_type="raw",
        public_id=public_id,
        overwrite=True
    )

    return result


# ---------------------------------------------------------
# Generate URL for encrypted file
# ---------------------------------------------------------

def get_encrypted_file_url(public_id: str):
    url, options = cloudinary.utils.cloudinary_url(
        public_id,
        resource_type="raw",
        type="upload",
        secure=True
    )

    return url


# ---------------------------------------------------------
# Delete encrypted file from Cloudinary
# ---------------------------------------------------------

def delete_encrypted_file(public_id: str):
    result = cloudinary.uploader.destroy(
        public_id,
        resource_type="raw"
    )

    return result