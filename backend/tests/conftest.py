"""
conftest.py – pytest fixtures shared across all test files.

Sets up:
  - An in-memory SQLite database (no PostgreSQL required for unit tests)
  - A fresh DB schema before each test
  - A TestClient with DB session override so routes use the test DB
"""

import os
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.database as app_database
import app.main as app_main
from app.database import Base, get_db
from app.main import app
from app.mongodb import clear_mongo_fallback
from app.redis_client import clear_redis_fallback
from app.services.security_service import clear_security_trackers

# ─── Test Database ────────────────────────────────────────────────────────────
# SQLite in-memory is used for speed and no external dependencies.
# StaticPool ensures the same in-memory DB is reused across threads.
SQLITE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
app_database.engine = engine
app_main.engine = engine
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
app_database.SessionLocal = TestingSessionLocal




# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def setup_database():
    """
    Create all tables before each test and drop them after.
    Clears in-memory MongoDB documents, Redis cache, and security trackers between tests.
    `autouse=True` means this runs automatically for every test in the suite.
    """
    clear_mongo_fallback()
    clear_redis_fallback()
    clear_security_trackers()
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    clear_mongo_fallback()
    clear_redis_fallback()
    clear_security_trackers()



@pytest.fixture
def db_session():
    """Yields a test database session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    """
    TestClient with the DB dependency overridden to use the test SQLite database.
    This ensures tests never touch the real PostgreSQL database.
    """
    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """Create and return a standard registered user for tests."""
    from app.auth import hash_password
    from app.models import User
    user = User(
        name="Test User",
        email="test_user_fixture@example.com",
        password_hash=hash_password("Password123!"),
        role="user",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    """Return JWT Bearer Authorization header for test_user."""
    from app.auth import create_access_token
    token = create_access_token(data={"sub": test_user.email})
    return {"Authorization": f"Bearer {token}"}

