
# TrustShare Database Design

## 1. Database

TrustShare uses PostgreSQL as the primary relational database.

The database stores user information, file metadata, permissions, sharing information and download records.

The actual encrypted file contents are stored in Backblaze B2.

---

## 2. Database Tables

TrustShare contains the following main tables:

1. Users
2. Folders
3. Files
4. File Versions
5. File Permissions
6. Share Links
7. Downloads

---

## 3. Users

Stores information about registered users.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| full_name | VARCHAR(150) | User's full name |
| email | VARCHAR(255) | Unique email |
| password_hash | VARCHAR(255) | Hashed password |
| role | VARCHAR(20) | user/admin |
| account_status | VARCHAR(20) | active/inactive/locked |
| created_at | TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | Last update time |

---

## 4. Folders

Stores user folders and subfolders.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| owner_id | UUID | User who owns the folder |
| parent_folder_id | UUID | Parent folder |
| name | VARCHAR(255) | Folder name |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

---

## 5. Files

Stores file metadata.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| owner_id | UUID | File owner |
| folder_id | UUID | Folder containing the file |
| original_name | VARCHAR(255) | Original filename |
| storage_key | VARCHAR(500) | Cloud storage location |
| content_type | VARCHAR(100) | File type |
| size_bytes | BIGINT | File size |
| checksum | VARCHAR(64) | SHA-256 checksum |
| encryption_key_reference | VARCHAR(255) | Reference to encryption key |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |
| deleted_at | TIMESTAMP | Soft-delete time |

The actual encrypted file content is stored in Backblaze B2.

The database stores only the storage location and encryption-key reference.

---

## 6. File Versions

Stores different versions of a file.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| file_id | UUID | Related file |
| version_number | INTEGER | Version number |
| storage_key | VARCHAR(500) | Storage location |
| size_bytes | BIGINT | File size |
| checksum | VARCHAR(64) | SHA-256 checksum |
| encryption_key_reference | VARCHAR(255) | Encryption key reference |
| uploaded_by | UUID | User who uploaded version |
| created_at | TIMESTAMP | Creation time |

---

## 7. File Permissions

Stores permissions given to users for shared files.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| file_id | UUID | Shared file |
| user_id | UUID | Recipient user |
| access_level | VARCHAR(20) | view/download |
| granted_by | UUID | User who granted access |
| expires_at | TIMESTAMP | Permission expiration |
| created_at | TIMESTAMP | Permission creation time |

A user can have either:

- View permission
- Download permission

An expiration time can also be assigned.

---

## 8. Share Links

Stores temporary sharing links.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| file_id | UUID | Shared file |
| created_by | UUID | Link creator |
| token_hash | VARCHAR(255) | Hashed temporary token |
| access_level | VARCHAR(20) | view/download |
| expires_at | TIMESTAMP | Link expiration |
| max_downloads | INTEGER | Maximum downloads |
| download_count | INTEGER | Current downloads |
| is_active | BOOLEAN | Link status |
| created_at | TIMESTAMP | Creation time |
| revoked_at | TIMESTAMP | Revocation time |

The raw temporary token is not stored in the database.

Only its hash is stored.

---

## 9. Downloads

Stores download activity.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| file_id | UUID | Downloaded file |
| share_link_id | UUID | Related temporary link |
| user_id | UUID | User who downloaded |
| ip_address | VARCHAR(45) | Client IP |
| user_agent | TEXT | Browser information |
| downloaded_at | TIMESTAMP | Download time |

This table helps maintain download records and audit information.

---

## 10. Relationships

```text
Users
 │
 ├──────────< Folders
 │              │
 │              └──────────< Files
 │
 └──────────< Files
                 │
                 ├──────────< File Versions
                 │
                 ├──────────< File Permissions >──────── Users
                 │
                 ├──────────< Share Links
                 │
                 └──────────< Downloads

```
## 11. Main Relationships

**Users → Files**:
One user can own many files.

**Users → Folders**:
One user can own many folders.

**Folders → Files**:
One folder can contain many files.

**Files → File Versions**:
One file can have multiple versions.

**Files → File Permissions**:
One file can have permissions for multiple users.

**Files → Share Links**:
One file can have multiple temporary share links.

**Files → Downloads**:
One file can have multiple download records.

## 12. Security Considerations

The database does not store the original file content.

Only encrypted file content is stored in cloud storage.

The database stores:

- File metadata
- Storage key
- Encryption key reference
- Permissions
- Share-link information
- Download information

Passwords are stored as password hashes.

Temporary share links are stored using token hashes.
