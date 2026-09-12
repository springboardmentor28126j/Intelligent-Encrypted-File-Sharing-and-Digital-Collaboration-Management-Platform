"""create files and file_shares tables

Revision ID: 002
Revises: 001
Create Date: 2026-09-01 00:00:00.000000

This migration creates:
  - `files` table: Encrypted file metadata, storage references, and AES-256-GCM parameters.
  - `file_shares` table: Secure sharing links, recipient access permissions, and temporary links.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create sharepermission enum type first
    sharepermission = sa.Enum("view_only", "can_download", name="sharepermission")
    sharepermission.create(op.get_bind(), checkfirst=True)

    # 1. Create files table
    op.create_table(
        "files",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=255), nullable=False),
        sa.Column("storage_backend", sa.String(length=32), nullable=False, server_default="local"),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False, server_default="application/octet-stream"),
        sa.Column("extension", sa.String(length=20), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False, server_default="other"),
        sa.Column("sha256_hash", sa.String(length=64), nullable=False),
        sa.Column("encryption_algorithm", sa.String(length=50), nullable=False, server_default="AES-256-GCM"),
        sa.Column("encrypted_dek", sa.Text(), nullable=False),
        sa.Column("nonce", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("download_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_files_id"), "files", ["id"], unique=False)
    op.create_index(op.f("ix_files_owner_id"), "files", ["owner_id"], unique=False)

    # 2. Create file_shares table
    op.create_table(
        "file_shares",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("file_id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("recipient_id", sa.Integer(), nullable=True),
        sa.Column("recipient_email", sa.String(length=255), nullable=True),
        sa.Column("share_token", sa.String(length=64), nullable=False),
        sa.Column(
            "permission",
            sa.Enum("view_only", "can_download", name="sharepermission"),
            nullable=False,
            server_default="can_download",
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("max_downloads", sa.Integer(), nullable=True),
        sa.Column("download_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_file_shares_id"), "file_shares", ["id"], unique=False)
    op.create_index(op.f("ix_file_shares_file_id"), "file_shares", ["file_id"], unique=False)
    op.create_index(op.f("ix_file_shares_owner_id"), "file_shares", ["owner_id"], unique=False)
    op.create_index(op.f("ix_file_shares_recipient_id"), "file_shares", ["recipient_id"], unique=False)
    op.create_index(op.f("ix_file_shares_recipient_email"), "file_shares", ["recipient_email"], unique=False)
    op.create_index(op.f("ix_file_shares_share_token"), "file_shares", ["share_token"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_file_shares_share_token"), table_name="file_shares")
    op.drop_index(op.f("ix_file_shares_recipient_email"), table_name="file_shares")
    op.drop_index(op.f("ix_file_shares_recipient_id"), table_name="file_shares")
    op.drop_index(op.f("ix_file_shares_owner_id"), table_name="file_shares")
    op.drop_index(op.f("ix_file_shares_file_id"), table_name="file_shares")
    op.drop_index(op.f("ix_file_shares_id"), table_name="file_shares")
    op.drop_table("file_shares")

    op.drop_index(op.f("ix_files_owner_id"), table_name="files")
    op.drop_index(op.f("ix_files_id"), table_name="files")
    op.drop_table("files")

    sa.Enum(name="sharepermission").drop(op.get_bind(), checkfirst=True)
