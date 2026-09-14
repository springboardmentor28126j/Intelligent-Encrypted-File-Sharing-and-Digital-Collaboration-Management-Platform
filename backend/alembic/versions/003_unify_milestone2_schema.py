"""unify milestone 2 schema with team common database

Revision ID: 003
Revises: 797183883c33
Create Date: 2026-09-13 00:00:00.000000

This migration non-destructively aligns the database with Milestone 2 features:
  - files table: adds storage_backend, extension, sha256_hash, encryption_algorithm, description, download_count, is_public
  - file_shares table: adds recipient_email, share_token, expires_at, max_downloads, download_count
  - backfills file extensions and defaults safely for existing team data
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "797183883c33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add Milestone 2 columns to `files` table
    with op.batch_alter_table("files") as batch_op:
        batch_op.add_column(
            sa.Column("storage_backend", sa.String(length=32), nullable=False, server_default="local")
        )
        batch_op.add_column(
            sa.Column("extension", sa.String(length=20), nullable=False, server_default="")
        )
        batch_op.add_column(
            sa.Column("sha256_hash", sa.String(length=64), nullable=False, server_default="")
        )
        batch_op.add_column(
            sa.Column("encryption_algorithm", sa.String(length=50), nullable=False, server_default="AES-256-GCM")
        )
        batch_op.add_column(
            sa.Column("description", sa.Text(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("download_count", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false"))
        )

    # Backfill file extension for existing rows if available
    try:
        bind = op.get_bind()
        if bind.dialect.name == "postgresql":
            op.execute("UPDATE files SET extension = substring(filename from '\\.[^\\.]+$') WHERE extension = '' AND filename LIKE '%.%'")
    except Exception:
        pass

    # 2. Add Milestone 2 columns to `file_shares` table
    with op.batch_alter_table("file_shares") as batch_op:
        batch_op.add_column(
            sa.Column("recipient_email", sa.String(length=255), nullable=True)
        )
        batch_op.add_column(
            sa.Column("share_token", sa.String(length=64), nullable=True)
        )
        batch_op.add_column(
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column("max_downloads", sa.Integer(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("download_count", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.alter_column("shared_with_id", existing_type=sa.Integer(), nullable=True)

    op.create_index(op.f("ix_file_shares_share_token"), "file_shares", ["share_token"], unique=True)
    op.create_index(op.f("ix_file_shares_recipient_email"), "file_shares", ["recipient_email"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_file_shares_recipient_email"), table_name="file_shares")
    op.drop_index(op.f("ix_file_shares_share_token"), table_name="file_shares")

    with op.batch_alter_table("file_shares") as batch_op:
        batch_op.drop_column("download_count")
        batch_op.drop_column("max_downloads")
        batch_op.drop_column("expires_at")
        batch_op.drop_column("share_token")
        batch_op.drop_column("recipient_email")

    with op.batch_alter_table("files") as batch_op:
        batch_op.drop_column("is_public")
        batch_op.drop_column("download_count")
        batch_op.drop_column("description")
        batch_op.drop_column("encryption_algorithm")
        batch_op.drop_column("sha256_hash")
        batch_op.drop_column("extension")
        batch_op.drop_column("storage_backend")
