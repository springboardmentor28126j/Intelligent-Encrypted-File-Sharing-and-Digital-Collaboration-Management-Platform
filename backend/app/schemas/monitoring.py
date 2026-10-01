from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    id: int
    user_id: int | None
    action: str
    resource_type: str | None
    resource_id: str | None
    status: str
    ip_address: str | None
    created_at: datetime
    details: dict | None

    model_config = ConfigDict(from_attributes=True)


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SecurityAlertResponse(BaseModel):
    id: int
    alert_type: str
    severity: str
    title: str
    description: str
    status: str
    ip_address: str | None
    created_at: datetime
    resolved_at: datetime | None
    metadata_json: dict | None

    model_config = ConfigDict(from_attributes=True)


class NotificationReadResponse(BaseModel):
    success: bool


class DashboardAnalytics(BaseModel):
    total_files: int
    total_storage: int
    storage_quota: int
    storage_percentage: float
    total_uploads: int
    total_downloads: int
    total_shares: int
    total_audit_events: int
    unread_notifications: int
    open_security_alerts: int