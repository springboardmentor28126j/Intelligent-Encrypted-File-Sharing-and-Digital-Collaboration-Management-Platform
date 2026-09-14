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

    for table in ["users", "files", "shares"]:
        print(f"\n{table.upper()} TABLE COLUMNS:")
        print("-" * 70)

        cur.execute("""
            SELECT
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
            ORDER BY ordinal_position;
        """, (table,))

        rows = cur.fetchall()

        if not rows:
            print("TABLE DOES NOT EXIST")
        else:
            for row in rows:
                print(row)

            cur.execute(f'SELECT COUNT(*) FROM "{table}";')
            print(f"ROW COUNT: {cur.fetchone()[0]}")

finally:
    conn.close()