# TrustShare – Final Project Documentation
**Intelligent Encrypted File Sharing & Digital Collaboration Management Platform**

---

## 1. Problem Statement

In today's distributed and hybrid workforce, enterprise teams, financial institutions, and healthcare providers exchange sensitive files containing Personally Identifiable Information (PII), proprietary intellectual property, legal agreements, and corporate data across untrusted networks. 

Conventional file-sharing solutions present critical vulnerabilities:
1. **Unencrypted or Inadequately Encrypted Storage**: Plaintext files stored on disks or cloud buckets remain susceptible to unauthorized server breaches, insider access, and database leakage.
2. **Coarse-Grained Sharing Controls**: Traditional sharing links frequently remain indefinitely active without download thresholds, role-based restrictions, or instantaneous revocation.
3. **Absence of Tamper-Evident Audit Trails**: Lack of granular activity logging hampers compliance with modern privacy standards (GDPR, HIPAA, SOC 2, ISO 27001).
4. **Complex and Fragmented Workflows**: Disjointed user experiences between cryptographic key management, storage backends, and collaboration tooling create operational friction.

---

## 2. Project Objectives

TrustShare addresses these challenges by delivering an enterprise-grade, zero-trust file-sharing and digital collaboration platform designed to satisfy the following engineering objectives:
- **Zero-Exposure Server-Side Envelope Encryption**: Utilize NIST-standard AES-256-GCM authenticated encryption where every file possesses an independent Data Encryption Key (DEK) protected by a Master Key Encryption Key (KEK).
- **Flexible Dual-Engine Architecture**: Combine the ACID relational consistency of PostgreSQL (for user accounts, RBAC, and permissions) with the flexible schema of MongoDB (for rich file metadata, activity logs, and real-time analytics).
- **Granular and Ephemeral Access Governance**: Provide customizable temporary access links with time expirations (1h, 24h, 7d, 30d, custom), permission scopes (`can_download` vs. `view_only`), maximum download quotas, and real-time revocation.
- **Auditing, Telemetry & Security Alerts**: Maintain automated event logging, instant user security notifications, and analytics dashboard aggregation.
- **Production-Ready Multi-Container Architecture**: Containerize the complete application stack (Frontend, Backend, PostgreSQL, MongoDB, Redis) with health checks, environment configurability, and cross-platform mobile-responsive layouts.

---

## 3. System Architecture & Component Design

```
+---------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                    |
|   Next.js 14 Web Application (React, TypeScript, Responsive CSS Design System)  |
+----------------------------------------+----------------------------------------+
                                         | HTTPS / REST API / JWT Bearer
                                         v
+---------------------------------------------------------------------------------+
|                                 BACKEND LAYER                                   |
|   FastAPI Application Framework (Asynchronous Python 3.11 / 3.12)              |
|                                                                                 |
|   Routers:                                                                      |
|     - /auth (Register, Login, Logout, /me, Password Reset)                      |
|     - /files (Upload, Listing, Download, Deletion, Summary Stats)               |
|     - /share & /files/{id}/share (Link Generation, Recipient Access, Revocation) |
|     - /audit (Activity Logging, IP Tracking, Filtering, Metrics)                |
|     - /notifications (Security Alerts, Read/Unread State Management)            |
|     - /analytics (Storage Distribution, Download & Upload Trends)               |
|     - /health (PostgreSQL, MongoDB, Redis Connectivity & Latency Telemetry)     |
|                                                                                 |
|   Core Cryptographic & Storage Services:                                        |
|     - Envelope Key Manager (256-bit KEK -> DEK Generation & Protection)         |
|     - AES-256-GCM Engine (Authenticated Encryption & Tamper Detection)          |
|     - Storage Backend Abstraction (Supabase Object Storage & Local Vault)       |
|     - Redis Client (Token Blacklisting & Rate Limiting)                         |
+-------------------+--------------------+-------------------+--------------------+
                    |                    |                   |
                    v                    v                   v
+-----------------------+ +----------------------+ +------------------------------+
|     POSTGRESQL / DB   | |       MONGODB        | |            REDIS             |
| Users, Roles, Shares, | | File Metadata,       | | Token Blacklisting,          |
| Granular Permissions, | | Audit Trails,        | | Rate Limiting Windows,       |
| Password Resets       | | Analytics Documents  | | Session Cache                |
+-----------------------+ +----------------------+ +------------------------------+
```

---

## 4. Database Overview & Schema Design

TrustShare leverages a hybrid polyglot persistence model:

### 4.1. Relational Database (PostgreSQL / SQLite fallback)
- **`users` Table**:
  - `id`: Primary key (Integer / Serial).
  - `full_name`: User's full name.
  - `email`: Unique indexed email address.
  - `hashed_password`: Secure bcrypt hash (12 rounds).
  - `role`: Role string (`user`, `admin`).
  - `is_active`: Boolean account state.
  - `created_at` & `updated_at`: Timestamps.
- **`file_shares` Table**:
  - `id`: Primary key.
  - `file_id`: Unique identifier referencing the file record.
  - `owner_id`: Foreign key referencing `users.id`.
  - `share_token`: 24-character cryptographically random URL-safe token.
  - `permission`: Permission scope (`can_download` or `view_only`).
  - `recipient_email`: Optional direct recipient target.
  - `expires_at`: Expiration datetime.
  - `max_downloads`: Maximum allowed downloads before auto-expiry.
  - `download_count`: Incremented download counter.
  - `is_revoked`: Boolean indicating manual revocation.
- **`notifications` Table**:
  - `id`: Primary key.
  - `user_id`: Target recipient user ID.
  - `message`: Notification payload.
  - `type`: Category (`share`, `download`, `security`).
  - `is_read`: Read status flag.
- **`audit_logs` Table**:
  - `id`: Primary key.
  - `user_id`: Acting user.
  - `action`: Action descriptor (`login`, `upload`, `download`, `share`, `revoke`).
  - `ip_address`: Client IP address.
  - `user_agent`: Client browser/device string.
  - `timestamp`: Event creation time.

### 4.2. Document Database (MongoDB)
- **`files_metadata` Collection**:
  - Stores rich document attributes, MIME types, categories, original filename, encrypted DEK (base64 envelope), nonce, SHA-256 integrity digest, storage backend path, and file size.
- **`audit_events` Collection**:
  - Time-series document stream indexed by action and timestamp for high-throughput security event aggregation.

---

## 5. Authentication & Authorization

- **Password Hashing**: Passwords are never stored in plaintext. They are salted and hashed using bcrypt.
- **JSON Web Tokens (JWT)**: Stateless authentication via `HS256` signed JWT bearer tokens with configurable expiration (default 30 minutes).
- **Session Blacklisting**: Upon user logout, active tokens are recorded in Redis cache to reject reuse before expiration.
- **Role-Based Access Control (RBAC)**: User roles (`user`, `admin`) govern API authorization boundaries.
- **Tenant Isolation**: Direct database filtering ensures non-owners cannot inspect, download, modify, or delete files owned by other users.

---

## 6. File Management & Upload Workflow

1. **Client Request**: Client sends a `multipart/form-data` payload containing the file and optional description.
2. **File Sanitization**:
   - Extension is checked against a strict whitelist (`.pdf`, `.docx`, `.xlsx`, `.png`, `.zip`, etc.).
   - Executable and script extensions (`.exe`, `.sh`, `.bat`, `.cmd`) are rejected with HTTP 400.
   - File names are sanitized against path traversal characters (`../`).
3. **Payload Streaming & Integrity Hashing**:
   - SHA-256 checksum is computed concurrently across incoming bytes.
   - File category (PDF, Document, Image, Spreadsheet, Archive) is resolved automatically from MIME type.

---

## 7. Cryptographic Architecture: AES-256-GCM Envelope Encryption

```
                    ┌──────────────────────────────┐
                    │      Plaintext File          │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┴───────────────────┐
              │                                        │
              ▼                                        ▼
┌───────────────────────────┐            ┌───────────────────────────┐
│ Unique 256-bit DEK        │            │ Unique 96-bit Nonce (IV)  │
│ (secrets.token_bytes(32)) │            │ (os.urandom(12))          │
└─────────────┬─────────────┘            └─────────────┬─────────────┘
              │                                        │
              └────────────────────┬───────────────────┘
                                   │
                                   ▼
              ┌────────────────────────────────────────┐
              │          AES-256-GCM Engine            │
              │  (Authenticated Ciphertext + Auth Tag) │
              └────────────────────┬───────────────────┘
                                   │
              ┌────────────────────┴───────────────────┐
              │                                        │
              ▼                                        ▼
┌───────────────────────────┐            ┌───────────────────────────┐
│     Ciphertext Payload    │            │ Master Key / KEK (256-bit)│
│  (Stored in S3 / Vault)   │            └─────────────┬─────────────┘
└───────────────────────────┘                          │
                                                       ▼
                                         ┌───────────────────────────┐
                                         │   Encrypted DEK Payload   │
                                         │   (Stored with Metadata)  │
                                         └───────────────────────────┘
```

- **Algorithm**: NIST-approved AES-256-GCM (Galois/Counter Mode) authenticated encryption.
- **Integrity Tag**: 16-byte cryptographic tag guarantees that any altered byte causes instant decryption failure.
- **Envelope Encryption**: Each file has a distinct DEK. DEKs are encrypted using the Master Key (KEK) before storage in metadata records.
- **Zero Key Leakage**: DEKs and KEK are never exposed to frontend clients or returned via API responses.

---

## 8. Secure Sharing & Temporary Access Links

TrustShare provides flexible and secure file distribution:
1. **Time-Limited Links**: Share links expire automatically after a predefined duration (1 hour, 24 hours, 7 days, 30 days, or custom timestamp).
2. **Granular Permissions**:
   - `view_only`: Recipient can inspect metadata, file details, and preview without download privileges (HTTP 403 on download).
   - `can_download`: Recipient is permitted to decrypt and download the stream.
3. **Download Quotas (`max_downloads`)**: Links automatically expire when the designated download count is satisfied.
4. **Instant Revocation**: Owners can revoke an active link at any point, immediately converting all future access attempts into HTTP 404/410 errors.
5. **Direct User-to-User Sharing**: Files can be shared directly with other registered platform users, surfacing in their "Shared With Me" dashboard.

---

## 9. Activity Monitoring & Audit Logging

Every significant security and business event is recorded:
- Event types: `login`, `failed_login`, `upload`, `download`, `share_created`, `share_revoked`, `password_reset`.
- Captured metadata: Acting user ID, user email, filename, file ID, IP address, user-agent, timestamp, and status.
- Audit records are queryable via `/audit/logs` with filtering by action and status.

---

## 10. Notifications & Security Alerts

- Real-time notification dispatch when:
  - Another user shares a file with you.
  - A recipient downloads a shared file.
  - A suspicious login attempt occurs.
- Endpoints for querying unread counts, reading notifications, and bulk mark-as-read.

---

## 11. Analytics Dashboard

Interactive dashboard metrics:
- Total storage consumed (bytes and megabytes).
- Total file count and category distribution breakdown.
- Active share links and cumulative download counts.
- 7-day and 30-day activity trendlines.

---

## 12. Security Testing & Test Results

### 12.1. Test Suite Execution
- **Testing Framework**: Pytest 8.2 with FastAPI TestClient.
- **Total Tests**: 69
- **Passed**: 69 (100%)
- **Failed**: 0
- **Execution Time**: ~64 seconds

### 12.2. Security Test Matrix

| Test Suite | Test Area | Verification Summary | Result |
|---|---|---|---|
| `test_auth.py` | Authentication | Registration, valid login, invalid credentials, token structure, expiration | **PASS** |
| `test_crypto.py` | Cryptography | AES-256-GCM encryption, DEK envelope encryption, tamper resilience, nonces | **PASS** |
| `test_files.py` | File Operations | Upload validation, extension whitelist, path sanitization, owner downloads | **PASS** |
| `test_shares_and_storage.py` | Sharing | Link creation, expiration, max download quota, instant revocation | **PASS** |
| `test_audit_monitoring.py` | Monitoring | Audit trail recording, IP capture, event filtering | **PASS** |
| `test_notifications.py` | Notifications | Notification delivery, unread count tracking, state transition | **PASS** |
| `test_analytics.py` | Analytics | Dashboard aggregation, trend calculations, category distribution | **PASS** |
| `test_milestone4_security_e2e.py` | Security & E2E | Forged/tampered JWT rejection, view-only enforcement, tenant isolation, end-to-end workflow | **PASS** |

---

## 13. Docker & Container Deployment

TrustShare is fully containerized with `docker-compose.yml`:
- `trustshare_db`: PostgreSQL 15 database container with health check.
- `trustshare_mongo`: MongoDB 6.0 document store container with health check.
- `trustshare_redis`: Redis 7.0 cache and token blacklist container with health check.
- `trustshare_backend`: FastAPI Python 3.11 container with database migrations and health check.
- `trustshare_frontend`: Next.js 14 container with responsive web interface.

### Running with Docker:
```bash
docker-compose up --build -d
```

---

## 14. Cloud Deployment & Production Readiness

1. **Cloud Storage**:
   - Supported providers: Supabase Object Storage, AWS S3.
   - Storage backend selected via `STORAGE_BACKEND=supabase` or `STORAGE_BACKEND=local`.
2. **HTTPS & Security Headers**:
   - Production deployments should be fronted by Nginx, Caddy, or Cloudflare with SSL/TLS termination.
   - CORS origin whitelist configured via `CORS_ORIGINS`.
3. **Health Telemetry**:
   - System health available at `/health`, `/health/mongodb`, and `/health/redis` for monitoring tools (Prometheus, Datadog, AWS CloudWatch).

---

## 15. Limitations & Future Enhancements

### Current Limitations:
- Single-region database configuration (read replica support can be expanded).
- File uploads currently buffered up to 50MB per file (can be expanded to multipart chunked uploads for multi-gigabyte files).

### Future Enhancements:
- Hardware Security Module (HSM) / AWS KMS / Azure Key Vault direct key derivation plugin.
- Zero-knowledge client-side encryption option (WebCrypto API in browser).
- Webhook integrations (Slack, Microsoft Teams, Discord) for enterprise compliance alerts.
- Multi-factor authentication (MFA / TOTP) support.

---

## 16. Conclusion

TrustShare has successfully achieved all Milestone 1, 2, 3, and 4 requirements. The platform provides a secure, fully tested, responsive, and production-ready file-sharing system with AES-256-GCM authenticated encryption, granular sharing controls, audit telemetry, and containerized deployment infrastructure.
