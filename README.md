# TrustShare – Secure File-Sharing System (Milestone 2)

An enterprise-grade, secure file-sharing and digital collaboration management platform featuring **AES-256-GCM server-side authenticated encryption**, **envelope key management**, **cloud object storage (AWS S3)**, **granular access control**, **temporary link expiration**, and **dual-layer PostgreSQL/MongoDB metadata persistence**.

---

## 🏗️ Architecture Overview

```
                        +----------------------------+
                        |  Next.js / React Frontend  |
                        +--------------+-------------+
                                       | (JWT Authenticated REST API)
                                       v
                        +----------------------------+
                        |      FastAPI Backend       |
                        +--------------+-------------+
                                       |
       +-------------------------------+-------------------------------+
       |                               |                               |
       v                               v                               v
+--------------+               +---------------+               +---------------+
| PostgreSQL   |               |    MongoDB    |               |     Redis     |
| (ACID Relational             | (Metadata     |               | (Token        |
|  Files/Shares/               |  Catalog &    |               |  Blacklist &  |
|  Users Schema)               |  Fast Query)  |               |  Cache)       |
+--------------+               +---------------+               +---------------+
       |                               |
       +-------------------------------+
                                       |
                        +--------------v-------------+
                        |    Envelope Key Manager    |
                        |   Master Key KEK (256-bit) |
                        +--------------+-------------+
                                       | (Protects Per-File DEK)
                                       v
                        +----------------------------+
                        |   AES-256-GCM Encryption   |
                        +--------------+-------------+
                                       | (Stores ONLY Ciphertext)
                                       v
                        +----------------------------+
                        |    Object Storage Vault    |
                        | (AWS S3 / Encrypted Disk)  |
                        +----------------------------+
```

---

## 🔐 Milestone 2 Security Features

### 1. AES-256-GCM Server-Side Encryption
- **Cipher**: NIST-standard Galois/Counter Mode (AES-256-GCM) providing authenticated encryption and tamper detection.
- **Per-File Keys (DEKs)**: Every uploaded file receives a unique 256-bit cryptographically secure random Data Encryption Key generated via `secrets.token_bytes(32)`.
- **Nonces (IVs)**: Every encryption operation uses a unique 96-bit (12-byte) random nonce (`os.urandom(12)`).
- **Backend Encryption**: Encryption occurs strictly on the FastAPI server before writing to storage. Plaintext files never reach object storage.
- **Zero-Exposure**: Raw DEKs and sensitive nonces are never returned in API responses or sent to client code.

### 2. Envelope Key Management
- Per-file Data Encryption Keys (DEKs) are envelope-encrypted using a 256-bit Master Key / Key Encryption Key (KEK) configured via `MASTER_KEY_HEX`.
- Clean `KeyManagerBase` abstraction enabling production plug-in with AWS KMS, Azure Key Vault, or HashiCorp Vault.

### 3. Cloud Object Storage Abstraction
- Clean `StorageBackend` interface with two implementations:
  - `S3StorageBackend`: Persists ciphertext in private AWS S3 buckets using `boto3` and AWS SSE-S3 headers.
  - `LocalStorageBackend`: Secure local disk vault (`uploads/encrypted/`) storing only ciphertext for offline development without credentials.

### 4. Granular Permissions & Access Control
- **View Only (`view_only`)**: Allows recipients to view file metadata but restricts downloading.
- **Can Download (`can_download`)**: Allows authorized recipients to decrypt and stream file bytes.
- **User-to-User Grants**: Direct sharing with other registered users via their email address (`POST /files/{file_id}/share-user`).
- **Temporary Public Links**: Cryptographically secure random tokens (`secrets.token_urlsafe(24)`) with time-based expiration (1h, 24h, 7d, 30d, custom) and instant revocation.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- PostgreSQL (or SQLite default for local zero-setup)
- MongoDB & Redis (or automated in-memory fallbacks)

---

### Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Activate the virtual environment:**
   ```bash
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

5. **Run Database Migrations:**
   ```bash
   alembic upgrade head
   ```

6. **Start the FastAPI server:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Frontend Setup

1. **From the project root directory:**
   ```bash
   npm install
   ```

2. **Run the Next.js development server:**
   ```bash
   npm run dev
   ```
   Access application: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Running Tests

Run the complete test suite (Milestone 1 + Milestone 2):

```bash
cd backend
.venv\Scripts\pytest -v
```

Test coverage includes:
- `test_auth.py`: JWT login, registration, password hashing, token revocation.
- `test_crypto.py`: AES-256-GCM encryption/decryption, tamper detection, nonce uniqueness, envelope key management.
- `test_storage.py`: Storage abstraction, LocalStorageBackend, S3StorageBackend mock integration.
- `test_milestone2.py`: End-to-end encrypted upload, key non-exposure, decryption on download, unauthorized download rejection, user-to-user sharing, temporary links, and revocation.

---

## ⚙️ Environment Variables Reference

| Variable | Description | Default (Local) |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy Database URL | `sqlite:///./trustshare.db` |
| `MONGODB_URL` | MongoDB Connection URL | `mongodb://localhost:27017` |
| `MONGODB_DB_NAME` | MongoDB Database Name | `trustshare_db` |
| `REDIS_URL` | Redis Connection URL | `redis://localhost:6379/0` |
| `MASTER_KEY_HEX` | 256-bit (64 hex char) Master KEK | `0123456789abcdef...` |
| `STORAGE_BACKEND` | Storage backend (`local` or `s3`) | `local` |
| `AWS_ACCESS_KEY_ID` | AWS Access Key ID (for S3) | `""` |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Access Key (for S3) | `""` |
| `AWS_REGION` | AWS S3 Bucket Region | `us-east-1` |
| `AWS_S3_BUCKET_NAME` | S3 Bucket Name | `trustshare-encrypted-files` |
| `SECRET_KEY` | JWT Signing Secret | `supersecretkey...` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT Lifespan | `30` |