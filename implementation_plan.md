# TrustShare – Milestone 1: Project Setup & Authentication Foundation

## Overview

Build the complete authentication foundation for TrustShare — a secure file-sharing system. This milestone establishes the full-stack skeleton: FastAPI backend with JWT auth, PostgreSQL database with SQLAlchemy/Alembic, and a Next.js frontend with registration, login, and a protected dashboard.

---

## Open Questions

> [!IMPORTANT]
> **PostgreSQL Connection**: Do you have PostgreSQL installed locally, or should we rely entirely on Docker for the DB? The plan assumes Docker Compose manages PostgreSQL so no local install is needed.

> [!IMPORTANT]
> **Docker**: Do you have Docker Desktop installed and running? If not, we can also provide a manual setup path.

> [!NOTE]
> **JWT Secret**: The `.env.example` will contain placeholder values. You'll need to fill in a real `SECRET_KEY` before running in production.

---

## Proposed Changes

### Project Root

#### [NEW] `.gitignore`
Standard gitignore for Python, Node.js, `.env` files, and Docker artifacts.

#### [NEW] `README.md`
Professional README with setup instructions, API reference, and architecture overview.

#### [NEW] `docker-compose.yml`
Orchestrates three services:
- `db` — PostgreSQL 15
- `backend` — FastAPI (Python 3.11)
- `frontend` — Next.js 14

---

### Backend (`backend/`)

#### [NEW] `backend/requirements.txt`
Dependencies:
- `fastapi`, `uvicorn[standard]`
- `sqlalchemy`, `alembic`
- `psycopg2-binary`
- `python-jose[cryptography]` (JWT)
- `passlib[bcrypt]` (password hashing)
- `python-dotenv`
- `pydantic[email]`
- `pytest`, `httpx` (testing)

#### [NEW] `backend/.env.example`
Template with: `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`

#### [NEW] `backend/app/__init__.py`
Package init.

#### [NEW] `backend/app/main.py`
FastAPI application entry point. Registers routers, CORS middleware, and the `/health` endpoint.

#### [NEW] `backend/app/database.py`
SQLAlchemy engine, `SessionLocal` factory, and `Base` declarative base. DB URL read from env.

#### [NEW] `backend/app/models.py`
`User` SQLAlchemy model with fields: `id`, `full_name`, `email`, `hashed_password`, `role`, `created_at`.

#### [NEW] `backend/app/schemas.py`
Pydantic v2 schemas:
- `UserCreate` (registration input)
- `UserLogin` (login input)
- `UserOut` (safe public output — no password)
- `Token` (JWT response)

#### [NEW] `backend/app/auth.py`
Auth utilities:
- `hash_password` / `verify_password` (bcrypt via passlib)
- `create_access_token` (JWT via python-jose)
- `get_current_user` (FastAPI dependency — decodes JWT from Bearer header)

#### [NEW] `backend/app/routers/auth.py`
API routes:
- `POST /register` — validates email, checks duplicates, hashes password, saves user
- `POST /login` — verifies credentials, issues JWT
- `GET /me` — protected; returns current user details

#### [NEW] `backend/alembic.ini`
Alembic configuration file.

#### [NEW] `backend/alembic/env.py`
Alembic env that imports `Base.metadata` for auto-generated migrations.

#### [NEW] `backend/alembic/versions/001_create_users_table.py`
Initial migration: creates the `users` table.

#### [NEW] `backend/tests/test_auth.py`
pytest tests covering all 7 scenarios:
1. Valid registration
2. Duplicate registration (409)
3. Valid login
4. Invalid login (401)
5. Missing token on `/me` (401)
6. Invalid token on `/me` (401)
7. Successful protected endpoint access

---

### Frontend (`src/`)

Next.js 14 app with TypeScript and the App Router pattern.

#### [NEW] `src/app/layout.tsx`
Root layout with Google Fonts (Inter), global metadata.

#### [NEW] `src/app/page.tsx`
**Home Page** — Hero landing page with TrustShare branding, links to Register/Login.

#### [NEW] `src/app/register/page.tsx`
**Register Page** — Form with Full Name, Email, Password fields. On success redirects to `/login`.

#### [NEW] `src/app/login/page.tsx`
**Login Page** — Form with Email, Password. On success stores JWT in `localStorage`, redirects to `/dashboard`.

#### [NEW] `src/app/dashboard/page.tsx`
**Dashboard Page** — Protected. Reads JWT from `localStorage`, calls `GET /me`, displays user details. Redirects to `/login` if no token.

#### [NEW] `src/lib/api.ts`
Centralized API client. Functions: `registerUser`, `loginUser`, `getCurrentUser`.

#### [NEW] `src/app/globals.css`
Premium design system: dark theme, glassmorphism cards, smooth animations, gradient accents.

---

## Verification Plan

### Automated Tests
```bash
cd backend
pytest tests/test_auth.py -v
```
All 7 test cases must pass.

### Manual Verification
1. `docker-compose up` starts all three services without errors
2. `GET http://localhost:8000/health` returns `{"status": "healthy"}`
3. Register a new user via the frontend form
4. Login with that user — JWT stored, dashboard loads
5. Dashboard shows user's name/email from `/me`
6. Accessing `/dashboard` directly without login redirects to `/login`

---

## Architecture Diagram

```
Browser (Next.js :3000)
       │
       │  HTTP (REST)
       ▼
FastAPI Backend (:8000)
       │
       │  SQLAlchemy ORM
       ▼
PostgreSQL DB (:5432)
```

---

## Milestone 1 Completion Checklist

- [ ] Project structure created
- [ ] Docker Compose configured
- [ ] `GET /health` endpoint working
- [ ] PostgreSQL User model + Alembic migration
- [ ] `POST /register` with validation & bcrypt
- [ ] `POST /login` with JWT issuance
- [ ] `GET /me` protected endpoint
- [ ] Next.js frontend: Home, Register, Login, Dashboard pages
- [ ] Frontend ↔ Backend integration working end-to-end
- [ ] All 7 pytest tests passing
