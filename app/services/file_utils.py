from pathlib import Path

from app.models.file import FileCategory

DOCUMENT_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
}

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
}

ARCHIVE_EXTENSIONS = {
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
}

CODE_EXTENSIONS = {
    ".py",
    ".js",
    ".ts",
    ".java",
    ".cpp",
    ".c",
    ".html",
    ".css",
    ".json",
}


def get_file_category(filename: str) -> FileCategory:
    extension = Path(filename).suffix.lower()

    if extension in DOCUMENT_EXTENSIONS:
        return FileCategory.DOCUMENT

    if extension in IMAGE_EXTENSIONS:
        return FileCategory.IMAGE

    if extension in ARCHIVE_EXTENSIONS:
        return FileCategory.ARCHIVE

    if extension in CODE_EXTENSIONS:
        return FileCategory.CODE

    return FileCategory.OTHER