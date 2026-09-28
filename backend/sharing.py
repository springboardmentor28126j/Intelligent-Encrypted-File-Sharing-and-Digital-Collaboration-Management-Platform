import os
import secrets
from datetime import datetime, timedelta, timezone

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def get_db_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured in .env")

    return psycopg2.connect(DATABASE_URL)


def ensure_share_table():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS trustshare_shares (
            id BIGSERIAL PRIMARY KEY,
            token TEXT UNIQUE NOT NULL,
            filename TEXT NOT NULL,
            owner_email TEXT NOT NULL,
            allowed_email TEXT NOT NULL,
            permission TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    conn.commit()
    cur.close()
    conn.close()


def create_share_link(
    filename,
    owner_email,
    allowed_email,
    permission="view",
    expiry_minutes=60,
):
    if permission not in ["view", "download"]:
        raise ValueError("Permission must be view or download")

    if expiry_minutes <= 0:
        raise ValueError("Expiry must be greater than 0 minutes")

    ensure_share_table()

    token = secrets.token_urlsafe(32)

    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=expiry_minutes
    )

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO trustshare_shares
        (
            token,
            filename,
            owner_email,
            allowed_email,
            permission,
            expires_at
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING token
        """,
        (
            token,
            filename,
            owner_email,
            allowed_email,
            permission,
            expires_at,
        ),
    )

    saved_token = cur.fetchone()[0]

    conn.commit()
    cur.close()
    conn.close()

    return saved_token


def get_share_link(token, user_email):
    ensure_share_table()

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            token,
            filename,
            owner_email,
            allowed_email,
            permission,
            expires_at,
            created_at
        FROM trustshare_shares
        WHERE token = %s
        """,
        (token,),
    )

    row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        return None, "Invalid share link"

    (
        saved_token,
        filename,
        owner_email,
        allowed_email,
        permission,
        expires_at,
        created_at,
    ) = row

    now = datetime.now(timezone.utc)

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now >= expires_at:
        return None, "Share link has expired"

    if user_email != allowed_email:
        return None, "You do not have permission to access this file"

    share = {
        "token": saved_token,
        "filename": filename,
        "owner_email": owner_email,
        "allowed_email": allowed_email,
        "permission": permission,
        "expires_at": expires_at,
        "created_at": created_at,
    }

    return share, None