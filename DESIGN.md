# TrustShare — Week 1 Design Document

## 1. Objective (recap)
Secure file-sharing platform with server-side AES-256 encryption, JWT/OAuth2 auth,
temporary share links, and activity/audit logging.

## 2. System Architecture (Week 1 scope)

```
[ Next.js Frontend ]  <--HTTPS-->  [ FastAPI Backend ]  <-->  [ PostgreSQL ]
                                          |                          (users, files, permissions)
                                          |--> [ MongoDB ]  (activity_logs)
                                          |--> [ Redis ]    (sessions/cache)
                                          |--> [ Local/S3 storage ] (file bytes)
```

- **Frontend**: Next.js app — login/register page, dashboard (upload + file list).
- **Backend**: FastAPI — REST API, JWT auth, file upload/list/download endpoints.
- **PostgreSQL**: source of truth for users, file metadata, permissions.
- **MongoDB**: activity/event logs (upload, login, download events).
- **Redis**: session/token cache (used later for share-link expiry in Milestone 2).

Encryption (AES-256), OAuth2, share links, and analytics are **Milestone 2+** —
intentionally out of scope for Week 1 so we ship a working auth + upload flow first.

## 3. Database Schema (PostgreSQL)

### `users`
| column        | type      | notes                  |
|---------------|-----------|-------------------------|
| id            | UUID PK   |                         |
| email         | text UNIQUE |                       |
| password_hash | text      | bcrypt                 |
| role          | text      | 'user' / 'admin'       |
| created_at    | timestamp |                         |

### `files`
| column        | type      | notes                        |
|---------------|-----------|-------------------------------|
| id            | UUID PK   |                                |
| owner_id      | UUID FK -> users.id |                      |
| filename      | text      |                                |
| storage_path  | text      | local path (S3 key later)     |
| size_bytes    | bigint    |                                |
| uploaded_at   | timestamp |                                |

### MongoDB — `activity_logs` (collection)
```json
{
  "user_id": "uuid",
  "action": "upload | login | download",
  "resource_id": "file uuid or null",
  "timestamp": "ISO8601",
  "metadata": {}
}
```

## 4. Week 1 Task Checklist
- [x] Define objectives and architecture (this doc)
- [x] Design DB schema (this doc)
- [x] Setup FastAPI backend skeleton
- [x] Setup Next.js frontend skeleton
- [x] Configure PostgreSQL, MongoDB, Redis via Docker Compose
- [x] Auth + file upload implementation

## 5. Milestone 2 — Encryption & Secure Sharing

### Encryption design
Files are encrypted with **AES-256-GCM** (authenticated encryption — tampering
with stored ciphertext is detected on decrypt, not silently accepted) using
**envelope encryption**:

1. Every uploaded file gets its own randomly generated 256-bit AES key
   (the "data key").
2. The file's bytes are encrypted with that data key before ever touching
   disk. Only the encrypted bytes are written to `UPLOAD_DIR`.
3. The data key itself is then encrypted ("wrapped") with a single
   **master key**, read from the `MASTER_ENCRYPTION_KEY` environment
   variable — never stored in the database, never exposed to users.
4. Only the *wrapped* key, plus the nonces needed to reverse both
   encryption steps, are stored in Postgres (`files.encrypted_key`,
   `files.key_nonce`, `files.file_nonce`).

On download, the wrapped key is unwrapped with the master key, the file
key is recovered, and the file bytes are decrypted **in memory only** —
the decrypted content is never written back to disk.

### New `files` table columns
| column         | type   | notes                                    |
|----------------|--------|-------------------------------------------|
| encrypted_key  | text   | per-file AES key, encrypted with master key |
| key_nonce      | text   | nonce used to encrypt the per-file key    |
| file_nonce     | text   | nonce used to encrypt the file's bytes    |

All three are base64-encoded before storage.

### Secure sharing links
Share links let someone access a specific file **without an account**.

- `POST /files/{id}/share` (authenticated) generates a random, unguessable
  token and stores `token → file_id` in **Redis** with a 24-hour TTL.
- `GET /share/{token}/download` (no authentication required) resolves the
  token via Redis, decrypts the file the same way an authenticated
  download does, and returns it.
- Redis's built-in key expiry handles link expiration automatically —
  no cleanup job needed. Once the TTL elapses, the token simply stops
  resolving.

### What was tested before shipping
- Full encrypt → wrap → unwrap → decrypt round trip, confirmed byte-identical
  to the original file.
- Tampered ciphertext is correctly rejected (`InvalidTag`), proving the
  authentication layer actually works, not just the encryption.
- Share token creation, resolution, expiry, and manual revocation, tested
  against a real Redis instance (including waiting for a token to actually
  expire).
- Full FastAPI app import with all new routes registering correctly.
- `File` model with the new encryption columns, tested against a real
  database (create table, insert, fetch, verify).

## 6. Milestone 2 Task Checklist
- [x] AES-256 server-side encryption workflow
- [x] Unique encryption key per file
- [x] Encrypted storage at rest
- [x] Envelope key management (master key never stored, per-file keys wrapped)
- [x] Secure shareable links
- [x] Temporary link expiration (via Redis TTL)
- [ ] OAuth2 login, MFA → later
- [ ] Access-level permissions beyond owner-only → later

