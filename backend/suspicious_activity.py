from datetime import datetime, timedelta, timezone
import os
import smtplib

from email.message import EmailMessage

from fastapi import APIRouter, Depends

from models import User
from security import get_current_user
from mongodb import activity_logs, security_alerts, create_security_alert


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/suspicious",
    tags=["Suspicious Activity Detection"]
)


# =========================================================
# EMAIL SECURITY ALERT
# =========================================================

def send_suspicious_activity_email(
    recipient_email: str,
    failed_attempt_count: int
):
    sender_email = os.getenv("EMAIL_ADDRESS")
    sender_password = os.getenv("EMAIL_APP_PASSWORD")

    if not sender_email:
        raise RuntimeError(
            "EMAIL_ADDRESS is missing in .env"
        )

    if not sender_password:
        raise RuntimeError(
            "EMAIL_APP_PASSWORD is missing in .env"
        )

    message = EmailMessage()

    message["Subject"] = (
        "Trust Share - Security Alert"
    )

    message["From"] = sender_email

    message["To"] = recipient_email

    message.set_content(
        f"""
Hello,

Trust Share has detected unusual login activity
on your account.

We detected {failed_attempt_count} failed login attempts
within the last 10 minutes.

This activity has been classified as a
HIGH severity security event.

If these login attempts were not made by you,
please change your password immediately.

Regards,

Trust Share Security Team
"""
    )

    with smtplib.SMTP(
        "smtp.gmail.com",
        587
    ) as server:

        server.starttls()

        server.login(
            sender_email,
            sender_password
        )

        server.send_message(
            message
        )

    print(
        "Suspicious activity email sent to:",
        recipient_email
    )


# =========================================================
# CHECK FAILED LOGIN ACTIVITY
# =========================================================

def check_failed_login_suspicious_activity(
    user: User
):
    """
    Checks whether the user has more than four
    failed login attempts within the last 10 minutes.

    5 or more failed attempts:
        -> suspicious activity
        -> high security alert
        -> email notification

    Returns the detection result.
    """

    now = datetime.now(timezone.utc)

    recent_time = (
        now - timedelta(minutes=10)
    )

    # -----------------------------------------------------
    # GET RECENT FAILED LOGIN ATTEMPTS
    # -----------------------------------------------------

    failed_logins = list(
        activity_logs.find({
            "user_id": user.id,
            "action": "login",
            "status": "failed",
            "timestamp": {
                "$gte": recent_time
            }
        })
    )

    failed_count = len(failed_logins)

    # -----------------------------------------------------
    # LESS THAN 5 ATTEMPTS
    # -----------------------------------------------------

    if failed_count < 5:

        return {
            "suspicious": False,
            "count": failed_count,
            "alert_created": False,
            "email_sent": False
        }

    # -----------------------------------------------------
    # CHECK WHETHER A SUSPICIOUS ALERT WAS ALREADY CREATED
    # -----------------------------------------------------

    existing_alert = security_alerts.find_one({
        "user_id": user.id,
        "alert_type": "multiple_failed_logins",
        "timestamp": {
            "$gte": recent_time
        }
    })

    # -----------------------------------------------------
    # ALREADY PROCESSED
    # -----------------------------------------------------

    if existing_alert:

        return {
            "suspicious": True,
            "count": failed_count,
            "alert_created": False,
            "email_sent": False,
            "already_alerted": True
        }

    # -----------------------------------------------------
    # SUSPICIOUS ACTIVITY DETECTED
    # -----------------------------------------------------

    message = (
        f"{failed_count} failed login attempts "
        "were detected within the last 10 minutes."
    )

    # -----------------------------------------------------
    # CREATE HIGH-SEVERITY SECURITY ALERT
    # -----------------------------------------------------

    try:

        create_security_alert(
            user_id=user.id,
            alert_type="multiple_failed_logins",
            severity="high",
            message=message
        )

        print(
            "Multiple failed login security alert "
            "saved to MongoDB."
        )

        alert_created = True

    except Exception as error:

        print(
            "Suspicious activity security alert "
            "failed:",
            error
        )

        alert_created = False

    # -----------------------------------------------------
    # SEND EMAIL
    # -----------------------------------------------------

    email_sent = False

    try:

        send_suspicious_activity_email(
            recipient_email=user.email,
            failed_attempt_count=failed_count
        )

        email_sent = True

    except Exception as error:

        print(
            "Suspicious activity email failed:",
            repr(error)
        )

    # -----------------------------------------------------
    # RETURN RESULT
    # -----------------------------------------------------

    return {
        "suspicious": True,
        "count": failed_count,
        "alert_created": alert_created,
        "email_sent": email_sent,
        "already_alerted": False
    }


# =========================================================
# SUSPICIOUS ACTIVITY API
# =========================================================

@router.get("/detect")
def detect_suspicious_activity(
    current_user: User = Depends(
        get_current_user
    )
):

    now = datetime.now(timezone.utc)

    recent_time = (
        now - timedelta(minutes=10)
    )

    suspicious_events = []

    # =====================================================
    # MULTIPLE FAILED LOGINS
    # =====================================================

    failed_logins = list(
        activity_logs.find({
            "user_id": current_user.id,
            "action": "login",
            "status": "failed",
            "timestamp": {
                "$gte": recent_time
            }
        })
    )

    failed_count = len(failed_logins)

    if failed_count >= 5:

        suspicious_events.append({
            "type": "Multiple Failed Logins",
            "severity": "high",
            "message": (
                f"{failed_count} failed login attempts "
                "detected within the last 10 minutes."
            ),
            "count": failed_count
        })

    # =====================================================
    # UNAUTHORIZED FILE ACCESS
    # =====================================================

    unauthorized_access = list(
        activity_logs.find({
            "user_id": current_user.id,
            "action": "unauthorized_file_access",
            "timestamp": {
                "$gte": recent_time
            }
        })
    )

    if len(unauthorized_access) >= 2:

        suspicious_events.append({
            "type": "Repeated Unauthorized Access",
            "severity": "high",
            "message": (
                f"{len(unauthorized_access)} unauthorized "
                "file access attempts detected."
            ),
            "count": len(unauthorized_access)
        })

    # =====================================================
    # PERMISSION VIOLATIONS
    # =====================================================

    permission_violations = list(
        activity_logs.find({
            "user_id": current_user.id,
            "action": "permission_violation",
            "timestamp": {
                "$gte": recent_time
            }
        })
    )

    if len(permission_violations) >= 2:

        suspicious_events.append({
            "type": "Permission Violation",
            "severity": "medium",
            "message": (
                f"{len(permission_violations)} permission "
                "violations detected."
            ),
            "count": len(permission_violations)
        })

    # =====================================================
    # EXPIRED FILE ACCESS
    # =====================================================

    expired_access = list(
        activity_logs.find({
            "user_id": current_user.id,
            "action": "expired_file_access",
            "timestamp": {
                "$gte": recent_time
            }
        })
    )

    if len(expired_access) >= 2:

        suspicious_events.append({
            "type": "Repeated Expired File Access",
            "severity": "medium",
            "message": (
                f"{len(expired_access)} attempts to access "
                "expired files detected."
            ),
            "count": len(expired_access)
        })

    # =====================================================
    # RESPONSE
    # =====================================================

    return {
        "success": True,
        "suspicious": (
            len(suspicious_events) > 0
        ),
        "count": len(suspicious_events),
        "events": suspicious_events
    }