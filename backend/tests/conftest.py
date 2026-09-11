import pytest
import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from src.models.sql.database import Base, get_db
from src.models.sql.user import User
from src.core.security import get_password_hash, create_access_token
from src.main import app
import httpx

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def async_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def test_user(async_session: AsyncSession) -> User:
    user = User(
        email="testuser@trustshare.io",
        hashed_password=get_password_hash("StrongP@ssw0rd!"),
        full_name="Alice Developer",
        role="user",
        mfa_enabled=False
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user

@pytest.fixture
async def auth_headers(test_user: User) -> dict[str, str]:
    token = create_access_token(subject=test_user.id, role=test_user.role)
    return {"Authorization": f"Bearer {token}"}

from src.storage.s3_adapter import LocalFileStorageAdapter

@pytest.fixture(autouse=True)
def test_storage(tmp_path, monkeypatch):
    adapter = LocalFileStorageAdapter(base_dir=str(tmp_path / "test_storage"))
    monkeypatch.setattr("src.storage.s3_adapter.get_storage_adapter", lambda: adapter)
    monkeypatch.setattr("src.services.file_service.get_storage_adapter", lambda: adapter)
    yield adapter

@pytest.fixture
async def client(async_session: AsyncSession) -> AsyncGenerator[httpx.AsyncClient, None]:
    async def override_get_db():
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
