from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_active_user,
)
from app.core.database import get_db
from app.models.file import Folder
from app.schemas.folder import (
    FolderCreate,
    FolderRename,
    FolderResponse,
)
from app.services.folder import (
    create_folder,
    delete_folder,
    list_folders,
)

router = APIRouter(
    prefix="/folders",
    tags=["Folders"],
)


@router.post(
    "",
    response_model=FolderResponse,
)
def create(
    data: FolderCreate,
    current_user=Depends(
        get_current_active_user
    ),
    db: Session = Depends(get_db),
):

    try:

        return create_folder(
            db,
            current_user.id,
            data.name,
            data.parent_id,
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.get(
    "",
    response_model=list[FolderResponse],
)
def list_all(
    parent_id: int | None = None,
    current_user=Depends(
        get_current_active_user
    ),
    db: Session = Depends(get_db),
):

    return list_folders(
        db,
        current_user.id,
        parent_id,
    )


@router.delete(
    "/{folder_id}",
)
def delete(
    folder_id: int,
    current_user=Depends(
        get_current_active_user
    ),
    db: Session = Depends(get_db),
):

    try:

        delete_folder(
            db,
            current_user.id,
            folder_id,
        )

        return {
            "message": "Folder deleted successfully"
        }

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

@router.patch("/{folder_id}", response_model=FolderResponse)
def rename(
    folder_id: int,
    data: FolderRename,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    folder = db.scalar(select(Folder).where(Folder.id == folder_id, Folder.owner_id == current_user.id))
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Folder name is required")
    folder.name = name
    db.commit(); db.refresh(folder)
    return folder
