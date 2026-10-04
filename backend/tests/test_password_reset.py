"""
test_password_reset.py – Comprehensive tests for TrustShare forgot/reset password system.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PasswordResetToken, User
from app.auth import hash_password, verify_password


def test_forgot_password_registered_user(client: TestClient, db_session: Session):
    """Verify that requesting forgot password for a registered user creates a token and triggers email."""
    # Register user first
    user_email = "reset_user_1@trustshare.io"
    client.post("/register", json={
        "full_name": "Reset Test User",
        "email": user_email,
        "password": "OldPassword123!",
    })

    # Request forgot password
    res = client.post("/forgot-password", json={"email": user_email})
    assert res.status_code == 200
    data = res.json()
    assert "password reset link" in data["message"]
    assert data["email_sent"] is True

    # Check database record
    user = db_session.query(User).filter(User.email == user_email).first()
    assert user is not None

    token_rec = db_session.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,
    ).first()
    assert token_rec is not None
    exp_dt = token_rec.expires_at if token_rec.expires_at.tzinfo else token_rec.expires_at.replace(tzinfo=timezone.utc)
    assert exp_dt > datetime.now(timezone.utc)



def test_forgot_password_unknown_email(client: TestClient):
    """Verify that requesting forgot password for an unknown email returns safe response without leaking user presence."""
    res = client.post("/forgot-password", json={"email": "nonexistent_user_999@trustshare.io"})
    assert res.status_code == 200
    data = res.json()
    assert "password reset link" in data["message"]


def test_reset_password_success_workflow(client: TestClient, db_session: Session):
    """Complete forgot -> reset -> login workflow test."""
    user_email = "workflow_user@trustshare.io"
    old_pw = "InitialPassword123!"
    new_pw = "BrandNewSecurePassword456!"

    # 1. Register
    client.post("/register", json={
        "full_name": "Workflow User",
        "email": user_email,
        "password": old_pw,
    })

    # 2. Forgot password
    client.post("/forgot-password", json={"email": user_email})

    user = db_session.query(User).filter(User.email == user_email).first()
    token_rec = db_session.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,
    ).first()
    assert token_rec is not None

    # Manually create a known raw token and hash for testing
    raw_token = "secure_test_token_abcdef1234567890"
    token_rec.token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    db_session.commit()

    # 3. Reset password
    res = client.post("/reset-password", json={
        "token": raw_token,
        "new_password": new_pw,
    })
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Verify token is marked as used
    db_session.refresh(token_rec)
    assert token_rec.used is True

    # 4. Login with old password must fail
    res_old = client.post("/login", json={"email": user_email, "password": old_pw})
    assert res_old.status_code == 401

    # 5. Login with new password must succeed
    res_new = client.post("/login", json={"email": user_email, "password": new_pw})
    assert res_new.status_code == 200
    assert "access_token" in res_new.json()


def test_reset_password_invalid_token(client: TestClient):
    """Verify that an invalid token is rejected with 400 Bad Request."""
    res = client.post("/reset-password", json={
        "token": "completely_invalid_token_1234567890",
        "new_password": "NewValidPassword123!",
    })
    assert res.status_code == 400
    assert "Invalid or unrecognized" in res.json()["detail"]


def test_reset_password_token_reuse_rejected(client: TestClient, db_session: Session):
    """Verify that already used tokens cannot be reused."""
    user = User(
        name="Reuse Test",
        email="reuse@trustshare.io",
        password_hash=hash_password("pw123"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    raw_token = "reused_token_sample_1234567890"
    tok_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    token_rec = PasswordResetToken(
        user_id=user.id,
        token_hash=tok_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        used=True,  # Already used!
    )
    db_session.add(token_rec)
    db_session.commit()

    res = client.post("/reset-password", json={
        "token": raw_token,
        "new_password": "AnotherNewPassword123!",
    })
    assert res.status_code == 400
    assert "already been used" in res.json()["detail"]


def test_reset_password_expired_token(client: TestClient, db_session: Session):
    """Verify that expired tokens are rejected with 410 Gone."""
    user = User(
        name="Expired Test",
        email="expired@trustshare.io",
        password_hash=hash_password("pw123"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    raw_token = "expired_token_sample_1234567890"
    tok_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    token_rec = PasswordResetToken(
        user_id=user.id,
        token_hash=tok_hash,
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=5),  # Expired 5 minutes ago!
        used=False,
    )
    db_session.add(token_rec)
    db_session.commit()

    res = client.post("/reset-password", json={
        "token": raw_token,
        "new_password": "AnotherNewPassword123!",
    })
    assert res.status_code == 410
    assert "expired" in res.json()["detail"]
