-- =========================================================
-- Milestone 2 migration
-- =========================================================
--
-- SQLAlchemy's Base.metadata.create_all() only creates tables that
-- don't exist yet. It will happily create the new "shares" table,
-- but it will NOT add new columns to your existing "files" table.
-- Run this once against your database before starting the updated
-- backend.
--
-- Usage:
--   psql -U postgres -h localhost -d trustshare_db -f migration.sql
--
-- =========================================================

ALTER TABLE files ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS encryption_key VARCHAR(255);
ALTER TABLE files ADD COLUMN IF NOT EXISTS encryption_nonce VARCHAR(64);
ALTER TABLE files ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS shares (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    permission VARCHAR(20) NOT NULL DEFAULT 'download',
    expires_at TIMESTAMP NOT NULL,
    max_downloads INTEGER,
    download_count INTEGER NOT NULL DEFAULT 0,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shares_token_hash ON shares(token_hash);

-- Files that already exist in your database will have is_encrypted = FALSE
-- and no encryption_key/nonce. The updated /download/{file_id} and
-- /share/{token} routes handle this automatically -- they only attempt
-- decryption when is_encrypted is TRUE.
