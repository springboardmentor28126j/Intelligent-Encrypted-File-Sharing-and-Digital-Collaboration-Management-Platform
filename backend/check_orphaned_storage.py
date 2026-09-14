"""
Checks whether any file record in the database still points at
backend/storage/ -- the old, orphaned folder left over from before the
current LocalDiskBackend (which uses backend/uploads/ instead).

Run this BEFORE deleting the storage/ folder, to make sure you're not
about to delete something a live database row still references.

Usage:
    python check_orphaned_storage.py
"""
from database import SessionLocal
from models import File


def main():

    db = SessionLocal()

    try:
        all_files = db.query(File).all()

        pointing_at_storage_folder = [
            f for f in all_files
            if "storage" in f.stored_filename.replace("\\", "/").split("/")
        ]

        if not pointing_at_storage_folder:
            print("No database rows reference the storage/ folder.")
            print("It should be safe to delete backend/storage/ entirely.")
        else:
            print(f"WARNING: {len(pointing_at_storage_folder)} file record(s) still reference storage/:")
            for f in pointing_at_storage_folder:
                print(f"  - File id={f.id}, filename={f.filename!r}, stored_filename={f.stored_filename!r}")
            print()
            print("Do NOT delete storage/ until these records are either")
            print("migrated to uploads/ or removed from the database.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
