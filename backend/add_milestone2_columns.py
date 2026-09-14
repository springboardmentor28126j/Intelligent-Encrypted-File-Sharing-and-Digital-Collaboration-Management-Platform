import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set in the .env file")

conn = psycopg2.connect(DATABASE_URL)

try:
    cur = conn.cursor()

    cur.execute("""
        ALTER TABLE files
        ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT FALSE;

        ALTER TABLE files
        ADD COLUMN IF NOT EXISTS encryption_key VARCHAR(255);

        ALTER TABLE files
        ADD COLUMN IF NOT EXISTS encryption_nonce VARCHAR(64);
    """)

    conn.commit()

    print("Milestone 2 encryption columns added successfully.")

finally:
    conn.close()