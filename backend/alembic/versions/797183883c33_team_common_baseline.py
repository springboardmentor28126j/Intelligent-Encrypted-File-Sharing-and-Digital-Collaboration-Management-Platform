"""team common baseline schema

Revision ID: 797183883c33
Revises: 
Create Date: 2026-09-02 00:00:00.000000

This baseline migration records the team's common Supabase PostgreSQL database schema:
  - users (id, name, email, password_hash, role, is_active, mfa_secret, mfa_enabled, storage_quota, used_storage, created_at, updated_at)
  - folders (id, name, parent_id, owner_id, created_at, updated_at)
  - files (id, owner_id, folder_id, filename, storage_path, content_type, size, category, is_deleted, created_at, updated_at, is_encrypted, encryption_key, encryption_nonce)
  - share_links (id, file_id, owner_id, token_hash, permission, expires_at, is_revoked, created_at)
  - shares (id, file_id, created_by, token_hash, permission, expires_at, max_downloads, download_count, revoked, created_at)
  - file_shares (id, file_id, owner_id, shared_with_id, permission, is_revoked, created_at, updated_at)
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "797183883c33"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="USER"),
        sa.Column("mfa_secret", sa.String(length=64), nullable=True),
        sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("storage_quota", sa.BigInteger(), nullable=False, server_default=sa.text("5368709120")),
        sa.Column("used_storage", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True, if_not_exists=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False, if_not_exists=True)

    # 2. folders table
    op.create_table(
        "folders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["folders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(op.f("ix_folders_id"), "folders", ["id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_folders_owner_id"), "folders", ["owner_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_folders_parent_id"), "folders", ["parent_id"], unique=False, if_not_exists=True)

    # 3. files table
    op.create_table(
        "files",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("folder_id", sa.Integer(), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=True),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_encrypted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("encryption_key", sa.String(length=255), nullable=True),
        sa.Column("encryption_nonce", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["folder_id"], ["folders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(op.f("ix_files_id"), "files", ["id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_files_owner_id"), "files", ["owner_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_files_folder_id"), "files", ["folder_id"], unique=False, if_not_exists=True)

    # 4. share_links table
    op.create_table(
        "share_links",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("permission", sa.String(length=20), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(op.f("ix_share_links_id"), "share_links", ["id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_share_links_file_id"), "share_links", ["file_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_share_links_owner_id"), "share_links", ["owner_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_share_links_token_hash"), "share_links", ["token_hash"], unique=True, if_not_exists=True)

    # 5. shares table
    op.create_table(
        "shares",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("permission", sa.String(length=20), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("max_downloads", sa.Integer(), nullable=True),
        sa.Column("download_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"]),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(op.f("ix_shares_id"), "shares", ["id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_shares_token_hash"), "shares", ["token_hash"], unique=True, if_not_exists=True)

    # 6. file_shares table
    op.create_table(
        "file_shares",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("shared_with_id", sa.Integer(), nullable=False),
        sa.Column("permission", sa.String(length=20), nullable=False),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["shared_with_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(op.f("ix_file_shares_id"), "file_shares", ["id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_file_shares_file_id"), "file_shares", ["file_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_file_shares_owner_id"), "file_shares", ["owner_id"], unique=False, if_not_exists=True)
    op.create_index(op.f("ix_file_shares_shared_with_id"), "file_shares", ["shared_with_id"], unique=False, if_not_exists=True)


def downgrade() -> None:
    op.drop_table("file_shares")
    op.drop_table("shares")
    op.drop_table("share_links")
    op.drop_table("files")
    op.drop_table("folders")
    op.drop_table("users")
