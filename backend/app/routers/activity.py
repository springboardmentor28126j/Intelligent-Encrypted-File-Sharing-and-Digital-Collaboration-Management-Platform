import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ActivityLog, File, User
from ..schemas.activity import ActivityResponse
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/api/activity", tags=["Activity"])

IST = timezone(timedelta(hours=5, minutes=30))


def format_ist_timestamp(dt: datetime | None) -> str:
    if not dt:
        return "N/A"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    ist_dt = dt.astimezone(IST)
    return ist_dt.strftime("%Y-%m-%d %I:%M:%S %p")


def _build_activity_query(
    db: Session,
    user_id: int,
    action: str = "",
    search: str = "",
    start_date: str = "",
    end_date: str = "",
):
    query = (
        db.query(ActivityLog, File)
        .outerjoin(File, ActivityLog.file_id == File.id)
        .filter(ActivityLog.user_id == user_id)
    )

    if isinstance(action, str) and action:
        query = query.filter(ActivityLog.action == action)
    if isinstance(search, str) and search:
        query = query.filter(ActivityLog.description.ilike(f"%{search}%"))
    if isinstance(start_date, str) and start_date.strip():
        try:
            sd = datetime.strptime(start_date.strip(), "%Y-%m-%d")
            query = query.filter(ActivityLog.created_at >= sd)
        except ValueError:
            pass
    if isinstance(end_date, str) and end_date.strip():
        try:
            ed = datetime.strptime(end_date.strip(), "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, microsecond=999999
            )
            query = query.filter(ActivityLog.created_at <= ed)
        except ValueError:
            pass

    return query.order_by(ActivityLog.created_at.desc())


@router.get("", response_model=list[ActivityResponse])
def list_activity(
    action: str = Query(""),
    search: str = Query(""),
    start_date: str = Query(""),
    end_date: str = Query(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns activity logs filtered by user, action, search text, and date range."""
    query = _build_activity_query(
        db,
        user_id=current_user.id,
        action=action,
        search=search,
        start_date=start_date,
        end_date=end_date,
    )
    results = query.limit(150).all()
    return [log for log, _file in results]


@router.get("/export")
def export_activity_csv(
    action: str = Query(""),
    search: str = Query(""),
    start_date: str = Query(""),
    end_date: str = Query(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generates and streams a CSV audit report for the current user's activity logs."""
    query = _build_activity_query(
        db,
        user_id=current_user.id,
        action=action,
        search=search,
        start_date=start_date,
        end_date=end_date,
    )
    results = query.all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Write CSV Header
    writer.writerow([
        "Timestamp (IST)",
        "Action",
        "File Name",
        "IP Address",
        "User Agent",
        "Details",
    ])

    for log, file_item in results:
        file_name = file_item.original_filename if file_item else "N/A"
        writer.writerow([
            format_ist_timestamp(log.created_at),
            log.action.replace("_", " ").title(),
            file_name,
            log.ip_address or "N/A",
            log.user_agent or "N/A",
            log.description or "",
        ])

    csv_content = output.getvalue()
    timestamp_str = datetime.now(IST).strftime("%Y%m%d_%H%M%S")
    filename = f"trustshare_activity_report_{timestamp_str}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
