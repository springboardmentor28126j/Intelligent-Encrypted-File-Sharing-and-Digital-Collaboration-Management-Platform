import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.services.auth_service import AuthService
from src.schemas.auth import UserRegister, UserLogin
from src.core.security import verify_password

@pytest.mark.asyncio
async def test_auth_service_register_and_login(async_session: AsyncSession):
    register_payload = UserRegister(
        email="bob@trustshare.io",
        password="SecureP@ssw0rd2026",
        full_name="Bob Engineer"
    )
    user_res = await AuthService.register(async_session, register_payload)
    assert user_res.email == "bob@trustshare.io"
    assert user_res.role == "user"

    login_payload = UserLogin(
        email="bob@trustshare.io",
        password="SecureP@ssw0rd2026"
    )
    token_res = await AuthService.login(async_session, login_payload)
    assert token_res.access_token is not None
    assert token_res.token_type == "Bearer"

@pytest.mark.asyncio
async def test_auth_service_mfa_flow(async_session: AsyncSession):
    register_payload = UserRegister(
        email="mfa_user@trustshare.io",
        password="SecureP@ssw0rd2026",
        full_name="MFA User"
    )
    user_res = await AuthService.register(async_session, register_payload)
    from src.models.sql.user import User
    from sqlalchemy import select
    user = await async_session.scalar(select(User).where(User.email == user_res.email))

    mfa_res = await AuthService.setup_mfa(async_session, user)
    assert mfa_res.secret is not None
    assert "otpauth://" in mfa_res.qr_uri
