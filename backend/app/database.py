"""
database.py – SQLAlchemy engine, session factory, and declarative Base.

All models import `Base` from here to register their table definitions.
The `get_db` function is a FastAPI dependency that yields a DB session per request
and ensures it is closed after the request completes (even on errors).
"""

from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

# ─── Engine ───────────────────────────────────────────────────────────────────
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {"sslmode": "require", "connect_timeout": 10}

if is_sqlite:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        echo=False,
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        poolclass=NullPool,
        echo=False,
    )

# ─── Session Factory ──────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ─── Declarative Base ─────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """All SQLAlchemy models inherit from this Base."""
    pass


def init_database_schema():
    """
    Initialize tables and perform lightweight non-destructive column additions
    for SQLite and PostgreSQL.
    """
    import logging
    from sqlalchemy import inspect, text

    logger = logging.getLogger("trustshare.database")
    try:
        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)
        
        # Check users table columns
        if "users" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("users")]
            with engine.begin() as conn:
                if "failed_login_attempts" not in columns:
                    logger.info("Migrating schema: adding 'failed_login_attempts' to users table.")
                    conn.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0"))
                if "locked_until" not in columns:
                    logger.info("Migrating schema: adding 'locked_until' to users table.")
                    conn.execute(text("ALTER TABLE users ADD COLUMN locked_until TIMESTAMP NULL"))
        logger.info("Database schema initialized and verified successfully.")
    except Exception as exc:
        logger.warning(f"Database schema initialization warning: {exc}")


# ─── FastAPI Dependency ───────────────────────────────────────────────────────
def get_db():
    """
    Yields a database session for use in a single request.
    Guarantees the session is closed when the request finishes.

    Usage:
        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

