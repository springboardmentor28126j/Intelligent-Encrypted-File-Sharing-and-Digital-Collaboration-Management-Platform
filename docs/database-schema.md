# TrustShare — Database Schema

## 1. Database Overview

TrustShare uses multiple database technologies for different types of data:

- PostgreSQL — structured application data
- MongoDB — activity and audit logs
- Redis — temporary data, caching and session-related information

## 2. PostgreSQL Database

PostgreSQL stores the core structured information required by the application.

### Main Tables

```text
users
roles
files
file_permissions
file_shares
temporary_access
```

## 3. Users Table

The `users` table stores registered user information.

| Column | Type | Description |
|---|---|---|
| id | UUID | Unique user identifier |
| name | VARCHAR | User's name |
| email | VARCHAR | Unique email address |
| password_hash | VARCHAR | Hashed password |
| role_id | UUID | User role |
| is_active | BOOLEAN | Account status |
| created_at | TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | Last update time |

## 4. Roles Table

The `roles` table defines user roles used for Role-Based Access Control.

| Column | Type | Description |
|---|---|---|
| id | UUID | Unique role identifier |
| name | VARCHAR | Role name |
| description | TEXT | Role description |

### Initial Roles

```text
Admin
User
```

Additional roles can be introduced if required by the project.

## 5. Files Table

The `files` table stores file metadata.

| Column | Type | Description |
|---|---|---|
| id | UUID | Unique file identifier |
| owner_id | UUID | User who owns the file |
| file_name | VARCHAR | Original file name |
| file_path | VARCHAR | Storage location |
| file_size | BIGINT | File size |
| file_type | VARCHAR | MIME/file type |
| checksum | VARCHAR | File integrity checksum |
| created_at | TIMESTAMP | Upload time |
| updated_at | TIMESTAMP | Last modification time |

## 6. File Permissions Table

The `file_permissions` table controls access to files.

| Column | Type | Description |
|---|---|---|
| id | UUID | Unique permission identifier |
| file_id | UUID | Related file |
| user_id | UUID | User receiving permission |
| permission | VARCHAR | Access permission |
| created_at | TIMESTAMP | Permission creation time |

### Permission Types

```text
VIEW
DOWNLOAD
EDIT
DELETE
```

## 7. File Shares Table

The `file_shares` table stores information about file-sharing operations.

| Column | Type | Description |
|---|---|---|
| id | UUID | Unique share identifier |
| file_id | UUID | Shared file |
| owner_id | UUID | File owner |
| shared_with_user_id | UUID | Recipient |
| permission | VARCHAR | Permission level |
| created_at | TIMESTAMP | Sharing time |
| expires_at | TIMESTAMP | Optional expiration time |

## 8. Temporary Access Table

The `temporary_access` table manages temporary file-access links.

| Column | Type | Description |
|---|---|---|
| id | UUID | Unique access identifier |
| file_id | UUID | Related file |
| token_hash | VARCHAR | Secure token hash |
| created_by | UUID | User creating the link |
| expires_at | TIMESTAMP | Link expiration time |
| max_downloads | INTEGER | Maximum permitted downloads |
| download_count | INTEGER | Number of downloads |
| created_at | TIMESTAMP | Creation time |

## 9. Database Relationships

```text
                    ┌──────────────┐
                    │    roles     │
                    └──────┬───────┘
                           │
                           │ 1:N
                           ↓
                    ┌──────────────┐
                    │    users     │
                    └──────┬───────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             │ 1:N         │ 1:N         │ 1:N
             ↓             ↓             ↓
       ┌──────────┐  ┌─────────────┐  ┌──────────────┐
       │  files   │  │ file_shares │  │file_permissions│
       └────┬─────┘  └─────────────┘  └──────────────┘
            │
            │ 1:N
            ↓
    ┌─────────────────┐
    │ temporary_access│
    └─────────────────┘
```

## 10. Relationship Description

### Users → Roles

Each user is assigned a role.

```text
roles 1 ─────── N users
```

### Users → Files

A user can own multiple files.

```text
users 1 ─────── N files
```

### Files → Permissions

A file can have permissions assigned to multiple users.

```text
files 1 ─────── N file_permissions
```

### Files → Shares

A file can be shared with multiple users.

```text
files 1 ─────── N file_shares
```

### Files → Temporary Access

A file can have multiple temporary access links.

```text
files 1 ─────── N temporary_access
```

## 11. MongoDB Database

MongoDB will store activity and audit information.

### Activity Log Document

Example structure:

```json
{
  "user_id": "user-uuid",
  "action": "FILE_DOWNLOAD",
  "file_id": "file-uuid",
  "ip_address": "client-ip",
  "timestamp": "2026-01-01T12:00:00Z",
  "status": "SUCCESS"
}
```

### Activity Types

```text
USER_LOGIN
USER_LOGOUT
FILE_UPLOAD
FILE_VIEW
FILE_DOWNLOAD
FILE_DELETE
FILE_SHARE
PERMISSION_CHANGE
SECURITY_EVENT
```

## 12. Redis

Redis will be used for temporary and frequently accessed information.

Potential uses:

- Session data
- Temporary authentication information
- Temporary access information
- Caching
- Rate-limiting support

## 13. Database Security

The database layer should follow these principles:

- Use parameterized database queries.
- Store passwords only as secure hashes.
- Never store plaintext passwords.
- Restrict database credentials using environment variables.
- Apply least-privilege database access.
- Validate user permissions before protected operations.
- Maintain activity and audit records.

## 14. Database Architecture Summary

```text
                  FastAPI Backend
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ↓             ↓             ↓
    PostgreSQL       MongoDB        Redis
          │             │             │
          ↓             ↓             ↓
 Structured Data    Audit Logs    Temporary Data
```