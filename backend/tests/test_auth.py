"""
test_auth.py – Integration tests for all authentication endpoints.

Covers all 7 required test scenarios:
  ✓ 1. Valid registration
  ✓ 2. Duplicate registration (409)
  ✓ 3. Valid login
  ✓ 4. Invalid login credentials (401)
  ✓ 5. Missing token on /me (403 from HTTPBearer)
  ✓ 6. Invalid/tampered token on /me (401)
  ✓ 7. Successful protected endpoint access with valid JWT
"""

import pytest
from fastapi.testclient import TestClient

# ─── Helpers ──────────────────────────────────────────────────────────────────

VALID_USER = {
    "full_name": "Alice Smith",
    "email": "alice@example.com",
    "password": "securepassword123",
}


def register_user(client: TestClient, data: dict = None) -> dict:
    """Helper: register a user and return the response JSON."""
    payload = data or VALID_USER
    return client.post("/register", json=payload)


def login_user(client: TestClient, email: str = None, password: str = None) -> dict:
    """Helper: log in and return the response."""
    return client.post(
        "/login",
        json={
            "email": email or VALID_USER["email"],
            "password": password or VALID_USER["password"],
        },
    )


def get_token(client: TestClient) -> str:
    """Helper: register + login and return the access token string."""
    register_user(client)
    response = login_user(client)
    return response.json()["access_token"]


# ─── Test 1: Valid Registration ───────────────────────────────────────────────

def test_valid_registration(client: TestClient):
    """
    POST /register with valid data should:
      - Return 201 Created
      - Return the user object (id, full_name, email, role, created_at)
      - NOT include hashed_password in the response
    """
    response = register_user(client)

    assert response.status_code == 201, response.text

    data = response.json()
    assert data["email"] == VALID_USER["email"]
    assert data["full_name"] == VALID_USER["full_name"]
    assert data["role"] == "user"
    assert "id" in data
    assert "created_at" in data
    assert "hashed_password" not in data
    assert "password" not in data


# ─── Test 2: Duplicate Registration ──────────────────────────────────────────

def test_duplicate_registration(client: TestClient):
    """
    Registering the same email twice should:
      - First registration: 201 Created
      - Second registration: 409 Conflict
    """
    # First registration should succeed
    response1 = register_user(client)
    assert response1.status_code == 201

    # Second registration with same email should fail
    response2 = register_user(client)
    assert response2.status_code == 409
    assert "already exists" in response2.json()["detail"]


# ─── Test 3: Valid Login ──────────────────────────────────────────────────────

def test_valid_login(client: TestClient):
    """
    POST /login with correct credentials should:
      - Return 200 OK
      - Return a JWT access_token
      - Return token_type = "bearer"
    """
    register_user(client)
    response = login_user(client)

    assert response.status_code == 200, response.text

    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert len(data["access_token"]) > 0


# ─── Test 4: Invalid Login ────────────────────────────────────────────────────

def test_invalid_login_wrong_password(client: TestClient):
    """
    POST /login with wrong password should return 401 Unauthorized.
    """
    register_user(client)
    response = login_user(client, password="wrongpassword")

    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


def test_invalid_login_wrong_email(client: TestClient):
    """
    POST /login with non-existent email should return 401 Unauthorized.
    """
    response = login_user(client, email="nobody@example.com")

    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


# ─── Test 5: Missing Token ────────────────────────────────────────────────────

def test_missing_token(client: TestClient):
    """
    GET /me without an Authorization header should return 403 Forbidden.
    FastAPI's HTTPBearer scheme returns 403 (not 401) when the header is missing entirely.
    """
    response = client.get("/me")

    # HTTPBearer returns 403 when there's no Authorization header at all
    assert response.status_code == 403


# ─── Test 6: Invalid Token ────────────────────────────────────────────────────

def test_invalid_token(client: TestClient):
    """
    GET /me with a tampered/invalid JWT should return 401 Unauthorized.
    """
    response = client.get(
        "/me",
        headers={"Authorization": "Bearer this.is.not.a.valid.jwt.token"},
    )

    assert response.status_code == 401
    assert "Could not validate credentials" in response.json()["detail"]


# ─── Test 7: Protected Endpoint Access ───────────────────────────────────────

def test_protected_endpoint_access(client: TestClient):
    """
    GET /me with a valid JWT should:
      - Return 200 OK
      - Return the authenticated user's profile
      - Match the email used during registration/login
    """
    token = get_token(client)

    response = client.get(
        "/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["email"] == VALID_USER["email"]
    assert data["full_name"] == VALID_USER["full_name"]
    assert "hashed_password" not in data


# ─── Test 8: Logout and Token Blacklisting in Redis ───────────────────────────

def test_logout_revokes_token(client: TestClient):
    """
    POST /logout should:
      - Return 200 OK
      - Blacklist token in Redis
      - Subsequent requests with that token to /me should return 401 Unauthorized
    """
    token = get_token(client)

    # 1. Verify token works initially
    res1 = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert res1.status_code == 200

    # 2. Call logout
    logout_res = client.post("/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_res.status_code == 200
    assert "revoked" in logout_res.json()["message"].lower()

    # 3. Verify token is now rejected
    res2 = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert res2.status_code == 401
    assert "terminated" in res2.json()["detail"].lower() or "revoked" in res2.json()["detail"].lower()

