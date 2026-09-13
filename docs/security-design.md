# TrustShare Security Design

## 1. Overview

TrustShare is designed to provide secure file storage and file sharing. It protects **user accounts, files, encryption keys, and file-sharing operations** using authentication, authorization, encryption, secure storage, and access controls.

## 2. Authentication

TrustShare provides secure user authentication using **bcrypt password hashing** and **JWT authentication**. Users must be authenticated before accessing protected resources.

- **bcrypt password hashing**
- **JWT authentication**
- Active-user verification
- Protected API endpoints
- Secure login and registration

## 3. Authorization

TrustShare uses **role-based access control (RBAC)** to control access to system resources.

- **User:** Manage and share their own files
- **Admin:** Manage users and user roles
- **View Permission:** Allows users to view shared files
- **Download Permission:** Allows users to download shared files
- Access is checked before file operations

## 4. File Encryption

Files are protected using **AES-256-GCM encryption** before being stored in cloud storage.

```text
Original File
     ↓
AES-256-GCM Encryption
     ↓
Encrypted File
     ↓
Backblaze B2

## 6. Secure File Sharing

TrustShare provides a secure file-sharing mechanism that allows users to share files with other registered users. Access to shared files is controlled using permissions.

- Users can share files with **registered users**
- **View permission** allows users to access shared files
- **Download permission** allows users to download files
- Permissions can have an **expiration time**
- Access is verified before providing the file

```text
Sender
   ↓
Select File
   ↓
Select Recipient
   ↓
Set Permission
   ↓
Shared File
   ↓
Authorized Recipient

## 7. Temporary Share Links

TrustShare provides temporary share links for **secure and time-limited file access**. Users can control how long a shared link remains active and how many times it can be used.

- **Expiration time** controls the validity of the link
- **Maximum download limit** controls the number of downloads
- **Download count** tracks link usage
- **Link revocation** allows the owner to disable the link
- **Hashed tokens** help protect share links

```text
Create Share Link
       ↓
Set Expiration
       ↓
Set Download Limit
       ↓
Generate Secure Link
       ↓
User Access
       ↓
Check Link Validity

## 8. Secure File Storage

TrustShare uses **Backblaze B2** for secure cloud storage. Files are encrypted using **AES-256-GCM** before they are uploaded to the cloud.

- **Encrypted files** are stored in Backblaze B2
- **PostgreSQL** stores file metadata
- **Storage key** identifies the file in cloud storage
- **Encryption key reference** is stored in PostgreSQL
- Actual file content is not stored directly in PostgreSQL

```text
Original File
     ↓
AES-256-GCM Encryption
     ↓
Encrypted File
     ↓
Backblaze B2

## 9. File Decryption

TrustShare decrypts files only after **authentication and permission verification**. The encrypted file is retrieved from Backblaze B2 and decrypted securely before it is provided to the authorized user.

- **JWT authentication** verifies the user
- **Permission check** verifies file access
- Encrypted file is retrieved from **Backblaze B2**
- Protected encryption key is recovered
- File is decrypted using **AES-256-GCM**
- Decrypted file is provided to the **authorized user**

```text
User Request
     ↓
JWT Authentication
     ↓
Permission Check
     ↓
Retrieve Encrypted File
     ↓
Recover Encryption Key
     ↓
AES-256-GCM Decryption
     ↓
Authorized User

## 10. Download Tracking

TrustShare records **file download activities** to track file access and maintain a secure download history.

- **File ID** identifies the downloaded file
- **User ID** identifies the user who downloaded the file
- **Share Link ID** identifies the share link used for downloading
- **IP address** records the request source
- **User agent** records the client information
- **Download time** records when the file was downloaded

```text
User
  ↓
Request File
  ↓
Authentication & Permission Check
  ↓
Download File
  ↓
Record Download Activity
  ↓
PostgreSQL
