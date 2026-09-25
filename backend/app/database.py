from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_timeout=30,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def _table_columns(table_name: str) -> set[str]:
    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _add_column_if_missing(connection, table_name: str, existing: set[str], column_name: str, ddl: str) -> None:
    if column_name in existing:
        return
    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {ddl}"))
    existing.add(column_name)


def ensure_schema_compatibility():
    """Add missing shared-schema columns without dropping or rewriting tables."""
    with engine.begin() as connection:
        files = _table_columns("files")
        if files:
            _add_column_if_missing(connection, "files", files, "filename", "filename VARCHAR(255) NOT NULL DEFAULT ''")
            _add_column_if_missing(connection, "files", files, "storage_path", "storage_path VARCHAR(500) NOT NULL DEFAULT ''")
            _add_column_if_missing(connection, "files", files, "content_type", "content_type VARCHAR(100)")
            _add_column_if_missing(connection, "files", files, "size", "size BIGINT NOT NULL DEFAULT 0")
            _add_column_if_missing(connection, "files", files, "is_deleted", "is_deleted BOOLEAN NOT NULL DEFAULT FALSE")
            _add_column_if_missing(connection, "files", files, "is_encrypted", "is_encrypted BOOLEAN NOT NULL DEFAULT FALSE")
            _add_column_if_missing(connection, "files", files, "encryption_key", "encryption_key VARCHAR(255)")
            _add_column_if_missing(connection, "files", files, "encryption_nonce", "encryption_nonce VARCHAR(64)")
            _add_column_if_missing(connection, "files", files, "storage_backend", "storage_backend VARCHAR(32) DEFAULT 'local'")
            _add_column_if_missing(connection, "files", files, "storage_key", "storage_key VARCHAR(500)")
            _add_column_if_missing(connection, "files", files, "extension", "extension VARCHAR(20) NOT NULL DEFAULT ''")
            _add_column_if_missing(connection, "files", files, "sha256_hash", "sha256_hash VARCHAR(64) NOT NULL DEFAULT ''")
            _add_column_if_missing(connection, "files", files, "encryption_algorithm", "encryption_algorithm VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM'")
            _add_column_if_missing(connection, "files", files, "description", "description TEXT")
            _add_column_if_missing(connection, "files", files, "download_count", "download_count INTEGER NOT NULL DEFAULT 0")
            _add_column_if_missing(connection, "files", files, "is_public", "is_public BOOLEAN NOT NULL DEFAULT FALSE")
            _add_column_if_missing(connection, "files", files, "original_filename", "original_filename VARCHAR(255)")
            _add_column_if_missing(connection, "files", files, "stored_filename", "stored_filename VARCHAR(255)")
            _add_column_if_missing(connection, "files", files, "file_path", "file_path VARCHAR(500)")
            _add_column_if_missing(connection, "files", files, "file_size", "file_size INTEGER")
            _add_column_if_missing(connection, "files", files, "file_type", "file_type VARCHAR(120) DEFAULT 'application/octet-stream'")
            _add_column_if_missing(connection, "files", files, "version", "version INTEGER DEFAULT 1")
            connection.execute(text("UPDATE files SET filename = original_filename WHERE (filename IS NULL OR filename = '') AND original_filename IS NOT NULL"))
            connection.execute(text("UPDATE files SET original_filename = filename WHERE original_filename IS NULL AND filename IS NOT NULL"))
            connection.execute(text("UPDATE files SET storage_path = COALESCE(NULLIF(storage_path, ''), storage_key, file_path, stored_filename, '')"))
            connection.execute(text("UPDATE files SET file_path = COALESCE(NULLIF(file_path, ''), storage_path, storage_key, stored_filename, '')"))
            connection.execute(text("UPDATE files SET stored_filename = COALESCE(stored_filename, storage_key, storage_path)"))
            connection.execute(text("UPDATE files SET size = file_size WHERE (size IS NULL OR size = 0) AND file_size IS NOT NULL"))
            connection.execute(text("UPDATE files SET file_size = size WHERE file_size IS NULL AND size IS NOT NULL"))
            connection.execute(text("UPDATE files SET content_type = file_type WHERE content_type IS NULL AND file_type IS NOT NULL"))
            connection.execute(text("UPDATE files SET file_type = COALESCE(file_type, content_type, 'application/octet-stream')"))

        users = _table_columns("users")
        if users:
            _add_column_if_missing(connection, "users", users, "storage_quota", "storage_quota BIGINT NOT NULL DEFAULT 5368709120")
            _add_column_if_missing(connection, "users", users, "used_storage", "used_storage BIGINT NOT NULL DEFAULT 0")
            _add_column_if_missing(connection, "users", users, "role", "role VARCHAR(20) NOT NULL DEFAULT 'user'")
            _add_column_if_missing(connection, "users", users, "updated_at", "updated_at TIMESTAMP DEFAULT NOW()")

        folders = _table_columns("folders")
        if folders:
            _add_column_if_missing(connection, "folders", folders, "parent_id", "parent_id INTEGER")

        shares = _table_columns("file_shares")
        if shares:
            _add_column_if_missing(connection, "file_shares", shares, "owner_id", "owner_id INTEGER")
            _add_column_if_missing(connection, "file_shares", shares, "shared_with_id", "shared_with_id INTEGER")
            _add_column_if_missing(connection, "file_shares", shares, "shared_with_user_id", "shared_with_user_id INTEGER")
            _add_column_if_missing(connection, "file_shares", shares, "is_revoked", "is_revoked BOOLEAN NOT NULL DEFAULT FALSE")
            _add_column_if_missing(connection, "file_shares", shares, "recipient_email", "recipient_email VARCHAR(255)")
            _add_column_if_missing(connection, "file_shares", shares, "share_token", "share_token VARCHAR(64)")
            _add_column_if_missing(connection, "file_shares", shares, "expires_at", "expires_at TIMESTAMP")
            _add_column_if_missing(connection, "file_shares", shares, "max_downloads", "max_downloads INTEGER")
            _add_column_if_missing(connection, "file_shares", shares, "download_count", "download_count INTEGER NOT NULL DEFAULT 0")
            connection.execute(text("UPDATE file_shares SET shared_with_user_id = shared_with_id WHERE shared_with_user_id IS NULL AND shared_with_id IS NOT NULL"))
            connection.execute(text("UPDATE file_shares SET shared_with_id = shared_with_user_id WHERE shared_with_id IS NULL AND shared_with_user_id IS NOT NULL"))
            connection.execute(text("UPDATE file_shares SET owner_id = files.owner_id FROM files WHERE file_shares.file_id = files.id AND file_shares.owner_id IS NULL"))

        logs = _table_columns("activity_logs")
        if logs:
            _add_column_if_missing(connection, "activity_logs", logs, "ip_address", "ip_address VARCHAR(45)")
            _add_column_if_missing(connection, "activity_logs", logs, "user_agent", "user_agent VARCHAR(255)")


def ensure_notifications_table():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if "notifications" not in table_names:
        from .models.notification import Notification
        Notification.__table__.create(bind=engine, checkfirst=True)
    else:
        notifications_cols = _table_columns("notifications")
        with engine.begin() as connection:
            _add_column_if_missing(connection, "notifications", notifications_cols, "user_id", "user_id INTEGER NOT NULL DEFAULT 1")
            _add_column_if_missing(connection, "notifications", notifications_cols, "type", "type VARCHAR(50) NOT NULL DEFAULT 'system'")
            _add_column_if_missing(connection, "notifications", notifications_cols, "notification_type", "notification_type VARCHAR(50)")
            _add_column_if_missing(connection, "notifications", notifications_cols, "title", "title VARCHAR(120) NOT NULL DEFAULT ''")
            _add_column_if_missing(connection, "notifications", notifications_cols, "message", "message TEXT NOT NULL DEFAULT ''")
            _add_column_if_missing(connection, "notifications", notifications_cols, "is_read", "is_read BOOLEAN NOT NULL DEFAULT FALSE")
            _add_column_if_missing(connection, "notifications", notifications_cols, "created_at", "created_at TIMESTAMP DEFAULT NOW()")

            if "notification_type" in notifications_cols:
                connection.execute(text("UPDATE notifications SET type = notification_type WHERE (type IS NULL OR type = '' OR type = 'system') AND notification_type IS NOT NULL"))
                connection.execute(text("UPDATE notifications SET notification_type = type WHERE notification_type IS NULL AND type IS NOT NULL"))

            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id);"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_notifications_is_read ON notifications (is_read);"))


def ensure_user_mfa_columns():
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(64);"))


def ensure_file_storage_columns():
    ensure_schema_compatibility()
    ensure_user_mfa_columns()
    ensure_notifications_table()

# In backend/app/database.py inside ensure_file_storage_columns or a new helper:
def ensure_activity_log_columns():
    columns = {column["name"] for column in inspect(engine).get_columns("activity_logs")}
    with engine.begin() as connection:
        if "ip_address" not in columns:
            connection.execute(text("ALTER TABLE activity_logs ADD COLUMN ip_address VARCHAR(45)"))
        if "user_agent" not in columns:
            connection.execute(text("ALTER TABLE activity_logs ADD COLUMN user_agent VARCHAR(255)"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
