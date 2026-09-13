# TrustShare System Architecture

## 1. Overview

TrustShare is a secure file-sharing and digital collaboration platform that allows users to upload, manage, and share files securely.

## 2. Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| Authentication | JWT |
| File Encryption | AES-256-GCM |
| Cloud Storage | Backblaze B2 |
| Key Management | Encrypted Key Store |

## 3. High-Level Request Flow

```text
User
 ↓
Frontend
 ↓
FastAPI Backend
 ↓
Authentication & Authorization
 ↓
PostgreSQL
 ↓
Encryption / Decryption
 ↓
Backblaze B2
4. System Architecture
                User
                  |
                  v
        HTML / CSS / JavaScript
                  |
                  v
            FastAPI Backend
             /          \
            /            \
           v              v
     PostgreSQL      AES-256-GCM
                          |
                          v
                  Backblaze B2
5. Component Responsibilities
Frontend
User login and registration
File management
File sharing
Admin dashboard
Backend
Authentication
File upload and download
Encryption and decryption
Access control
Sharing and temporary links
PostgreSQL

Stores users, files, folders, permissions, share links, versions, and download records.

Backblaze B2

Stores encrypted file data.

Key Management

Protects and manages file encryption keys.

6. Security
JWT authentication
bcrypt password hashing
AES-256-GCM encryption
Role-based access control
File permissions
Temporary link expiration
Share-link revocation
