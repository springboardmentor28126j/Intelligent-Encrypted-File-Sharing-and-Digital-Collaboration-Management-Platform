# Quickstart Guide: TrustShare Platform

**Feature**: `001-encrypted-file-sharing` | **Date**: 2026-08-25

## 1. System Prerequisites

- **Python**: 3.11 or higher
- **Node.js**: 18.x or 20.x (LTS)
- **Docker & Docker Compose**: v2.20+
- **Git**: 2.30+

---

## 2. Infrastructure Setup (Docker Compose)

Launch backing storage, caching, and database services:

```bash
docker compose -f docker-compose.dev.yml up -d
```

This boots:
- **PostgreSQL 16**: Port `5432` (`trustshare_db`)
- **MongoDB 7**: Port `27017` (`trustshare_telemetry`)
- **Redis 7**: Port `6379` (`cache & session store`)
- **MinIO**: Port `9000` (API) & `9001` (Console) - S3 compatible object storage

---

## 3. Backend Setup & Database Migrations

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy environment configuration
cp .env.example .env

# 5. Run database migrations
alembic upgrade head

# 6. Start FastAPI server with live reload
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

API docs will be available at: `http://localhost:8000/docs`

---

## 4. Frontend Setup

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install npm dependencies
npm install

# 3. Copy environment configuration
cp .env.example .env.local

# 4. Start Next.js development server
npm run dev
```

Web interface will be available at: `http://localhost:3000`

---

## 5. Running Automated Tests

### Backend Test Suite (Unit, Contract & Encryption Tests)
```bash
cd backend
source .venv/bin/activate
pytest -v --cov=src --cov-report=term-missing
```

### Frontend Test Suite
```bash
cd frontend
npm test
```

---

## 6. End-to-End Verification Walkthrough

1. **Register & Login**:
   - Navigate to `http://localhost:3000/register` and create an account.
   - Login to receive JWT session.
2. **Upload & Verify Encryption**:
   - Upload a test file (e.g. `confidential_report.pdf`).
   - Verify that MinIO bucket contains only AES-256 encrypted binary payload with no plaintext metadata.
3. **Generate Expiring Share Link**:
   - Click "Share", set expiration to 24 hours, add access passphrase, and set permission to "View Only".
   - Copy the generated URL.
4. **Access in Incognito / Guest Mode**:
   - Open link in private browsing window, provide passphrase.
   - Confirm document preview renders, but file download is restricted.
5. **Inspect Audit Log**:
   - Log back into owner/admin account and navigate to `http://localhost:3000/audit-logs`.
   - Confirm recorded entry for share creation and guest view event with client IP and timestamp.
