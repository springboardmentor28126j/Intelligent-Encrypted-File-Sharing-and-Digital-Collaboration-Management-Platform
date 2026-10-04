# TrustShare – Enterprise Secure File-Sharing & Digital Collaboration Platform

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111.0-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.5-black.svg)](https://nextjs.org/)
[![Security](https://img.shields.io/badge/Encryption-AES--256--GCM-green.svg)](https://csrc.nist.gov/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-69%20Passed-brightgreen.svg)]()

TrustShare is a production-grade, zero-trust secure file-sharing and digital collaboration management platform. It combines **AES-256-GCM server-side authenticated envelope encryption**, **role-based access control (RBAC)**, **cloud object storage (Supabase / AWS S3)**, **granular temporary link sharing with expiration and revocation**, **real-time security notifications**, **tamper-evident audit logging**, and an **interactive analytics dashboard**.

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Key Features](#2-key-features)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Frontend Setup](#5-frontend-setup)
6. [Backend Setup](#6-backend-setup)
7. [Database Setup & Migrations](#7-database-setup--migrations)
8. [Cloud Storage Setup](#8-cloud-storage-setup)
9. [Environment Variables Reference](#9-environment-variables-reference)
10. [Running Locally](#10-running-locally)
11. [Running with Docker & Docker Compose](#11-running-with-docker--docker-compose)
12. [Automated Testing Suite](#12-automated-testing-suite)
13. [Security Architecture & Verification](#13-security-architecture--verification)
14. [Deployment Instructions](#14-deployment-instructions)
15. [API Overview & Endpoints](#15-api-overview--endpoints)
16. [End-to-End Workflow](#16-end-to-end-workflow)
17. [Milestones 1–4 Completion Summary](#17-milestones-14-completion-summary)

---

## 1. Project Overview

Modern organizations handle sensitive financial, legal, and operational documents that require stringent data protection standards (GDPR, HIPAA, SOC 2). TrustShare eliminates the security vulnerabilities of unencrypted cloud drives and generic file sharing links by implementing:
- Server-side cryptographic envelope encryption for every file.
- Automatic key isolation where raw encryption keys never leave the backend.
- Granular permission management (view-only vs. download) and time-limited tokenized access.
- Comprehensive immutable audit trails for every file operation.

---

## 2. Key Features

- **Authenticated AES-256-GCM Encryption**: Every file payload is encrypted with a distinct 256-bit Data Encryption Key (DEK) and a unique 96-bit nonce, verifying data integrity and authenticity.
- **Envelope Key Management (KEK/DEK)**: DEKs are protected using a 256-bit Master Key (Key Encryption Key) before storage.
- **Cloud & Local Storage Vaults**: Native support for Supabase Object Storage / AWS S3 buckets with fallback to a secure local encrypted disk vault.
- **Granular Sharing & Link Controls**:
  - Expiration periods: 1 hour, 24 hours, 7 days, 30 days, or custom timestamp.
  - Permission scopes: `can_download` or `view_only`.
  - Max download limits: Link auto-invalidates once download threshold is reached.
  - Instant Revocation: Revoke links on demand with immediate effect.
  - Direct user-to-user sharing with registered platform members.
- **Activity Monitoring & Audit Logging**: Automatic structured recording of logins, uploads, downloads, sharing events, and revocations with IP addresses and user agents.
- **Real-Time Security Notifications**: Alert users when files are shared, downloaded, or suspicious logins occur.
- **Interactive Analytics Dashboard**: Visual breakdown of storage by category, download trends, active links, and storage metrics.
- **Multi-Device Responsive Design**: Fully optimized UI supporting desktop monitors, laptops, tablets, and mobile smartphones.

---

## 3. System Architecture

```
                          ┌───────────────────────────┐
                          │    Next.js 14 Frontend    │
                          │   (React, Glassmorphism)  │
                          └─────────────┬─────────────┘
                                        │ JWT Bearer / HTTPS
                                        ▼
                          ┌───────────────────────────┐
                          │      FastAPI Backend      │
                          │  (Auth, Routers, Services)│
                          └──────┬─────────────┬──────┘
                                 │             │
                 ┌───────────────┴────┐        └────────────────┐
                 ▼                    ▼                         ▼
      ┌────────────────────┐ ┌─────────────────┐      ┌──────────────────┐
      │  PostgreSQL / DB   │ │   MongoDB Atlas │      │   Redis Cache    │
      │ (Users, Shares,    │ │ (Metadata, Logs │      │ (Token Blacklist,│
      │  RBAC, SQLite dev) │ │  & Analytics)   │      │  Rate Limits)    │
      └────────────────────┘ └─────────────────┘      └──────────────────┘
                 │
                 ▼
      ┌─────────────────────────────┐
      │    Envelope Key Manager     │
      │  Master KEK (256-bit AES)   │
      └──────────────┬──────────────┘
                     │ (Protects per-file DEK)
                     ▼
      ┌─────────────────────────────┐
      │   AES-256-GCM Engine        │
      │ (Ciphertext + 16-byte Tag)  │
      └──────────────┬──────────────┘
                     │ (Stores strictly ciphertext)
                     ▼
      ┌─────────────────────────────┐
      │    Cloud Object Storage     │
      │   (Supabase S3 / Vault)     │
      └─────────────────────────────┘
```

---

## 4. Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Vanilla CSS Design System with responsive breakpoints.
- **Backend**: Python 3.11/3.12, FastAPI, SQLAlchemy ORM, Pydantic v2, Alembic.
- **Cryptography**: `cryptography` (hazmat AESGCM primitives), `python-jose` (JWT), `passlib` + `bcrypt`.
- **Databases**:
  - Relational: PostgreSQL 15 / SQLite (Local zero-config).
  - Document: MongoDB 6.0 (File metadata catalog & audit trail).
  - In-Memory: Redis 7.0 (Session revocation & rate limiting).
- **Storage**: Supabase Cloud Storage API & Local Encrypted Storage Engine.
- **Containerization**: Docker, Docker Compose, Multi-stage builds.
- **Testing**: Pytest, FastAPI TestClient, AnyIO, AsyncIO.

---

## 5. Frontend Setup

```bash
# 1. Install Node dependencies
npm install

# 2. Configure environment (optional, defaults to http://localhost:8000)
# NEXT_PUBLIC_API_URL=http://localhost:8000 in .env.local

# 3. Launch development server
npm run dev
```
Frontend runs at: `http://localhost:3000`

---

## 6. Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create and activate virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux / macOS:
source .venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Copy environment configuration
cp .env.example .env

# 5. Launch FastAPI backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Backend runs at: `http://localhost:8000`
Interactive Swagger API docs: `http://localhost:8000/docs`

---

## 7. Database Setup & Migrations

For SQLite (default local mode):
- Schema is automatically initialized on backend startup via SQLAlchemy metadata.

For PostgreSQL / Supabase:
```bash
cd backend
# Run Alembic migrations
alembic upgrade head
```

---

## 8. Cloud Storage Setup

TrustShare supports both Supabase Object Storage and local filesystem storage.

### Option A: Supabase Cloud Storage (Recommended for Cloud)
1. Create a project at [supabase.com](https://supabase.com).
2. Create a private bucket named `trustshare-files`.
3. In `backend/.env` configure:
   ```env
   STORAGE_BACKEND=supabase
   SUPABASE_URL=https://<your-project-ref>.supabase.co
   SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   SUPABASE_STORAGE_BUCKET=trustshare-files
   ```

### Option B: Local Encrypted Storage (Default for Local Dev)
```env
STORAGE_BACKEND=local
UPLOAD_DIR=./uploads
```
Files are encrypted with AES-256-GCM before being stored in `./uploads/encrypted/`.

---

## 9. Environment Variables Reference

| Variable | Description | Default / Example |
|---|---|---|
| `DATABASE_URL` | Primary database connection string | `sqlite:///./trustshare.db` |
| `MONGODB_URL` | MongoDB connection URL | `mongodb://localhost:27017` |
| `MONGODB_DB_NAME` | MongoDB database name | `trustshare_db` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379/0` |
| `SECRET_KEY` | JWT signature secret key (32+ chars) | `supersecretkey_change_in_production` |
| `ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token validity lifespan | `30` |
| `MASTER_KEY_HEX` | 256-bit (64 hex characters) KEK | `0123456789abcdef...` |
| `STORAGE_BACKEND` | Storage provider (`supabase` or `local`) | `local` |
| `SUPABASE_URL` | Supabase project API URL | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin service key | `eyJh...` |
| `SUPABASE_STORAGE_BUCKET` | Supabase storage bucket name | `trustshare-files` |
| `MAX_FILE_SIZE_MB` | Maximum allowed upload size | `50` |
| `ALLOWED_EXTENSIONS` | Whitelist of permitted extensions | `.pdf,.docx,.xlsx,.png,...` |
| `FRONTEND_URL` | Frontend client origin URL | `http://localhost:3000` |
| `CORS_ORIGINS` | Comma-separated CORS origins | `http://localhost:3000,http://127.0.0.1:3000` |

---

## 10. Running Locally

You can run both services concurrently:

```bash
# Terminal 1: Backend
cd backend
.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend
npm run dev
```

---

## 11. Running with Docker & Docker Compose

Run the entire TrustShare ecosystem with a single command:

```bash
# Build and launch all 5 containers (Postgres, Mongo, Redis, Backend, Frontend)
docker-compose up --build -d

# Check service health status
docker-compose ps

# View container logs
docker-compose logs -f backend
```

Services exposed:
- Frontend UI: `http://localhost:3000`
- FastAPI API: `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`
- MongoDB: `localhost:27017`
- Redis: `localhost:6379`

To stop containers:
```bash
docker-compose down
```

---

## 12. Automated Testing Suite

The project includes an extensive test suite covering all security, cryptographic, access control, and API workflows.

```bash
# Run the complete test suite
pytest backend/tests -v
```

### Test Suite Summary:
- **Total Tests**: 69
- **Passed**: 69 (100%)
- **Failed**: 0
- **Skipped**: 0

### Modules Tested:
- `test_auth.py`: Registration, login, invalid credentials, JWT generation, token verification, session blacklist.
- `test_crypto.py`: AES-256-GCM authenticated encryption, DEK envelope encryption, nonce uniqueness, tamper resistance.
- `test_files.py`: Upload validation, extension whitelist, category categorization, file downloads, storage stats.
- `test_shares_and_storage.py`: Share link generation, expiration enforcement, user grants, direct downloads.
- `test_audit_monitoring.py`: Audit trail creation, IP tracking, event filtering.
- `test_notifications.py`: Notification delivery, unread counter, read state update.
- `test_analytics.py`: Dashboard metrics, storage breakdown by category, upload trends.
- `test_password_reset.py`: Password reset token lifecycle, expiration, email delivery.
- `test_milestone4_security_e2e.py`: Path traversal defense, view-only download restrictions, max download limits, revocation blocking, and complete user simulation flow.

---

## 13. Security Architecture & Verification

1. **Envelope Encryption Workflow**:
   - For every upload: Generate random 256-bit DEK (`secrets.token_bytes(32)`) + 96-bit nonce (`os.urandom(12)`).
   - Encrypt raw file using AES-256-GCM.
   - Encrypt DEK using 256-bit Master Key (KEK).
   - Store encrypted DEK and ciphertext. DEK in plaintext is discarded from memory.
2. **Zero-Exposure Policy**:
   - DEKs and KEK are never exposed in API schemas or responses.
3. **Upload Sanitization**:
   - Strict extension whitelisting prevents malicious executable execution (`.exe`, `.sh`, `.bat`, `.cmd` blocked).
   - Filename sanitization prevents directory traversal attacks (`../../`).
4. **Access Control Enforcement**:
   - Non-owners receive HTTP 403 when attempting to access private files.
   - View-only links receive HTTP 403 on download requests.
   - Revoked or expired share links return HTTP 404 / 410.

---

## 14. Deployment Instructions

### Production Deployment to Cloud / VPS (AWS EC2, DigitalOcean, Azure VM, Render)

1. **Configure Production Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your production database credentials and strong SECRET_KEY
   ```
2. **Generate Strong Secrets**:
   ```bash
   # Generate SECRET_KEY
   python -c "import secrets; print(secrets.token_hex(32))"
   # Generate MASTER_KEY_HEX
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
3. **Run Production Containers**:
   ```bash
   docker-compose -f docker-compose.yml up --build -d
   ```
4. **Configure Reverse Proxy (Nginx / Cloudflare / Caddy)**:
   - Route `https://your-domain.com` to port `3000` (Frontend).
   - Route `https://api.your-domain.com` to port `8000` (Backend).
   - Enable SSL/TLS certificates using Let's Encrypt / Certbot.

---

## 15. API Overview & Endpoints

| Category | Method | Endpoint | Description |
|---|---|---|---|
| **System** | `GET` | `/` | API root status & version |
| **Health** | `GET` | `/health` | Full system health (PG, Mongo, Redis) |
| **Health** | `GET` | `/health/mongodb` | MongoDB connection & latency |
| **Health** | `GET` | `/health/redis` | Redis connection & memory stats |
| **Auth** | `POST` | `/register` | Register a new user account |
| **Auth** | `POST` | `/login` | Authenticate & obtain JWT token |
| **Auth** | `POST` | `/logout` | Invalidate token & blacklist session |
| **Auth** | `GET` | `/me` | Get current authenticated user profile |
| **Auth** | `POST` | `/forgot-password` | Request password reset token / email |
| **Auth** | `POST` | `/reset-password` | Reset password using valid token |
| **Files** | `POST` | `/files/upload` | Upload & AES-256 encrypt file |
| **Files** | `GET` | `/files` | List user files with search & category filter |
| **Files** | `GET` | `/files/{id}` | Get detailed file metadata |
| **Files** | `GET` | `/files/{id}/download` | Decrypt & download owned file |
| **Files** | `DELETE` | `/files/{id}` | Permanently delete file & ciphertext |
| **Files** | `GET` | `/files/stats/summary` | Aggregate user storage metrics |
| **Sharing** | `POST` | `/files/{id}/share` | Create temporary public share link |
| **Sharing** | `POST` | `/files/{id}/share-user` | Share file directly with registered user |
| **Sharing** | `GET` | `/files/shared-with-me` | List files shared with current user |
| **Sharing** | `DELETE` | `/files/{id}/share/{token}` | Revoke temporary share link |
| **Public** | `GET` | `/share/{token}` | Recipient view share metadata |
| **Public** | `GET` | `/share/{token}/download` | Recipient download shared file |
| **Audit** | `GET` | `/audit/logs` | Query activity audit logs |
| **Audit** | `GET` | `/audit/stats` | Activity statistics & breakdown |
| **Notifications**| `GET` | `/notifications` | List user notifications |
| **Notifications**| `PATCH`| `/notifications/{id}/read` | Mark notification as read |
| **Analytics** | `GET` | `/analytics/dashboard` | Aggregated analytics & trends |

---

## 16. End-to-End Workflow

1. **User Registration & Login**: User registers -> JWT access token issued -> Saved in secure client session.
2. **File Upload & Envelope Encryption**: User uploads file -> FastAPI generates 256-bit DEK -> AES-256-GCM encrypts payload -> DEK encrypted via Master KEK -> Ciphertext saved to storage -> Metadata recorded in MongoDB & PostgreSQL -> Audit log entry created.
3. **Authorized Download**: Owner requests download -> Backend verifies JWT -> Fetches encrypted DEK -> Decrypts DEK using Master KEK -> Decrypts ciphertext and streams plaintext to client.
4. **Secure Sharing**: Owner configures permissions (`can_download` or `view_only`, expiration, max downloads) -> Unique 24-character token generated -> Recipient accesses `/share/{token}` -> Downloads if permitted -> Counter increments -> Link auto-expires on limit.
5. **Revocation & Monitoring**: Owner revokes link -> Subsequent access blocked with 404/410 -> All actions displayed in Audit Log, Notifications, and Analytics Dashboard.

---

## 17. Milestones 1–4 Completion Summary

- [x] **Milestone 1**: User Authentication, JWT Tokens, Role-Based Access Control, SQLite/PostgreSQL Database Architecture, Responsive Auth Pages.
- [x] **Milestone 2**: AES-256-GCM Authenticated Encryption, Envelope Key Management (KEK/DEK), Cloud Object Storage Abstraction, Granular Permissions, Temporary Link Sharing & Revocation.
- [x] **Milestone 3**: Activity Monitoring & Audit Logging, Real-Time Security Notifications, Analytics Dashboard & Visualization, Password Reset & Email Integration, Redis Caching.
- [x] **Milestone 4**: Comprehensive Security Testing Suite, Complete Workflow Validation, Multi-Device UI Responsiveness & Optimization, Production Docker & Container Orchestration, Production Infrastructure & Health Monitoring, End-to-End Project Documentation.

---

## 📄 License

TrustShare is released under the [MIT License](LICENSE).