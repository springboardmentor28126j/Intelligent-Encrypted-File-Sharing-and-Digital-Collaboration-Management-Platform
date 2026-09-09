from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def ensure_file_storage_columns():
    columns = {column["name"] for column in inspect(engine).get_columns("files")}
    with engine.begin() as connection:
        if "storage_backend" not in columns:
            connection.execute(text("ALTER TABLE files ADD COLUMN storage_backend VARCHAR(20)"))
        if "storage_key" not in columns:
            connection.execute(text("ALTER TABLE files ADD COLUMN storage_key VARCHAR(500)"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
