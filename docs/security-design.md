# TrustShare Security Design

## 1. Overview

TrustShare uses multiple security mechanisms to protect **user accounts, files, encryption keys, and file-sharing operations**.

## 2. Authentication

TrustShare provides secure user authentication using:

- **bcrypt password hashing**
- **JWT authentication**
- Active-user verification
- Protected API endpoints

## 3. Authorization

TrustShare uses **role-based access control (RBAC)** to control user access.

- **User:** Manage and share their own files
- **Admin:** Manage users and user roles
- **File Permissions:** View or Download

## 4. File Encryption

Files are protected using **AES-256-GCM encryption** before being stored.

Original File
     ↓
AES-256-GCM Encryption
     ↓
Encrypted File
     ↓
Backblaze B2

## 5. Key Management

TrustShare uses secure encryption key management to protect file encryption keys.

- Unique encryption key for each file
- Master encryption key protects file keys
- Encryption key reference stored in PostgreSQL
- Actual encryption keys are protected separately

File Encryption Key
        ↓
Master Encryption Key
        ↓
Encrypted Key Store

## 6. Secure File Sharing

TrustShare allows users to securely share files with other registered users.

- View permission
- Download permission
- Permission expiration
- Access verification
  
Sender
   ↓
Select File
   ↓
Select User
   ↓
Set Permission
   ↓
Shared File

## 7. Temporary Share Links

TrustShare provides temporary share links for controlled file access.

- Expiration time
- Maximum download limit
- Download count tracking
- Link revocation
- Hashed share tokens
  
Create Share Link
       ↓
Set Expiration
       ↓
Set Download Limit
       ↓
Share Link
       ↓
Access File

## 8. Secure File Storage

Encrypted files are stored in Backblaze B2.

- Files are encrypted before storage
- Encrypted files are stored in Backblaze B2
- PostgreSQL stores file metadata
- Storage keys identify stored files
- Encryption key references are stored in PostgreSQL
 Original File
     ↓
AES-256-GCM Encryption
     ↓
Encrypted File
     ↓
Backblaze B2

## 9. File Decryption

Files are decrypted only after successful authentication and permission verification.

- JWT authentication verifies the user
- Permission check verifies file access
- Encrypted file is retrieved from Backblaze B2
- Protected encryption key is recovered
- File is decrypted using AES-256-GCM
- Decrypted file is provided to the authorized user
User Request
     ↓
Authentication
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

## 10. Download Tracking

TrustShare records file download activities for tracking and auditing.

- File information
- User information
- Share Link ID
- IP address
- User agent
- Download time

