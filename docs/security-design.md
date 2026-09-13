# TrustShare Security Design

## 1. Overview

TrustShare uses multiple security mechanisms to protect user accounts, files, encryption keys, and file-sharing operations.

## 2. Authentication

- Users register with their email and password.
- Passwords are protected using bcrypt hashing.
- JWT tokens are used for authenticated API requests.
- Only active users can access protected resources.

## 3. Authorization

TrustShare uses role-based access control.

- **User:** Can manage and share their own files.
- **Admin:** Can manage users and their roles.
- File permissions control whether a user can view or download a file.

## 4. File Encryption

Files are encrypted on the server using **AES-256-GCM** before being stored in cloud storage.

```text
Original File
     ↓
AES-256-GCM Encryption
     ↓
Encrypted File
     ↓
Backblaze B2

5. Encryption Key Management
A unique encryption key is generated for files.
File keys are protected using a master encryption key.
Only a key reference is stored in the database.
Actual encryption keys are not stored directly in PostgreSQL.
6. Secure File Sharing

Files can be shared with specific users using access permissions.

Available permissions:
View
Download
Permissions can also have an expiration time.


7. Temporary Share Links

Temporary links provide controlled file access.

Links have an expiration time.
Maximum download limits can be configured.
Links can be revoked.
Raw share tokens are not stored directly.


8. Secure File Storage

Only encrypted file data is stored in Backblaze B2.
PostgreSQL stores file metadata such as:
File name
File size
Storage key
Checksum
Encryption key reference
9. Security Flow
User Authentication
        ↓
Permission Check
        ↓
Encrypted File Retrieval
        ↓
Key Recovery
        ↓
AES-256-GCM Decryption
        ↓
Authorized User
