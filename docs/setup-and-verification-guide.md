# TrustShare Milestone 1: Step-by-Step Setup & Verification Guide

This guide details step-by-step instructions to set up, launch, and verify **Milestone 1** of the TrustShare platform.

---

## 1. Prerequisites

Ensure you have the following installed on your machine:
- **Python**: 3.11 or higher
- **Node.js**: 18+ or 20+ and **npm**
- **Docker & Docker Compose** (for PostgreSQL, MongoDB, Redis, and MinIO)

---

## 2. Step-by-Step Setup Instructions

### Step 1: Start Supporting Infrastructure Services (Docker)
Start the PostgreSQL 16, MongoDB 7, Redis 7, and MinIO object storage containers in the background:

```bash
docker compose -f docker-compose.dev.yml up -d
```

To verify the containers are healthy and running:
```bash
docker ps
```
Services exposed:
- **PostgreSQL**: `localhost:5432` (`trustshare_user` / `trustshare_password`, db: `trustshare_db`)
- **MongoDB**: `localhost:27017` (db: `trustshare_telemetry`)
- **Redis**: `localhost:6379`
- **MinIO**: `localhost:9000` (Console at `http://localhost:9001`, user: `minioadmin`, pass: `minioadminpassword`)

---

### Step 2: Setup and Run the FastAPI Backend

1. **Activate the Python virtual environment**:
   ```bash
   source .venv/bin/activate
   ```

2. **Verify / Install dependencies**:
   ```bash
   pip install -r backend/requirements.txt
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example backend/.env
   ```

4. **Launch the FastAPI Backend Server**:
   ```bash
   cd backend
   PYTHONPATH=. uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
   ```

The backend is now accessible at:
- **Interactive Swagger API Docs**: [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
- **OpenAPI JSON**: [http://localhost:8000/api/v1/openapi.json](http://localhost:8000/api/v1/openapi.json)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

### Step 3: Setup and Run the Next.js Frontend

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install Node dependencies**:
   ```bash
   npm install
   ```

3. **Start the Next.js Development Server**:
   ```bash
   npm run dev
   ```

The web application is now live at:
- **Web App**: [http://localhost:3000](http://localhost:3000)
- **File Manager Dashboard**: [http://localhost:3000/files](http://localhost:3000/files)
- **Login Page**: [http://localhost:3000/login](http://localhost:3000/login)
- **Register Page**: [http://localhost:3000/register](http://localhost:3000/register)

---

## 3. Verifying Milestone 1 Core Workflows

### 3.1 Run the Automated Test Suite
To run all unit tests, contract tests, and integration tests for Milestone 1:

```bash
PYTHONPATH=backend pytest backend/tests/ -v
```

Expected Output:
```text
tests/contract/test_analytics_api.py::test_analytics_storage_metrics_contract PASSED
tests/contract/test_files_api.py::test_file_upload_and_list_contract PASSED
tests/contract/test_shares_api.py::test_share_link_creation_and_access_contract PASSED
tests/integration/test_analytics_aggregation.py::test_analytics_storage_aggregation PASSED
tests/integration/test_audit_pipeline.py::test_audit_logging_and_alerting PASSED
tests/integration/test_file_lifecycle.py::test_file_upload_version_and_download_flow PASSED
tests/integration/test_share_lifecycle.py::test_share_link_lifecycle PASSED
tests/unit/test_anomaly_detector.py::test_anomaly_detector_ip_and_brute_force PASSED
tests/unit/test_crypto.py::test_aes256_gcm_encryption_decryption PASSED
tests/unit/test_crypto.py::test_stream_encryption_decryption PASSED
tests/unit/test_crypto.py::test_tampered_ciphertext_detection PASSED
tests/unit/test_crypto.py::test_key_manager_envelope_encryption PASSED
============================== 12 passed in 15.93s ==============================
```

---

### 3.2 Testing via API (cURL / Swagger)

#### 1. Register a New User
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@trustshare.io",
    "password": "SecurePassword123!",
    "full_name": "Alice Innovator"
  }'
```

#### 2. Authenticate and Obtain JWT Token
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@trustshare.io",
    "password": "SecurePassword123!"
  }'
```
Response contains:
```json
{
  "access_token": "<JWT_ACCESS_TOKEN>",
  "refresh_token": "<JWT_REFRESH_TOKEN>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user_id": "...",
  "email": "alice@trustshare.io",
  "role": "user"
}
```

#### 3. Create a Folder
```bash
curl -X POST http://localhost:8000/api/v1/folders \
  -H "Authorization: Bearer <JWT_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Project Documents"
  }'
```

#### 4. Upload an Encrypted File (AES-256-GCM)
```bash
curl -X POST http://localhost:8000/api/v1/files/upload \
  -H "Authorization: Bearer <JWT_ACCESS_TOKEN>" \
  -F "file=@/path/to/sample.pdf" \
  -F "category=executive"
```

#### 5. Download and Decrypt File on the Fly
```bash
curl -X GET http://localhost:8000/api/v1/files/<FILE_ID>/download \
  -H "Authorization: Bearer <JWT_ACCESS_TOKEN>" \
  --output decrypted_sample.pdf
```

---

## 4. Verification of Milestone 1 Outcomes

| Milestone 1 Task | Implementation Status | Verified Component |
|---|---|---|
| (i) Define project objectives & secure workflows | Completed | Architecture doc in [docs/milestone-1-architecture.md](file:///home/shiva/project/docs/milestone-1-architecture.md) |
| (ii) Design secure system architecture & DB schema | Completed | SQLAlchemy models, MongoDB schemas, [docs/milestone-1-architecture.md](file:///home/shiva/project/docs/milestone-1-architecture.md) |
| (iii) Create UI wireframes & workflow planning | Completed | Wireframe designs in [docs/ui-wireframes-and-workflows.md](file:///home/shiva/project/docs/ui-wireframes-and-workflows.md) |
| (iv) Setup Next.js frontend & FastAPI backend | Completed | `frontend/` (Next.js 14, Tailwind) & `backend/` (FastAPI, Uvicorn) |
| (v) Configure PostgreSQL, MongoDB, and Redis | Completed | `docker-compose.dev.yml` & connection clients |
| (vi) Implement authentication & RBAC system | Completed | `AuthService`, bcrypt, JWT tokens, TOTP MFA in `backend/src/services/auth_service.py` |
| (vii) Build secure file upload workflows | Completed | 64KB AES-256-GCM chunked stream cipher & envelope KeyManager |
| (viii) Develop file management dashboard | Completed | Responsive UI in `frontend/src/app/files/page.tsx` & `file-explorer.tsx` |
