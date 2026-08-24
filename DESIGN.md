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
- [ ] Auth + file upload implementation → **Week 2**
