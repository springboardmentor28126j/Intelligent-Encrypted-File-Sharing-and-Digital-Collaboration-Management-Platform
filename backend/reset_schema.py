from app.core.config import settings
from sqlalchemy import create_engine, text

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    conn.execute(text("DROP SCHEMA IF EXISTS trustshare_jolsna CASCADE"))
    conn.commit()
print("Done. Your private schema was reset.")
