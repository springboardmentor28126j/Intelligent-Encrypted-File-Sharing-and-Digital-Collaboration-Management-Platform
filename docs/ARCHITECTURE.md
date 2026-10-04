# TrustShare – Enterprise Architecture & Cryptographic Design

## 1. System Overview

**TrustShare** is a zero-knowledge cloud file sharing and digital collaboration platform engineered for confidentiality, integrity, access control, and threat prevention. Plaintext data is never written to disk or transmitted across untrusted networks.

---

## 2. High-Level Architecture Diagram

```mermaid
graph TD
    Client["Client Web Browser (Next.js 14)"]

    subgraph Gateway ["Application Gateway & API Layer"]
        FastAPI["FastAPI Python 3.12 Gateway"]
        AuthMid["JWT & RBAC Middleware"]
        ThreatMid["Suspicious Activity & IP Detection"]
    end

    subgraph CryptoLayer ["Cryptographic Engine"]
        AES["AES-256-GCM Streaming Cipher"]
        KeyMgr["Master KEK / AWS KMS Envelope Manager"]
        HashEngine["SHA-256 Integrity Verification"]
    end

    subgraph StorageBackends ["Cloud & Storage Layer"]
        S3["AWS S3 Private Object Bucket (Ciphertext)"]
        LocalStorage["Local Encrypted Vault Fallback"]
    end

    subgraph DataTier ["Databases & Cache"]
        PostgreSQL[("PostgreSQL (Users, Permissions, AuditLog, Notifications)")]
        MongoDB[("MongoDB (File Metadata & Document Logs)")]
        Redis[("Redis (Token Revocation & Velocity Counters)")]
    end

    Client -->|HTTPS / REST| FastAPI
    FastAPI --> AuthMid
    FastAPI --> ThreatMid

    FastAPI --> CryptoLayer
    CryptoLayer --> StorageBackends

    FastAPI --> PostgreSQL
    FastAPI --> MongoDB
    FastAPI --> Redis
    ThreatMid --> Redis
    ThreatMid --> PostgreSQL
```

---

## 3. Cryptographic Pipeline: AES-256-GCM Envelope Encryption

TrustShare utilizes **Envelope Encryption** adhering to NIST SP 800-57 guidelines:

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant API as FastAPI Backend
    participant KM as Master KEK Manager
    participant AES as AES-256-GCM Engine
    participant S3 as AWS S3 Object Storage
    participant DB as PostgreSQL & MongoDB

    User->>API: Upload Plaintext File via TLS 1.3
    API->>API: Generate 256-bit random DEK (Data Encryption Key) + 96-bit Nonce
    API->>AES: Encrypt Plaintext using ephemeral DEK (GCM Mode)
    AES-->>API: Return Ciphertext + 128-bit Auth Tag
    API->>KM: Encrypt ephemeral DEK with Master KEK
    KM-->>API: Return Encrypted DEK
    API->>S3: Put Ciphertext with UUID storage_key (AES256 SSE)
    API->>DB: Save metadata, Encrypted DEK, Nonce & SHA-256 hash
    API->>API: Wipe ephemeral plaintext DEK from memory
    API-->>User: 201 Created (Return Metadata, keys omitted)
```

---

## 4. Secure File Download & Decryption Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Recipient as Authenticated User / Public Link
    participant API as FastAPI Backend
    participant Auth as Access Control & Token Validator
    participant DB as PostgreSQL / Redis
    participant S3 as AWS S3 Storage
    participant KM as Master KEK Manager
    participant AES as AES-256-GCM Engine

    Recipient->>API: Request Download (Token / File ID)
    API->>Auth: Validate JWT / Share Expiration & Download Quota
    Auth->>DB: Verify Ownership / Permission Grant
    API->>S3: Retrieve Ciphertext Binary Stream
    API->>KM: Decrypt Encrypted DEK using Master KEK
    API->>AES: Decrypt Ciphertext Stream with DEK + Nonce
    API->>DB: Increment Download Counter & Log Audit Event
    API-->>Recipient: Stream Plaintext File with Content-Disposition
```

---

## 5. Security & Threat Prevention Subsystem

1. **Brute Force Protection**: Failed logins tracked in Redis/memory sliding window (5 failed attempts in 10 min trigger security alert + audit log).
2. **Exfiltration Burst Defense**: Monitors download velocity per user session (>10 downloads in 5 min flags incident).
3. **Anomalous IP Detection**: Alerts users on logins originating from unseen IPs.
4. **Token Revocation**: Distributed JWT session invalidation via Redis token blacklisting.
