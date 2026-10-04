# TrustShare – REST API Specification

**Base URL**: `http://localhost:8000` (or configured API gateway)  
**OpenAPI / Interactive Docs**: `http://localhost:8000/docs`  
**Authentication**: Bearer Token in `Authorization: Bearer <JWT_TOKEN>` header.

---

## 1. Authentication Endpoints

### `POST /register`
Creates a new user account. Plaintext password is automatically bcrypt-hashed before storage.
- **Request Body**:
  ```json
  {
    "full_name": "Alice Smith",
    "email": "alice@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "id": 1,
    "full_name": "Alice Smith",
    "email": "alice@example.com",
    "role": "user",
    "created_at": "2026-09-23T12:00:00Z"
  }
  ```

### `POST /login`
Authenticates credentials and returns a signed JWT access token.
- **Request Body**:
  ```json
  {
    "email": "alice@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer"
  }
  ```

### `POST /logout` (Protected)
Revokes the current JWT session by blacklisting it in Redis.
- **Response `200 OK`**:
  ```json
  {
    "message": "Successfully logged out and session revoked.",
    "success": true
  }
  ```

### `GET /me` (Protected)
Returns the currently authenticated user profile.

---

## 2. Secure File Management Endpoints

### `POST /files/upload` (Protected)
Uploads, encrypts via AES-256-GCM, stores ciphertext in AWS S3 or Local Vault, and records metadata.
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `file`: Binary file stream
  - `description`: Optional text notes
- **Response `201 Created`**:
  ```json
  {
    "id": "1",
    "original_name": "Financials.pdf",
    "stored_name": "vault/9a5f-4a0b-93e1-329b3c4a17.bin",
    "file_size": 1048576,
    "content_type": "application/pdf",
    "extension": ".pdf",
    "category": "pdf",
    "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "owner_id": 1,
    "owner_email": "alice@example.com",
    "description": "Quarterly overview",
    "upload_date": "2026-09-23T12:00:00Z",
    "download_count": 0,
    "is_encrypted": true,
    "encryption_algorithm": "AES-256-GCM",
    "storage_backend": "s3"
  }
  ```

### `GET /files` (Protected)
Lists all files owned by the user (or system-wide if admin), with optional `search` and `category` filters.

### `GET /files/{file_id}` (Protected)
Retrieves complete file metadata and active share links (omits encryption keys).

### `GET /files/{file_id}/download` (Protected)
Verifies ownership, retrieves ciphertext from S3/local storage, decrypts server-side with AES-256-GCM, and streams plaintext.

### `DELETE /files/{file_id}` (Protected)
Permanently deletes ciphertext from storage and removes database records.

---

## 3. Secure File Sharing Endpoints

### `POST /files/{file_id}/share` (Protected)
Generates a secure temporary share link with configurable expiration and download limits.
- **Request Body**:
  ```json
  {
    "duration": "24h",
    "permission": "can_download",
    "max_downloads": 5
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "share_token": "9bf2c1e8a4d7...",
    "share_url": "/share/9bf2c1e8a4d7...",
    "permission": "can_download",
    "expires_at": "2026-09-24T12:00:00Z",
    "max_downloads": 5,
    "download_count": 0,
    "created_at": "2026-09-23T12:00:00Z"
  }
  ```

### `POST /files/{file_id}/share-user` (Protected)
Grants direct access to another registered user and sends them an in-app notification.

### `GET /files/shared-with-me` (Protected)
Lists all files shared directly with the authenticated user.

### `GET /share/{token}` (Public)
Retrieves public information for a shared link without revealing owner secrets.

### `GET /share/{token}/download` (Public)
Streams decrypted file if token is valid, not expired, and not revoked.

---

## 4. Activity Monitoring & Audit Endpoints

### `GET /audit/logs` (Protected)
Fetches chronological audit logs with filters:
- Query parameters: `action`, `file_id`, `status_filter`, `limit`, `offset`.

### `GET /audit/stats` (Protected)
Aggregates activity metrics: total logins, failed logins, file operations, security incidents, and action distributions.

### `GET /audit/file/{file_id}` (Protected)
Returns the complete lifecycle and access trail of a specific file.

---

## 5. In-App Notifications Endpoints

### `GET /notifications` (Protected)
Retrieves user notifications (supports `unread_only=true` filter).

### `GET /notifications/unread-count` (Protected)
Returns count of unread notifications for badge rendering.

### `PATCH /notifications/{id}/read` (Protected)
Marks a single notification as read.

### `POST /notifications/read-all` (Protected)
Marks all user notifications as read.

### `DELETE /notifications/{id}` (Protected)
Deletes a notification.

---

## 6. Analytics Dashboard Endpoints

### `GET /analytics/dashboard` (Protected)
Returns unified metrics: total files, storage in bytes & MB, total downloads, active shares, security incidents, 7-day upload/download trends, storage breakdown by category, and recent activity stream.

---

## 7. Health & Diagnostic Endpoints

### `GET /health` (Public)
Full health status of PostgreSQL, MongoDB, and Redis.

### `GET /health/mongodb` (Public)
Dedicated MongoDB connectivity and latency check.

### `GET /health/redis` (Public)
Dedicated Redis connectivity and latency check.
