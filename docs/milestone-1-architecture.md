# Milestone 1: System Architecture, Database Schema & Security Design

**Project**: TrustShare — Intelligent Encrypted File Sharing and Digital Collaboration Management Platform  
**Milestone**: 1 (Week 1 & 2) — Project Initialization, Design Process & Core Setup  

---

## 1. Executive Summary & System Objectives

TrustShare is an enterprise-grade secure file-sharing and digital collaboration system engineered with **Server-Side Zero-Exposure AES-256-GCM Envelope Encryption**. The core objective of Milestone 1 is to establish the complete foundational architecture, containerized infrastructure, multi-model persistence layer, cryptographic key hierarchy, authentication system, and end-to-end file ingestion workflow.

### Key Functional Objectives for Milestone 1:
- **Zero-Plaintext Storage**: All uploaded files are streamed and encrypted in 64 KB chunks using unique AES-256-GCM Data Encryption Keys (DEKs) before persistence.
- **Envelope Key Management**: DEKs are wrapped using a master Key Encryption Key (KEK) and stored securely in PostgreSQL.
- **Hybrid Polyglot Persistence**:
  - **PostgreSQL 16**: Relational consistency for users, permissions, folder hierarchies, file metadata, versions, and encrypted DEKs.
  - **MongoDB 7.0**: High-throughput, schemaless telemetry for audit trails and security event streams.
  - **Redis 7.0**: Low-latency token revocation blacklists, rate limiting, and temporary access caches.
  - **Object Storage (S3 / MinIO / Local)**: Encrypted ciphertext storage blobs.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions for Administrators, Regular Users, and Guest Collaborators.

---

## 2. System Architecture Diagram

```mermaid
flowchart TD
    subgraph Client_Layer ["Client Applications"]
        UI["React / Next.js 14 Frontend<br/>(Tailwind CSS + Axios)"]
        CLI["API Clients / Postman"]
    end

    subgraph Gateway_Layer ["API Gateway & Security"]
        FASTAPI["FastAPI 0.110+ Application<br/>(Uvicorn ASGI Server)"]
        CORS["CORS & Security Headers Middleware"]
        CORR["Correlation ID Tracing Middleware"]
        AUTH_MW["JWT & RBAC Verification Dependency"]
    end

    subgraph Crypto_Engine ["Cryptographic Subsystem"]
        CIPHER["AES-256-GCM Stream Cipher<br/>(64KB Chunked Encryption/Decryption)"]
        KEY_MGR["Key Manager (KEK Envelope Wrapping)"]
    end

    subgraph Service_Layer ["Backend Domain Services"]
        AUTH_SVC["AuthService<br/>(bcrypt, JWT, TOTP MFA)"]
        FILE_SVC["FileService<br/>(Upload, Stream Encrypt, Versioning)"]
        SHARE_SVC["ShareService<br/>(Link Grants, Token Hashing)"]
        AUDIT_SVC["AuditService<br/>(Event Dispatcher)"]
        ANALYTICS_SVC["AnalyticsService<br/>(Storage & Usage Aggregator)"]
    end

    subgraph Persistence_Layer ["Data Storage Tier"]
        PG[(PostgreSQL 16<br/>Users, Files, Folders, Versions, Keys)]
        MONGO[(MongoDB 7.0<br/>Immutable Audit Logs & Security Alerts)]
        REDIS[(Redis 7.0<br/>Session Cache & Token Blacklist)]
        BLOB[(Encrypted Storage<br/>MinIO / S3 / Local Filesystem)]
    end

    UI -->|HTTPS / JSON / Form-Data| CORS
    CLI -->|REST Requests| CORS
    CORS --> CORR --> AUTH_MW --> FASTAPI

    FASTAPI --> AUTH_SVC
    FASTAPI --> FILE_SVC
    FASTAPI --> SHARE_SVC
    FASTAPI --> AUDIT_SVC
    FASTAPI --> ANALYTICS_SVC

    AUTH_SVC --> PG
    AUTH_SVC --> REDIS
    FILE_SVC --> CIPHER
    FILE_SVC --> KEY_MGR
    FILE_SVC --> PG
    FILE_SVC --> BLOB
    SHARE_SVC --> PG
    SHARE_SVC --> REDIS
    AUDIT_SVC --> MONGO
    ANALYTICS_SVC --> PG
    ANALYTICS_SVC --> MONGO
```

---

## 3. Cryptographic Workflow (Envelope Encryption)

```mermaid
sequenceDiagram
    autonumber
    actor User as Authenticated User
    participant Frontend as Next.js Web App
    participant API as FastAPI Backend
    participant KeyMgr as Key Manager
    participant Cipher as AES-256-GCM Engine
    participant DB as PostgreSQL
    participant Storage as Object Storage (MinIO/S3)
    participant Audit as MongoDB

    User->>Frontend: Select file for upload (Drag & Drop)
    Frontend->>API: POST /api/v1/files/upload (Multipart stream + JWT)
    API->>API: Validate user quota & MIME type
    API->>KeyMgr: Generate 256-bit DEK & 96-bit Nonce
    KeyMgr->>KeyMgr: Encrypt DEK with Master KEK
    KeyMgr->>DB: Save Encrypted DEK & IV metadata
    API->>Cipher: Stream plaintext file through AES-256-GCM
    Cipher->>Storage: Stream encrypted ciphertext blocks to storage
    Storage-->>API: Blob storage path confirmed
    API->>DB: Record File & FileVersion (checksum, size, path)
    API->>Audit: Emit 'FILE_UPLOAD' telemetry event
    API-->>Frontend: 201 Created (File metadata)
    Frontend-->>User: Display file in File Explorer with lock badge
```

---

## 4. Database Schema Design

### 4.1 PostgreSQL Relational Tables

```mermaid
erDiagram
    USERS ||--o{ FOLDERS : owns
    USERS ||--o{ FILES : owns
    USERS ||--o{ FILE_VERSIONS : uploads
    USERS ||--o{ SHARE_LINKS : creates
    FILES ||--o{ FILE_VERSIONS : contains
    FILES ||--o{ ENCRYPTION_KEYS : secured_by
    FILES ||--o{ SHARE_LINKS : shared_via
    FOLDERS ||--o{ FOLDERS : contains_subfolder
    FOLDERS ||--o{ FILES : contains_files

    USERS {
        uuid id PK
        string email UK
        string hashed_password
        string full_name
        string role
        boolean mfa_enabled
        string mfa_secret
        bigint storage_quota_bytes
        bigint storage_used_bytes
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    FOLDERS {
        uuid id PK
        string name
        uuid owner_id FK
        uuid parent_id FK
        timestamp created_at
        timestamp updated_at
    }

    FILES {
        uuid id PK
        string name
        uuid owner_id FK
        uuid folder_id FK
        string mime_type
        bigint size_bytes
        int current_version
        string category
        string status
        timestamp created_at
        timestamp updated_at
    }

    FILE_VERSIONS {
        uuid id PK
        uuid file_id FK
        int version_number
        bigint size_bytes
        string storage_path
        uuid encryption_key_id FK
        string checksum_sha256
        uuid uploaded_by FK
        timestamp created_at
    }

    ENCRYPTION_KEYS {
        uuid id PK
        uuid file_id FK
        bytea encrypted_dek
        bytea iv_nonce
        string algorithm
        int key_version
        timestamp created_at
    }

    SHARE_LINKS {
        uuid id PK
        uuid file_id FK
        uuid created_by FK
        string token_hash UK
        string permission_type
        string hashed_passphrase
        int max_downloads
        int current_downloads
        timestamp expires_at
        boolean is_revoked
        timestamp created_at
    }
```

### 4.2 MongoDB Telemetry Collections (`trustshare_telemetry`)

#### `audit_logs`
- `_id`: ObjectId
- `event_type`: string (`USER_LOGIN`, `FILE_UPLOAD`, `FILE_DOWNLOAD`, `SHARE_CREATED`, `ACCESS_REVOKED`)
- `user_id`: string (UUID)
- `resource_type`: string (`file`, `share`, `user`)
- `resource_id`: string (UUID)
- `ip_address`: string
- `user_agent`: string
- `correlation_id`: string (UUID)
- `metadata`: object (JSON details)
- `timestamp`: ISODate

#### `security_alerts`
- `_id`: ObjectId
- `alert_type`: string (`FAILED_LOGIN_ANOMALY`, `EXPIRED_LINK_ACCESS`, `UNAUTHORIZED_DOWNLOAD_ATTEMPT`)
- `severity`: string (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- `user_id`: string (UUID, optional)
- `source_ip`: string
- `details`: object
- `resolved`: boolean
- `created_at`: ISODate

---

## 5. Security & RBAC Specifications

| Role | Permissions |
|---|---|
| **Admin** | Full system governance, view platform audit logs, manage storage quotas, monitor anomalies, manage all user records. |
| **User** | Create/delete folders, upload/download personal files, version files, generate expiring share links with passphrase protection. |
| **Viewer / Guest** | Read-only access to specific shared documents authorized via cryptographic share tokens. |

---

## 6. Milestone 1 Verification Checklist

- [x] Project workspace initialized with Next.js 14 frontend and FastAPI backend.
- [x] Docker Compose multi-container environment configured for PostgreSQL 16, MongoDB 7, Redis 7, MinIO.
- [x] Database schemas defined with SQLAlchemy 2.0 and Alembic migration environment.
- [x] Authentication service implemented with bcrypt password hashing, JWT access/refresh tokens, and PyOTP MFA.
- [x] AES-256-GCM stream cipher and envelope key management service implemented and tested.
- [x] Chunked file upload and decrypted streaming download implemented.
- [x] Frontend responsive file manager dashboard, drag-and-drop uploader, and version history modal built.
- [x] Test suite passing with 100% success rate across unit, contract, and integration tests.
