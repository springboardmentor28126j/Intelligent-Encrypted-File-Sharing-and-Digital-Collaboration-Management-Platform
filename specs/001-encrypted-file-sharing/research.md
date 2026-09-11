# Research & Architecture Decisions: TrustShare Platform

**Feature**: `001-encrypted-file-sharing` | **Date**: 2026-08-25

## 1. Backend Framework & Asynchronous Architecture

- **Decision**: Python 3.11+ with FastAPI, Uvicorn, and Pydantic v2.
- **Rationale**: 
  - Native asynchronous I/O (`async`/`await`) enables high concurrent throughput for large file streaming and collaborative operations without thread exhaustion.
  - Pydantic v2 provides strict data validation, serialization, and automatic OpenAPI schema generation, aligning with constitutional code quality principles.
  - High performance, lightweight footprint, and seamless integration with Python's cryptographic libraries.
- **Alternatives Considered**: 
  - *Django / DRF*: Heavier footprint, synchronous ORM complexity, unnecessary overhead for microservice API architectures.
  - *Flask*: Requires extensive third-party plugins for async streaming, typing, and OpenAPI generation.

---

## 2. Server-Side Encryption (SSE) & Cryptographic Architecture

- **Decision**: Authenticated AES-256-GCM (Galois/Counter Mode) envelope encryption via Python's standard `cryptography` library with unique per-file keys and chunked streaming.
- **Rationale**:
  - AES-256-GCM provides both confidentiality and data integrity authentication, detecting any unauthorized tampering at rest.
  - Unique per-file encryption keys prevent blast radius expansion if a single key is compromised.
  - Streaming chunk-by-chunk encryption/decryption (64KB chunks) ensures constant, bounded memory usage (<50MB per transfer stream) even when handling multi-gigabyte files.
  - Decryption occurs strictly in-memory during authorized request streaming; plaintext is never persisted to disk.
- **Alternatives Considered**:
  - *Client-Side Encryption Only*: Breaks server-side search/indexing, metadata extraction, dynamic permission enforcement, and web-based previews.
  - *AES-256-CBC*: Lacks built-in authentication tag; vulnerable to padding oracle attacks without HMAC-SHA256 wrapper.

---

## 3. Polyglot Persistence & Data Storage Architecture

- **Decision**: Hybrid architecture:
  - **PostgreSQL**: Core relational storage for structured entities (Users, Files, Folders, FileVersions, ShareLinks, Roles, and Key Metadata) using SQLAlchemy 2.0 and Alembic migrations.
  - **MongoDB**: High-write-throughput document store for append-only Audit Trails, Access Activity Logs, and Security Telemetry via Motor (async driver).
  - **Redis**: In-memory store for active session tokens, link rate-limiting, temporary token blacklists, and fast expiration cache.
  - **Cloud Object Storage (AWS S3 / Azure Blob / MinIO)**: Scalable binary storage for raw AES-256 encrypted payload blobs.
- **Rationale**:
  - PostgreSQL guarantees ACID compliance for transactional permission and file state changes.
  - MongoDB handles high-volume immutable audit logging without impacting relational query performance.
  - Redis ensures sub-millisecond token invalidation and brute-force throttling on share links.
  - Object storage abstracts scalable binary persistence with high durability.
- **Alternatives Considered**:
  - *Single PostgreSQL Database for all logs*: Audit logs can grow to millions of rows rapidly, bloating relational tables and degrading index performance.
  - *Local Disk Storage*: Lacks cloud redundancy, scalability, and lifecycle policies required for enterprise collaboration.

---

## 4. Authentication, Authorization & Session Management

- **Decision**: Multi-tiered authentication combining OAuth2, JWT Bearer Tokens (Short-lived Access + Sliding Refresh Tokens), bcrypt password hashing, and PyOTP for Time-based One-Time Passwords (TOTP MFA).
- **Rationale**:
  - JWT provides stateless, verifiable authentication for API calls.
  - Redis token blacklisting enables immediate token revocation on logout or security incidents.
  - PyOTP enables RFC 6238 compliant TOTP multi-factor authentication for enhanced account security.
  - Granular RBAC (Admin, Standard User, Restricted Viewer) mapped cleanly via FastAPI dependencies.
- **Alternatives Considered**:
  - *Cookie-only Session Storage*: Difficult to support standalone mobile/CLI clients and cross-domain APIs.
  - *API Keys only*: Lacks user identity lifecycle, refresh flows, and MFA capabilities.

---

## 5. Frontend Architecture & Design System

- **Decision**: Next.js 14 (App Router) + React 18 + Tailwind CSS + Axios.
- **Rationale**:
  - Server and Client components optimize initial load times and client-side interactivity.
  - Tailwind CSS delivers a consistent, accessible design system matching WCAG 2.1 AA requirements.
  - Modular component structure separates UI presentation from cryptographic upload and download streams.
- **Alternatives Considered**:
  - *Plain HTML/Vanilla JS*: High maintenance for complex interactive state management (folder trees, version comparisons, live analytics).
  - *Vue / Angular*: Incompatible with existing React ecosystem requirements outlined in the project specification.

---

## 6. Testing Strategy & CI Quality Gates

- **Decision**: Multi-layered test automation:
  - **Unit Tests**: `pytest` + `pytest-asyncio` isolating models, encryption routines, and utilities with mock storage.
  - **Contract & API Tests**: `pytest` + `httpx.AsyncClient` against FastAPI test client verifying OpenAPI contracts and response schemas.
  - **Integration & Security Tests**: Automated test suites verifying end-to-end upload -> encryption -> share link creation -> passphrase verification -> streaming download -> audit log recording.
- **Coverage Target**: Minimum 85% overall backend coverage; 100% branch coverage for cryptographic and security modules.
