import os
import base64
import hashlib
import bcrypt
import psycopg2
import boto3
import smtplib
import secrets

from datetime import datetime, timedelta
from email.mime.text import MIMEText

from dotenv import load_dotenv
from botocore.exceptions import ClientError

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# =========================
# Load Environment Variables
# =========================

load_dotenv()


# =========================
# PostgreSQL Connection
# =========================

conn = psycopg2.connect(
    host="localhost",
    database="trustshare",
    user="postgres",
    password="Shreesha@29",
    port="5432"
)


# =========================
# Notification Table Setup
# =========================

cur = conn.cursor()
cur.execute(
    """
    CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(150) NOT NULL,
        notification_type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """
)
conn.commit()
cur.close()


# =========================
# AWS S3 Configuration
# =========================

s3 = boto3.client(
    "s3",
    region_name=os.getenv("AWS_REGION")
)

BUCKET_NAME = os.getenv("AWS_BUCKET_NAME")


# =========================
# Master Key
# =========================
# The master key is used only
# to protect individual file keys.

MASTER_KEY_TEXT = os.getenv(
    "TRUSTSHARE_MASTER_KEY"
)

if not MASTER_KEY_TEXT:
    raise RuntimeError(
        "TRUSTSHARE_MASTER_KEY is missing in .env"
    )

MASTER_KEY = hashlib.sha256(
    MASTER_KEY_TEXT.encode("utf-8")
).digest()


# =========================
# FastAPI App
# =========================

app = FastAPI()


# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# User Model
# =========================

class User(BaseModel):
    name: str
    email: str
    password: str
    role: str = "user"


# =========================
# Home
# =========================

@app.get("/")
def home():
    return {
        "message": "TrustShare Backend is Running"
    }


# =========================
# Register
# =========================

@app.post("/register")
def register(user: User):

    cur = conn.cursor()

    hashed_password = bcrypt.hashpw(
        user.password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    cur.execute(
        """
        INSERT INTO users
        (name, email, password, role)
        VALUES (%s, %s, %s, %s)
        """,
        (
            user.name,
            user.email,
            hashed_password,
            user.role
        )
    )

    conn.commit()
    cur.close()

    log_activity(
        user.email,
        "REGISTER",
        status="SUCCESS",
        details="New user registered"
    )

    return {
        "message": "User registered successfully",
        "user": user.name,
        "role": user.role
    }


# =========================
# Login
# =========================

@app.post("/login")
def login(email: str, password: str):

    cur = conn.cursor()

    cur.execute(
        """
        SELECT name, email, role, password
        FROM users
        WHERE email=%s
        """,
        (email,)
    )

    user = cur.fetchone()

    cur.close()

    if user:

        stored_password = user[3]

        if bcrypt.checkpw(
            password.encode("utf-8"),
            stored_password.encode("utf-8")
        ):

            if not check_role(user[2]):
                log_activity(
                    user[1],
                    "LOGIN",
                    status="FAILED",
                    details="Invalid role"
                )
                return {
                    "message": "Invalid role"
                }

            log_activity(
                user[1],
                "LOGIN",
                status="SUCCESS",
                details="Login successful"
            )

            return {
                "message": "Login successful",
                "name": user[0],
                "email": user[1],
                "role": user[2]
            }

    log_activity(
        email,
        "LOGIN",
        status="FAILED",
        details="Invalid email or password"
    )

    return {
        "message": "Invalid email or password"
    }


# =========================
# Role Checking
# =========================

def check_role(role: str):

    allowed_roles = [
        "user",
        "content_creator",
        "administrator"
    ]

    return role in allowed_roles


# =========================
# Activity Logging
# =========================

def log_activity(
    user_email: str,
    action: str,
    filename: str = None,
    status: str = "SUCCESS",
    details: str = None
):
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO access_logs
        (user_email, action, filename, status, details)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            user_email,
            action,
            filename,
            status,
            details
        )
    )

    conn.commit()
    cur.close()


# =========================
# Notification & Security Alerts
# =========================

def create_notification(
    user_email: str,
    notification_type: str,
    message: str
):
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO notifications
            (user_email, notification_type, message)
            VALUES (%s, %s, %s)
            """,
            (
                user_email,
                notification_type,
                message
            )
        )
        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()


# =========================
# Encrypt File Key
# =========================

def protect_file_key(file_key: bytes) -> str:

    aesgcm = AESGCM(MASTER_KEY)

    nonce = os.urandom(12)

    encrypted_key = aesgcm.encrypt(
        nonce,
        file_key,
        None
    )

    protected_key = nonce + encrypted_key

    return base64.b64encode(
        protected_key
    ).decode("utf-8")


# =========================
# Decrypt File Key
# =========================

def unprotect_file_key(protected_key: str) -> bytes:

    protected_data = base64.b64decode(
        protected_key
    )

    nonce = protected_data[:12]

    encrypted_key = protected_data[12:]

    aesgcm = AESGCM(MASTER_KEY)

    file_key = aesgcm.decrypt(
        nonce,
        encrypted_key,
        None
    )

    return file_key


# =========================
# Upload File
# AES-256-GCM Encryption
# =========================

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    email: str = Form(...),
    role: str = Form("user")
):

    # -------------------------
    # Get the real role from database
    # -------------------------

    cur = conn.cursor()
    cur.execute(
        """
        SELECT role
        FROM users
        WHERE email=%s
        """,
        (email,)
    )
    user_record = cur.fetchone()
    cur.close()

    actual_role = user_record[0] if user_record else None

    # The database role is the source of truth.
    if actual_role not in [
        "content_creator",
        "administrator"
    ]:
        log_activity(
            email,
            "UPLOAD",
            filename=file.filename,
            status="FAILED",
            details="Unauthorized upload attempt"
        )
        return {
            "message":
                "You do not have permission to upload files"
        }

    role = actual_role


    # -------------------------
    # Allowed File Types
    # -------------------------

    allowed_types = [
        "text/plain",
        "application/pdf",
        "image/jpeg",
        "image/png"
    ]

    if file.content_type not in allowed_types:
        log_activity(
            email,
            "UPLOAD",
            filename=file.filename,
            status="FAILED",
            details="File type not allowed"
        )
        return {
            "message": "File type not allowed"
        }


    # -------------------------
    # Read File
    # -------------------------

    contents = await file.read()


    # -------------------------
    # Maximum 5 MB
    # -------------------------

    max_size = 5 * 1024 * 1024

    if len(contents) > max_size:
        log_activity(
            email,
            "UPLOAD",
            filename=file.filename,
            status="FAILED",
            details="File size exceeds 5 MB"
        )
        return {
            "message":
                "File size must be less than 5 MB"
        }


    # -------------------------
    # Generate Unique AES-256 Key
    # -------------------------

    file_key = AESGCM.generate_key(
        bit_length=256
    )


    # -------------------------
    # Generate File Nonce
    # -------------------------

    file_nonce = os.urandom(12)


    # -------------------------
    # Encrypt File
    # -------------------------

    aesgcm = AESGCM(file_key)

    encrypted_data = aesgcm.encrypt(
        file_nonce,
        contents,
        None
    )


    # -------------------------
    # Combine Nonce + Encrypted Data
    # -------------------------

    encrypted_file = (
        file_nonce +
        encrypted_data
    )


    # -------------------------
    # Protect AES File Key
    # -------------------------

    protected_key = protect_file_key(
        file_key
    )


    # -------------------------
    # S3 Key
    # -------------------------

    s3_key = f"encrypted/{file.filename}"


    try:

        # -------------------------
        # Upload Encrypted File
        # -------------------------

        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=s3_key,
            Body=encrypted_file,
            ContentType="application/octet-stream"
        )


        # -------------------------
        # Store Protected Key
        # -------------------------

        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO file_keys
            (filename, encryption_key, nonce)
            VALUES (%s, %s, %s)
            ON CONFLICT (filename)
            DO UPDATE SET
                encryption_key = EXCLUDED.encryption_key,
                nonce = EXCLUDED.nonce
            """,
            (
                file.filename,
                protected_key,
                psycopg2.Binary(file_nonce)
            )
        )

        conn.commit()
        cur.close()

        log_activity(
            email,
            "UPLOAD",
            filename=file.filename,
            status="SUCCESS",
            details=f"Encrypted file stored in S3 with role {role}"
        )

        return {
            "message":
                "File encrypted with AES-256 and securely stored in S3",
            "filename":
                file.filename,
            "s3_key":
                s3_key,
            "role":
                role
        }


    except ClientError as e:

        log_activity(
            email,
            "UPLOAD",
            filename=file.filename,
            status="FAILED",
            details="S3 encrypted upload failed"
        )

        return {
            "message":
                "S3 encrypted upload failed",
            "error":
                str(e)
        }


# =========================
# Get Files from S3
# =========================

@app.get("/files")
def get_files():

    try:

        response = s3.list_objects_v2(
            Bucket=BUCKET_NAME,
            Prefix="encrypted/"
        )

        files = []

        if "Contents" in response:

            for item in response["Contents"]:

                key = item["Key"]

                if key == "encrypted/":
                    continue

                filename = key.replace(
                    "encrypted/",
                    "",
                    1
                )

                files.append(filename)

        return {
            "files": files
        }


    except ClientError as e:

        return {
            "message":
                "Unable to get files from S3",
            "error":
                str(e)
        }


# =========================
# Download + Decrypt File
# =========================

@app.get("/download/{filename}")
def download_file(
    filename: str,
    email: str
):

    s3_key = f"encrypted/{filename}"

    try:

        # -------------------------
        # Get Encrypted File
        # -------------------------

        response = s3.get_object(
            Bucket=BUCKET_NAME,
            Key=s3_key
        )

        encrypted_file = response[
            "Body"
        ].read()

        # -------------------------
        # Get Protected AES Key
        # -------------------------

        cur = conn.cursor()

        cur.execute(
            """
            SELECT encryption_key
            FROM file_keys
            WHERE filename=%s
            """,
            (filename,)
        )

        result = cur.fetchone()

        cur.close()

        if not result:

            log_activity(
                email,
                "DOWNLOAD",
                filename=filename,
                status="FAILED",
                details="Encryption key not found"
            )

            return {
                "message":
                    "Encryption key not found"
            }

        # -------------------------
        # Recover AES-256 Key
        # -------------------------

        file_key = unprotect_file_key(
            result[0]
        )

        # -------------------------
        # Extract File Nonce
        # -------------------------

        file_nonce = encrypted_file[:12]

        # -------------------------
        # Extract Ciphertext
        # -------------------------

        encrypted_data = encrypted_file[12:]

        # -------------------------
        # Decrypt
        # -------------------------

        aesgcm = AESGCM(file_key)

        original_file = aesgcm.decrypt(
            file_nonce,
            encrypted_data,
            None
        )

        # -------------------------
        # Content Type
        # -------------------------

        content_type = (
            "application/octet-stream"
        )

        if filename.lower().endswith(".pdf"):
            content_type = "application/pdf"

        elif filename.lower().endswith(".txt"):
            content_type = "text/plain"

        elif filename.lower().endswith(".jpg"):
            content_type = "image/jpeg"

        elif filename.lower().endswith(".jpeg"):
            content_type = "image/jpeg"

        elif filename.lower().endswith(".png"):
            content_type = "image/png"

        # -------------------------
        # Audit Log
        # -------------------------

        log_activity(
            email,
            "DOWNLOAD",
            filename=filename,
            status="SUCCESS",
            details="Encrypted file decrypted and downloaded"
        )

        # =====================================================
        # DOWNLOAD NOTIFICATION
        # =====================================================

        try:

            cur = conn.cursor()

            # Find the owner of the shared file.
            # We look at the most recent matching share record.
            cur.execute(
                """
                SELECT owner_email
                FROM shared_files
                WHERE filename=%s
                AND allowed_email=%s
                ORDER BY id DESC
                LIMIT 1
                """,
                (
                    filename,
                    email
                )
            )

            share_result = cur.fetchone()

            cur.close()

            if share_result:

                owner_email = share_result[0]

                # Do not send a notification when the owner
                # downloads their own file.
                if (
                    owner_email
                    and owner_email.lower()
                    != email.lower()
                ):

                    notification_message = (
                        f"Your file '{filename}' "
                        f"was downloaded by {email}."
                    )

                    # In-app notification
                    create_notification(
                        owner_email,
                        "FILE_DOWNLOADED",
                        notification_message
                    )

                    # Email notification
                    send_notification_email(
                        owner_email,
                        "TrustShare - File Downloaded",
                        (
                            f"Hello,\n\n"
                            f"Your file '{filename}' "
                            f"was downloaded by {email}.\n\n"
                            f"TrustShare Security Notification\n"
                            f"TrustShare Team"
                        )
                    )

        except Exception as notification_error:

            print(
                "Download notification error:",
                notification_error
            )

            # Notification failure must not stop the actual
            # file download.
            try:
                conn.rollback()
            except Exception:
                pass

        # -------------------------
        # Return Original File
        # -------------------------

        return Response(
            content=original_file,
            media_type=content_type,
            headers={
                "Content-Disposition":
                    f'attachment; filename="{filename}"'
            }
        )

    except ClientError as e:

        log_activity(
            email,
            "DOWNLOAD",
            filename=filename,
            status="FAILED",
            details="Encrypted file not found in S3"
        )

        return {
            "message":
                "Encrypted file not found in S3",
            "error":
                str(e)
        }

    except Exception as e:

        log_activity(
            email,
            "DOWNLOAD",
            filename=filename,
            status="FAILED",
            details="File decryption failed"
        )

        return {
            "message":
                "File decryption failed",
            "error":
                str(e)
        }


# =========================
# Delete File
# =========================

@app.delete("/delete/{filename}")
def delete_file(
    filename: str,
    email: str = "unknown",
    role: str = "user"
):

    # -------------------------
    # Get the real role from database
    # -------------------------

    cur = conn.cursor()
    cur.execute(
        """
        SELECT role
        FROM users
        WHERE email=%s
        """,
        (email,)
    )
    user_record = cur.fetchone()
    cur.close()

    actual_role = user_record[0] if user_record else None

    # The database role is the source of truth.
    if actual_role not in [
        "content_creator",
        "administrator"
    ]:
        log_activity(
            email,
            "DELETE",
            filename=filename,
            status="FAILED",
            details="Unauthorized delete attempt"
        )
        return {
            "message":
                "You do not have permission to delete files"
        }

    role = actual_role


    s3_key = f"encrypted/{filename}"


    try:

        # -------------------------
        # Delete S3 File
        # -------------------------

        s3.delete_object(
            Bucket=BUCKET_NAME,
            Key=s3_key
        )


        # -------------------------
        # Delete Encryption Key
        # -------------------------

        cur = conn.cursor()

        cur.execute(
            """
            DELETE FROM file_keys
            WHERE filename=%s
            """,
            (filename,)
        )

        conn.commit()
        cur.close()

        log_activity(
            email,
            "DELETE",
            filename=filename,
            status="SUCCESS",
            details=f"File deleted by role {role}"
        )

        return {
            "message":
                "Encrypted file and encryption key deleted successfully"
        }


    except ClientError as e:

        log_activity(
            email,
            "DELETE",
            filename=filename,
            status="FAILED",
            details="S3 delete failed"
        )

        return {
            "message":
                "S3 delete failed",
            "error":
                str(e)
        }
    # =========================
# Secure File Sharing
# =========================

@app.post("/share")
def share_file(
    filename: str,
    owner_email: str,
    allowed_email: str,
    permission: str,
    expiry_minutes: int
):
    # Permission check
    if permission not in ["view", "download"]:
        log_activity(
            owner_email,
            "SHARE",
            filename=filename,
            status="FAILED",
            details="Invalid permission"
        )
        return {
            "message": "Invalid permission"
        }

    # Expiry check
    if expiry_minutes <= 0:
        log_activity(
            owner_email,
            "SHARE",
            filename=filename,
            status="FAILED",
            details="Invalid expiry time"
        )
        return {
            "message": "Expiry time must be greater than 0 minutes"
        }

    # Check that file exists in S3
    s3_key = f"encrypted/{filename}"

    try:
        s3.head_object(
            Bucket=BUCKET_NAME,
            Key=s3_key
        )

    except ClientError:
        log_activity(
            owner_email,
            "SHARE",
            filename=filename,
            status="FAILED",
            details="File not found"
        )
        return {
            "message": "File not found"
        }

    # Generate secure random token
    share_token = base64.urlsafe_b64encode(
        os.urandom(32)
    ).decode("utf-8")

    # Calculate expiry time
    from datetime import datetime, timedelta

    expires_at = datetime.now() + timedelta(
        minutes=expiry_minutes
    )

    # Store sharing information
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO shared_files
        (filename, owner_email, allowed_email,
         permission, share_token, expires_at)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (
            filename,
            owner_email,
            allowed_email,
            permission,
            share_token,
            expires_at
        )
    )

    conn.commit()
    cur.close()

    log_activity(
        owner_email,
        "SHARE",
        filename=filename,
        status="SUCCESS",
        details=f"Shared with {allowed_email}, permission={permission}, expiry={expiry_minutes} minutes"
    )

    create_notification(
        allowed_email,
        "FILE_SHARED",
        f"File '{filename}' was shared with you with {permission} permission. The share expires in {expiry_minutes} minutes."
    )

    return {
        "message": "Secure share link created successfully",
        "filename": filename,
        "allowed_email": allowed_email,
        "permission": permission,
        "expires_at": expires_at,
        "share_token": share_token
    }
# =========================
# Access Shared File
# =========================

@app.get("/shared/{share_token}")
def access_shared_file(
    share_token: str,
    email: str
):
    from datetime import datetime

    cur = conn.cursor()

    cur.execute(
        """
        SELECT filename, owner_email, allowed_email, permission, expires_at
        FROM shared_files
        WHERE share_token=%s
        """,
        (share_token,)
    )

    share = cur.fetchone()
    cur.close()

    # Check share link
    if not share:
        log_activity(
            email,
            "SHARED_ACCESS",
            status="FAILED",
            details="Invalid share link"
        )
        return {
            "message": "Invalid share link"
        }

    filename = share[0]
    owner_email = share[1]
    allowed_email = share[2]
    permission = share[3]
    expires_at = share[4]

    # Check authorized email
    if email.lower() != allowed_email.lower():
        log_activity(
            email,
            "SHARED_ACCESS",
            filename=filename,
            status="FAILED",
            details="Unauthorized shared-file access attempt"
        )
        create_notification(
            owner_email,
            "SECURITY_ALERT",
            f"Unauthorized access attempt detected for shared file '{filename}' from {email}."
        )
        return {
            "message": "You are not authorized to access this file"
        }

    # Check expiry
    if datetime.now() > expires_at:
        log_activity(
            email,
            "SHARED_ACCESS",
            filename=filename,
            status="FAILED",
            details="Share link has expired"
        )
        create_notification(
            owner_email,
            "SECURITY_ALERT",
            f"An expired share link for '{filename}' was accessed by {email}."
        )
        return {
            "message": "Share link has expired"
        }

    log_activity(
        email,
        "SHARED_ACCESS",
        filename=filename,
        status="SUCCESS",
        details=f"Access granted with permission={permission}"
    )
    create_notification(
        owner_email,
        "ACCESS_ALERT",
        f"Shared file '{filename}' was accessed by {email}."
    )

    return {
        "message": "Access granted",
        "filename": filename,
        "permission": permission,
        "expires_at": expires_at
    }

# =========================
# View Activity Logs
# =========================

@app.get("/logs")
def get_activity_logs(limit: int = 100):

    if limit <= 0:
        limit = 100

    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, user_email, action, filename, status, details, created_at
        FROM access_logs
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (limit,)
    )

    rows = cur.fetchall()
    cur.close()

    logs = []

    for row in rows:
        logs.append({
            "id": row[0],
            "user_email": row[1],
            "action": row[2],
            "filename": row[3],
            "status": row[4],
            "details": row[5],
            "created_at": row[6]
        })

    return {
        "logs": logs
    }


# =========================
# File Activity & Security Reports
# =========================

@app.get("/reports/activity")
def activity_report(limit: int = 100):

    if limit <= 0:
        limit = 100

    cur = conn.cursor()

    cur.execute(
        """
        SELECT action, status, COUNT(*)
        FROM access_logs
        GROUP BY action, status
        ORDER BY action, status
        """
    )

    summary_rows = cur.fetchall()

    cur.execute(
        """
        SELECT id, user_email, action, filename, status, details, created_at
        FROM access_logs
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (limit,)
    )

    recent_rows = cur.fetchall()
    cur.close()

    summary = []
    for row in summary_rows:
        summary.append({
            "action": row[0],
            "status": row[1],
            "count": row[2]
        })

    recent_activity = []
    for row in recent_rows:
        recent_activity.append({
            "id": row[0],
            "user_email": row[1],
            "action": row[2],
            "filename": row[3],
            "status": row[4],
            "details": row[5],
            "created_at": row[6]
        })

    return {
        "report": "File Activity Report",
        "summary": summary,
        "recent_activity": recent_activity
    }


@app.get("/reports/security")
def security_report(limit: int = 100):

    if limit <= 0:
        limit = 100

    cur = conn.cursor()

    cur.execute(
        """
        SELECT action, COUNT(*)
        FROM access_logs
        WHERE status != 'SUCCESS'
        GROUP BY action
        ORDER BY COUNT(*) DESC
        """
    )

    summary_rows = cur.fetchall()

    cur.execute(
        """
        SELECT id, user_email, action, filename, status, details, created_at
        FROM access_logs
        WHERE status != 'SUCCESS'
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (limit,)
    )

    security_rows = cur.fetchall()
    cur.close()

    summary = []
    for row in summary_rows:
        summary.append({
            "action": row[0],
            "failed_events": row[1]
        })

    security_events = []
    for row in security_rows:
        security_events.append({
            "id": row[0],
            "user_email": row[1],
            "action": row[2],
            "filename": row[3],
            "status": row[4],
            "details": row[5],
            "created_at": row[6]
        })

    return {
        "report": "Security Activity Report",
        "summary": summary,
        "security_events": security_events
    }


# =========================
# View Notifications
# =========================

@app.get("/notifications")
def get_notifications(email: str, unread_only: bool = False):
    cur = conn.cursor()

    if unread_only:
        cur.execute(
            """
            SELECT id, user_email, notification_type, message,
                   is_read, created_at
            FROM notifications
            WHERE user_email=%s AND is_read=FALSE
            ORDER BY created_at DESC
            LIMIT 100
            """,
            (email,)
        )
    else:
        cur.execute(
            """
            SELECT id, user_email, notification_type, message,
                   is_read, created_at
            FROM notifications
            WHERE user_email=%s
            ORDER BY created_at DESC
            LIMIT 100
            """,
            (email,)
        )

    rows = cur.fetchall()
    cur.close()

    notifications = []

    for row in rows:
        notifications.append({
            "id": row[0],
            "user_email": row[1],
            "notification_type": row[2],
            "message": row[3],
            "is_read": row[4],
            "created_at": row[5]
        })

    return {
        "notifications": notifications
    }


# =========================
# Mark Notification as Read
# =========================

@app.put("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, email: str):
    cur = conn.cursor()

    cur.execute(
        """
        UPDATE notifications
        SET is_read=TRUE
        WHERE id=%s AND user_email=%s
        RETURNING id
        """,
        (notification_id, email)
    )

    updated = cur.fetchone()
    conn.commit()
    cur.close()

    if not updated:
        return {
            "message": "Notification not found"
        }

    return {
        "message": "Notification marked as read",
        "id": notification_id
    }


# =========================
# Storage Analytics
# =========================

@app.get("/analytics/storage")
def storage_analytics():

    cur = conn.cursor()

    # Total files and total encrypted storage from S3
    response = s3.list_objects_v2(
        Bucket=BUCKET_NAME,
        Prefix="encrypted/"
    )

    total_files = 0
    total_storage_bytes = 0
    files = []

    if "Contents" in response:
        for item in response["Contents"]:

            key = item["Key"]

            if key == "encrypted/":
                continue

            filename = key.replace(
                "encrypted/",
                "",
                1
            )

            size_bytes = item.get("Size", 0)

            total_files += 1
            total_storage_bytes += size_bytes

            files.append({
                "filename": filename,
                "size_bytes": size_bytes
            })

    # Activity counts
    cur.execute("""
        SELECT COUNT(*)
        FROM access_logs
        WHERE action='UPLOAD'
        AND status='SUCCESS'
    """)
    uploads = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*)
        FROM access_logs
        WHERE action='DOWNLOAD'
        AND status='SUCCESS'
    """)
    downloads = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*)
        FROM shared_files
    """)
    shared_files_count = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*)
        FROM access_logs
        WHERE status != 'SUCCESS'
    """)
    security_events = cur.fetchone()[0]

    cur.close()

    total_storage_mb = round(
        total_storage_bytes / (1024 * 1024),
        2
    )

    return {
        "report": "Storage Analytics",
        "total_files": total_files,
        "total_storage_bytes": total_storage_bytes,
        "total_storage_mb": total_storage_mb,
        "uploads": uploads,
        "downloads": downloads,
        "shared_files": shared_files_count,
        "security_events": security_events,
        "files": files
    }


# =========================
# Usage Analytics
# =========================

@app.get("/analytics/usage")
def usage_analytics():

    cur = conn.cursor()

    cur.execute("""
        SELECT action, COUNT(*)
        FROM access_logs
        GROUP BY action
        ORDER BY action
    """)

    rows = cur.fetchall()
    cur.close()

    action_summary = []

    for row in rows:
        action_summary.append({
            "action": row[0],
            "total": row[1]
        })

    return {
        "report": "Usage Monitoring",
        "action_summary": action_summary
    }


# =========================
# Suspicious Activity Detection
# =========================

@app.get("/security/suspicious")
def suspicious_activity():

    cur = conn.cursor()

    cur.execute("""
        SELECT
            user_email,
            action,
            filename,
            status,
            details,
            created_at
        FROM access_logs
        WHERE created_at >= NOW() - INTERVAL '10 minutes'
        AND (
            LOWER(COALESCE(status, '')) LIKE '%fail%'
            OR LOWER(COALESCE(status, '')) LIKE '%unauthor%'
            OR LOWER(COALESCE(status, '')) LIKE '%invalid%'
            OR LOWER(COALESCE(status, '')) LIKE '%expire%'
            OR LOWER(COALESCE(details, '')) LIKE '%fail%'
            OR LOWER(COALESCE(details, '')) LIKE '%unauthor%'
            OR LOWER(COALESCE(details, '')) LIKE '%invalid%'
            OR LOWER(COALESCE(details, '')) LIKE '%expire%'
        )
        ORDER BY created_at DESC
    """)

    rows = cur.fetchall()
    cur.close()

    alerts = []

    for row in rows:
        alerts.append({
            "user_email": row[0],
            "action": row[1],
            "filename": row[2],
            "status": row[3],
            "details": row[4],
            "created_at": row[5]
        })

    return {
        "report": "Suspicious Activity Detection",
        "suspicious_events": len(alerts),
        "alerts": alerts
    }
# =========================================================
# FORGOT PASSWORD / OTP SYSTEM
# =========================================================


def send_otp_email(receiver_email: str, otp: str):
    """
    Sends password reset OTP through Gmail SMTP.
    """

    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if not smtp_email or not smtp_password:
        raise RuntimeError(
            "SMTP_EMAIL or SMTP_PASSWORD is missing in .env"
        )

    subject = "TrustShare Password Reset OTP"

    body = f"""
Hello,

Your TrustShare password reset OTP is:

{otp}

This OTP is valid for 10 minutes.

If you did not request a password reset, please ignore this email.

Regards,
TrustShare Team
"""

    message = MIMEText(body)
    message["Subject"] = subject
    message["From"] = smtp_email
    message["To"] = receiver_email

    with smtplib.SMTP(smtp_server, smtp_port) as server:
        server.starttls()
        server.login(
            smtp_email,
            smtp_password.replace(" ", "")
        )
        server.sendmail(
            smtp_email,
            receiver_email,
            message.as_string()
        )


# =========================================================
# SEND NORMAL NOTIFICATION EMAIL
# =========================================================


def send_notification_email(
    receiver_email: str,
    subject: str,
    message: str
):
    """
    Sends a normal TrustShare notification email through Gmail SMTP.
    """

    try:

        smtp_email = os.getenv("SMTP_EMAIL")
        smtp_password = os.getenv("SMTP_PASSWORD")
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))

        if not smtp_email or not smtp_password:
            raise RuntimeError(
                "SMTP_EMAIL or SMTP_PASSWORD is missing in .env"
            )

        message_body = MIMEText(message)
        message_body["Subject"] = subject
        message_body["From"] = smtp_email
        message_body["To"] = receiver_email

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(
                smtp_email,
                smtp_password.replace(" ", "")
            )
            server.sendmail(
                smtp_email,
                receiver_email,
                message_body.as_string()
            )

        return True

    except Exception as e:

        print("Notification email error:", e)
        return False


# =========================================================
# Forgot Password - Send OTP
# =========================================================

@app.post("/forgot-password")
def forgot_password(email: str):

    email = email.strip().lower()

    cur = conn.cursor()

    # Check whether user exists
    cur.execute(
        """
        SELECT email
        FROM users
        WHERE LOWER(email)=%s
        """,
        (email,)
    )

    user = cur.fetchone()

    if not user:
        cur.close()

        return {
            "message": "Email address is not registered"
        }

    # Generate secure 6-digit OTP
    otp = str(
        secrets.randbelow(900000) + 100000
    )

    expires_at = datetime.now() + timedelta(
        minutes=10
    )

    # Remove old OTPs for this email
    cur.execute(
        """
        DELETE FROM password_reset_otps
        WHERE email=%s
        """,
        (email,)
    )

    # Store new OTP
    cur.execute(
        """
        INSERT INTO password_reset_otps
        (email, otp, expires_at, is_verified)
        VALUES (%s, %s, %s, FALSE)
        """,
        (
            email,
            otp,
            expires_at
        )
    )

    conn.commit()
    cur.close()

    try:
        # Send OTP email
        send_otp_email(
            email,
            otp
        )

    except Exception as e:

        # Remove OTP if email sending fails
        cur = conn.cursor()

        cur.execute(
            """
            DELETE FROM password_reset_otps
            WHERE email=%s
            AND otp=%s
            """,
            (
                email,
                otp
            )
        )

        conn.commit()
        cur.close()

        print("SMTP Error:", e)

        return {
            "message": "Failed to send OTP email"
        }

    return {
        "message": "OTP sent successfully"
    }


# =========================================================
# Verify OTP
# =========================================================

@app.post("/verify-otp")
def verify_otp(
    email: str,
    otp: str
):

    email = email.strip().lower()
    otp = otp.strip()

    cur = conn.cursor()

    cur.execute(
        """
        SELECT id
        FROM password_reset_otps
        WHERE email=%s
        AND otp=%s
        AND is_verified=FALSE
        AND expires_at > CURRENT_TIMESTAMP
        ORDER BY id DESC
        LIMIT 1
        """,
        (
            email,
            otp
        )
    )

    record = cur.fetchone()

    if not record:
        cur.close()

        return {
            "message": "Invalid or expired OTP"
        }

    # Mark OTP as verified
    cur.execute(
        """
        UPDATE password_reset_otps
        SET is_verified=TRUE
        WHERE id=%s
        """,
        (record[0],)
    )

    conn.commit()
    cur.close()

    return {
        "message": "OTP verified successfully"
    }


# =========================================================
# Reset Password
# =========================================================

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str


@app.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest
):

    email = request.email.strip().lower()
    otp = request.otp.strip()
    new_password = request.new_password

    # Basic password validation
    if len(new_password) < 6:
        return {
            "message": "Password must contain at least 6 characters"
        }

    cur = conn.cursor()

    # Check verified and non-expired OTP
    cur.execute(
        """
        SELECT id
        FROM password_reset_otps
        WHERE email=%s
        AND otp=%s
        AND is_verified=TRUE
        AND expires_at > CURRENT_TIMESTAMP
        ORDER BY id DESC
        LIMIT 1
        """,
        (
            email,
            otp
        )
    )

    otp_record = cur.fetchone()

    if not otp_record:
        cur.close()

        return {
            "message": "OTP verification required or OTP expired"
        }

    # Hash new password using bcrypt
    hashed_password = bcrypt.hashpw(
        new_password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    # Update user's password
    cur.execute(
        """
        UPDATE users
        SET password=%s
        WHERE LOWER(email)=%s
        """,
        (
            hashed_password,
            email
        )
    )

    # Delete used OTP
    cur.execute(
        """
        DELETE FROM password_reset_otps
        WHERE id=%s
        """,
        (otp_record[0],)
    )

    conn.commit()
    cur.close()

    return {
        "message": "Password reset successfully"
    }