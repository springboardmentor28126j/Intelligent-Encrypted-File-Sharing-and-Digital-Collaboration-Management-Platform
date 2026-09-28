import platform
import socket
from datetime import datetime
from contextvars import ContextVar

from sqlalchemy.orm import Session
from starlette.requests import Request

from ..models import ActivityLog, User
from ..mongo import get_mongo_collection

_request_ip: ContextVar[str | None] = ContextVar("audit_ip", default=None)
_request_ua: ContextVar[str | None] = ContextVar("audit_ua", default=None)


def bind_request_audit_meta(request: Request) -> None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        raw_ip = forwarded.split(",")[0].strip() or None
    else:
        raw_ip = request.client.host if request.client else None

    # Resolve local or remote system name
    if not raw_ip or raw_ip in ("127.0.0.1", "localhost", "::1", "Unknown"):
        system_name = platform.node() or socket.gethostname()
    else:
        try:
            system_name = socket.gethostbyaddr(raw_ip)[0]
        except Exception:
            system_name = raw_ip

    user_agent = request.headers.get("user-agent")
    _request_ip.set(system_name)
    _request_ua.set(_truncate_user_agent(user_agent))


def _truncate_user_agent(user_agent: str | None) -> str | None:
    if not user_agent:
        return None
    return user_agent[:255]


def log_activity(
    db: Session,
    user: User,
    action: str,
    description: str,
    file_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
):
    ip_address = ip_address or _request_ip.get()
    user_agent = _truncate_user_agent(user_agent or _request_ua.get())

    db.add(
        ActivityLog(
            user_id=user.id,
            action=action,
            description=description,
            file_id=file_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
    db.commit()

    try:
        get_mongo_collection().insert_one(
            {
                "user_id": user.id,
                "action": action,
                "description": description,
                "file_id": file_id,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "created_at": datetime.utcnow(),
            }
        )
    except Exception:
        pass


def log_download_notification(
    db: Session,
    owner: User,
    downloader: User,
    file_name: str,
    file_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
):
    ip_address = ip_address or _request_ip.get()
    user_agent = _truncate_user_agent(user_agent or _request_ua.get())
    description = f"{downloader.name} ({downloader.email}) downloaded '{file_name}'"
    db.add(
        ActivityLog(
            user_id=owner.id,
            action="shared_download",
            description=description,
            file_id=file_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
    db.commit()

    try:
        get_mongo_collection().insert_one(
            {
                "user_id": owner.id,
                "action": "shared_download",
                "description": description,
                "file_id": file_id,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "created_at": datetime.utcnow(),
            }
        )
    except Exception:
        pass