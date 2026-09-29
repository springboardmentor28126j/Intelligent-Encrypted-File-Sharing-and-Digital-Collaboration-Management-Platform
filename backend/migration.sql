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

CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    file_id INTEGER,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    ip_address VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20),
    description TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE activity_logs
ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE notifications
ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE security_alerts
ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE shares
ADD COLUMN IF NOT EXISTS recipient_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_shares_recipient_id
ON shares(recipient_id);
