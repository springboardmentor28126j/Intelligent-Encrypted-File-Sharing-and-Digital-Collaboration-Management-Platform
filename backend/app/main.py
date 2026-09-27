from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from .database import SessionLocal
from .models import (
    User,
    PasswordResetToken,
    ActivityLog,
    File,
    AuditLog,
    SecurityAlert,
)
from .auth import (
    create_access_token,
    get_current_user,
    require_admin,
    create_password_reset_token,
    verify_password_reset_token,
)
from .monitoring import (
    log_activity,
    create_security_alert,
    create_notification,
)
from .email_service import send_password_reset_email
from .file_routes import router as file_router
from .share_routes import router as share_router


app = FastAPI(title="TrustShare API")


# -------------------------
# ROUTERS
# -------------------------

app.include_router(file_router)
app.include_router(share_router)


# -------------------------
# CORS
# -------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------
# PASSWORD HASHING
# -------------------------

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


# -------------------------
# REQUEST MODELS
# -------------------------

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# -------------------------
# ROOT
# -------------------------

@app.get("/")
def root():
    return {
        "message": "TrustShare API is running"
    }


# -------------------------
# REGISTER
# -------------------------

@app.post("/auth/register")
def register(data: RegisterRequest):

    db: Session = SessionLocal()

    try:
        existing_user = (
            db.query(User)
            .filter(User.email == data.email)
            .first()
        )

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Email already registered",
            )

        hashed_password = pwd_context.hash(
            data.password
        )

        new_user = User(
            name=data.username,
            email=data.email,
            password_hash=hashed_password,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            role="USER",
            mfa_secret=None,
            mfa_enabled=False,
            storage_quota=1073741824,
            used_storage=0,
            updated_at=datetime.now(timezone.utc),
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return {
            "message": "Registration successful",
            "user_id": new_user.id,
            "username": new_user.name,
            "email": new_user.email,
        }

    finally:
        db.close()


# -------------------------
# FORGOT PASSWORD
# -------------------------

@app.post("/auth/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
):

    db: Session = SessionLocal()

    try:
        user = (
            db.query(User)
            .filter(User.email == data.email)
            .first()
        )

        # Always return the same response.
        # This prevents revealing whether an email
        # exists in the database.

        if user:

            reset_token = create_password_reset_token(
                user.id
            )

            try:
                send_password_reset_email(
                    recipient_email=user.email,
                    reset_token=reset_token,
                )

            except Exception as email_error:

                print(
                    "Password reset email failed: "
                    f"{email_error}"
                )

        return {
            "message": (
                "If an account with that email exists, "
                "a password reset link will be sent."
            )
        }

    finally:
        db.close()


# -------------------------
# RESET PASSWORD
# -------------------------

@app.post("/auth/reset-password")
def reset_password(
    data: ResetPasswordRequest,
):

    # -------------------------
    # Validate token
    # -------------------------

    reset_token = verify_password_reset_token(
        data.token
    )

    if not reset_token:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired password reset token",
        )

    # -------------------------
    # Validate new password
    # -------------------------

    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long",
        )

    db: Session = SessionLocal()

    try:

        # -------------------------
        # Find user
        # -------------------------

        user = (
            db.query(User)
            .filter(
                User.id == reset_token["user_id"]
            )
            .first()
        )

        if not user:
            raise HTTPException(
                status_code=400,
                detail="User account not found",
            )

        # -------------------------
        # Find token record
        # -------------------------

        db_token = (
            db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.id
                == reset_token["token_id"]
            )
            .first()
        )

        if not db_token:
            raise HTTPException(
                status_code=400,
                detail="Invalid password reset token",
            )

        # Make sure token has not been used

        if db_token.used:
            raise HTTPException(
                status_code=400,
                detail="Password reset token has already been used",
            )

        # -------------------------
        # Update password
        # -------------------------

        user.password_hash = pwd_context.hash(
            data.new_password
        )

        # -------------------------
        # Invalidate token
        # -------------------------

        db_token.used = True

        db.commit()

        return {
            "message": "Password reset successful"
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


# -------------------------
# LOGIN
# -------------------------

@app.post("/auth/login")
def login(
    user: UserLogin,
):

    db: Session = SessionLocal()

    try:

        existing_user = (
            db.query(User)
            .filter(User.email == user.email)
            .first()
        )

        # -------------------------
        # User not found
        # -------------------------

        if not existing_user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password",
            )

        # -------------------------
        # Check account status
        # -------------------------

        if not existing_user.is_active:
            raise HTTPException(
                status_code=403,
                detail="User account is inactive",
            )

        # -------------------------
        # Verify password
        # -------------------------

        if not pwd_context.verify(
            user.password,
            existing_user.password_hash,
        ):

            # -------------------------
            # Record failed login
            # -------------------------

            log_activity(
                db=db,
                user_id=existing_user.id,
                action="LOGIN_FAILED",
                description="Failed login attempt",
                status="FAILED",
                details="Invalid password",
            )

            # -------------------------
            # Check previous failed logins
            # -------------------------

            previous_failures = (
                db.query(ActivityLog)
                .filter(
                    ActivityLog.user_id == existing_user.id,
                    ActivityLog.action == "LOGIN_FAILED",
                )
                .count()
            )

            # The current failed login is already
            # included in the count after log_activity().
            # Trigger alert when there are 3 or more.

            if previous_failures >= 3:

                create_security_alert(
                    db=db,
                    user_id=existing_user.id,
                    alert_type="MULTIPLE_FAILED_LOGINS",
                    description=(
                        "Multiple failed login attempts "
                        "detected for this account."
                    ),
                    severity="HIGH",
                )
                create_notification(
                    db=db,
                    user_id=existing_user.id,
                    title="Security Alert",
                    message=(
                      "Multiple failed login attempts "
                      "were detected on your account."
                   ),
                     notification_type="SECURITY",
             )    

            db.commit()

            raise HTTPException(
                status_code=401,
                detail="Invalid email or password",
            )

        # -------------------------
        # Create JWT
        # -------------------------

        token = create_access_token(
            existing_user.id
        )

        # -------------------------
        # Record successful login
        # -------------------------

        log_activity(
            db=db,
            user_id=existing_user.id,
            action="LOGIN_SUCCESS",
            description="User logged in successfully",
            status="SUCCESS",
            details="Successful password authentication",
        )

        db.commit()

        return {
            "message": "Login successful",
            "access_token": token,
            "token_type": "bearer",
            "user_id": existing_user.id,
            "username": existing_user.name,
            "email": existing_user.email,
            "role": existing_user.role,
        }

    finally:
        db.close()


# -------------------------
# CURRENT USER
# -------------------------

@app.get("/auth/me")
def get_me(
    current_user: User = Depends(get_current_user),
):

    return {
        "message": "Authenticated user",
        "user_id": current_user.id,
        "username": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
    }


# -------------------------
# ADMIN
# -------------------------

@app.get("/admin")
def admin_dashboard(
    current_user: User = Depends(require_admin),
):

    return {
        "message": "Welcome to the Admin Dashboard",
        "admin": current_user.name,
        "role": current_user.role,
    }

@app.get("/analytics/storage")
def storage_analytics(
    current_user=Depends(get_current_user),
):
    db: Session = SessionLocal()

    try:
        files = (
            db.query(File)
            .filter(
                File.owner_id == current_user.id,
                File.is_deleted == False,
            )
            .all()
        )

        total_files = len(files)
        encrypted_files = sum(
            1 for file in files
            if file.is_encrypted
        )

        total_storage = sum(
            file.size or 0
            for file in files
        )

        file_types = {}

        for file in files:
            content_type = (
                file.content_type
                or "Unknown"
            )

            file_types[content_type] = (
                file_types.get(content_type, 0) + 1
            )

        return {
            "total_files": total_files,
            "encrypted_files": encrypted_files,
            "total_storage_bytes": total_storage,
            "file_types": file_types,
        }

    finally:
        db.close()

@app.get("/reports/activity")
def activity_security_report(
    current_user=Depends(get_current_user),
):
    db: Session = SessionLocal()

    try:
        activities = (
            db.query(ActivityLog)
            .filter(
                ActivityLog.user_id == current_user.id
            )
            .order_by(
                ActivityLog.created_at.desc()
            )
            .limit(50)
            .all()
        )

        alerts = (
            db.query(SecurityAlert)
            .filter(
                SecurityAlert.user_id == current_user.id
            )
            .order_by(
                SecurityAlert.created_at.desc()
            )
            .limit(20)
            .all()
        )

        return {
            "activity_summary": {
                "total_activities": len(activities),
                "successful_logins": sum(
                    1 for item in activities
                    if item.action == "LOGIN_SUCCESS"
                ),
                "failed_logins": sum(
                    1 for item in activities
                    if item.action == "LOGIN_FAILED"
                ),
                "uploads": sum(
                    1 for item in activities
                    if item.action == "FILE_UPLOAD"
                ),
                "downloads": sum(
                    1 for item in activities
                    if item.action == "FILE_DOWNLOAD"
                ),
                "deletions": sum(
                    1 for item in activities
                    if item.action == "FILE_DELETE"
                ),
            },
            "security_alerts": [
                {
                    "id": alert.id,
                    "type": alert.alert_type,
                    "severity": alert.severity,
                    "description": alert.description,
                    "created_at": alert.created_at,
                    "resolved": alert.resolved,
                }
                for alert in alerts
            ],
            "recent_activity": [
                {
                    "id": item.id,
                    "action": item.action,
                    "description": item.description,
                    "created_at": item.created_at,
                }
                for item in activities[:10]
            ],
        }

    finally:
        db.close()
