from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
import uuid

class AuditLogEntry(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actor: Dict[str, Any]  # user_id, email, role, client_ip, user_agent
    category: str          # AUTH, FILE, SHARE, SECURITY
    action: str            # LOGIN, UPLOAD, DOWNLOAD, SHARE_CREATE, SHARE_ACCESS, REVOKE
    resource: Dict[str, Any]  # resource_type, resource_id, resource_name
    status: str            # SUCCESS, FAILURE, DENIED
    details: Dict[str, Any] = Field(default_factory=dict)

class SecurityAlertEntry(BaseModel):
    alert_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    severity: str          # LOW, MEDIUM, HIGH, CRITICAL
    type: str              # BRUTE_FORCE_PASSPHRASE, SUSPICIOUS_IP, BULK_DOWNLOAD
    target_user_id: Optional[str] = None
    source_ip: str
    description: str
    acknowledged: bool = False
