import secrets
import psycopg2
import bcrypt
import os
import hashlib
import smtplib

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
load_dotenv()


from fastapi import (
    FastAPI,
    UploadFile,
    File,
    HTTPException,
    Depends,
    Form
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer

from pydantic import BaseModel
from jose import JWTError, jwt

from fastapi.responses import FileResponse, Response

from encryption import encrypt_file, decrypt_file

from supabase import create_client, Client

# =========================
# FASTAPI APP
# =========================

app = FastAPI(
    title="TrustShare API",
    description="Secure File-Sharing System",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# SUPABASE
# =========================
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
)

SUPABASE_BUCKET = "trustshare-files"

# ==========================================
# SUPABASE STORAGE CONFIGURATION
# ==========================================

from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
)

SUPABASE_BUCKET = "trustshare-files"


# ==========================================
# UPLOAD ENCRYPTED FILE TO SUPABASE
# ==========================================

def upload_to_supabase(
    encrypted_data: bytes,
    storage_path: str
):

    response = supabase.storage.from_(
        SUPABASE_BUCKET
    ).upload(
        storage_path,
        encrypted_data,
        {
            "content-type": "application/octet-stream",
            "upsert": "false"
        }
    )

    return response


# ==========================================
# DOWNLOAD ENCRYPTED FILE FROM SUPABASE
# ==========================================

def download_from_supabase(
    storage_path: str
):

    encrypted_data = supabase.storage.from_(
        SUPABASE_BUCKET
    ).download(storage_path)

    return encrypted_data

# -----------------------------
# JWT Configuration
# -----------------------------

SECRET_KEY = "trustshare-super-secret-key-change-this-later"

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60


def create_access_token(data: dict):

    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({
        "exp": expire
    })

    encoded_jwt = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return encoded_jwt


# -----------------------------
# JWT Authentication
# -----------------------------

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="token"
)


def get_current_user(
    token: str = Depends(oauth2_scheme)
):

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("user_id")
        email = payload.get("email")

        if user_id is None or email is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )

        # Get user's role from database
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id, email, role
            FROM users
            WHERE id = %s
            AND email = %s
            """,
            (user_id, email)
        )

        user = cursor.fetchone()

        cursor.close()

        if user is None:
            raise HTTPException(
                status_code=401,
                detail="User not found"
            )

        return {
            "user_id": user[0],
            "email": user[1],
            "role": user[2]
        }

    except JWTError:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )


# -----------------------------
# RBAC - Admin Authorization
# -----------------------------

def require_admin(
    current_user: dict = Depends(get_current_user)
):

    if current_user.get("role") != "admin":

        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return current_user
# -----------------------------
# PostgreSQL Connection
# -----------------------------

connection = psycopg2.connect(
    host="localhost",
    database="trustshare",
    user="postgres",
    password="182006"
)


from datetime import datetime

def log_activity(
    user_id,
    user_email,
    action,
    filename=None,
    details=None,
    ip_address=None
):
    try:
        supabase.table("activity_logs").insert({
            "user_id": user_id,
            "user_email": user_email,
            "action": action,
            "filename": filename,
            "details": details,
            "ip_address": ip_address,
            "created_at": datetime.now().isoformat()
        }).execute()

    except Exception as e:
        print("Activity logging failed:", e)

# -----------------------------
# Notification Helper
# -----------------------------

def create_notification(
    user_id,
    title,
    message,
    notification_type
):
    try:

        supabase.table("notifications").insert({
            "user_id": user_id,
            "title": title,
            "message": message,
            "notification_type": notification_type,
            "is_read": False,
            "created_at": datetime.now().isoformat()
        }).execute()

    except Exception as error:

        print(
            "Notification creation failed:",
            str(error)
        )
# -----------------------------
# Get Notifications
# -----------------------------

@app.get("/notifications")
def get_notifications(
    current_user: dict = Depends(get_current_user)
):
    try:
        response = (
            supabase
            .table("notifications")
            .select("*")
            .eq("user_id", current_user["user_id"])
            .order("created_at", desc=True)
            .execute()
        )

        return {
            "notifications": response.data
        }

    except Exception as error:
        print("NOTIFICATION FETCH ERROR:", str(error))
        raise HTTPException(
            status_code=500,
            detail="Unable to fetch notifications"
        )
# ---------------------------------
# Unread Notification Count
# ---------------------------------

@app.get("/notifications/unread-count")
def get_unread_notification_count(
    current_user: dict = Depends(get_current_user)
):
    try:

        response = (
            supabase
            .table("notifications")
            .select("id")
            .eq("user_id", current_user["user_id"])
            .eq("is_read", False)
            .execute()
        )

        unread_count = len(response.data)

        return {
            "unread_count": unread_count
        }

    except Exception as error:

        print(
            "UNREAD NOTIFICATION COUNT ERROR:",
            str(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to fetch unread notification count"
        )
# -----------------------------
# Mark Notification as Read
# -----------------------------

@app.put("/notifications/{notification_id}/read")
def mark_notification_as_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user)
):

    try:

        response = (
            supabase
            .table("notifications")
            .update({
                "is_read": True
            })
            .eq("id", notification_id)
            .eq("user_id", current_user["user_id"])
            .execute()
        )

        if not response.data:

            raise HTTPException(
                status_code=404,
                detail="Notification not found"
            )

        return {
            "message": "Notification marked as read",
            "notification_id": notification_id
        }

    except HTTPException:

        raise

    except Exception as error:

        print(
            "MARK NOTIFICATION READ ERROR:",
            str(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to mark notification as read"
        )

@app.put("/notifications/read-all")
def mark_all_notifications_as_read(
    current_user: dict = Depends(get_current_user)
):
    try:

        response = (
            supabase
            .table("notifications")
            .update({"is_read": True})
            .eq("user_id", current_user["user_id"])
            .eq("is_read", False)
            .execute()
        )

        return {
            "message": "All notifications marked as read",
            "updated_count": len(response.data)
        }

    except Exception as error:

        print(
            "MARK ALL NOTIFICATIONS ERROR:",
            repr(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to mark notifications as read"
        )


@app.get("/activity")
def get_my_activity(current_user: dict = Depends(get_current_user)):
    print("ACTIVITY CURRENT USER:", current_user)

    try:
        response = (
            supabase
            .table("activity_logs")
            .select("*")
            .eq("user_id", current_user["user_id"])
            .order("created_at", desc=True)
            .limit(8)
            .execute()
        )

        print("ACTIVITY ROW COUNT:", len(response.data))

        return {
            "activities": response.data
        }

    except Exception as error:
        print("ACTIVITY FETCH ERROR:", repr(error))
        raise HTTPException(
            status_code=500,
            detail="Unable to load recent activity"
        )


@app.get("/activity/all")
def get_all_my_activity(current_user: dict = Depends(get_current_user)):
    print("ALL ACTIVITY CURRENT USER:", current_user)

    try:
        response = (
            supabase
            .table("activity_logs")
            .select("*")
            .eq("user_id", current_user["user_id"])
            .order("created_at", desc=True)
            .execute()
        )

        print("ALL ACTIVITY ROW COUNT:", len(response.data))

        return {
            "activities": response.data
        }

    except Exception as error:
        print("ALL ACTIVITY FETCH ERROR:", repr(error))
        raise HTTPException(
            status_code=500,
            detail="Unable to load activity history"
        )
# =========================================
# SECURITY ANALYTICS
# =========================================

@app.get("/security/analytics")
def get_security_analytics(
    current_user: dict = Depends(get_current_user)
):
    try:

        # Get recent activity for the current user
        response = (
            supabase
            .table("activity_logs")
            .select("*")
            .eq("user_id", current_user["user_id"])
            .order("created_at", desc=True)
            .execute()
        )

        activities = response.data or []

        # -----------------------------------------
        # 1. Failed login detection
        # -----------------------------------------

        now = datetime.now(timezone.utc)

        recent_failed_logins = []

        for activity in activities:

            if activity.get("action") != "LOGIN_FAILED":
                continue

            created_at = activity.get("created_at")

            if not created_at:
                continue

            try:
                activity_time = datetime.fromisoformat(
                    created_at.replace("Z", "+00:00")
                )

                if activity_time.tzinfo is None:
                    activity_time = activity_time.replace(
                        tzinfo=timezone.utc
                    )

                difference = now - activity_time

                if difference.total_seconds() <= 600:
                    recent_failed_logins.append(activity)

            except Exception:
                continue

        failed_login_count = len(recent_failed_logins)

        suspicious_login = failed_login_count >= 3

        # -----------------------------------------
        # 2. Unusual download detection
        # -----------------------------------------

        recent_downloads = []

        for activity in activities:

            if activity.get("action") not in [
                "FILE_DOWNLOADED",
                "SHARED_FILE_DOWNLOADED"
            ]:
                continue

            created_at = activity.get("created_at")

            if not created_at:
                continue

            try:
                activity_time = datetime.fromisoformat(
                    created_at.replace("Z", "+00:00")
                )

                if activity_time.tzinfo is None:
                    activity_time = activity_time.replace(
                        tzinfo=timezone.utc
                    )

                difference = now - activity_time

                if difference.total_seconds() <= 600:
                    recent_downloads.append(activity)

            except Exception:
                continue

        download_count = len(recent_downloads)

        suspicious_downloads = download_count >= 5

        # -----------------------------------------
        # Security status
        # -----------------------------------------

        alerts = []

        if suspicious_login:

            alerts.append({
                "type": "FAILED_LOGIN",
                "severity": "HIGH",
                "title": "Multiple Failed Login Attempts",
                "message": (
                    f"{failed_login_count} failed login attempts "
                    "were detected in the last 10 minutes."
                )
            })

        if suspicious_downloads:

            alerts.append({
                "type": "UNUSUAL_DOWNLOAD",
                "severity": "MEDIUM",
                "title": "Unusual Download Activity",
                "message": (
                    f"{download_count} file downloads "
                    "were detected in the last 10 minutes."
                )
            })

        return {
            "failed_login_count": failed_login_count,
            "download_count": download_count,
            "suspicious_login": suspicious_login,
            "suspicious_downloads": suspicious_downloads,
            "alerts": alerts
        }

    except Exception as error:

        print(
            "SECURITY ANALYTICS ERROR:",
            repr(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to calculate security analytics"
        )

@app.post("/security/check")
def check_security_activity(
    current_user: dict = Depends(get_current_user)
):
    try:
        # Get recent activity
        response = (
            supabase
            .table("activity_logs")
            .select("*")
            .eq("user_id", current_user["user_id"])
            .order("created_at", desc=True)
            .execute()
        )

        activities = response.data or []

        now = datetime.now(timezone.utc)

        failed_logins = []
        downloads = []

        # Check activities from the last 10 minutes
        for activity in activities:

            created_at = activity.get("created_at")

            if not created_at:
                continue

            try:
                activity_time = datetime.fromisoformat(
                    created_at.replace("Z", "+00:00")
                )

                if activity_time.tzinfo is None:
                    activity_time = activity_time.replace(
                        tzinfo=timezone.utc
                    )

                difference = now - activity_time

                if difference.total_seconds() > 600:
                    continue

                # Failed login
                if activity.get("action") == "LOGIN_FAILED":
                    failed_logins.append(activity)

                # Downloads
                if activity.get("action") in [
                    "FILE_DOWNLOADED",
                    "SHARED_FILE_DOWNLOADED"
                ]:
                    downloads.append(activity)

            except Exception:
                continue

        alerts_created = []

        # =========================================
        # FAILED LOGIN ALERT
        # =========================================

        if len(failed_logins) >= 3:

            # Check whether we already created this alert recently
            existing_alert = (
                supabase
                .table("activity_logs")
                .select("*")
                .eq("user_id", current_user["user_id"])
                .eq("action", "SECURITY_ALERT")
                .eq("details", "Multiple failed login attempts detected")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )

            should_create = True

            if existing_alert.data:
                last_alert = existing_alert.data[0]

                last_alert_time = datetime.fromisoformat(
                    last_alert["created_at"].replace("Z", "+00:00")
                )

                if last_alert_time.tzinfo is None:
                    last_alert_time = last_alert_time.replace(
                        tzinfo=timezone.utc
                    )

                if (now - last_alert_time).total_seconds() <= 600:
                    should_create = False

            if should_create:

                message = (
                    f"{len(failed_logins)} failed login attempts "
                    "were detected in the last 10 minutes."
                )

                # Record security event
                log_activity(
                    current_user["user_id"],
                    current_user["email"],
                    "SECURITY_ALERT",
                    None,
                    "Multiple failed login attempts detected",
                    None
                )

                # Create notification
                create_notification(
                    current_user["user_id"],
                    "Security Alert",
                    message,
                    "SECURITY_ALERT"
)
                alerts_created.append({
                    "type": "FAILED_LOGIN",
                    "severity": "HIGH",
                    "message": message
                })

        # =========================================
        # UNUSUAL DOWNLOAD ALERT
        # =========================================

        if len(downloads) >= 5:

            existing_alert = (
                supabase
                .table("activity_logs")
                .select("*")
                .eq("user_id", current_user["user_id"])
                .eq("action", "SECURITY_ALERT")
                .eq("details", "Unusual download activity detected")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )

            should_create = True

            if existing_alert.data:
                last_alert = existing_alert.data[0]

                last_alert_time = datetime.fromisoformat(
                    last_alert["created_at"].replace("Z", "+00:00")
                )

                if last_alert_time.tzinfo is None:
                    last_alert_time = last_alert_time.replace(
                        tzinfo=timezone.utc
                    )

                if (now - last_alert_time).total_seconds() <= 600:
                    should_create = False

            if should_create:

                message = (
                    f"{len(downloads)} file downloads "
                    "were detected in the last 10 minutes."
                )

                # Record security event
                log_activity(
                    current_user["user_id"],
                    current_user["email"],
                    "SECURITY_ALERT",
                    None,
                    "Unusual download activity detected",
                    None
                )

                # Create notification
                create_notification(
                     current_user["user_id"],
                    "Security Alert",
                    message,
                    "SECURITY_ALERT"
                )

                alerts_created.append({
                    "type": "UNUSUAL_DOWNLOAD",
                    "severity": "MEDIUM",
                    "message": message
                })

        return {
            "success": True,
            "failed_login_count": len(failed_logins),
            "download_count": len(downloads),
            "alerts_created": alerts_created
        }

    except Exception as error:
        print("SECURITY CHECK ERROR:", repr(error))

        raise HTTPException(
            status_code=500,
            detail="Unable to check security activity"
        )

# =========================================
# SECURITY REPORTS
# =========================================

@app.get("/security/report")
def get_security_report(
    current_user: dict = Depends(get_current_user)
):
    try:
        response = (
            supabase
            .table("activity_logs")
            .select("*")
            .eq("user_id", current_user["user_id"])
            .execute()
        )

        activities = response.data or []

        total_activities = len(activities)

        failed_logins = sum(
            1 for activity in activities
            if activity.get("action") == "LOGIN_FAILED"
        )

        security_events = sum(
            1 for activity in activities
            if activity.get("action") == "SECURITY_ALERT"
        )

        uploads = sum(
            1 for activity in activities
            if activity.get("action") == "FILE_UPLOADED"
        )

        downloads = sum(
            1 for activity in activities
            if activity.get("action") in [
                "FILE_DOWNLOADED",
                "SHARED_FILE_DOWNLOADED"
            ]
        )

        shares = sum(
            1 for activity in activities
            if activity.get("action") == "FILE_SHARED"
        )

        return {
            "total_activities": total_activities,
            "failed_logins": failed_logins,
            "security_events": security_events,
            "uploads": uploads,
            "downloads": downloads,
            "shares": shares
        }

    except Exception as error:
        print("SECURITY REPORT ERROR:", repr(error))

        raise HTTPException(
            status_code=500,
            detail="Unable to generate security report"
        )

# =========================================
# STORAGE ANALYTICS
# =========================================

@app.get("/storage/analytics")
def get_storage_analytics(
    current_user: dict = Depends(get_current_user)
):

    cursor = connection.cursor()

    try:

        cursor.execute(
            """
            SELECT
                category,
                file_size
            FROM files
            WHERE owner_id = %s
            """,
            (current_user["user_id"],)
        )

        files = cursor.fetchall()

        # Total files
        total_files = len(files)

        # Total storage used
        storage_used = sum(
            int(row[1] or 0)
            for row in files
        )

        # Files by category
        files_by_category = {}

        for row in files:

            category = row[0] or "other"

            if category not in files_by_category:
                files_by_category[category] = 0

            files_by_category[category] += 1

        return {
            "total_files": total_files,
            "storage_used_bytes": storage_used,
            "files_by_category": files_by_category
        }

    except Exception as error:

        print(
            "STORAGE ANALYTICS ERROR:",
            repr(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to calculate storage analytics"
        )

    finally:

        cursor.close()
# -----------------------------
# Create uploads folder
# -----------------------------

UPLOAD_FOLDER = "uploads"

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


# -----------------------------
# Home API
# -----------------------------

@app.get("/")
def home():
    return {
        "message": "TrustShare API is running"
    }


# -----------------------------
# Health Check
# -----------------------------

@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/test-supabase-user")
def test_supabase_user(current_user: dict = Depends(get_current_user)):

    try:

        print("CURRENT USER:", current_user)

        response = (
            supabase
            .table("activity_logs")
            .select("*")
            .eq("user_id", current_user["user_id"])
            .order("created_at", desc=True)
            .execute()
        )

        return {
            "success": True,
            "current_user": current_user,
            "count": len(response.data),
            "data": response.data[:10]
        }

    except Exception as error:

        print("USER ACTIVITY TEST ERROR:", repr(error))

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )
# -----------------------------
# Database Test
# -----------------------------

@app.get("/database")
def database_test():

    cursor = connection.cursor()

    cursor.execute("SELECT 1")

    result = cursor.fetchone()

    cursor.close()

    return {
        "database": "connected",
        "result": result[0]
    }


# -----------------------------
# User Registration
# -----------------------------

class UserRegister(BaseModel):
    name: str
    email: str
    password: str


@app.post("/register")
def register_user(user: UserRegister):

    cursor = connection.cursor()

    try:

        # Hash the password
        hashed_password = bcrypt.hashpw(
            user.password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        cursor.execute(
            """
            INSERT INTO users (name, email, password)
            VALUES (%s, %s, %s)
            RETURNING id, name, email
            """,
            (
                user.name,
                user.email,
                hashed_password
            )
        )

        new_user = cursor.fetchone()

        connection.commit()

        return {
            "message": "User registered successfully",
            "user": {
                "id": new_user[0],
                "name": new_user[1],
                "email": new_user[2]
            }
        }

    except psycopg2.Error as error:

        connection.rollback()

        return {
            "message": "Registration failed",
            "error": str(error)
        }

    finally:

        cursor.close()
# -----------------------------
# User Login
# -----------------------------

class UserLogin(BaseModel):
    email: str
    password: str


@app.post("/login")
def login_user(user: UserLogin):

    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT id, name, email, password
            FROM users
            WHERE email = %s
            """,
            (user.email,)
        )

        existing_user = cursor.fetchone()

        if existing_user is None:

            log_activity(
                user_id=None,
                user_email=user.email,
                action="LOGIN_FAILED",
                details="Login failed: invalid email or password"
            )

            return {
                "message": "Invalid email or password"
            }

        stored_password = existing_user[3]

        password_correct = bcrypt.checkpw(
            user.password.encode("utf-8"),
            stored_password.encode("utf-8")
        )

        if not password_correct:

            log_activity(
                user_id=existing_user[0],
                user_email=existing_user[2],
                action="LOGIN_FAILED",
                details="Login failed: invalid email or password"
            )
             
            create_notification(
                user_id=existing_user[0],
                title="Failed Login Attempt",
                message="A failed login attempt was detected on your TrustShare account.",
                notification_type="LOGIN_FAILED"
            )
            return {
                "message": "Invalid email or password"
            }
        access_token = create_access_token(
            {
                "user_id": existing_user[0],
                "email": existing_user[2]
            }
        )


        log_activity(
            user_id=existing_user[0],
            user_email=existing_user[2],
            action="LOGIN_SUCCESS",
            details="User logged in successfully"
        )
        create_notification(
             user_id=existing_user[0],
            title="Login Successful",
            message="You have successfully logged into your TrustShare account.",
            notification_type="LOGIN_SUCCESS"
        )

        return {
            "message": "Login successful",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": existing_user[0],
                "name": existing_user[1],
                "email": existing_user[2]
            }
    }

    finally:
        cursor.close()
# -----------------------------
# OAuth2 Token Endpoint
# Used by Swagger Authorize
# -----------------------------

@app.post("/token")
def login_for_swagger(
    username: str = Form(...),
    password: str = Form(...)
):

    cursor = connection.cursor()

    try:

        cursor.execute(
            """
            SELECT id, name, email, password
            FROM users
            WHERE email = %s
            """,
            (username,)
        )

        existing_user = cursor.fetchone()

        if existing_user is None:

            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        stored_password = existing_user[3]

        password_correct = bcrypt.checkpw(
            password.encode("utf-8"),
            stored_password.encode("utf-8")
        )

        if not password_correct:

            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        access_token = create_access_token(
            {
                "user_id": existing_user[0],
                "email": existing_user[2]
            }
        )

        return {
            "access_token": access_token,
            "token_type": "bearer"
        }

    finally:

        cursor.close()
# ==========================================
# SUPABASE STORAGE FUNCTIONS
# ==========================================

def upload_to_supabase(encrypted_data: bytes, storage_path: str):

    response = supabase.storage.from_(
        SUPABASE_BUCKET
    ).upload(
        storage_path,
        encrypted_data,
        {
            "content-type": "application/octet-stream",
            "upsert": "false"
        }
    )

    return response


def download_from_supabase(storage_path: str):

    encrypted_data = supabase.storage.from_(
        SUPABASE_BUCKET
    ).download(storage_path)

    return encrypted_data
# -----------------------------
# Secure Encrypted File Upload
# -----------------------------

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    category: str = "other",
    current_user: dict = Depends(get_current_user)
):

    # ---------------------------------
    # Read original file
    # ---------------------------------

    contents = await file.read()

    # Original file size
    file_size = len(contents)

    # ---------------------------------
    # Encrypt the file before storing it
    # ---------------------------------

    try:

        encrypted_contents = encrypt_file(contents)

    except Exception as error:

        print(
            "ENCRYPTION ERROR:",
            str(error)
        )

        raise HTTPException(
            status_code=500,
            detail="File encryption failed"
        )

    # ---------------------------------
    # Create unique Supabase storage path
    # ---------------------------------

    import uuid

    encrypted_filename = (
        str(uuid.uuid4()) + ".enc"
    )

    storage_path = (
        f"encrypted/"
        f"{current_user['user_id']}/"
        f"{encrypted_filename}"
    )

    # ---------------------------------
    # Upload encrypted file to Supabase
    # ---------------------------------

    try:

        upload_to_supabase(
            encrypted_contents,
            storage_path
        )

        print(
            "Encrypted file uploaded to Supabase"
        )

        print(
            "Storage path:",
            storage_path
        )

    except Exception as error:

        print(
            "SUPABASE ERROR:",
            str(error)
        )

        raise HTTPException(
            status_code=500,
            detail=f"Supabase upload failed: {str(error)}"
        )

    cursor = connection.cursor()

    try:

        # ---------------------------------
        # Store file metadata in PostgreSQL
        # ---------------------------------

        cursor.execute(
            """
            INSERT INTO files
            (
                filename,
                category,
                file_size,
                file_path,
                owner_id
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                file.filename,
                category,
                file_size,
                storage_path,
                current_user["user_id"]
            )
        )

        file_id = cursor.fetchone()[0]

        connection.commit()

        # ---------------------------------
        # Log file upload activity
        # ---------------------------------

        log_activity(
            user_id=current_user["user_id"],
            user_email=current_user["email"],
            action="FILE_UPLOADED",
            filename=file.filename,
            details=(
                f"File uploaded successfully. "
                f"File ID: {file_id}, "
                f"Category: {category}, "
                f"Size: {file_size} bytes"
            )
        )

        # ---------------------------------
        # Create upload notification
        # ---------------------------------

        create_notification(
            user_id=current_user["user_id"],
            title="File Uploaded",
            message=(
                f"Your file '{file.filename}' "
                f"was uploaded successfully."
            ),
            notification_type="FILE_UPLOADED"
        )

        # ---------------------------------
        # Return success response
        # ---------------------------------

        return {
            "message": (
                "File uploaded, encrypted and "
                "stored in Supabase successfully"
            ),
            "file_id": file_id,
            "filename": file.filename,
            "category": category,
            "file_size": file_size,
            "uploaded_by": current_user["email"]
        }

    except psycopg2.Error as error:

        connection.rollback()

        # ---------------------------------
        # Remove Supabase file if database
        # insertion fails
        # ---------------------------------

        try:

            supabase.storage.from_(
                SUPABASE_BUCKET
            ).remove(
                [storage_path]
            )

        except Exception:

            pass

        print(
            "DATABASE INSERTION ERROR:",
            str(error)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                f"Database insertion failed: "
                f"{str(error)}"
            )
        )

    finally:

        cursor.close()
# -----------------------------
# Get My Files
# -----------------------------

@app.get("/files")
def get_my_files(
    current_user: dict = Depends(get_current_user)
):

    cursor = connection.cursor()

    try:

        cursor.execute(
            """
            SELECT
                id,
                filename,
                category,
                file_size,
                uploaded_at
            FROM files
            WHERE owner_id = %s
            ORDER BY uploaded_at DESC
            """,
            (current_user["user_id"],)
        )

        files = cursor.fetchall()

        return {
            "files": [
                {
                    "id": row[0],
                    "filename": row[1],
                    "category": row[2],
                    "file_size": row[3],
                    "uploaded_at": row[4]
                }
                for row in files
            ]
        }

    finally:

        cursor.close()

# -----------------------------
# File Metadata
# -----------------------------

@app.get("/files/{file_id}/metadata")
def get_file_metadata(
    file_id: int,
    current_user: dict = Depends(get_current_user)
):

    cursor = connection.cursor()

    try:

        cursor.execute(
            """
            SELECT
                id,
                filename,
                category,
                file_size,
                file_path,
                uploaded_at,
                owner_id
            FROM files
            WHERE id = %s
            AND owner_id = %s
            """,
            (
                file_id,
                current_user["user_id"]
            )
        )

        file = cursor.fetchone()

        if file is None:

            raise HTTPException(
                status_code=404,
                detail="File not found or you do not own this file"
            )

        return {
            "id": file[0],
            "filename": file[1],
            "category": file[2],
            "file_size": file[3],
            "file_path": file[4],
            "uploaded_at": file[5],
            "owner_id": file[6]
        }

    finally:

        cursor.close()
# -----------------------------
# Get File Metadata
# -----------------------------

@app.get("/files/{file_id}")
def get_file_metadata(
    file_id: int,
    current_user: dict = Depends(get_current_user)
):

    cursor = connection.cursor()

    try:

        cursor.execute(
            """
            SELECT
                f.id,
                f.filename,
                f.file_size,
                f.category,
                f.file_path,
                f.uploaded_at,
                u.email
            FROM files f
            JOIN users u
                ON f.owner_id = u.id
            WHERE f.id = %s
            AND f.owner_id = %s
            """,
            (
                file_id,
                current_user["user_id"]
            )
        )

        file = cursor.fetchone()

        if file is None:
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )

        return {
            "id": file[0],
            "filename": file[1],
            "file_size": file[2],
            "category": file[3],
            "file_path": file[4],
            "uploaded_at": file[5],
            "owner_email": file[6],
            "file_type": (
                file[1].split(".")[-1].upper()
                if "." in file[1]
                else "Unknown"
            )
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting file metadata: {str(e)}"
        )

    finally:
        cursor.close()

# -----------------------------
# Download Decrypted File
# -----------------------------

@app.get("/files/{file_id}/download")
def download_file(
    file_id: int,
    current_user: dict = Depends(get_current_user)
):

    cursor = connection.cursor()

    try:

        # ---------------------------------
        # Get file information from database
        # ---------------------------------

        cursor.execute(
            """
            SELECT filename, file_path
            FROM files
            WHERE id = %s
            AND owner_id = %s
            """,
            (
                file_id,
                current_user["user_id"]
            )
        )

        file = cursor.fetchone()

        if file is None:

            raise HTTPException(
                status_code=404,
                detail="File not found or you do not have permission"
            )

        filename = file[0]
        storage_path = file[1]

        # ---------------------------------
        # Download encrypted file
        # from Supabase
        # ---------------------------------

        try:

            encrypted_data = download_from_supabase(
                storage_path
            )

            print(
                "Encrypted file retrieved from Supabase"
            )

        except Exception as error:

            print(
                "SUPABASE DOWNLOAD ERROR:",
                str(error)
            )

            raise HTTPException(
                status_code=404,
                detail="Encrypted file not found in Supabase"
            )

        # ---------------------------------
        # Decrypt file
        # ---------------------------------

        try:

            decrypted_data = decrypt_file(
                encrypted_data
            )

            print(
                "File decrypted successfully"
            )

        except Exception as error:

            print(
                "DECRYPTION ERROR:",
                str(error)
            )

            raise HTTPException(
                status_code=500,
                detail="Unable to decrypt file"
            )

        # ---------------------------------
        # Log file download activity
        # ---------------------------------

        log_activity(
            user_id=current_user["user_id"],
            user_email=current_user["email"],
            action="FILE_DOWNLOADED",
            filename=filename,
            details=(
                f"File downloaded successfully. "
                f"File ID: {file_id}"
            )
        )

        # ---------------------------------
        # Create download notification
        # ---------------------------------

        create_notification(
            user_id=current_user["user_id"],
            title="File Downloaded",
            message=(
                f"Your file '{filename}' "
                f"was downloaded successfully."
            ),
            notification_type="FILE_DOWNLOADED"
        )

        # ---------------------------------
        # Return original decrypted file
        # ---------------------------------

        return Response(
            content=decrypted_data,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition":
                f'attachment; filename="{filename}"'
            }
        )

    except HTTPException:

        raise

    except Exception as error:

        print(
            "DOWNLOAD ERROR:",
            str(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to download file"
        )

    finally:

        cursor.close()
# -----------------------------
# Delete File
# -----------------------------

@app.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    current_user: dict = Depends(get_current_user)
):

    cursor = connection.cursor()

    try:

        # ---------------------------------
        # Get file information
        # ---------------------------------

        cursor.execute(
            """
            SELECT filename, file_path
            FROM files
            WHERE id = %s
            AND owner_id = %s
            """,
            (
                file_id,
                current_user["user_id"]
            )
        )

        file = cursor.fetchone()

        if file is None:

            raise HTTPException(
                status_code=404,
                detail="File not found or you do not own this file"
            )

        filename = file[0]
        storage_path = file[1]

        # ---------------------------------
        # Delete encrypted file
        # from Supabase Storage
        # ---------------------------------

        try:

            supabase.storage.from_(
                SUPABASE_BUCKET
            ).remove(
                [storage_path]
            )

            print(
                "File deleted from Supabase:",
                storage_path
            )

        except Exception as error:

            print(
                "SUPABASE DELETE ERROR:",
                str(error)
            )

        # ---------------------------------
        # Delete database record
        # ---------------------------------

        cursor.execute(
            """
            DELETE FROM files
            WHERE id = %s
            AND owner_id = %s
            """,
            (
                file_id,
                current_user["user_id"]
            )
        )

        connection.commit()

        # ---------------------------------
        # Activity Logging
        # ---------------------------------

        log_activity(
            user_id=current_user["user_id"],
            user_email=current_user["email"],
            action="FILE_DELETED",
            filename=filename,
            details=f"File deleted successfully. File ID: {file_id}"
        )
        create_notification(
            user_id=current_user["user_id"],
            title="File Deleted",
            message=(
                f"Your file '{filename}' "
                f"was deleted successfully."
            ),
            notification_type="FILE_ACTIVITY"
        )

        return {
            "message": "File deleted successfully",
            "file_id": file_id,
            "filename": filename
        }

    except HTTPException:

        connection.rollback()
        raise

    except Exception as error:

        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        cursor.close()


## -----------------------------
# Share File
# -----------------------------

class ShareRequest(BaseModel):
    file_id: int
    recipient_email: str | None = None
    expires_in: int = 24
    max_downloads: int | None = None


@app.post("/share")
def share_file(
    share: ShareRequest,
    current_user: dict = Depends(get_current_user)
):

    cursor = connection.cursor()

    try:

        # ---------------------------------
        # Check file ownership
        # ---------------------------------

        cursor.execute(
            """
            SELECT filename
            FROM files
            WHERE id = %s
            AND owner_id = %s
            """,
            (
                share.file_id,
                current_user["user_id"]
            )
        )

        file = cursor.fetchone()

        if file is None:

            raise HTTPException(
                status_code=404,
                detail="File not found or you do not own this file"
            )

        # ---------------------------------
        # Validate expiration
        # ---------------------------------

        if share.expires_in <= 0:

            raise HTTPException(
                status_code=400,
                detail="Expiration time must be greater than 0 hours"
            )

        # ---------------------------------
        # Validate max downloads
        # ---------------------------------

        if (
            share.max_downloads is not None
            and share.max_downloads <= 0
        ):

            raise HTTPException(
                status_code=400,
                detail="Maximum downloads must be greater than 0"
            )

        # ---------------------------------
        # Generate secure random token
        # ---------------------------------

        token = secrets.token_urlsafe(48)

        # ---------------------------------
        # Calculate expiration
        # ---------------------------------

        expires_at = (
            datetime.now(timezone.utc)
            + timedelta(hours=share.expires_in)
        )

        # ---------------------------------
        # Insert sharing record
        # ---------------------------------

        cursor.execute(
            """
            INSERT INTO file_share_links
            (
                file_id,
                recipient_email,
                token,
                created_by,
                expires_at,
                max_downloads
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                share.file_id,
                share.recipient_email,
                token,
                current_user["user_id"],
                expires_at,
                share.max_downloads
            )
        )

        share_id = cursor.fetchone()[0]

        connection.commit()

        # ---------------------------------
        # Log sharing activity
        # ---------------------------------

        log_activity(
            user_id=current_user["user_id"],
            user_email=current_user["email"],
            action="FILE_SHARED",
            filename=file[0],
            details=(
                f"File shared successfully. "
                f"Share ID: {share_id}, "
                f"Expires in: {share.expires_in} hours, "
                f"Maximum downloads: {share.max_downloads}"
            )
        )

        # ---------------------------------
        # Create sharing notification
        # ---------------------------------

        create_notification(
            user_id=current_user["user_id"],
            title="File Shared",
            message=(
                f"Your file '{file[0]}' "
                f"was shared successfully."
            ),
            notification_type="FILE_SHARED"
        )

        # ---------------------------------
        # Return sharing details
        # ---------------------------------

        return {
            "message": "File shared successfully",
            "share_id": share_id,
            "filename": file[0],
            "recipient_email": share.recipient_email,
            "expires_at": expires_at,
            "max_downloads": share.max_downloads,
            "token": token
        }

    except HTTPException:

        connection.rollback()
        raise

    except psycopg2.Error as error:

        connection.rollback()

        print(
            "SHARE DATABASE ERROR:",
            str(error)
        )

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    except Exception as error:

        connection.rollback()

        print(
            "SHARE ERROR:",
            str(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to create sharing link"
        )

    finally:

        cursor.close()

# -----------------------------
# Access Shared File
# -----------------------------

@app.get("/shared/{token}")
def access_shared_file(
    token: str
):

    cursor = connection.cursor()

    try:

        # ---------------------------------
        # Find shared file
        # ---------------------------------

        cursor.execute(
            """
            SELECT
                f.id,
                f.filename,
                f.file_size,
                f.category,
                f.file_path,
                s.recipient_email,
                s.expires_at,
                s.is_active
            FROM file_share_links s
            JOIN files f
                ON s.file_id = f.id
            WHERE s.token = %s
            """,
            (token,)
        )

        shared_file = cursor.fetchone()

        # ---------------------------------
        # Token not found
        # ---------------------------------

        if shared_file is None:

            raise HTTPException(
                status_code=404,
                detail="Invalid sharing link"
            )

        # ---------------------------------
        # Extract values
        # ---------------------------------

        file_id = shared_file[0]

        filename = shared_file[1]

        file_size = shared_file[2]

        category = shared_file[3]

        storage_path = shared_file[4]

        recipient_email = shared_file[5]

        expires_at = shared_file[6]

        is_active = shared_file[7]

        # ---------------------------------
        # Check active status
        # ---------------------------------

        if not is_active:

            raise HTTPException(
                status_code=403,
                detail="This sharing link has been disabled"
            )

        # ---------------------------------
        # Check expiration
        # ---------------------------------

        if expires_at is not None:

            now = datetime.now(timezone.utc)

            # PostgreSQL timestamp without timezone
            if expires_at.tzinfo is None:

                expires_at = expires_at.replace(
                    tzinfo=timezone.utc
                )

            if now > expires_at:

                # Automatically deactivate
                cursor.execute(
                    """
                    UPDATE file_share_links
                    SET is_active = FALSE
                    WHERE token = %s
                    """,
                    (token,)
                )

                connection.commit()

                raise HTTPException(
                    status_code=403,
                    detail="This sharing link has expired"
                )

        # ---------------------------------
        # Check encrypted file in Supabase
        # ---------------------------------

        try:

            encrypted_data = download_from_supabase(
                storage_path
            )

            if not encrypted_data:

                raise Exception(
                    "Empty encrypted file"
                )

        except Exception as error:

            print(
                "SUPABASE SHARED FILE ERROR:",
                str(error)
            )

            raise HTTPException(
                status_code=404,
                detail="Shared file no longer exists in storage"
            )

        # ---------------------------------
        # Return shared file information
        # ---------------------------------

        return {
            "message": "Shared file is available",

            "file": {
                "id": file_id,
                "filename": filename,
                "file_size": file_size,
                "category": category
            },

            "recipient_email": recipient_email,

            "expires_at": expires_at
        }

    except HTTPException:

        raise

    except Exception as error:

        print(
            "SHARED ACCESS ERROR:",
            str(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to access shared file"
        )

    finally:

        cursor.close()


# -----------------------------
# Supabase Connection Test
# -----------------------------

@app.get("/supabase-test")
def supabase_test():

    try:

        buckets = supabase.storage.list_buckets()

        return {
            "message":
                "Supabase connection successful",

            "buckets":
                [
                    bucket.name
                    for bucket in buckets
                ]
        }

    except Exception as error:

        return {
            "message":
                "Supabase connection failed",

            "error":
                str(error)
        }

# -----------------------------
# Download Shared File
# -----------------------------

@app.get("/shared/{token}/download")
def download_shared_file(
    token: str
):

    cursor = connection.cursor()

    try:

        # ---------------------------------
        # Get shared file information
        # ---------------------------------

        cursor.execute(
            """
            SELECT
                f.filename,
                f.file_path,
                f.owner_id,
                s.expires_at,
                s.is_active,
                s.download_count,
                s.max_downloads,
                s.recipient_email
            FROM file_share_links s
            JOIN files f
                ON s.file_id = f.id
            WHERE s.token = %s
            """,
            (token,)
        )

        shared_file = cursor.fetchone()

        if shared_file is None:

            raise HTTPException(
                status_code=404,
                detail="Invalid sharing link"
            )

        # ---------------------------------
        # Get values from database
        # ---------------------------------

        filename = shared_file[0]

        storage_path = shared_file[1]

        owner_id = shared_file[2]

        expires_at = shared_file[3]

        is_active = shared_file[4]

        download_count = shared_file[5]

        max_downloads = shared_file[6]

        recipient_email = shared_file[7]

        # ---------------------------------
        # Check active status
        # ---------------------------------

        if not is_active:

            raise HTTPException(
                status_code=403,
                detail="This sharing link has been disabled"
            )

        # ---------------------------------
        # Check expiration
        # ---------------------------------

        if expires_at is not None:

            now = datetime.now(timezone.utc)

            if expires_at.tzinfo is None:

                expires_at = expires_at.replace(
                    tzinfo=timezone.utc
                )

            if now > expires_at:

                cursor.execute(
                    """
                    UPDATE file_share_links
                    SET is_active = FALSE
                    WHERE token = %s
                    """,
                    (token,)
                )

                connection.commit()

                # ---------------------------------
                # Expiration notification
                # ---------------------------------

                create_notification(
                    user_id=owner_id,
                    title="Shared Link Expired",
                    message=(
                        f"The sharing link for "
                        f"'{filename}' has expired."
                    ),
                    notification_type="SECURITY"
                )

                raise HTTPException(
                    status_code=403,
                    detail="This sharing link has expired"
                )

        # ---------------------------------
        # Check maximum downloads
        # ---------------------------------

        if (
            max_downloads is not None
            and download_count >= max_downloads
        ):

            cursor.execute(
                """
                UPDATE file_share_links
                SET
                    is_active = FALSE,
                    revoked_at = NOW()
                WHERE token = %s
                """,
                (token,)
            )

            connection.commit()

            # ---------------------------------
            # Maximum download notification
            # ---------------------------------

            create_notification(
                user_id=owner_id,
                title="Shared Link Disabled",
                message=(
                    f"The maximum download limit for "
                    f"'{filename}' has been reached. "
                    f"The sharing link has been disabled."
                ),
                notification_type="SECURITY"
            )

            raise HTTPException(
                status_code=403,
                detail="Maximum download limit reached"
            )

        # ---------------------------------
        # Download encrypted file
        # from Supabase
        # ---------------------------------

        try:

            encrypted_data = download_from_supabase(
                storage_path
            )

            print(
                "Shared encrypted file retrieved from Supabase"
            )

        except Exception as error:

            print(
                "SUPABASE SHARED DOWNLOAD ERROR:",
                str(error)
            )

            raise HTTPException(
                status_code=404,
                detail="Shared encrypted file not found"
            )

        # ---------------------------------
        # Decrypt shared file
        # ---------------------------------

        try:

            decrypted_data = decrypt_file(
                encrypted_data
            )

            print(
                "Shared file decrypted successfully"
            )

        except Exception as error:

            print(
                "SHARED DECRYPTION ERROR:",
                str(error)
            )

            raise HTTPException(
                status_code=500,
                detail="Unable to decrypt shared file"
            )

        # ---------------------------------
        # Increase download count
        # ---------------------------------

        new_download_count = (
            download_count + 1
        )

        # ---------------------------------
        # Disable link if limit reached
        # ---------------------------------

        if (
            max_downloads is not None
            and new_download_count >= max_downloads
        ):

            cursor.execute(
                """
                UPDATE file_share_links
                SET
                    download_count = %s,
                    is_active = FALSE,
                    revoked_at = NOW()
                WHERE token = %s
                """,
                (
                    new_download_count,
                    token
                )
            )

        else:

            cursor.execute(
                """
                UPDATE file_share_links
                SET
                    download_count = %s
                WHERE token = %s
                """,
                (
                    new_download_count,
                    token
                )
            )

        connection.commit()

        # ---------------------------------
        # Log shared file download activity
        # ---------------------------------

        log_activity(
            user_id=owner_id,
            user_email=recipient_email,
            action="SHARED_FILE_DOWNLOADED",
            filename=filename,
            details=(
                f"Shared file downloaded successfully. "
                f"Download count: {new_download_count}"
            )
        )

        # ---------------------------------
        # Create download notification
        # ---------------------------------

        create_notification(
            user_id=owner_id,
            title="File Downloaded",
            message=(
                f"Your shared file "
                f"'{filename}' was downloaded successfully."
            ),
            notification_type="FILE_ACTIVITY"
        )

        # ---------------------------------
        # Return decrypted original file
        # ---------------------------------

        return Response(
            content=decrypted_data,

            media_type="application/octet-stream",

            headers={
                "Content-Disposition":
                f'attachment; filename="{filename}"'
            }
        )

    except HTTPException:

        connection.rollback()

        raise

    except Exception as error:

        connection.rollback()

        print(
            "SHARED DOWNLOAD ERROR:",
            str(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to download shared file"
        )

    finally:

        cursor.close()

# -----------------------------
# Revoke Shared Link
# -----------------------------

@app.post("/share/{share_id}/revoke")
def revoke_share_link(
    share_id: int,
    current_user: dict = Depends(get_current_user)
):

    cursor = connection.cursor()

    try:

        # ---------------------------------
        # Check that the share belongs to user
        # ---------------------------------

        cursor.execute(
            """
            SELECT id, is_active
            FROM file_share_links
            WHERE id = %s
            AND created_by = %s
            """,
            (
                share_id,
                current_user["user_id"]
            )
        )

        share = cursor.fetchone()

        if share is None:

            raise HTTPException(
                status_code=404,
                detail="Sharing link not found"
            )

        # ---------------------------------
        # Check if already revoked
        # ---------------------------------

        if not share[1]:

            raise HTTPException(
                status_code=400,
                detail="Sharing link is already revoked"
            )

        # ---------------------------------
        # Revoke the sharing link
        # ---------------------------------

        cursor.execute(
            """
            UPDATE file_share_links
            SET
                is_active = FALSE,
                revoked_at = NOW()
            WHERE id = %s
            AND created_by = %s
            """,
            (
                share_id,
                current_user["user_id"]
            )
        )

        connection.commit()

        # ---------------------------------
        # Log share revocation activity
        # ---------------------------------

        log_activity(
            user_id=current_user["user_id"],
            user_email=current_user["email"],
            action="SHARE_REVOKED",
            details=(
                f"Sharing link revoked successfully. "
                f"Share ID: {share_id}"
            )
        )

        # ---------------------------------
        # Create revocation notification
        # ---------------------------------

        create_notification(
            user_id=current_user["user_id"],
            title="Sharing Link Revoked",
            message=(
                f"Your sharing link with ID "
                f"{share_id} has been revoked successfully."
            ),
            notification_type="SHARE_REVOKED"
        )



        # ---------------------------------
        # Return success response
        # ---------------------------------

        return {
            "message": "Sharing link revoked successfully",
            "share_id": share_id
        }

    except HTTPException:

        connection.rollback()
        raise

    except Exception as error:

        connection.rollback()

        print(
            "REVOKE SHARE ERROR:",
            str(error)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to revoke sharing link"
        )

    finally:

        cursor.close()
# -----------------------------
# Dashboard Data
# -----------------------------

@app.get("/dashboard")
def get_dashboard(
    current_user: dict = Depends(get_current_user)
):

    cursor = connection.cursor()

    try:

        # Get statistics
        cursor.execute(
            """
            SELECT
                COUNT(*),
                COALESCE(SUM(file_size), 0)
            FROM files
            WHERE owner_id = %s
            """,
            (current_user["user_id"],)
        )

        stats = cursor.fetchone()

        total_files = stats[0]
        storage_used = stats[1]

        # Get number of active shared links
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM file_share_links
            WHERE created_by = %s
            AND is_active = TRUE
            """,
            (current_user["user_id"],)
        )

        shared_files = cursor.fetchone()[0]

        # Get recent files
        cursor.execute(
            """
            SELECT
                id,
                filename,
                category,
                file_size,
                uploaded_at
            FROM files
            WHERE owner_id = %s
            ORDER BY uploaded_at DESC
            LIMIT 5
            """,
            (current_user["user_id"],)
        )

        files = cursor.fetchall()

        recent_files = []

        for file in files:

            recent_files.append({
                "id": file[0],
                "filename": file[1],
                "category": file[2],
                "file_size": file[3],
                "uploaded_at": file[4].isoformat()
            })

        return {
            "total_files": total_files,
            "shared_files": shared_files,
            "storage_used": storage_used,
            "recent_files": recent_files
        }

    finally:

        cursor.close()
# -----------------------------
# Admin Test
# -----------------------------

@app.get("/admin/test")
def admin_test(
    current_user: dict = Depends(require_admin)
):

    return {
        "message": "Admin access granted",
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "role": current_user["role"]
    }
# -----------------------------
# Admin - View All Users
# -----------------------------

@app.get("/admin/users")
def get_all_users(
    current_user: dict = Depends(require_admin)
):

    cursor = connection.cursor()

    try:

        cursor.execute("""
            SELECT
                id,
                name,
                email,
                role
            FROM users
            ORDER BY id DESC
        """)

        users = cursor.fetchall()

        return {
            "users": [
                {
                    "id": user[0],
                    "name": user[1],
                    "email": user[2],
                    "role": user[3]
                }
                for user in users
            ]
        }

    finally:
        cursor.close()
# -----------------------------
# Admin - View All Files
# -----------------------------

@app.get("/admin/files")
def get_all_files(
    current_user: dict = Depends(require_admin)
):

    cursor = connection.cursor()

    try:

        cursor.execute("""
            SELECT
                f.id,
                f.filename,
                f.category,
                f.file_size,
                f.owner_id,
                u.email,
                f.uploaded_at
            FROM files f
            JOIN users u
                ON f.owner_id = u.id
            ORDER BY f.uploaded_at DESC
        """)

        files = cursor.fetchall()

        return {
            "files": [
                {
                    "id": file[0],
                    "filename": file[1],
                    "category": file[2],
                    "file_size": file[3],
                    "owner_id": file[4],
                    "owner_email": file[5],
                    "uploaded_at": file[6]
                }
                for file in files
            ]
        }

    finally:
        cursor.close()


@app.get("/test-activity")
def test_activity(
    current_user: dict = Depends(get_current_user)
):
    log_activity(
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        action="TEST_ACTIVITY",
        filename="test-file.pdf",
        details="Testing TrustShare activity monitoring"
    )

    return {
        "message": "Activity logged successfully"
    }


@app.get("/test-db")
def test_db():

    cursor = connection.cursor()

    cursor.execute("""
        SELECT current_database(), current_schema()
    """)

    result = cursor.fetchone()

    cursor.close()

    return {
        "database": result[0],
        "schema": result[1]
    }