from audit_log import log_activity, get_audit_logs


# =========================================================
# TEST LOGS
# =========================================================

log_activity(
    action="UPLOAD",
    user_email="user@example.com",
    filename="Shreeram Patil Resume.pdf",
    status="success",
    details="File encrypted and uploaded"
)

log_activity(
    action="SHARE_CREATED",
    user_email="owner@example.com",
    filename="Shreeram Patil Resume.pdf",
    status="success",
    details="File shared with user@example.com"
)

log_activity(
    action="ACCESS_DENIED",
    user_email="wrong@example.com",
    filename="Shreeram Patil Resume.pdf",
    status="denied",
    details="Unauthorized user"
)

log_activity(
    action="LINK_EXPIRED",
    user_email="user@example.com",
    filename="Shreeram Patil Resume.pdf",
    status="denied",
    details="Temporary sharing link expired"
)


# =========================================================
# DISPLAY LOGS
# =========================================================

logs = get_audit_logs()

print("\nAudit Logs:\n")

for log in logs:
    print(log)