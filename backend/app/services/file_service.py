from pathlib import Path
from uuid import uuid4
from fastapi import UploadFile
from ..config import settings

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


async def save_upload(upload: UploadFile) -> tuple[str, str, int]:
    safe_name = f"{uuid4().hex}_{Path(upload.filename or 'file').name}"
    path = UPLOAD_DIR / safe_name
    size = 0

    try:
        with path.open("wb") as output:
            while chunk := await upload.read(1024 * 1024):
                size += len(chunk)
                if size > settings.max_file_size_mb * 1024 * 1024:
                    raise ValueError(f"File must be smaller than {settings.max_file_size_mb} MB")
                output.write(chunk)
    except ValueError:
        if path.exists():
            path.unlink(missing_ok=True)
        raise

    return safe_name, str(path), size
