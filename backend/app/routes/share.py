from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.mongo import log_activity
from app.core.redis_client import resolve_share_token
from app.models.models import File
from app.routes.files import _decrypt_file_record

router = APIRouter(prefix="/share", tags=["share"])


@router.get("/{token}/download")
def download_via_share_link(token: str, db: Session = Depends(get_db)):
    link = resolve_share_token(token)
    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This share link is invalid or has expired",
        )
    file_id = link["file_id"]

    file_record = db.query(File).filter(File.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    plaintext = _decrypt_file_record(file_record)

    log_activity(str(file_record.owner_id), "download_via_share_link", file_id)

    return Response(
        content=plaintext,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{file_record.filename}"'},
    )
