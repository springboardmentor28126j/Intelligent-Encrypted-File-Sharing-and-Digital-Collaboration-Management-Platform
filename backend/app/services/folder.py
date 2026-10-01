from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.file import File, Folder


def create_folder(
    db: Session,
    owner_id: int,
    name: str,
    parent_id: int | None=None
) -> Folder:

    if parent_id is not None:

        parent = db.scalar(
            select(Folder).where(
                Folder.id == parent_id,
                Folder.owner_id == owner_id,
            )
        )

        if not parent:
            raise ValueError("Parent folder not found")


    folder = Folder(
        name=name.strip(),
        parent_id=parent_id,
        owner_id=owner_id,
    )

    db.add(folder)
    db.commit()
    db.refresh(folder)

    return folder

def list_folders(
    db:Session,
    owner_id: int,
    parent_id: int | None=None,
) -> list[Folder]:

    return list(
        db.scalars(
            select(Folder)
            .where(
                Folder.owner_id == owner_id,
                Folder.parent_id == parent_id,
            )
            .order_by(Folder.name)
        )
    )

def delete_folder(
        db: Session,
        owner_id: int,
        folder_id: int,
) -> None:

    folder = db.scalar(
        select(Folder).where(
            Folder.id == folder_id,
            Folder.owner_id == owner_id,
        )
    )

    if not folder:
        raise ValueError("Folder not found")
    
    child_exists = db.scalar(
        select(Folder.id)
        .where(Folder.parent_id == folder_id).limit(1)
    )

    if child_exists:
        raise ValueError("Folder contains subfolders")

    file_exists = db.scalar(
        select(File.id)
        .where(
            File.folder_id == folder_id,
            File.is_deleted.is_(False),
        )
        .limit(1)
    )

    if file_exists:
        raise ValueError("Folder contains files")

    db.delete(folder)
    db.commit()