import os
import uuid
import mimetypes
import hashlib
import re
import json
import urllib.request
import urllib.error
import html
import shutil
import subprocess
import tempfile

from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone

load_dotenv()

from fastapi import (
    FastAPI,
    Depends,
    Form,
    UploadFile,
    File as FastAPIFile,
    HTTPException,
    Header,
    Request
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from sqlalchemy.orm import Session
from sqlalchemy import text

from cryptography.exceptions import InvalidTag

from database import Base, engine, get_db
from models import User, File as DBFile, Share

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    verify_token,
    create_mfa_token,
    verify_mfa_token
)

import mfa as mfa_utils

from encryption import (
    generate_data_key,
    wrap_key,
    unwrap_key,
    encrypt_file_bytes,
    decrypt_file_bytes
)

from storage import storage

from sharing import (
    create_share as sharing_create_share,
    get_valid_share,
    check_and_register_access,
    revoke_share as sharing_revoke_share
)


# =========================================================
# CREATE APPLICATION
# =========================================================

app = FastAPI(
    title="TrustShare API",
    description="Secure File Sharing and Collaboration Platform",
    version="2.0"
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# =========================================================
# DATABASE TABLE CREATION
# =========================================================


Base.metadata.create_all(bind=engine)

# MFA: make sure the users table has the MFA columns.
try:
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(64)"
        ))
        connection.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
            "mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        connection.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT"
        ))
except Exception as mfa_schema_error:
    print("MFA schema check:", mfa_schema_error)

# Milestone 2 account-to-account sharing:
# add recipient_id to the existing shares table if it is not present.
try:
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE shares "
                "ADD COLUMN IF NOT EXISTS recipient_id INTEGER"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_shares_recipient_id "
                "ON shares(recipient_id)"
            )
        )
except Exception as schema_error:
    print("Account-sharing schema check:", schema_error)

# =========================================================
# MILESTONE 3 DATABASE TABLES
# Activity monitoring, audit logging, notifications,
# security alerts and analytics.
# =========================================================

try:
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                file_id INTEGER,
                action VARCHAR(100) NOT NULL,
                description TEXT,
                ip_address VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
            ON activity_logs(user_id)
        """))
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
            ON activity_logs(created_at)
        """))

        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                notification_type VARCHAR(50) DEFAULT 'general',
                type VARCHAR(50) DEFAULT 'general',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_notifications_user_id
            ON notifications(user_id)
        """))

        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS security_alerts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                alert_type VARCHAR(100) NOT NULL,
                severity VARCHAR(20),
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                resolved BOOLEAN DEFAULT FALSE
            )
        """))
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id
            ON security_alerts(user_id)
        """))
        # Existing M3 tables may have been created without defaults.
        connection.execute(text("""
            ALTER TABLE activity_logs
            ALTER COLUMN created_at SET DEFAULT NOW()
        """))
        connection.execute(text("""
            ALTER TABLE notifications
            ALTER COLUMN created_at SET DEFAULT NOW()
        """))
        connection.execute(text("""
            ALTER TABLE notifications
            ADD COLUMN IF NOT EXISTS type VARCHAR(50)
        """))
        connection.execute(text("""
            UPDATE notifications
            SET type = COALESCE(notification_type, 'general')
            WHERE type IS NULL
        """))
        connection.execute(text("""
            ALTER TABLE notifications
            ALTER COLUMN type SET DEFAULT 'general'
        """))
        connection.execute(text("""
            ALTER TABLE security_alerts
            ALTER COLUMN created_at SET DEFAULT NOW()
        """))
except Exception as milestone3_schema_error:
    print("Milestone 3 schema check:", milestone3_schema_error)

# Older security_alerts tables may have rows whose `resolved` is NULL (no
# default), which hid them from the Security Alerts page. Repair them.
try:
    with engine.begin() as connection:
        connection.execute(text(
            "UPDATE security_alerts SET resolved = FALSE WHERE resolved IS NULL"
        ))
        connection.execute(text(
            "ALTER TABLE security_alerts ALTER COLUMN resolved SET DEFAULT FALSE"
        ))
except Exception as alerts_schema_error:
    print("Security-alerts schema repair:", alerts_schema_error)

# =========================================================
# ENHANCED MILESTONE 1-3 TABLES
# Folders, file versions, integrity hashes and AI metadata.
# =========================================================

try:
    with engine.begin() as connection:
        connection.execute(text("""
            ALTER TABLE files ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64)
        """))
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_files_file_hash ON files(file_hash)
        """))
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS folders (
                id SERIAL PRIMARY KEY,
                owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(owner_id, parent_id, name)
            )
        """))
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_folders_owner_id ON folders(owner_id)
        """))
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS file_versions (
                id SERIAL PRIMARY KEY,
                file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
                version_number INTEGER NOT NULL,
                storage_path VARCHAR(255) NOT NULL,
                size BIGINT NOT NULL,
                file_hash VARCHAR(64),
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(file_id, version_number)
            )
        """))
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id)
        """))
except Exception as enhanced_schema_error:
    print("Enhanced M1-M3 schema check:", enhanced_schema_error)


# =========================================================
# MILESTONE 3 HELPERS
# =========================================================

def _utc_iso(value):
    """Return database timestamps as explicit UTC ISO-8601 strings."""
    if value is None:
        return None
    from datetime import timezone
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat()


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def log_activity(
    db: Session,
    user_id: int | None,
    action: str,
    description: str | None = None,
    file_id: int | None = None,
    ip_address: str | None = None
):
    db.execute(
        text("""
            INSERT INTO activity_logs
                (user_id, file_id, action, description, ip_address)
            VALUES
                (:user_id, :file_id, :action, :description, :ip_address)
        """),
        {
            "user_id": user_id,
            "file_id": file_id,
            "action": action,
            "description": description,
            "ip_address": ip_address
        }
    )


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "general"
):
    db.execute(
        text("""
            INSERT INTO notifications
                (user_id, title, message, notification_type, type)
            VALUES
                (:user_id, :title, :message, :notification_type, :type)
        """),
        {
            "user_id": user_id,
            "title": title,
            "message": message,
            "notification_type": notification_type,
            "type": notification_type
        }
    )


def create_security_alert(
    db: Session,
    user_id: int | None,
    alert_type: str,
    severity: str,
    description: str
):
    # Avoid creating the same unresolved alert repeatedly.
    existing = db.execute(
        text("""
            SELECT id
            FROM security_alerts
            WHERE user_id = :user_id
              AND alert_type = :alert_type
              AND COALESCE(resolved, FALSE) = FALSE
              AND created_at >= NOW() - INTERVAL '1 hour'
            LIMIT 1
        """),
        {"user_id": user_id, "alert_type": alert_type}
    ).first()

    if existing:
        return

    db.execute(
        text("""
            INSERT INTO security_alerts
                (user_id, alert_type, severity, description)
            VALUES
                (:user_id, :alert_type, :severity, :description)
        """),
        {
            "user_id": user_id,
            "alert_type": alert_type,
            "severity": severity,
            "description": description
        }
    )


def run_suspicious_activity_checks(
    db: Session,
    user_id: int
):
    # Simple rule-based checks for Milestone 3.
    download_count = db.execute(
        text("""
            SELECT COUNT(*)
            FROM activity_logs
            WHERE user_id = :user_id
              AND action IN ('DOWNLOAD', 'SHARED_DOWNLOAD')
              AND created_at >= NOW() - INTERVAL '1 hour'
        """),
        {"user_id": user_id}
    ).scalar() or 0

    if download_count >= 5:
        create_security_alert(
            db, user_id,
            "EXCESSIVE_DOWNLOADS",
            "HIGH",
            f"{download_count} downloads were recorded within the last hour."
        )

    share_count = db.execute(
        text("""
            SELECT COUNT(*)
            FROM activity_logs
            WHERE user_id = :user_id
              AND action = 'SHARE_CREATED'
              AND created_at >= NOW() - INTERVAL '1 hour'
        """),
        {"user_id": user_id}
    ).scalar() or 0

    if share_count >= 5:
        create_security_alert(
            db, user_id,
            "EXCESSIVE_SHARING",
            "MEDIUM",
            f"{share_count} file shares were created within the last hour."
        )

    failed_logins = db.execute(
        text("""
            SELECT COUNT(*)
            FROM activity_logs
            WHERE user_id = :user_id
              AND action = 'LOGIN_FAILED'
              AND created_at >= NOW() - INTERVAL '15 minutes'
        """),
        {"user_id": user_id}
    ).scalar() or 0

    if failed_logins >= 3:
        create_security_alert(
            db, user_id,
            "MULTIPLE_LOGIN_FAILURES",
            "HIGH",
            f"{failed_logins} failed login attempts were recorded within 15 minutes."
        )



# =========================================================
# FAILED-LOGIN SECURITY ALERTS
# =========================================================

FAILED_LOGIN_ALERT_THRESHOLD = 3


def _recent_failed_logins(db: Session, user_id: int) -> int:
    return int(db.execute(
        text("""
            SELECT COUNT(*)
            FROM activity_logs
            WHERE user_id = :user_id
              AND action = 'LOGIN_FAILED'
              AND created_at >= NOW() - INTERVAL '15 minutes'
        """),
        {"user_id": user_id}
    ).scalar() or 0)


def record_failed_login_alert(db: Session, user_id: int, ip_address=None):
    """
    Called after every wrong password for an existing account.

    - Always keeps ONE unresolved FAILED_LOGIN alert up to date
      (so the very first wrong password shows up under Security Alerts).
    - Escalates to the HIGH MULTIPLE_LOGIN_FAILURES alert at 3 attempts
      (handled by run_suspicious_activity_checks).
    - Sends the account owner a notification (attempt 1, 3, then every 5th)
      so a stream of guesses cannot flood the notification list.

    Returns the number of failed attempts in the last 15 minutes.
    """
    failed = _recent_failed_logins(db, user_id)

    description = (
        f"Incorrect password entered for your account "
        f"({failed} failed attempt{'s' if failed != 1 else ''} in the last 15 minutes)"
        + (f" from IP {ip_address}." if ip_address else ".")
    )

    existing = db.execute(
        text("""
            SELECT id FROM security_alerts
            WHERE user_id = :user_id
              AND alert_type = 'FAILED_LOGIN'
              AND COALESCE(resolved, FALSE) = FALSE
              AND created_at >= NOW() - INTERVAL '1 hour'
            LIMIT 1
        """),
        {"user_id": user_id}
    ).first()

    # From 3 attempts on, the HIGH "MULTIPLE_LOGIN_FAILURES" alert (created by
    # run_suspicious_activity_checks) takes over, so the LOW alert is not
    # updated any further and no duplicate HIGH alert appears.
    severity = "LOW"

    if failed >= FAILED_LOGIN_ALERT_THRESHOLD:
        pass
    elif existing:
        db.execute(
            text("""
                UPDATE security_alerts
                SET description = :description,
                    severity = :severity,
                    created_at = NOW()
                WHERE id = :id
            """),
            {"description": description, "severity": severity, "id": existing[0]}
        )
    else:
        db.execute(
            text("""
                INSERT INTO security_alerts
                    (user_id, alert_type, severity, description)
                VALUES
                    (:user_id, 'FAILED_LOGIN', :severity, :description)
            """),
            {"user_id": user_id, "severity": severity, "description": description}
        )

    if failed in (1, FAILED_LOGIN_ALERT_THRESHOLD) or (failed > 3 and failed % 5 == 0):
        try:
            # Savepoint: if the notification insert fails, only it is undone;
            # the security alert written above is kept.
            with db.begin_nested():
                create_notification(
                    db, user_id,
                    "Security Alert: Failed Login",
                    f"Someone entered an incorrect password for your account "
                    f"({failed} failed attempt{'s' if failed != 1 else ''} in 15 minutes). "
                    f"If this was not you, change your password.",
                    "security"
                )
        except Exception as notification_error:
            print("Failed-login notification error:", notification_error)

    return failed


def sync_failed_login_alerts(db: Session, user_id: int):
    """
    Make sure the Security Alerts list agrees with the activity log.

    If failed logins were recorded in the last 24 hours but no unresolved
    FAILED_LOGIN / MULTIPLE_LOGIN_FAILURES alert exists (for example the
    failures happened before alerting was added, or an alert write failed),
    create the missing alert. Safe to call repeatedly.
    """
    try:
        failed = _failed_attempts_last_day(db, user_id)

        if failed == 0:
            return

        existing = db.execute(
            text("""
                SELECT 1 FROM security_alerts
                WHERE user_id = :user_id
                  AND alert_type IN ('FAILED_LOGIN', 'MULTIPLE_LOGIN_FAILURES')
                  AND COALESCE(resolved, FALSE) = FALSE
                  AND created_at >= NOW() - INTERVAL '24 hours'
                LIMIT 1
            """),
            {"user_id": user_id}
        ).first()

        if existing:
            return

        if failed >= FAILED_LOGIN_ALERT_THRESHOLD:
            alert_type, severity = "MULTIPLE_LOGIN_FAILURES", "HIGH"
        else:
            alert_type, severity = "FAILED_LOGIN", "LOW"

        db.execute(
            text("""
                INSERT INTO security_alerts
                    (user_id, alert_type, severity, description)
                VALUES
                    (:user_id, :alert_type, :severity, :description)
            """),
            {
                "user_id": user_id,
                "alert_type": alert_type,
                "severity": severity,
                "description": (
                    f"{failed} failed login attempt{'s' if failed != 1 else ''} "
                    f"{'were' if failed != 1 else 'was'} recorded on your account "
                    f"in the last 24 hours."
                )
            }
        )
        db.commit()

    except Exception as sync_error:
        db.rollback()
        print("Failed-login alert sync error:", sync_error)


# =========================================================
# SHARED AUTH HELPER
# =========================================================

def get_authenticated_user(
    authorization: str = Header(None)
) -> dict:

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authentication required."
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization format."
        )

    token = authorization.split(" ", 1)[1]

    user_data = verify_token(token)

    if not user_data:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    return user_data


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():

    return {
        "success": True,
        "message": "TrustShare backend is running."
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
def health():

    return {
        "success": True,
        "status": "healthy",
        "message": "TrustShare API is working."
    }


# =========================================================
# REGISTER
# =========================================================

@app.post("/register")
def register(
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    request: Request = None,
    db: Session = Depends(get_db)
):

    username = username.strip()
    email = email.strip().lower()

    if not username:
        return {
            "success": False,
            "message": "Username is required."
        }

    if not email:
        return {
            "success": False,
            "message": "Email is required."
        }

    # Check existing username.
    # Python username maps to the existing DB column "name".
    existing_username = (
        db.query(User)
        .filter(User.username == username)
        .first()
    )

    if existing_username:
        return {
            "success": False,
            "message": "Username already exists."
        }

    # Check existing email.
    existing_email = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_email:
        return {
            "success": False,
            "message": "Email already registered."
        }

    if len(password) < 6:
        return {
            "success": False,
            "message": "Password must contain at least 6 characters."
        }

    hashed_password = hash_password(password)

    new_user = User(
        username=username,
        email=email,
        password=hashed_password,
        role="USER",
        is_active=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_activity(
        db, new_user.id, "REGISTER",
        "New TrustShare account registered.",
        ip_address=_client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "Registration successful.",
        "user_id": new_user.id,
        "username": new_user.username,
        "email": new_user.email
    }


# =========================================================
# LOGIN
# =========================================================

@app.post("/login")
def login(
    email: str = Form(...),
    password: str = Form(...),
    request: Request = None,
    db: Session = Depends(get_db)
):

    email = email.strip().lower()

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        log_activity(
            db, None, "LOGIN_FAILED",
            "Login attempt for an unknown email address.",
            ip_address=_client_ip(request)
        )
        db.commit()
        return {
            "success": False,
            "message": "Invalid email or password."
        }

    if not user.is_active:
        return {
            "success": False,
            "message": "This account is inactive."
        }

    if not verify_password(password, user.password):
        log_activity(
            db, user.id, "LOGIN_FAILED",
            "Invalid password during login.",
            ip_address=_client_ip(request)
        )
        db.commit()

        failed_attempts = 0
        try:
            failed_attempts = record_failed_login_alert(
                db, user.id, _client_ip(request)
            )
            run_suspicious_activity_checks(db, user.id)
            db.commit()
        except Exception as alert_error:
            db.rollback()
            print("Failed-login alert error:", alert_error)

        if failed_attempts >= FAILED_LOGIN_ALERT_THRESHOLD:
            warning = (
                "Too many failed login attempts. A high-severity security "
                "alert has been raised for this account."
            )
        elif failed_attempts > 0:
            warning = (
                f"Failed attempt {failed_attempts} of "
                f"{FAILED_LOGIN_ALERT_THRESHOLD}. A security alert has been "
                "recorded on this account."
            )
        else:
            warning = None

        return {
            "success": False,
            "message": "Invalid email or password.",
            "security_warning": warning,
            "failed_attempts": failed_attempts
        }

    # -----------------------------------------------------
    # MFA: password is correct, but a second factor is needed.
    # Issue a short-lived challenge token (NOT an access token).
    # -----------------------------------------------------
    if user.mfa_enabled:
        return {
            "success": False,
            "mfa_required": True,
            "mfa_token": create_mfa_token(user.id),
            "message": "Enter the 6-digit code from your authenticator app."
        }

    sync_failed_login_alerts(db, user.id)

    token = create_access_token(
        user.id,
        user.username,
        user.role
    )

    log_activity(
        db, user.id, "LOGIN_SUCCESS",
        "User logged in successfully.",
        ip_address=_client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "Login successful.",
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "mfa_enabled": False,
        "recent_failed_logins": _failed_attempts_last_day(db, user.id)
    }


# =========================================================
# MFA
# =========================================================

def _failed_attempts_last_day(db: Session, user_id: int) -> int:
    """Wrong passwords / wrong MFA codes recorded for this account in 24h."""
    try:
        return int(db.execute(
            text("""
                SELECT COUNT(*)
                FROM activity_logs
                WHERE user_id = :user_id
                  AND action IN ('LOGIN_FAILED', 'MFA_FAILED')
                  AND created_at >= NOW() - INTERVAL '24 hours'
            """),
            {"user_id": user_id}
        ).scalar() or 0)
    except Exception as count_error:
        db.rollback()
        print("Failed-attempt count error:", count_error)
        return 0


MFA_MAX_FAILED_ATTEMPTS = 5
MFA_LOCK_WINDOW_MINUTES = 10


def _mfa_recent_failures(db: Session, user_id: int) -> int:
    row = db.execute(
        text("""
            SELECT COUNT(*) FROM activity_logs
            WHERE user_id = :user_id
              AND action = 'MFA_FAILED'
              AND created_at > :since
        """),
        {
            "user_id": user_id,
            "since": datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
                minutes=MFA_LOCK_WINDOW_MINUTES
            )
        }
    ).scalar()
    return int(row or 0)


def _check_second_factor(user: User, code: str):
    """
    Returns (ok, used_backup_code_updated_json).
    Accepts either a TOTP code or an unused backup code.
    """
    if mfa_utils.verify_totp(user.mfa_secret, code):
        return True, None

    updated = mfa_utils.consume_backup_code(user.mfa_backup_codes, code)

    if updated is not None:
        return True, updated

    return False, None


@app.post("/login/mfa")
def login_mfa(
    mfa_token: str = Form(...),
    code: str = Form(...),
    request: Request = None,
    db: Session = Depends(get_db)
):

    user_id = verify_mfa_token(mfa_token)

    if not user_id:
        return {
            "success": False,
            "mfa_expired": True,
            "message": "Verification expired. Please log in again."
        }

    user = db.query(User).filter(User.id == user_id).first()

    if not user or not user.is_active or not user.mfa_enabled:
        return {
            "success": False,
            "mfa_expired": True,
            "message": "Verification failed. Please log in again."
        }

    if _mfa_recent_failures(db, user.id) >= MFA_MAX_FAILED_ATTEMPTS:
        return {
            "success": False,
            "message": (
                "Too many incorrect codes. "
                f"Try again in {MFA_LOCK_WINDOW_MINUTES} minutes."
            )
        }

    ok, updated_backup = _check_second_factor(user, code)

    if not ok:
        log_activity(
            db, user.id, "MFA_FAILED",
            "Invalid MFA code during login.",
            ip_address=_client_ip(request)
        )
        db.commit()

        try:
            mfa_failures = _mfa_recent_failures(db, user.id)
            if mfa_failures >= FAILED_LOGIN_ALERT_THRESHOLD:
                create_security_alert(
                    db, user.id,
                    "MULTIPLE_MFA_FAILURES",
                    "HIGH",
                    f"{mfa_failures} incorrect MFA codes were entered within "
                    f"{MFA_LOCK_WINDOW_MINUTES} minutes."
                )
                create_notification(
                    db, user.id,
                    "Security Alert: MFA Failures",
                    f"{mfa_failures} incorrect MFA codes were entered for your "
                    "account. If this was not you, change your password.",
                    "security"
                )
            db.commit()
        except Exception as alert_error:
            db.rollback()
            print("MFA alert error:", alert_error)

        return {
            "success": False,
            "message": "Invalid verification code."
        }

    sync_failed_login_alerts(db, user.id)

    description = "User logged in successfully with MFA."

    if updated_backup is not None:
        user.mfa_backup_codes = updated_backup
        description = "User logged in with an MFA backup code."

    token = create_access_token(
        user.id,
        user.username,
        user.role
    )

    log_activity(
        db, user.id, "LOGIN_SUCCESS",
        description,
        ip_address=_client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "Login successful.",
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "mfa_enabled": True,
        "recent_failed_logins": _failed_attempts_last_day(db, user.id),
        "backup_codes_remaining": mfa_utils.remaining_backup_codes(
            user.mfa_backup_codes
        )
    }


def _get_user_or_404(db: Session, user_data: dict) -> User:
    user = db.query(User).filter(User.id == user_data["user_id"]).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    return user


@app.get("/mfa/status")
def mfa_status(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    user = _get_user_or_404(db, user_data)

    return {
        "success": True,
        "mfa_enabled": bool(user.mfa_enabled),
        "backup_codes_remaining": mfa_utils.remaining_backup_codes(
            user.mfa_backup_codes
        )
    }


@app.post("/mfa/setup")
def mfa_setup(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """
    Step 1 of enabling MFA: generate a secret + QR code.
    MFA is NOT active until /mfa/enable confirms a valid code.
    """
    user = _get_user_or_404(db, user_data)

    if user.mfa_enabled:
        raise HTTPException(
            status_code=400,
            detail="MFA is already enabled. Disable it first to reconfigure."
        )

    secret = mfa_utils.generate_secret()
    uri = mfa_utils.provisioning_uri(secret, user.email)

    user.mfa_secret = secret
    db.commit()

    return {
        "success": True,
        "secret": secret,
        "otpauth_uri": uri,
        "qr_code": mfa_utils.qr_data_uri(uri)
    }


@app.post("/mfa/enable")
def mfa_enable(
    code: str = Form(...),
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Step 2: confirm a code from the app, turn MFA on, return backup codes."""
    user = _get_user_or_404(db, user_data)

    if user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled.")

    if not user.mfa_secret:
        raise HTTPException(
            status_code=400,
            detail="Start MFA setup first."
        )

    if not mfa_utils.verify_totp(user.mfa_secret, code):
        return {
            "success": False,
            "message": "Invalid code. Check your authenticator app and try again."
        }

    plain_codes, hashed_json = mfa_utils.generate_backup_codes()

    user.mfa_enabled = True
    user.mfa_backup_codes = hashed_json

    log_activity(
        db, user.id, "MFA_ENABLED",
        "Multi-factor authentication was enabled.",
        ip_address=_client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "MFA enabled.",
        "backup_codes": plain_codes
    }


@app.post("/mfa/disable")
def mfa_disable(
    password: str = Form(...),
    code: str = Form(...),
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Turning MFA off needs BOTH the password and a valid code."""
    user = _get_user_or_404(db, user_data)

    if not user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is not enabled.")

    if _mfa_recent_failures(db, user.id) >= MFA_MAX_FAILED_ATTEMPTS:
        return {
            "success": False,
            "message": (
                "Too many incorrect codes. "
                f"Try again in {MFA_LOCK_WINDOW_MINUTES} minutes."
            )
        }

    if not verify_password(password, user.password):
        return {"success": False, "message": "Incorrect password."}

    ok, _ = _check_second_factor(user, code)

    if not ok:
        log_activity(
            db, user.id, "MFA_FAILED",
            "Invalid MFA code while disabling MFA.",
            ip_address=_client_ip(request)
        )
        db.commit()
        return {"success": False, "message": "Invalid verification code."}

    user.mfa_enabled = False
    user.mfa_secret = None
    user.mfa_backup_codes = None

    log_activity(
        db, user.id, "MFA_DISABLED",
        "Multi-factor authentication was disabled.",
        ip_address=_client_ip(request)
    )
    db.commit()

    return {"success": True, "message": "MFA disabled."}


# =========================================================
# RESET PASSWORD
# =========================================================

@app.post("/reset-password")
def reset_password(
    email: str = Form(...),
    new_password: str = Form(...),
    request: Request = None,
    db: Session = Depends(get_db)
):

    email = email.strip().lower()

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        return {
            "success": False,
            "message": "No account found with this email address."
        }

    if len(new_password) < 6:
        return {
            "success": False,
            "message": "Password must contain at least 6 characters."
        }

    user.password = hash_password(new_password)

    log_activity(
        db, user.id, "PASSWORD_RESET",
        "Password was reset successfully.",
        ip_address=_client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "Password reset successfully. You can now login with your new password."
    }


# =========================================================
# CURRENT USER
# =========================================================

@app.get("/me")
def get_current_user(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    user = (
        db.query(User)
        .filter(User.id == user_data["user_id"])
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    return {
        "success": True,
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "mfa_enabled": bool(user.mfa_enabled)
    }


# =========================================================
# GET USER FILES
# =========================================================

@app.get("/files/{user_id}")
def get_files(
    user_id: int,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    if user_data["user_id"] != user_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    files = (
        db.query(DBFile)
        .filter(
            DBFile.user_id == user_id,
            DBFile.is_deleted == False
        )
        .all()
    )

    return [
        {
            "id": file.id,
            "filename": file.filename,
            "content_type": file.content_type,
            "size": file.size,
            "category": file.category,
            "is_encrypted": file.is_encrypted,
            "file_hash": getattr(file, "file_hash", None),
            "folder_id": file.folder_id,
            "created_at": (
                file.created_at.isoformat()
                if file.created_at
                else None
            )
        }
        for file in files
    ]


# =========================================================
# UPLOAD FILE
# Milestone 2: Secure File Encryption
# =========================================================

@app.post("/upload")
async def upload_file(
    user_id: int = Form(...),
    file: UploadFile = FastAPIFile(...),
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    if user_data["user_id"] != user_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Please select a file."
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="The selected file is empty."
        )

    # =====================================================
    # FILE METADATA
    # =====================================================

    extension = ""

    if "." in file.filename:
        extension = "." + file.filename.rsplit(".", 1)[-1]

    category = (
        file.filename.rsplit(".", 1)[-1].lower()
        if "." in file.filename
        else "other"
    )

    stored_key = str(uuid.uuid4()) + extension

    file_size = len(content)

    # =====================================================
    # ENCRYPTION
    # =====================================================

    # Generate a unique 256-bit key for this file.
    data_key = generate_data_key()

    # Encrypt file using AES-256-GCM.
    ciphertext, nonce_b64 = encrypt_file_bytes(
        content,
        data_key
    )

    # Encrypt/wrap the file key using the master key.
    wrapped_key = wrap_key(data_key)

    # =====================================================
    # STORAGE
    # =====================================================

    location = storage.save(
        stored_key,
        ciphertext
    )

    # =====================================================
    # CONTENT TYPE
    # =====================================================

    content_type = file.content_type

    if (
        not content_type
        or content_type == "application/octet-stream"
    ):
        guessed_type, _ = mimetypes.guess_type(
            file.filename
        )

        content_type = (
            guessed_type
            or "application/octet-stream"
        )

    # =====================================================
    # DATABASE RECORD
    # =====================================================

    new_file = DBFile(
        filename=file.filename,
        stored_filename=location,
        content_type=content_type,
        user_id=user_id,
        size=file_size,
        category=category,
        is_deleted=False,
        is_encrypted=True,
        encryption_key=wrapped_key,
        encryption_nonce=nonce_b64
    )

    db.add(new_file)
    db.commit()
    db.refresh(new_file)

    # Store a SHA-256 integrity hash of the original plaintext.
    file_hash = hashlib.sha256(content).hexdigest()
    db.execute(text("UPDATE files SET file_hash=:hash WHERE id=:fid"), {"hash": file_hash, "fid": new_file.id})
    db.commit()

    log_activity(
        db, user_data["user_id"], "UPLOAD",
        f"Uploaded file {new_file.filename}.",
        new_file.id, _client_ip(request)
    )
    create_notification(
        db, user_data["user_id"],
        "File Uploaded",
        f"{new_file.filename} was uploaded and encrypted successfully.",
        "file_uploaded"
    )
    db.commit()

    return {
        "success": True,
        "message": "File uploaded and encrypted successfully.",
        "file_id": new_file.id,
        "filename": new_file.filename,
        "size": new_file.size,
        "category": new_file.category,
        "is_encrypted": new_file.is_encrypted
    }


# =========================================================
# DOWNLOAD FILE
# Milestone 2: Decrypt Before Serving
# =========================================================

@app.get("/download/{file_id}")
def download_file(
    file_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == file_id,
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    if file.user_id != user_data["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    plaintext = _load_and_decrypt(file)

    log_activity(
        db, user_data["user_id"], "DOWNLOAD",
        f"Downloaded file {file.filename}.",
        file.id, _client_ip(request)
    )
    db.commit()
    run_suspicious_activity_checks(db, user_data["user_id"])
    db.commit()

    return Response(
        content=plaintext,
        media_type=_resolve_content_type(file),
        headers={
            "Content-Disposition":
                f'attachment; filename="{file.filename}"'
        }
    )


# =========================================================
# FILE PREVIEW - XLSX / PPT / PPTX
# View only. Download behavior is unchanged.
# =========================================================

def _preview_html_escape(value):
    return html.escape("" if value is None else str(value))


def _build_xlsx_preview(content: bytes, filename: str) -> str:
    from openpyxl import load_workbook
    from io import BytesIO

    workbook = load_workbook(BytesIO(content), read_only=True, data_only=True)
    sections = []

    for worksheet in workbook.worksheets:
        rows_html = []
        for row in worksheet.iter_rows(values_only=True):
            values = list(row)
            if not any(value is not None for value in values):
                continue
            cells = "".join(
                f"<td>{_preview_html_escape(value)}</td>"
                for value in values
            )
            rows_html.append(f"<tr>{cells}</tr>")

        if rows_html:
            sections.append(
                f"<section><h2>{_preview_html_escape(worksheet.title)}</h2>"
                f"<div class='table-wrap'><table><tbody>{''.join(rows_html)}</tbody></table></div></section>"
            )
        else:
            sections.append(
                f"<section><h2>{_preview_html_escape(worksheet.title)}</h2>"
                f"<p class='empty'>This worksheet is empty.</p></section>"
            )

    workbook.close()
    return "".join(sections) or "<p class='empty'>No worksheet data found.</p>"


def _build_pptx_preview(content: bytes, filename: str) -> str:
    from pptx import Presentation
    from io import BytesIO

    presentation = Presentation(BytesIO(content))
    sections = []

    for index, slide in enumerate(presentation.slides, start=1):
        texts = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text:
                text_value = shape.text.strip()
                if text_value:
                    texts.append(
                        f"<div class='slide-text'>{_preview_html_escape(text_value)}</div>"
                    )

        body = "".join(texts) or "<div class='empty'>No readable text on this slide.</div>"
        sections.append(
            f"<section class='slide'><div class='slide-number'>Slide {index}</div>{body}</section>"
        )

    return "".join(sections) or "<p class='empty'>No slides found.</p>"


def _build_office_preview(content: bytes, filename: str) -> str:
    ext = os.path.splitext(filename.lower())[1]

    if ext == ".xlsx":
        return _build_xlsx_preview(content, filename)

    if ext == ".pptx":
        return _build_pptx_preview(content, filename)

    if ext == ".ppt":
        # python-pptx reads PPTX, not legacy PPT. Convert only for viewing.
        with tempfile.TemporaryDirectory() as temp_dir:
            source_path = os.path.join(temp_dir, filename)
            Path(source_path).write_bytes(content)

            soffice = shutil.which("libreoffice") or shutil.which("soffice")
            if not soffice:
                raise HTTPException(
                    status_code=500,
                    detail="Legacy .ppt preview requires LibreOffice on the server."
                )

            result = subprocess.run(
                [soffice, "--headless", "--convert-to", "pptx", "--outdir", temp_dir, source_path],
                capture_output=True,
                text=True,
                timeout=60
            )

            converted_path = os.path.join(
                temp_dir,
                os.path.splitext(os.path.basename(filename))[0] + ".pptx"
            )

            if result.returncode != 0 or not os.path.exists(converted_path):
                raise HTTPException(
                    status_code=500,
                    detail="Unable to convert the PPT file for preview."
                )

            return _build_pptx_preview(
                Path(converted_path).read_bytes(),
                os.path.basename(converted_path)
            )

    raise HTTPException(
        status_code=400,
        detail="Preview is supported only for XLSX, PPT and PPTX files."
    )


def _preview_document_html(filename: str, body_html: str) -> str:
    safe_name = _preview_html_escape(filename)
    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{safe_name} - TrustShare Preview</title>
<style>
body {{ margin:0; background:#f4f7fb; color:#172033; font-family:Inter,Segoe UI,Arial,sans-serif; }}
.preview-header {{ position:sticky; top:0; z-index:10; padding:18px 24px; background:#fff; border-bottom:1px solid #dfe5ee; box-shadow:0 2px 10px rgba(0,0,0,.06); }}
.preview-header h1 {{ margin:0; font-size:20px; }}
.preview-header p {{ margin:5px 0 0; color:#718096; font-size:13px; }}
.preview-body {{ max-width:1200px; margin:24px auto; padding:0 18px 40px; }}
section {{ background:#fff; border:1px solid #dfe5ee; border-radius:14px; padding:18px; margin-bottom:18px; box-shadow:0 4px 14px rgba(30,50,80,.05); }}
h2 {{ margin:0 0 14px; font-size:18px; }}
.table-wrap {{ overflow:auto; max-height:75vh; }}
table {{ width:100%; border-collapse:collapse; min-width:600px; }}
td {{ border:1px solid #dfe5ee; padding:9px 11px; vertical-align:top; white-space:pre-wrap; }}
.slide {{ min-height:220px; }}
.slide-number {{ font-weight:700; margin-bottom:14px; color:#5b3bb8; }}
.slide-text {{ white-space:pre-wrap; line-height:1.6; padding:10px 0; font-size:16px; }}
.empty {{ color:#718096; }}
</style>
</head>
<body>
<header class="preview-header"><h1>TrustShare Preview</h1><p>{safe_name}</p></header>
<main class="preview-body">{body_html}</main>
</body>
</html>"""


def _public_viewer_response(file: DBFile, share: Share, plaintext: bytes) -> Response:
    """Return a consistent TrustShare viewer for a public VIEW link."""
    safe_name = _preview_html_escape(file.filename)
    content_type = mimetypes.guess_type(file.filename)[0] or _resolve_content_type(file) or "application/octet-stream"
    ext = os.path.splitext(file.filename.lower())[1]

    # Text-like files can be rendered directly without another request.
    if content_type.startswith("text/") or ext in {".json", ".csv", ".log", ".md", ".py", ".js", ".jsx", ".css", ".html"}:
        try:
            text_content = plaintext.decode("utf-8", errors="replace")
        except Exception:
            text_content = "Unable to decode this file as text."
        body = f"<pre class='text-preview'>{_preview_html_escape(text_content)}</pre>"
    elif content_type.startswith("image/"):
        import base64
        data_uri = "data:" + content_type + ";base64," + base64.b64encode(plaintext).decode("ascii")
        body = f"<div class='media-wrap'><img src='{data_uri}' alt='{safe_name}' /></div>"
    elif content_type == "application/pdf":
        import base64
        data_uri = "data:application/pdf;base64," + base64.b64encode(plaintext).decode("ascii")
        body = f"<iframe class='pdf-preview' src='{data_uri}' title='{safe_name}'></iframe>"
    elif content_type.startswith("video/"):
        import base64
        data_uri = "data:" + content_type + ";base64," + base64.b64encode(plaintext).decode("ascii")
        body = f"<video class='media-player' controls src='{data_uri}'></video>"
    elif content_type.startswith("audio/"):
        import base64
        data_uri = "data:" + content_type + ";base64," + base64.b64encode(plaintext).decode("ascii")
        body = f"<audio class='audio-player' controls src='{data_uri}'></audio>"
    else:
        body = "<div class='unsupported'><strong>Preview is not available for this file type.</strong><p>This secure link has View permission, so downloading is not allowed.</p></div>"

    expires = share.expires_at.isoformat() if share.expires_at else ""
    html_doc = f"""<!doctype html>
<html>
<head>
<meta charset='utf-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<title>{safe_name} - TrustShare View</title>
<style>
*{{box-sizing:border-box}} body{{margin:0;background:#f4f7fb;color:#172033;font-family:Inter,Segoe UI,Arial,sans-serif}}
.header{{position:sticky;top:0;z-index:10;background:#fff;border-bottom:1px solid #dfe5ee;padding:16px 22px;box-shadow:0 2px 10px rgba(0,0,0,.06)}}
.brand{{font-size:18px;font-weight:800;color:#6d35e8}} .name{{margin-top:5px;font-size:14px;color:#5d6b82;word-break:break-word}}
.badge{{display:inline-block;margin-top:8px;padding:5px 10px;border-radius:999px;background:#efe7ff;color:#6231d7;font-size:12px;font-weight:700}}
.body{{max-width:1200px;margin:24px auto;padding:0 18px 40px}} .viewer{{background:#fff;border:1px solid #dfe5ee;border-radius:16px;min-height:70vh;padding:18px;box-shadow:0 8px 25px rgba(30,50,80,.07)}}
.pdf-preview{{width:100%;height:75vh;border:0;border-radius:10px;background:#fff}} .media-wrap{{display:flex;justify-content:center;align-items:center;min-height:65vh;background:#f8fafc;border-radius:10px;padding:20px}}
.media-wrap img{{max-width:100%;max-height:70vh;object-fit:contain}} .media-player{{display:block;width:100%;max-height:75vh;margin:auto}} .audio-player{{display:block;width:min(700px,100%);margin:120px auto}}
.text-preview{{white-space:pre-wrap;overflow:auto;max-height:75vh;background:#0f172a;color:#e5e7eb;border-radius:10px;padding:20px;line-height:1.55}}
.unsupported{{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:55vh;text-align:center;color:#5d6b82}}
</style></head>
<body><header class='header'><div class='brand'>TrustShare</div><div class='name'>{safe_name}</div><span class='badge'>View Only</span></header>
<main class='body'><div class='viewer'>{body}</div></main></body></html>"""
    return Response(content=html_doc, media_type="text/html", headers={"Content-Disposition": "inline"})


def _preview_response(file: DBFile, plaintext: bytes) -> Response:
    body_html = _build_office_preview(plaintext, file.filename)
    return Response(
        content=_preview_document_html(file.filename, body_html),
        media_type="text/html",
        headers={"Content-Disposition": "inline"}
    )


@app.get("/preview/{file_id}")
def preview_file(
    file_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == file_id,
            DBFile.user_id == user_data["user_id"],
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(status_code=404, detail="File not found.")

    extension = os.path.splitext(file.filename.lower())[1]
    if extension not in {".xlsx", ".ppt", ".pptx"}:
        raise HTTPException(
            status_code=400,
            detail="Preview is supported only for XLSX, PPT and PPTX files."
        )

    plaintext = _load_and_decrypt(file)

    log_activity(
        db,
        user_data["user_id"],
        "VIEW",
        f"Viewed file {file.filename}.",
        file.id,
        _client_ip(request)
    )
    db.commit()

    return _preview_response(file, plaintext)


# =========================================================
# DELETE FILE
# =========================================================

@app.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == file_id,
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    if file.user_id != user_data["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    # Milestone 1 enhancement: soft-delete first so the file can be restored.
    filename_for_log = file.filename
    file.is_deleted = True
    log_activity(
        db, user_data["user_id"], "DELETE",
        f"Moved file {filename_for_log} to the recycle bin.",
        file_id, _client_ip(request)
    )
    create_notification(
        db, user_data["user_id"],
        "File Moved to Recycle Bin",
        f"\"{filename_for_log}\" can be restored from the Recycle Bin.",
        "file_deleted"
    )
    db.commit()

    return {
        "success": True,
        "message": "File moved to the Recycle Bin."
    }


# =========================================================
# CREATE SHARE LINK
# Milestone 2:
# Secure Sharing + Permission Management
# =========================================================

@app.post("/files/{file_id}/share")
def create_share(
    file_id: int,
    permission: str = Form("download"),
    expires_in_hours: int = Form(24),
    max_downloads: int = Form(None),
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == file_id,
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    if file.user_id != user_data["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    share, raw_token = sharing_create_share(
        db=db,
        file=file,
        user_id=user_data["user_id"],
        permission=permission,
        expires_in_hours=expires_in_hours,
        max_downloads=max_downloads
    )

    log_activity(
        db, user_data["user_id"], "SHARE_CREATED",
        f"Created a {permission} share link for {file.filename}.",
        file.id, _client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "Share link created. Save this token now -- it will not be shown again.",
        "share_id": share.id,
        "share_token": raw_token,
        "share_url": f"/share/{raw_token}",
        "permission": share.permission,
        "expires_at": share.expires_at.isoformat()
    }


# =========================================================
# PUBLIC SECURE SHARE LINK INFORMATION
# =========================================================

@app.get("/share/{token}/info")
def get_public_share_info(
    token: str,
    db: Session = Depends(get_db)
):
    share = get_valid_share(db, token)

    file = (
        db.query(DBFile)
        .filter(DBFile.id == share.file_id, DBFile.is_deleted == False)
        .first()
    )

    if not file:
        raise HTTPException(status_code=404, detail="The shared file no longer exists.")

    return {
        "success": True,
        "filename": file.filename,
        "permission": share.permission,
        "expires_at": share.expires_at.isoformat() if share.expires_at else None,
        "max_downloads": share.max_downloads,
        "download_count": share.download_count
    }


# =========================================================
# LIST SHARE LINKS
# Milestone 2: Permission Management
# =========================================================

@app.get("/files/{file_id}/shares")
def list_shares(
    file_id: int,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == file_id,
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    if file.user_id != user_data["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    shares = (
        db.query(Share)
        .filter(Share.file_id == file_id)
        .all()
    )

    return [
        {
            "id": share.id,
            "permission": share.permission,
            "expires_at": share.expires_at.isoformat(),
            "revoked": share.revoked,
            "download_count": share.download_count,
            "max_downloads": share.max_downloads
        }
        for share in shares
    ]


# =========================================================
# REVOKE SHARE LINK
# Milestone 2: Permission Management
# =========================================================

@app.delete("/shares/{share_id}")
def revoke_share(
    share_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):

    share = (
        db.query(Share)
        .filter(Share.id == share_id)
        .first()
    )

    if not share:
        raise HTTPException(
            status_code=404,
            detail="Share link not found."
        )

    sharing_revoke_share(
        db=db,
        share=share,
        user_id=user_data["user_id"]
    )

    log_activity(
        db, user_data["user_id"], "SHARE_REVOKED",
        f"Revoked share {share_id}.",
        share.file_id, _client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "Share link revoked."
    }



# =========================================================
# ACCOUNT-TO-ACCOUNT SHARING
# Milestone 2: Share directly with another TrustShare user
# =========================================================

@app.post("/files/{file_id}/share-account")
def share_file_with_account(
    file_id: int,
    recipient: str = Form(...),
    permission: str = Form("view"),
    expires_in_hours: int = Form(24),
    max_downloads: int = Form(None),
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    recipient = recipient.strip()

    if not recipient:
        raise HTTPException(
            status_code=400,
            detail="Recipient email or username is required."
        )

    if permission not in ("view", "download"):
        raise HTTPException(
            status_code=400,
            detail="Permission must be view or download."
        )

    if expires_in_hours <= 0:
        raise HTTPException(
            status_code=400,
            detail="Expiry must be greater than 0 hours."
        )

    if max_downloads is not None and max_downloads <= 0:
        raise HTTPException(
            status_code=400,
            detail="Maximum downloads must be greater than 0."
        )

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == file_id,
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    if file.user_id != user_data["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    sender = (
        db.query(User)
        .filter(User.id == user_data["user_id"])
        .first()
    )

    recipient_user = (
        db.query(User)
        .filter(
            (User.email == recipient.lower()) |
            (User.username == recipient)
        )
        .first()
    )

    if not recipient_user:
        raise HTTPException(
            status_code=404,
            detail="TrustShare account not found."
        )

    if recipient_user.id == sender.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot share a file with yourself."
        )

    # Reuse the existing secure share creation logic for token,
    # permission, expiry and download-limit handling.
    share, raw_token = sharing_create_share(
        db=db,
        file=file,
        user_id=user_data["user_id"],
        permission=permission,
        expires_in_hours=expires_in_hours,
        max_downloads=max_downloads
    )

    # Store the recipient account directly on the share record.
    db.execute(
        text(
            "UPDATE shares "
            "SET recipient_id = :recipient_id "
            "WHERE id = :share_id"
        ),
        {
            "recipient_id": recipient_user.id,
            "share_id": share.id
        }
    )
    log_activity(
        db, user_data["user_id"], "SHARE_CREATED",
        f"Shared {file.filename} with {recipient_user.username} ({permission}).",
        file.id, _client_ip(request)
    )
    create_notification(
        db, recipient_user.id,
        "New File Shared",
        f"{sender.username} shared {file.filename} with you. Permission: {permission}.",
        "file_shared"
    )
    db.commit()
    db.refresh(share)

    return {
        "success": True,
        "message": f"File shared successfully with {recipient_user.username}.",
        "share_id": share.id,
        "recipient_id": recipient_user.id,
        "recipient_username": recipient_user.username,
        "recipient_email": recipient_user.email,
        "permission": share.permission,
        "expires_at": (
            _utc_iso(share.expires_at)
        ),
        # The raw token is deliberately not needed by the frontend.
        # The recipient accesses the file from Shared With Me.
    }


@app.get("/shared-with-me")
def get_shared_with_me(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    current_user_id = user_data["user_id"]

    rows = db.execute(
        text(
            """
            SELECT
                s.id AS share_id,
                s.permission,
                s.expires_at,
                s.max_downloads,
                s.download_count,
                s.revoked,
                s.created_at,
                f.id AS file_id,
                f.filename,
                f.content_type,
                f.size,
                f.category,
                f.created_at AS file_created_at,
                u.id AS owner_id,
                u.name AS owner_username,
                u.email AS owner_email
            FROM shares s
            JOIN files f ON f.id = s.file_id
            JOIN users u ON u.id = s.created_by
            WHERE s.recipient_id = :user_id
              AND f.is_deleted = FALSE
            ORDER BY s.created_at DESC
            """
        ),
        {"user_id": current_user_id}
    ).mappings().all()

    return [
        {
            "share_id": row["share_id"],
            "file_id": row["file_id"],
            "filename": row["filename"],
            "content_type": row["content_type"],
            "size": row["size"],
            "category": row["category"],
            "permission": row["permission"],
            "expires_at": (
                row["expires_at"].isoformat()
                if row["expires_at"]
                else None
            ),
            "max_downloads": row["max_downloads"],
            "download_count": row["download_count"],
            "revoked": row["revoked"],
            "created_at": (
                row["created_at"].isoformat()
                if row["created_at"]
                else None
            ),
            "owner": {
                "user_id": row["owner_id"],
                "username": row["owner_username"],
                "email": row["owner_email"],
            }
        }
        for row in rows
    ]


@app.get("/shared-with-me/{share_id}")
def access_account_shared_file(
    share_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    row = db.execute(
        text(
            """
            SELECT id, file_id, permission, expires_at,
                   max_downloads, download_count, revoked,
                   recipient_id, created_by
            FROM shares
            WHERE id = :share_id
              AND recipient_id = :recipient_id
            """
        ),
        {
            "share_id": share_id,
            "recipient_id": user_data["user_id"]
        }
    ).mappings().first()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Shared file not found."
        )

    if row["revoked"]:
        raise HTTPException(
            status_code=403,
            detail="This share has been revoked."
        )

    if row["expires_at"] is not None:
        from datetime import datetime, timezone
        expires_at = row["expires_at"]
        now = datetime.now(timezone.utc)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at <= now:
            raise HTTPException(
                status_code=403,
                detail="This shared access has expired."
            )

    if (
        row["max_downloads"] is not None
        and row["download_count"] >= row["max_downloads"]
    ):
        raise HTTPException(
            status_code=403,
            detail="The maximum download limit has been reached."
        )

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == row["file_id"],
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="The shared file no longer exists."
        )

    # Decrypt first. The download counter is updated only after
    # the encrypted file has been successfully recovered.
    plaintext = _load_and_decrypt(file)

    access_action = (
        "SHARED_DOWNLOAD"
        if row["permission"] == "download"
        else "VIEW"
    )

    if row["permission"] == "download":
        db.execute(
            text(
                """
                UPDATE shares
                SET download_count = download_count + 1
                WHERE id = :share_id
                """
            ),
            {"share_id": share_id}
        )

    log_activity(
        db,
        user_data["user_id"],
        access_action,
        f"Accessed shared file {file.filename}.",
        file.id,
        _client_ip(request)
    )

    # Notification is useful for Milestone 3, but a notification
    # failure must never prevent the recipient from downloading
    # the already-decrypted file.
    try:
        access_word = (
            "downloaded"
            if row["permission"] == "download"
            else "viewed"
        )

        create_notification(
            db,
            row["created_by"],
            "Shared File Accessed",
            f"{file.filename} was {access_word} by a shared recipient.",
            "file_accessed"
        )
    except Exception as notification_error:
        print("Shared-file notification error:", notification_error)

    try:
        run_suspicious_activity_checks(
            db,
            user_data["user_id"]
        )
    except Exception as security_error:
        print("Security check error:", security_error)

    db.commit()

    disposition = (
        "attachment"
        if row["permission"] == "download"
        else "inline"
    )

    return Response(
        content=plaintext,
        media_type=_resolve_content_type(file),
        headers={
            "Content-Disposition":
                f'{disposition}; filename="{file.filename}"'
        }
    )


@app.get("/shared-with-me/{share_id}/preview")
def preview_account_shared_file(
    share_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    row = db.execute(
        text("""
            SELECT id, file_id, permission, expires_at,
                   max_downloads, download_count, revoked,
                   recipient_id, created_by
            FROM shares
            WHERE id = :share_id
              AND recipient_id = :recipient_id
        """),
        {"share_id": share_id, "recipient_id": user_data["user_id"]}
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Shared file not found.")
    if row["revoked"]:
        raise HTTPException(status_code=403, detail="This share has been revoked.")

    if row["expires_at"] is not None:
        expires_at = row["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=403, detail="This shared access has expired.")

    file = db.query(DBFile).filter(
        DBFile.id == row["file_id"],
        DBFile.is_deleted == False
    ).first()
    if not file:
        raise HTTPException(status_code=404, detail="The shared file no longer exists.")

    extension = os.path.splitext(file.filename.lower())[1]
    if extension not in {".xlsx", ".ppt", ".pptx"}:
        raise HTTPException(status_code=400, detail="Preview is supported only for XLSX, PPT and PPTX files.")

    plaintext = _load_and_decrypt(file)

    log_activity(
        db,
        user_data["user_id"],
        "VIEW",
        f"Viewed shared file {file.filename}.",
        file.id,
        _client_ip(request)
    )
    db.commit()

    return _preview_response(file, plaintext)


@app.delete("/shared-with-me/{share_id}")
def remove_shared_access(
    share_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    result = db.execute(
        text(
            """
            DELETE FROM shares
            WHERE id = :share_id
              AND recipient_id = :recipient_id
            """
        ),
        {
            "share_id": share_id,
            "recipient_id": user_data["user_id"]
        }
    )

    db.commit()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Shared access not found."
        )

    log_activity(
        db, user_data["user_id"], "SHARED_ACCESS_REMOVED",
        f"Removed shared access {share_id} from Shared With Me.",
        None, _client_ip(request)
    )
    db.commit()

    return {
        "success": True,
        "message": "Shared file removed from your list."
    }



# =========================================================
# SENT FILES
# =========================================================

@app.get("/sent-files")
def get_sent_files(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Return files the logged-in TrustShare user shared with other accounts."""
    current_user_id = user_data["user_id"]

    rows = db.execute(
        text("""
            SELECT
                s.id AS share_id,
                s.file_id,
                s.permission,
                s.expires_at,
                s.max_downloads,
                s.download_count,
                s.revoked,
                s.created_at,
                f.filename,
                f.content_type,
                f.size,
                f.category,
                r.id AS recipient_id,
                r.name AS recipient_username,
                r.email AS recipient_email
            FROM shares s
            JOIN files f ON f.id = s.file_id
            JOIN users r ON r.id = s.recipient_id
            WHERE s.created_by = :user_id
              AND s.recipient_id IS NOT NULL
              AND COALESCE(f.is_deleted, FALSE) = FALSE
            ORDER BY s.created_at DESC
        """),
        {"user_id": current_user_id}
    ).mappings().all()

    return [
        {
            "share_id": row["share_id"],
            "file_id": row["file_id"],
            "filename": row["filename"],
            "content_type": row["content_type"],
            "size": row["size"],
            "category": row["category"],
            "permission": row["permission"],
            "expires_at": _utc_iso(row["expires_at"]),
            "max_downloads": row["max_downloads"],
            "download_count": row["download_count"],
            "revoked": bool(row["revoked"]),
            "created_at": _utc_iso(row["created_at"]),
            "recipient": {
                "id": row["recipient_id"],
                "username": row["recipient_username"],
                "email": row["recipient_email"]
            }
        }
        for row in rows
    ]


# =========================================================
# MILESTONE 3 APIs
# =========================================================

@app.get("/activity")
def get_activity(
    limit: int = 50,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    limit = max(1, min(limit, 200))
    rows = db.execute(
        text("""
            SELECT
                a.id, a.action, a.description, a.ip_address, a.created_at,
                a.file_id, f.filename
            FROM activity_logs a
            LEFT JOIN files f ON f.id = a.file_id
            WHERE a.user_id = :user_id
            ORDER BY a.created_at DESC
            LIMIT :limit
        """),
        {"user_id": user_data["user_id"], "limit": limit}
    ).mappings().all()

    return [
        {
            "id": row["id"],
            "action": row["action"],
            "description": row["description"],
            "ip_address": row["ip_address"],
            "file_id": row["file_id"],
            "filename": row["filename"],
            "created_at": _utc_iso(row["created_at"])
        }
        for row in rows
    ]


@app.get("/notifications")
def get_notifications(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    rows = db.execute(
        text("""
            SELECT id, title, message, notification_type, is_read, created_at
            FROM notifications
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT 100
        """),
        {"user_id": user_data["user_id"]}
    ).mappings().all()

    return [
        {
            "id": row["id"],
            "title": row["title"],
            "message": row["message"],
            "notification_type": row["notification_type"],
            "is_read": row["is_read"],
            "created_at": _utc_iso(row["created_at"])
        }
        for row in rows
    ]


@app.put("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    result = db.execute(
        text("""
            UPDATE notifications
            SET is_read = TRUE
            WHERE id = :notification_id
              AND user_id = :user_id
        """),
        {"notification_id": notification_id, "user_id": user_data["user_id"]}
    )
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found.")

    return {"success": True, "message": "Notification marked as read."}


@app.put("/notifications/read-all")
def mark_all_notifications_read(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    db.execute(
        text("""
            UPDATE notifications
            SET is_read = TRUE
            WHERE user_id = :user_id
              AND is_read = FALSE
        """),
        {"user_id": user_data["user_id"]}
    )
    db.commit()
    return {"success": True, "message": "All notifications marked as read."}


@app.get("/security-alerts")
def get_security_alerts(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Return current unresolved security alerts for the logged-in user.

    Suspicious-activity checks are triggered by the relevant account/file
    events themselves (for example failed login, download and share).
    The only thing done here is a consistency check that creates a missing
    failed-login alert when the activity log shows failures (see
    sync_failed_login_alerts); refreshing never creates duplicates. There is intentionally no resolve endpoint because
    resolving an alert can immediately satisfy the detection rule again
    and create a new alert.
    """
    sync_failed_login_alerts(db, user_data["user_id"])

    rows = db.execute(
        text("""
            SELECT id, alert_type, severity, description, created_at
            FROM security_alerts
            WHERE user_id = :user_id
              AND COALESCE(resolved, FALSE) = FALSE
            ORDER BY created_at DESC
            LIMIT 100
        """),
        {"user_id": user_data["user_id"]}
    ).mappings().all()

    return [
        {
            "id": row["id"],
            "alert_type": row["alert_type"],
            "severity": row["severity"],
            "description": row["description"],
            "created_at": _utc_iso(row["created_at"]),
            "resolved": False
        }
        for row in rows
    ]


@app.get("/analytics")
def get_analytics(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Return live Milestone 3 statistics for the logged-in user.

    File access statistics are based on the user's files, so downloads/views
    performed by a recipient are also reflected in the owner's dashboard.
    """
    user_id = user_data["user_id"]

    # Count all active files available to the user:
    # 1. Files uploaded by the current user.
    # 2. Files shared with the current user's TrustShare account.
    # A file shared more than once must still count as ONE file.
    # Keep the shared-file rules consistent with /shared-with-me.
    total_files = db.execute(
        text("""
            SELECT COUNT(*)
            FROM (
                SELECT f.id
                FROM files f
                WHERE f.owner_id = :user_id
                  AND f.is_deleted = FALSE

                UNION

                SELECT s.file_id
                FROM shares s
                JOIN files f2 ON f2.id = s.file_id
                WHERE s.recipient_id = :user_id
                  AND f2.is_deleted = FALSE
            ) visible_files
        """),
        {"user_id": user_id}
    ).scalar() or 0

    # Count unique files that the user has shared directly with another
    # TrustShare account. This is a historical sharing metric, so an expired
    # temporary share is still counted as a file that was shared.
    # Public-link shares are excluded by requiring recipient_id.
    total_shared = db.execute(
        text("""
            SELECT COUNT(DISTINCT s.file_id)
            FROM shares s
            JOIN files f ON f.id = s.file_id
            WHERE s.created_by = :user_id
              AND s.recipient_id IS NOT NULL
              AND f.is_deleted = FALSE
        """),
        {"user_id": user_id}
    ).scalar() or 0

    total_downloads = db.execute(
        text("""
            SELECT COUNT(*)
            FROM activity_logs a
            LEFT JOIN files f ON f.id = a.file_id
            WHERE (
                    a.user_id = :user_id
                    OR f.owner_id = :user_id
                  )
              AND a.action IN ('DOWNLOAD', 'SHARED_DOWNLOAD')
        """),
        {"user_id": user_id}
    ).scalar() or 0

    total_views = db.execute(
        text("""
            SELECT COUNT(*)
            FROM activity_logs a
            LEFT JOIN files f ON f.id = a.file_id
            WHERE a.user_id = :user_id
              AND a.action = 'VIEW'
        """),
        {"user_id": user_id}
    ).scalar() or 0

    unread_notifications = db.execute(
        text("""
            SELECT COUNT(*)
            FROM notifications
            WHERE user_id = :user_id
              AND is_read = FALSE
        """),
        {"user_id": user_id}
    ).scalar() or 0

    active_alerts = db.execute(
        text("""
            SELECT COUNT(*)
            FROM security_alerts
            WHERE user_id = :user_id
              AND COALESCE(resolved, FALSE) = FALSE
        """),
        {"user_id": user_id}
    ).scalar() or 0

    storage_bytes = db.execute(
        text("""
            SELECT COALESCE(SUM(size), 0)
            FROM files
            WHERE owner_id = :user_id
              AND is_deleted = FALSE
        """),
        {"user_id": user_id}
    ).scalar() or 0

    return {
        "total_files": int(total_files),
        "total_shared": int(total_shared),
        "total_downloads": int(total_downloads),
        "total_views": int(total_views),
        "unread_notifications": int(unread_notifications),
        "security_alerts": int(active_alerts),
        "storage_bytes": int(storage_bytes)
    }


@app.get("/security-check")
def security_check(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    run_suspicious_activity_checks(db, user_data["user_id"])
    db.commit()
    alert_count = db.execute(
        text("""
            SELECT COUNT(*) FROM security_alerts
            WHERE user_id = :user_id AND COALESCE(resolved, FALSE) = FALSE
        """),
        {"user_id": user_data["user_id"]}
    ).scalar() or 0

    return {
        "success": True,
        "security_alerts": alert_count,
        "status": "attention_required" if alert_count else "normal"
    }


# =========================================================
# ACCESS SHARED FILE
# Milestone 2: Temporary Access
#
# This endpoint does NOT require login.
# The share token acts as the access credential.
# =========================================================

@app.get("/share/{token}")
def access_shared_file(
    token: str,
    request: Request = None,
    db: Session = Depends(get_db)
):

    # Validate:
    # - token
    # - expiration
    # - revocation
    share = get_valid_share(
        db,
        token
    )

    file = (
        db.query(DBFile)
        .filter(
            DBFile.id == share.file_id,
            DBFile.is_deleted == False
        )
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="The shared file no longer exists."
        )

    # Decrypt before serving.
    plaintext = _load_and_decrypt(file)

    # Public secure-link access is anonymous. Attribute the activity to
    # the TrustShare account that created the link because activity_logs
    # requires a non-null user_id.
    log_activity(
        db, share.created_by,
        "SHARED_LINK_ACCESS",
        f"Accessed shared link for {file.filename}.",
        file.id, _client_ip(request)
    )
    db.commit()

    # VIEW links use a TrustShare viewer page. This avoids relying on the
    # browser's download behavior for formats such as XLSX and gives a
    # consistent viewing experience. Only DOWNLOAD links increment the
    # download counter and return an attachment.
    if share.permission == "view":
        extension = os.path.splitext(file.filename.lower())[1]
        if extension in {".xlsx", ".ppt", ".pptx"}:
            return _preview_response(file, plaintext)
        return _public_viewer_response(file, share, plaintext)

    # DOWNLOAD permission is the only permission that consumes a download.
    check_and_register_access(db, share)
    db.commit()

    content_type = _resolve_content_type(file)
    guessed_type, _ = mimetypes.guess_type(file.filename)
    content_type = guessed_type or content_type

    return Response(
        content=plaintext,
        media_type=content_type,
        headers={
            "Content-Disposition":
                f'attachment; filename="{file.filename}"',
            "X-Content-Type-Options": "nosniff"
        }
    )



# =========================================================
# ENHANCED MILESTONE 1-3 ENDPOINTS
# Recycle Bin, folders, versions, integrity and AI assistant.
# =========================================================

@app.get("/recycle-bin")
def get_recycle_bin(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    rows = db.query(DBFile).filter(
        DBFile.user_id == user_data["user_id"],
        DBFile.is_deleted == True
    ).order_by(DBFile.updated_at.desc()).all()
    return [{
        "id": f.id,
        "filename": f.filename,
        "size": f.size,
        "category": f.category,
        "deleted_at": f.updated_at.isoformat() if f.updated_at else None
    } for f in rows]


@app.put("/recycle-bin/{file_id}/restore")
def restore_file(
    file_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    file = db.query(DBFile).filter(
        DBFile.id == file_id,
        DBFile.user_id == user_data["user_id"],
        DBFile.is_deleted == True
    ).first()
    if not file:
        raise HTTPException(status_code=404, detail="Deleted file not found.")
    file.is_deleted = False
    log_activity(db, user_data["user_id"], "FILE_RESTORED", f"Restored {file.filename} from the recycle bin.", file.id, _client_ip(request))
    db.commit()
    return {"success": True, "message": "File restored successfully."}


@app.delete("/recycle-bin/{file_id}/permanent")
def permanently_delete_file(
    file_id: int,
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    file = db.query(DBFile).filter(
        DBFile.id == file_id,
        DBFile.user_id == user_data["user_id"],
        DBFile.is_deleted == True
    ).first()
    if not file:
        raise HTTPException(status_code=404, detail="Deleted file not found.")
    filename = file.filename
    location = file.stored_filename

    try:
        # Remove references before deleting the file. This makes the endpoint
        # safe even when an existing PostgreSQL database does not have every
        # expected ON DELETE CASCADE constraint.
        db.execute(
            text("UPDATE activity_logs SET file_id = NULL WHERE file_id = :file_id"),
            {"file_id": file_id}
        )
        db.execute(
            text("DELETE FROM shares WHERE file_id = :file_id"),
            {"file_id": file_id}
        )

        # Record the event without a file_id because the file is being removed.
        log_activity(
            db,
            user_data["user_id"],
            "PERMANENT_DELETE",
            f"Permanently deleted {filename}.",
            None,
            _client_ip(request)
        )

        db.delete(file)
        db.flush()
        db.commit()

    except Exception as exc:
        db.rollback()
        print("Permanent delete database error:", exc)
        raise HTTPException(
            status_code=500,
            detail="Unable to permanently delete the file. Please try again."
        )

    # Storage cleanup is best-effort after the database deletion succeeds.
    try:
        storage.delete(location)
    except Exception as storage_error:
        print("Permanent delete storage cleanup warning:", storage_error)

    return {"success": True, "message": "File permanently deleted."}


@app.post("/folders")
def create_folder(
    name: str = Form(...),
    parent_id: int | None = Form(None),
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    name = name.strip()
    if not name or len(name) > 255:
        raise HTTPException(status_code=400, detail="Enter a valid folder name.")
    if parent_id:
        parent = db.execute(text("SELECT id FROM folders WHERE id=:id AND owner_id=:uid"), {"id": parent_id, "uid": user_data["user_id"]}).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found.")
    try:
        row = db.execute(text("""
            INSERT INTO folders(owner_id,name,parent_id) VALUES(:uid,:name,:parent)
            RETURNING id, name, parent_id, created_at
        """), {"uid": user_data["user_id"], "name": name, "parent": parent_id}).mappings().first()
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="A folder with this name already exists here.")
    log_activity(db, user_data["user_id"], "FOLDER_CREATED", f"Created folder {name}.")
    db.commit()
    return dict(row)


@app.get("/folders")
def list_folders(
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    rows = db.execute(text("""
        SELECT id, name, parent_id, created_at
        FROM folders WHERE owner_id=:uid ORDER BY name
    """), {"uid": user_data["user_id"]}).mappings().all()
    return [dict(r) for r in rows]


@app.put("/files/{file_id}/move")
def move_file_to_folder(
    file_id: int,
    folder_id: int | None = Form(None),
    request: Request = None,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    file = db.query(DBFile).filter(DBFile.id == file_id, DBFile.user_id == user_data["user_id"], DBFile.is_deleted == False).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found.")
    if folder_id is not None:
        folder = db.execute(text("SELECT id FROM folders WHERE id=:fid AND owner_id=:uid"), {"fid": folder_id, "uid": user_data["user_id"]}).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found.")
    file.folder_id = folder_id
    log_activity(db, user_data["user_id"], "FILE_MOVED", f"Moved {file.filename}.", file.id, _client_ip(request))
    db.commit()
    return {"success": True, "message": "File moved successfully."}


@app.get("/files/{file_id}/versions")
def list_file_versions(
    file_id: int,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    file = db.query(DBFile).filter(DBFile.id == file_id, DBFile.user_id == user_data["user_id"]).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found.")
    rows = db.execute(text("""
        SELECT id, version_number, size, file_hash, created_at
        FROM file_versions WHERE file_id=:fid ORDER BY version_number DESC
    """), {"fid": file_id}).mappings().all()
    return [dict(r) for r in rows]


@app.get("/files/{file_id}/integrity")
def verify_file_integrity(
    file_id: int,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    file = db.query(DBFile).filter(DBFile.id == file_id, DBFile.user_id == user_data["user_id"], DBFile.is_deleted == False).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found.")
    plaintext = _load_and_decrypt(file)
    current_hash = hashlib.sha256(plaintext).hexdigest()
    stored_hash = file.file_hash
    if not stored_hash:
        db.execute(text("UPDATE files SET file_hash=:hash WHERE id=:fid"), {"hash": current_hash, "fid": file.id})
        db.commit()
        stored_hash = current_hash
    valid = current_hash == stored_hash
    log_activity(db, user_data["user_id"], "INTEGRITY_CHECK", f"Integrity check for {file.filename}: {'passed' if valid else 'failed'}.", file.id)
    db.commit()
    return {"success": True, "valid": valid, "algorithm": "SHA-256", "stored_hash": stored_hash, "current_hash": current_hash}


def _extract_document_text(content: bytes, filename: str) -> str:
    """Extract readable text without requiring an AI provider."""
    ext = os.path.splitext(filename.lower())[1]
    try:
        if ext == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(__import__('io').BytesIO(content))
            return "\n".join((page.extract_text() or "") for page in reader.pages)
        if ext == ".docx":
            from docx import Document
            doc = Document(__import__('io').BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs)
        if ext == ".pptx":
            from pptx import Presentation
            prs = Presentation(__import__('io').BytesIO(content))
            chunks=[]
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text:
                        chunks.append(shape.text)
            return "\n".join(chunks)
        if ext in {".txt", ".md", ".csv", ".json", ".py", ".js", ".jsx", ".css", ".html"}:
            return content.decode("utf-8", errors="ignore")
    except Exception as exc:
        return f"[Text extraction failed: {exc}]"
    return ""


def _chunk_text(text_value: str, size: int = 1200, overlap: int = 150):
    clean = re.sub(r"\s+", " ", text_value or "").strip()
    if not clean:
        return []
    chunks=[]
    start=0
    while start < len(clean):
        end=min(len(clean), start+size)
        chunks.append(clean[start:end])
        if end == len(clean): break
        start=max(end-overlap, start+1)
    return chunks


def _rank_chunks(question: str, chunks: list[str], limit: int = 5):
    terms=set(re.findall(r"[a-zA-Z0-9]{3,}", question.lower()))
    scored=[]
    for chunk in chunks:
        words=re.findall(r"[a-zA-Z0-9]{3,}", chunk.lower())
        score=sum(words.count(term) for term in terms)
        scored.append((score, chunk))
    scored.sort(key=lambda x:x[0], reverse=True)
    return [c for score,c in scored[:limit] if score > 0] or chunks[:limit]


def _call_ai_provider(system_prompt: str, user_prompt: str):
    api_key=os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY")
    endpoint=os.getenv("AI_API_URL", "https://api.openai.com/v1/chat/completions")
    model=os.getenv("AI_MODEL", "gpt-4o-mini")
    if not api_key:
        return None
    payload=json.dumps({
        "model": model,
        "messages":[
            {"role":"system","content":system_prompt},
            {"role":"user","content":user_prompt}
        ],
        "temperature":0.2
    }).encode("utf-8")
    request=urllib.request.Request(endpoint, data=payload, headers={"Content-Type":"application/json", "Authorization":f"Bearer {api_key}"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            data=json.loads(response.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        print("AI provider error:", exc)
        return None


def _local_ai_answer(question: str, context: str) -> str:
    q=question.lower()
    sentences=[x.strip() for x in re.split(r"(?<=[.!?])\s+", context) if x.strip()]
    if not sentences:
        return "I could not find readable text in the authorized files. Try a PDF, DOCX, PPTX or text file."
    terms=set(re.findall(r"[a-zA-Z0-9]{3,}", q))
    ranked=sorted(sentences, key=lambda x: sum(x.lower().count(t) for t in terms), reverse=True)
    selected=ranked[:5]
    if any(k in q for k in ["summarize", "summary", "brief"]):
        return "Summary:\n• " + "\n• ".join(selected[:5])
    if any(k in q for k in ["key points", "important", "main points"]):
        return "Key points:\n• " + "\n• ".join(selected[:6])
    return "Based on your authorized TrustShare files:\n\n" + "\n".join(f"• {x}" for x in selected[:5])


@app.post("/ai/ask")
def ai_ask(
    question: str = Form(...),
    file_id: int | None = Form(None),
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    question=question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Enter a question.")

    docs=[]
    if file_id:
        file=db.query(DBFile).filter(DBFile.id==file_id, DBFile.user_id==user_data["user_id"], DBFile.is_deleted==False).first()
        if not file:
            raise HTTPException(status_code=403, detail="You are not authorized to use this file with AI.")
        docs=[file]
    else:
        docs=db.query(DBFile).filter(DBFile.user_id==user_data["user_id"], DBFile.is_deleted==False).order_by(DBFile.created_at.desc()).limit(20).all()

    all_chunks=[]
    source_names=[]
    for file in docs:
        try:
            plaintext=_load_and_decrypt(file)
            text_value=_extract_document_text(plaintext, file.filename)
            chunks=_chunk_text(text_value)
            ranked=_rank_chunks(question, chunks, 5)
            all_chunks.extend(f"[{file.filename}] {c}" for c in ranked)
            if ranked: source_names.append(file.filename)
        except Exception:
            continue

    context="\n\n".join(all_chunks[:12])
    system="You are TrustShare AI, a secure document assistant. Use only the supplied authorized context. Never claim access to files not included in the context. If context is insufficient, say so. Keep answers concise and useful."
    provider_answer=_call_ai_provider(system, f"Question: {question}\n\nAuthorized context:\n{context}") if context else None
    answer=provider_answer or _local_ai_answer(question, context)
    log_activity(db, user_data["user_id"], "AI_QUERY", f"AI assistant query: {question[:180]}")
    db.commit()
    return {"success":True, "answer":answer, "sources":source_names, "provider": "external" if provider_answer else "local"}


@app.post("/ai/file/{file_id}/summary")
def ai_file_summary(
    file_id: int,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    file=db.query(DBFile).filter(DBFile.id==file_id, DBFile.user_id==user_data["user_id"], DBFile.is_deleted==False).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found.")
    plaintext=_load_and_decrypt(file)
    text_value=_extract_document_text(plaintext, file.filename)
    if not text_value.strip():
        raise HTTPException(status_code=400, detail="This file type does not contain extractable text.")
    chunks=_chunk_text(text_value)
    context="\n".join(chunks[:8])
    prompt=f"Create a concise summary with 5 key points for this document.\n\nDocument:\n{context}"
    answer=_call_ai_provider("You are TrustShare AI. Summarize only the supplied document.", prompt) or _local_ai_answer("summarize", context)
    log_activity(db, user_data["user_id"], "AI_SUMMARY", f"Generated AI summary for {file.filename}.", file.id)
    db.commit()
    return {"success":True,"filename":file.filename,"summary":answer,"provider":"external" if os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY") else "local"}


@app.post("/ai/file/{file_id}/insights")
def ai_file_insights(
    file_id: int,
    user_data: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    file=db.query(DBFile).filter(DBFile.id==file_id, DBFile.user_id==user_data["user_id"], DBFile.is_deleted==False).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found.")
    plaintext=_load_and_decrypt(file)
    text_value=_extract_document_text(plaintext, file.filename)
    if not text_value.strip():
        raise HTTPException(status_code=400, detail="This file type does not contain extractable text.")
    words=re.findall(r"[A-Za-z][A-Za-z0-9_-]{3,}", text_value.lower())
    stop={"this","that","with","from","your","have","will","about","there","which","their","into","using","also","they","were","been","what","when","where","than","then"}
    freq={}
    for w in words:
        if w not in stop: freq[w]=freq.get(w,0)+1
    topics=[w for w,_ in sorted(freq.items(), key=lambda x:x[1], reverse=True)[:8]]
    summary=_local_ai_answer("summarize", text_value)
    return {"success":True,"filename":file.filename,"category":file.category,"size":file.size,"topics":topics,"suggested_tags":[f"#{x}" for x in topics[:5]],"summary":summary}

# =========================================================
# LOAD + DECRYPT FILE
# =========================================================

def _load_and_decrypt(
    file: DBFile
) -> bytes:

    try:
        ciphertext = storage.load(
            file.stored_filename
        )

    except Exception:
        raise HTTPException(
            status_code=404,
            detail="Stored file could not be found."
        )

    # Backward compatibility for files uploaded before
    # Milestone 2 encryption was enabled.
    if not file.is_encrypted:
        return ciphertext

    if (
        not file.encryption_key
        or not file.encryption_nonce
    ):
        raise HTTPException(
            status_code=500,
            detail="Encryption metadata is missing."
        )

    try:

        data_key = unwrap_key(
            file.encryption_key
        )

        return decrypt_file_bytes(
            ciphertext,
            data_key,
            file.encryption_nonce
        )

    except InvalidTag:

        raise HTTPException(
            status_code=500,
            detail="File integrity check failed. The stored file may have been corrupted or tampered with."
        )

    except Exception:

        raise HTTPException(
            status_code=500,
            detail="Unable to decrypt the file."
        )


# =========================================================
# RESOLVE FILE CONTENT TYPE
# =========================================================

def _resolve_content_type(
    file: DBFile
) -> str:

    if file.content_type:
        return file.content_type

    guessed_type, _ = mimetypes.guess_type(
        file.filename
    )

    return guessed_type or "application/octet-stream"
