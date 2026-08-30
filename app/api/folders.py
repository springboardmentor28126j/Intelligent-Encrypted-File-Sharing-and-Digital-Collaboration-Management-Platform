from datetime import datetime, timezone

from app.api.dependencies import CurrentUserDep, DatabaseDep
from app.models.file import Folder
from fastapi import APIRouter, HTTPException, status

#from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/folders",
    tags=["Folders"],
)


@router.post("/")
def create_folder(
    name: str,
    current_user: CurrentUserDep,
    db: DatabaseDep,
    parent_id: int | None = None,
):
    name = name.strip()

    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Folder name is required",
        )

    if parent_id is not None:
        parent = (
            db.query(Folder)
            .filter(
                Folder.id == parent_id,
                Folder.owner_id == current_user.id,
            )
            .first()
        )

        if not parent :
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent folder not found"
            )

    folder = Folder(
        name=name,
        owner_id=current_user.id,
        parent_id=parent_id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    db.add(folder)
    db.commit()
    db.refresh(folder)

    return {
        "message": "Folder created successfully",
        "folder_id": folder.id,
        "name": folder.name,
        "parent_id": folder.parent_id,
    }


@router.get("/")
def list_folders(
    current_user: CurrentUserDep,
    db: DatabaseDep,
    parent_id: int | None = None,
):
    query = db.query(Folder).filter(Folder.owner_id == current_user.id)

    if parent_id is None:
        query = query.filter(Folder.parent_id.is_(None))
    else:
        query = query.filter(Folder.parent_id == parent_id)
    
    folders = query.order_by(Folder.created_at.desc()).all()

    return [
        {
            "id": folder.id,
            "name": folder.name,
            "parent_id": folder.parent_id,
            "created_at": folder.created_at,
            "updated_at": folder.updated_at,
        }
        for folder in folders
    ]


@router.delete("/{folder_id}")
def delete_folder(
    folder_id: int,
    current_user: CurrentUserDep,
    db: DatabaseDep,
):
    folder = (
        db.query(Folder)
        .filter(
            Folder.id == folder_id,
            Folder.owner_id == current_user.id,
        )
        .first()
    )

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found",
        )

    db.delete(folder)
    db.commit()

    return {
        "message": "Folder deleted successfully",
        "folder_id": folder_id,
    }