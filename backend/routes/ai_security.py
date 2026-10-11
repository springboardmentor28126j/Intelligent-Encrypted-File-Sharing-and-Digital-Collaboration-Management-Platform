
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from auth_utils import verify_access_token
from database.connection import engine
from models.activity_log import ActivityLog


router = APIRouter()
security = HTTPBearer()

SECURITY_ENGINE_VERSION = "rule-based-security-v2"


# =========================================================
# AUTHENTICATION
# =========================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    payload = verify_access_token(credentials.credentials)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    user_id = payload.get("user_id")
    email = payload.get("email")

    if not user_id or not email:
        raise HTTPException(
            status_code=401,
            detail="Invalid user token",
        )

    return {"user_id": user_id, "email": email}


# =========================================================
# FETCH ALL USER ACTIVITY
# =========================================================

def get_user_activities(user_id):
    """Retrieve every available activity record for this user."""
    db = Session(bind=engine)

    try:
        activities = (
            db.query(ActivityLog)
            .filter(ActivityLog.user_id == user_id)
            .order_by(ActivityLog.created_at.asc())
            .all()
        )

        result = []

        for activity in activities:
            created_at = getattr(activity, "created_at", None)

            result.append({
                "action": str(
                    getattr(activity, "action", "") or "UNKNOWN"
                ).upper(),
                "filename": getattr(activity, "filename", None),
                "details": getattr(activity, "details", None),
                "created_at": (
                    created_at.isoformat()
                    if created_at is not None
                    and hasattr(created_at, "isoformat")
                    else str(created_at) if created_at else None
                ),
                "ip_address": getattr(activity, "ip_address", None),
            })

        return result

    finally:
        db.close()


# =========================================================
# TIMESTAMP HELPERS
# =========================================================

def parse_timestamp(value):
    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(
            str(value).replace("Z", "+00:00")
        )

        # Assumption: timezone-naive database timestamps are UTC.
        # Change this if your database stores local time instead.
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

        return parsed.astimezone(timezone.utc)

    except (ValueError, TypeError, OverflowError):
        return None


# =========================================================
# ACTIVITY STATISTICS: ENTIRE HISTORY
# =========================================================

def build_activity_statistics(activity_data):
    action_counts = Counter()
    event_counts = Counter()
    unique_files = set()
    valid_timestamps = []

    for item in activity_data:
        action = str(item.get("action") or "UNKNOWN").upper()
        action_counts[action] += 1

        if "LOGIN" in action:
            event_counts["login_events"] += 1

            if "FAIL" in action:
                event_counts["failed_login_events"] += 1
            elif "SUCCESS" in action:
                event_counts["successful_login_events"] += 1

        if "UPLOAD" in action:
            event_counts["upload_events"] += 1

        if "DOWNLOAD" in action:
            event_counts["download_events"] += 1

        if action in {"FILE_SHARED", "SHARE_CREATED"}:
            event_counts["sharing_events"] += 1

        if action == "SHARE_REVOKED":
            event_counts["share_revoked_events"] += 1

        if "TEMPORARY" in action or "TEMP_LINK" in action:
            event_counts["temporary_link_events"] += 1

        if "MFA" in action:
            event_counts["mfa_events"] += 1

            if "DISABLED" in action:
                event_counts["mfa_disabled_events"] += 1
            elif "ENABLED" in action:
                event_counts["mfa_enabled_events"] += 1

        if "DELETE" in action:
            event_counts["delete_events"] += 1

        filename = item.get("filename")
        if filename:
            unique_files.add(str(filename))

        timestamp = parse_timestamp(item.get("created_at"))
        if timestamp:
            valid_timestamps.append(timestamp)

    first_activity = min(valid_timestamps) if valid_timestamps else None
    last_activity = max(valid_timestamps) if valid_timestamps else None

    return {
        "analysis_scope": "all_available_user_activity",
        "total_records_analyzed": len(activity_data),
        "records_with_valid_timestamps": len(valid_timestamps),
        "action_counts": dict(action_counts),
        "event_counts": dict(event_counts),
        "unique_files_in_records": len(unique_files),
        "first_activity_at": (
            first_activity.isoformat() if first_activity else None
        ),
        "last_activity_at": (
            last_activity.isoformat() if last_activity else None
        ),
    }


# =========================================================
# FULL-HISTORY SECURITY ANALYSIS
# =========================================================


def calculate_security_risk(activity_data):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=10)

    failed_logins = []
    downloads = 0
    shares = 0
    mfa_enabled_events = []
    mfa_disabled_events = []
    timestamped_events = []

    for item in activity_data:
        action = str(item.get("action") or "").upper()
        timestamp = parse_timestamp(item.get("created_at"))

        if timestamp is not None:
            timestamped_events.append((timestamp, item, action))

        if "LOGIN" in action and "FAIL" in action:
            failed_logins.append((timestamp, item))

        if "DOWNLOAD" in action:
            downloads += 1

        if action in {"FILE_SHARED", "SHARE_CREATED"}:
            shares += 1

        if "MFA" in action and "ENABLED" in action:
            mfa_enabled_events.append((timestamp, item))

        if "MFA" in action and "DISABLED" in action:
            mfa_disabled_events.append((timestamp, item))

    timestamped_events.sort(key=lambda entry: entry[0])

    # Ignore future-dated events in risk rules.
    valid_events = [
        entry for entry in timestamped_events
        if entry[0] <= now
    ]

    valid_failed_logins = [
        (timestamp, item)
        for timestamp, item in failed_logins
        if timestamp is not None and timestamp <= now
    ]

    
    
    # Detect successful logins preceded by at least 3 failures
    # within the previous 10 minutes.
    qualifying_successes = []

    for timestamp, item, action in valid_events:
        if "LOGIN" not in action or "SUCCESS" not in action:
            continue

        success_ip = item.get("ip_address")
        matching_failures = []
        same_ip_failures = 0
        missing_ip_failures = 0

        for failed_time, failed_item in valid_failed_logins:
            if not (
                timestamp - timedelta(minutes=10)
                <= failed_time < timestamp
            ):
                continue

            failed_ip = failed_item.get("ip_address")

            # If both IPs are known, require them to match.
            if success_ip and failed_ip:
                if success_ip != failed_ip:
                    continue
                same_ip_failures += 1
            else:
                # IP correlation is inconclusive when either IP is missing.
                missing_ip_failures += 1

            matching_failures.append(failed_time)

        if len(matching_failures) >= 3:
            qualifying_successes.append({
                "success_at": timestamp.isoformat(),
                "failed_attempts_before_success": len(matching_failures),
                "same_ip_failed_attempts": same_ip_failures,
                "ip_unavailable_failed_attempts": missing_ip_failures,
                "success_ip_available": bool(success_ip),
            })

    evidence = []
    recommendations = []
    score = 0


    def add_finding(rule, points, description, **extra):
        nonlocal score

        finding = {
            "rule": rule,
            "risk_points": points,
            "description": description,
        }
        finding.update(extra)
        evidence.append(finding)
        score += points

    # Rule 1: Historical failed-login volume.
    # Keep this as context, but do not add its points when the
    # more specific failed-login-followed-by-success rule matches.
    # Count only timestamped failed logins that are not future-dated.
    failed_count = len(valid_failed_logins)

    if failed_count >= 10:
        if not qualifying_successes:
            add_finding(
                "REPEATED_HISTORICAL_FAILED_LOGINS",
                25,
                "Ten or more failed login events exist in the "
                "recorded history.",
                observed_count=failed_count,
            )
        else:
            evidence.append({
                "rule": "REPEATED_HISTORICAL_FAILED_LOGINS",
                "risk_points": 0,
                "description": (
                    "Ten or more failed login events exist in the "
                    "recorded history. No additional points were "
                    "added because the more specific login-sequence "
                    "rule already accounts for overlapping activity."
                ),
                "observed_count": failed_count,
            })

        recommendations.append(
            "Review failed login records and confirm the attempts "
            "were made by the account owner."
        )

    elif failed_count >= 5:
        if not qualifying_successes:
            add_finding(
                "MULTIPLE_HISTORICAL_FAILED_LOGINS",
                15,
                "Five or more failed login events exist in the "
                "recorded history.",
                observed_count=failed_count,
            )
        else:
            evidence.append({
                "rule": "MULTIPLE_HISTORICAL_FAILED_LOGINS",
                "risk_points": 0,
                "description": (
                    "Five or more failed login events exist in the "
                    "recorded history; overlapping points were "
                    "suppressed by the login-sequence rule."
                ),
                "observed_count": failed_count,
            })

        recommendations.append(
            "Review the failed login history for unfamiliar attempts."
        )

    elif failed_count >= 3:
        if not qualifying_successes:
            add_finding(
                "SEVERAL_HISTORICAL_FAILED_LOGINS",
                8,
                "Three or more failed login events exist in the "
                "recorded history.",
                observed_count=failed_count,
            )
        else:
            evidence.append({
                "rule": "SEVERAL_HISTORICAL_FAILED_LOGINS",
                "risk_points": 0,
                "description": (
                    "Three or more failed login events exist in the "
                    "recorded history; overlapping points were "
                    "suppressed by the login-sequence rule."
                ),
                "observed_count": failed_count,
            })

        recommendations.append(
            "Monitor authentication history for repeated failures."
        )

    # Rule 2: Repeated failures followed by a successful login.
    if qualifying_successes:
        strongest_sequence = max(
            qualifying_successes,
            key=lambda entry: entry["failed_attempts_before_success"],
        )

        
        add_finding(
            "FAILED_LOGINS_FOLLOWED_BY_SUCCESS",
            15,
            "A successful login followed at least three failed "
            "login attempts within the preceding 10 minutes. "
            "Known IP addresses were compared; missing IP data "
            "limits correlation confidence.",
            failed_attempts_before_success=(
                strongest_sequence["failed_attempts_before_success"]
            ),
            qualifying_success_count=len(qualifying_successes),
            success_at=strongest_sequence["success_at"],
            same_ip_failed_attempts=(
                strongest_sequence["same_ip_failed_attempts"]
            ),
            ip_unavailable_failed_attempts=(
                strongest_sequence["ip_unavailable_failed_attempts"]
            ),
            success_ip_available=(
                strongest_sequence["success_ip_available"]
            ),
        )


        recommendations.append(
            "Verify successful logins that followed repeated failures "
            "and review the account's authentication history."
        )

    # Rule 3: Rapid MFA enable/disable changes.
    mfa_events = sorted(
        [
            (timestamp, "ENABLED")
            for timestamp, _ in mfa_enabled_events
            if timestamp is not None and timestamp <= now
        ] + [
            (timestamp, "DISABLED")
            for timestamp, _ in mfa_disabled_events
            if timestamp is not None and timestamp <= now
        ],
        key=lambda entry: entry[0],
    )

    rapid_mfa_changes = 0

    for previous, current in zip(mfa_events, mfa_events[1:]):
        previous_time, previous_state = previous
        current_time, current_state = current

        if (
            previous_state != current_state
            and timedelta(0) < current_time - previous_time
            <= timedelta(minutes=5)
        ):
            rapid_mfa_changes += 1

    if rapid_mfa_changes:
        add_finding(
            "RAPID_HISTORICAL_MFA_CHANGES",
            15,
            "MFA enable/disable transitions occurred within five "
            "minutes in the recorded history. This does not establish "
            "the current MFA setting.",
            rapid_change_pairs=rapid_mfa_changes,
            total_mfa_enabled_events=len(mfa_enabled_events),
            total_mfa_disabled_events=len(mfa_disabled_events),
        )

        recommendations.append(
            "Check the current MFA setting and confirm that the "
            "recorded configuration changes were intentional."
        )

    # Rule 4: Historical download volume.
    if downloads >= 100:
        add_finding(
            "HIGH_HISTORICAL_DOWNLOAD_VOLUME",
            15,
            "At least 100 download events exist in the recorded history.",
            observed_count=downloads,
        )
        recommendations.append(
            "Review download history and verify that access was authorized."
        )

    elif downloads >= 30:
        add_finding(
            "ELEVATED_HISTORICAL_DOWNLOAD_VOLUME",
            8,
            "At least 30 download events exist in the recorded history.",
            observed_count=downloads,
        )

    # Rule 5: Historical sharing volume.
    if shares >= 50:
        add_finding(
            "HIGH_HISTORICAL_SHARING_VOLUME",
            10,
            "At least 50 file-sharing creation events exist in history.",
            observed_count=shares,
        )
        recommendations.append(
            "Review shared-file permissions and confirm recipients "
            "are authorized."
        )

    score = min(max(score, 0), 100)

    if score >= 60:
        level = "HIGH"
    elif score >= 30:
        level = "MEDIUM"
    elif score >= 10:
        level = "LOW"
    else:
        level = "NO_HISTORICAL_ALERTS"

    recommendations = list(dict.fromkeys(recommendations))

    if not recommendations:
        recommendations = [
            "Continue monitoring account activity.",
            "Review access permissions and sharing settings periodically.",
            "Keep authentication and file-protection controls enabled.",
        ]

    while len(recommendations) < 3:
        recommendations.append(
            "Continue reviewing activity for new warning signals."
        )

    if evidence:
        reason = (
            f"Analyzed the complete available activity history and "
            f"matched {len(evidence)} configured historical risk rule(s). "
            "Overlapping login-volume points may be suppressed. "
            "Findings are indicators for review, not proof of an attack."
        )
    else:
        reason = (
            "No configured historical risk rules matched the available "
            "records. This does not guarantee that the account is free "
            "from threats."
        )

    recent_events = [
        entry for entry in valid_events
        if cutoff <= entry[0] <= now
    ]

    recent_failed = sum(
        1 for timestamp, _ in valid_failed_logins
        if cutoff <= timestamp <= now
    )

    return {
        "risk_level": level,
        "risk_score": score,
        "reason": reason,
        "recommendations": recommendations[:5],
        "evidence": evidence,
        "analysis_scope": "all_available_user_activity",
        "records_analyzed": len(activity_data),
        "historical_failed_login_count": failed_count,
        "historical_download_count": downloads,
        "historical_share_creation_count": shares,
        "historical_mfa_enabled_count": len(mfa_enabled_events),
        "historical_mfa_disabled_count": len(mfa_disabled_events),
        "rapid_mfa_change_pairs": rapid_mfa_changes,
        "recent_observation_window_minutes": 10,
        "recent_records_with_timestamps": len(recent_events),
        "recent_failed_login_count": recent_failed,
        "engine": SECURITY_ENGINE_VERSION,
        "note": (
            "Risk scores are rule-based indicators, not calibrated "
            "probabilities. Historical MFA events do not establish "
            "the current MFA setting."
        ),
    }


# =========================================================
# SECURITY ANALYSIS ENDPOINT
# =========================================================

@router.post("/ai/security-analyze")
def analyze_security(
    current_user: dict = Depends(get_current_user),
):
    activity_data = get_user_activities(current_user["user_id"])
    analysis = calculate_security_risk(activity_data)

    if not activity_data:
        analysis["reason"] = (
            "No activity records were found for this user. "
            "There is insufficient evidence to assess account risk."
        )
        analysis["risk_level"] = "INSUFFICIENT_DATA"

    return {
        "success": True,
        "model": SECURITY_ENGINE_VERSION,
        "analysis": analysis,
    }


# =========================================================
# SECURITY INSIGHTS ENDPOINT
# =========================================================

@router.post("/ai/security-insights")
def generate_security_insights(
    current_user: dict = Depends(get_current_user),
):
    activity_data = get_user_activities(current_user["user_id"])

    statistics = build_activity_statistics(activity_data)
    risk = calculate_security_risk(activity_data)

    event_counts = statistics["event_counts"]

    failed_logins = event_counts.get("failed_login_events", 0)
    successful_logins = event_counts.get("successful_login_events", 0)
    downloads = event_counts.get("download_events", 0)
    uploads = event_counts.get("upload_events", 0)
    shares = event_counts.get("sharing_events", 0)
    mfa_enabled = event_counts.get("mfa_enabled_events", 0)
    mfa_disabled = event_counts.get("mfa_disabled_events", 0)

    if not activity_data:
        summary = (
            "No activity records were found. A security assessment "
            "cannot be established without recorded activity."
        )
        activity_insights = (
            "There are no recorded login, file, or sharing activities."
        )
        suspicious_patterns = (
            "There is insufficient recorded evidence to assess "
            "suspicious activity."
        )
    else:
        summary = (
            f"Analyzed all {len(activity_data)} available activity records. "
            f"The rule-based engine assigned {risk['risk_level']} with "
            f"a score of {risk['risk_score']}/100."
        )

        activity_insights = (
            f"Full-history totals: {successful_logins} successful logins, "
            f"{failed_logins} failed logins, {uploads} uploads, "
            f"{downloads} downloads, {shares} share-creation events, "
            f"{event_counts.get('temporary_link_events', 0)} temporary "
            f"link events, {event_counts.get('delete_events', 0)} deletions, "
            f"{mfa_enabled} MFA-enabled events, and "
            f"{mfa_disabled} MFA-disabled events."
        )

        if risk["evidence"]:
            suspicious_patterns = (
                f"{len(risk['evidence'])} historical risk rule(s) matched. "
                "Review the evidence and context before deciding whether "
                "any event was malicious."
            )
        else:
            suspicious_patterns = (
                "No configured historical risk rules matched the available "
                "records. This does not rule out every possible threat."
            )

    insights = {
        "security_summary": summary,
        "activity_insights": activity_insights,
        "storage_and_file_usage": (
            f"The activity history references "
            f"{statistics['unique_files_in_records']} distinct filename(s). "
            "Actual storage usage cannot be calculated without file-size "
            "data."
        ),
        "suspicious_patterns": suspicious_patterns,
        "recommendations": " ".join(risk["recommendations"]),
    }

    return {
        "success": True,
        "model": SECURITY_ENGINE_VERSION,
        "statistics": statistics,
        "risk_assessment": risk,
        "insights": insights,
    }
