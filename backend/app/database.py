"""
database.py – SQLAlchemy engine, session factory, and declarative Base.

All models import `Base` from here to register their table definitions.
The `get_db` function is a FastAPI dependency that yields a DB session per request
and ensures it is closed after the request completes (even on errors).
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

# ─── Engine ───────────────────────────────────────────────────────────────────
# For SQLite, check_same_thread=False is needed so FastAPI worker threads can share connections.
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=not is_sqlite,
    echo=False,  # Set to True to log all SQL statements during development
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
