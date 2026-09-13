from datetime import datetime
from pathlib import Path
import uuid

from sqlalchemy import text
from app.database import engine, Base
from app.models import (
    User,
    Folder,
    File,
    FileVersion,
    FilePermission,
    ShareLink,
    Download,
)


def migrate():
    print("Starting TrustShare database migration...")

    with engine.begin() as conn:

        # Rename old tables first
        old_tables = [
            "users",
            "files",
            "shared_files",
            "temporary_links",
        ]

        existing = {
            row[0]
            for row in conn.execute(
                text("""
                    SELECT tablename
                    FROM pg_tables
                    WHERE schemaname = 'public'
                """)
            )
        }

        for table in old_tables:
            if table in existing:
                legacy_name = "legacy_" + table

                # Do not rename twice
                if legacy_name not in existing:
                    print(f"Renaming {table} -> {legacy_name}")
                    conn.execute(
                        text(f'ALTER TABLE "{table}" RENAME TO "{legacy_name}"')
                    )

        # Create the new 7-table schema
        print("Creating new TrustShare tables...")
        Base.metadata.create_all(bind=conn)

        # ---------------------------------------------------------
        # 1. USERS
        # ---------------------------------------------------------

        print("Migrating users...")

        old_users = conn.execute(
            text("""
                SELECT id, name, email, password, role
                FROM legacy_users
                ORDER BY id
            """)
        ).mappings().all()

        user_map = {}

        for old_user in old_users:
            new_id = uuid.uuid4()
            user_map[old_user["id"]] = new_id

            conn.execute(
                text("""
                    INSERT INTO users
                    (
                        id,
                        full_name,
                        email,
                        password_hash,
                        role,
                        account_status,
                        created_at,
                        updated_at
                    )
                    VALUES
                    (
                        :id,
                        :full_name,
                        :email,
                        :password_hash,
                        :role,
                        :account_status,
                        :created_at,
                        :updated_at
                    )
                """),
                {
                    "id": new_id,
                    "full_name": old_user["name"],
                    "email": old_user["email"],
                    "password_hash": old_user["password"],
                    "role": old_user["role"]
                    if old_user["role"] in ["admin", "user"]
                    else "user",
                    "account_status": "active",
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                },
            )

        print(f"Migrated {len(old_users)} users.")

        # ---------------------------------------------------------
        # 2. FILES
        # ---------------------------------------------------------

        print("Migrating files...")

        old_files = conn.execute(
            text("""
                SELECT id, filename, stored_filename, owner_id, encrypted_key
                FROM legacy_files
                ORDER BY id
            """)
        ).mappings().all()

        file_map = {}
        file_lookup = {}

        for old_file in old_files:

            if old_file["owner_id"] not in user_map:
                print(
                    f"Skipping file {old_file['id']} - owner not found."
                )
                continue

            new_file_id = uuid.uuid4()

            storage_key = (
                f"trustshare/"
                f"{old_file['owner_id']}/"
                f"{old_file['stored_filename']}"
            )

            # Reference only - never store the actual encryption key
            encryption_reference = (
                f"legacy-key:{new_file_id}"
            )

            file_map[old_file["id"]] = new_file_id

            file_lookup[
                (old_file["owner_id"], old_file["filename"])
            ] = new_file_id

            conn.execute(
                text("""
                    INSERT INTO files
                    (
                        id,
                        owner_id,
                        folder_id,
                        original_name,
                        storage_key,
                        content_type,
                        size_bytes,
                        checksum,
                        encryption_key_reference,
                        created_at,
                        updated_at,
                        deleted_at
                    )
                    VALUES
                    (
                        :id,
                        :owner_id,
                        NULL,
                        :original_name,
                        :storage_key,
                        :content_type,
                        0,
                        NULL,
                        :encryption_key_reference,
                        :created_at,
                        :updated_at,
                        NULL
                    )
                """),
                {
                    "id": new_file_id,
                    "owner_id": user_map[old_file["owner_id"]],
                    "original_name": old_file["filename"],
                    "storage_key": storage_key,
                    "content_type": "application/octet-stream",
                    "encryption_key_reference": encryption_reference,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                },
            )

            # -----------------------------------------------------
            # 3. FILE VERSIONS
            # -----------------------------------------------------

            conn.execute(
                text("""
                    INSERT INTO file_versions
                    (
                        id,
                        file_id,
                        version_number,
                        storage_key,
                        size_bytes,
                        checksum,
                        encryption_key_reference,
                        uploaded_by,
                        created_at
                    )
                    VALUES
                    (
                        :id,
                        :file_id,
                        1,
                        :storage_key,
                        0,
                        NULL,
                        :encryption_key_reference,
                        :uploaded_by,
                        :created_at
                    )
                """),
                {
                    "id": uuid.uuid4(),
                    "file_id": new_file_id,
                    "storage_key": storage_key,
                    "encryption_key_reference": encryption_reference,
                    "uploaded_by": user_map[old_file["owner_id"]],
                    "created_at": datetime.utcnow(),
                },
            )

        print(f"Migrated {len(file_map)} files.")

        # ---------------------------------------------------------
        # 4. FILE PERMISSIONS
        # ---------------------------------------------------------

        print("Migrating file permissions...")

        old_shares = conn.execute(
            text("""
                SELECT
                    id,
                    filename,
                    owner_id,
                    sender_id,
                    recipient_id,
                    permission
                FROM legacy_shared_files
                ORDER BY id
            """)
        ).mappings().all()

        permission_count = 0

        for share in old_shares:

            file_id = file_lookup.get(
                (share["owner_id"], share["filename"])
            )

            if file_id is None:
                print(
                    f"Skipping share {share['id']} - file not found."
                )
                continue

            if share["recipient_id"] not in user_map:
                continue

            if share["sender_id"] not in user_map:
                continue

            access_level = "download"

            if share["permission"] == "read":
                access_level = "view"

            conn.execute(
                text("""
                    INSERT INTO file_permissions
                    (
                        id,
                        file_id,
                        user_id,
                        access_level,
                        granted_by,
                        expires_at,
                        created_at
                    )
                    VALUES
                    (
                        :id,
                        :file_id,
                        :user_id,
                        :access_level,
                        :granted_by,
                        NULL,
                        :created_at
                    )
                    ON CONFLICT (file_id, user_id)
                    DO NOTHING
                """),
                {
                    "id": uuid.uuid4(),
                    "file_id": file_id,
                    "user_id": user_map[share["recipient_id"]],
                    "access_level": access_level,
                    "granted_by": user_map[share["sender_id"]],
                    "created_at": datetime.utcnow(),
                },
            )

            permission_count += 1

        print(f"Migrated {permission_count} file permissions.")

        # ---------------------------------------------------------
        # 5. SHARE LINKS
        # ---------------------------------------------------------

        print("Share links table created.")

        # Old temporary links are NOT copied because the old table
        # stored raw tokens. The new table stores token_hash only.

        # ---------------------------------------------------------
        # 6. DOWNLOADS
        # ---------------------------------------------------------

        print("Downloads table created.")

        print("")
        print("===================================")
        print("DATABASE MIGRATION COMPLETED")
        print("===================================")
        print("")
        print("New tables:")
        print("1. users")
        print("2. folders")
        print("3. files")
        print("4. file_versions")
        print("5. file_permissions")
        print("6. share_links")
        print("7. downloads")
        print("")
        print("Old tables were kept as legacy tables.")
        print("DO NOT delete them yet.")
        print("")


if __name__ == "__main__":
    migrate()