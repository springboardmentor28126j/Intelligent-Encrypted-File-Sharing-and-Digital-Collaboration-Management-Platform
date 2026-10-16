# TrustShare --- Secure File-Sharing System

TrustShare is a full-stack platform for secure file management and
collaboration. Users can upload, preview, download, organise, and share
files with other TrustShare accounts or through controlled links. The
backend encrypts files before storing them in Amazon S3. PostgreSQL
stores account information, file metadata, sharing records, audit logs,
notifications, and security alerts.

## Features

### Authentication

-   Registration and login with bcrypt-hashed passwords.
-   JWT authentication for protected endpoints.
-   Optional TOTP multi-factor authentication (MFA), authenticator-app
    support, backup codes, and failed-attempt lockout.
-   User roles, with `USER` as the default.
-   Password-reset endpoint.

### File management

-   Upload, download, preview, and delete files.
-   Automatic file categorisation.
-   Folders and file organisation.
-   File version history.
-   Recycle bin, restore, and permanent deletion.
-   SHA-256 file-integrity checks.
-   Storage-usage statistics.

### Secure sharing

-   Share files directly with another TrustShare account by email or
    username.
-   Create secure shareable links.
-   View-only or download permissions.
-   Expiry times and optional download limits.
-   Revoke access at any time.
-   "Shared With Me" and "Sent Files" views.
-   Store SHA-256 hashes of share tokens rather than the raw tokens.

### Monitoring and alerts

-   Audit logs for important actions, including logins, uploads,
    downloads, shares, and AI queries.
-   Notifications with read/unread status.
-   Rule-based security alerts for unusual activity.
-   Analytics for files, shares, downloads, views, storage, and security
    posture.

### AI Assistant

-   Ask questions about accessible files.
-   Generate summaries and document insights.
-   Extract text from supported formats such as PDF, DOCX, PPTX, TXT,
    MD, CSV, JSON, and common code files.
-   Use an OpenAI-compatible API when configured, or a local
    keyword-based fallback when no AI API key is set.

### Interface

-   React dashboard.
-   Light, dark, and system themes.
-   Profile image and account menu.
-   Activity and analytics pages.

## Technology Stack

  Component           Technology
  ------------------- --------------------------------------------------
  Frontend            React 19, Vite, JavaScript, CSS
  Backend             Python, FastAPI
  Database            PostgreSQL, SQLAlchemy
  Authentication      JWT, bcrypt
  MFA                 TOTP
  Encryption          AES-256-GCM
  Integrity checks    SHA-256
  Object storage      Amazon S3
  AI assistant        OpenAI-compatible Chat Completions API, optional
  Local AI fallback   Keyword-based sentence selection

## Architecture

1.  The React frontend sends requests to the FastAPI backend.
2.  The backend authenticates users and checks permissions.
3.  On upload, the backend encrypts the file before writing the
    encrypted bytes to Amazon S3.
4.  PostgreSQL stores user records, file metadata, wrapped encryption
    keys, sharing details, audit logs, notifications, and security
    alerts.
5.  For authorised downloads or previews, the backend retrieves the
    encrypted object from S3 and decrypts it on the server.
6.  The AI Assistant processes extracted text from files the user is
    permitted to access. If an external AI provider is configured,
    relevant document text may be sent to that provider.

## Security and Encryption

TrustShare uses per-file data keys:

1.  A fresh random 256-bit data-encryption key is generated for each
    file.
2.  AES-256-GCM encrypts the file contents and provides
    authenticated-encryption tamper detection.
3.  The per-file data key is wrapped using `MASTER_KEY`.
4.  Encrypted file objects are stored in Amazon S3. PostgreSQL stores
    file metadata and the wrapped key.
5.  During an authorised download, the backend unwraps the key and
    decrypts the file.

**Important:** Back up `MASTER_KEY` securely. Losing it or changing it
without a planned key migration can make existing encrypted files
unrecoverable. Never commit it or AWS credentials to Git.

## AI Assistant

The documented default model is `gpt-4o-mini`, accessed through an
OpenAI-compatible Chat Completions API. Set `AI_API_KEY`, `AI_MODEL`,
and `AI_API_URL` to configure it or another compatible provider.

When `AI_API_KEY` is not configured, TrustShare uses a local
keyword-based fallback that selects relevant sentences. This fallback
does not use an LLM.

**Privacy note:** When an external AI provider is enabled, extracted
document text used as context may leave your server and be sent to that
provider. Enable this only if the provider's data handling is acceptable
for your files.

## Project Structure

``` text
Trustshare-final/
├── requirements.txt
├── backend/
│   ├── main.py                  # FastAPI application and API routes
│   ├── models.py                # SQLAlchemy data models
│   ├── database.py              # PostgreSQL connection and sessions
│   ├── auth.py                  # Password hashing and JWT helpers
│   ├── mfa.py                   # TOTP and backup-code helpers
│   ├── encryption.py            # AES-GCM encryption and key wrapping
│   ├── master_key.py            # Master-key generation utility
│   ├── storage.py               # Local and S3 storage backends
│   ├── sharing.py               # Share-token generation and validation
│   ├── migration.sql            # Database migration SQL
│   ├── run_migration.py         # Migration runner
│   ├── check_orphaned_storage.py
│   ├── test_s3_connection.py
│   ├── tests/
│   │   └── test_encryption.py
│   └── uploads/                 # Used in local-storage mode
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── App.css
        ├── dark-theme.css
        └── icons.jsx
```

## Prerequisites

-   Python 3.10 or newer.
-   Node.js 18 or newer and npm.
-   PostgreSQL database, local or hosted.
-   AWS account, private S3 bucket, and IAM credentials with the
    required bucket permissions.
-   Optional AI API key for the AI Assistant's external-provider mode.

## Configuration

Create `backend/.env`. Replace the example placeholders with your own
values. Do not put real credentials in this README or commit `.env` to
Git.

``` env
# PostgreSQL
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE_NAME

# Base64-encoded 32-byte key generated by master_key.py
MASTER_KEY=YOUR_GENERATED_MASTER_KEY

# Amazon S3
STORAGE_BACKEND=s3
S3_BUCKET_NAME=YOUR_S3_BUCKET_NAME
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_REGION=YOUR_AWS_REGION

# Optional AI Assistant
AI_API_KEY=
AI_MODEL=gpt-4o-mini
AI_API_URL=https://api.openai.com/v1/chat/completions


```

### Configure Amazon S3

1.  Create an S3 bucket in your chosen AWS region.
2.  Create an IAM identity with least-privilege access to the required
    bucket operations.
3.  Set `STORAGE_BACKEND=s3`.
4.  Set the bucket name, region, access key ID, and secret access key in
    `backend/.env`.
5.  Keep the bucket private; do not enable public read access.
6.  Run the project's S3 connection test if available.

For production, prefer an IAM role or short-lived credentials where
supported. Never commit AWS keys to source control.

### Generate the master key

From the `backend/` directory, run:

``` bash
python master_key.py
```

Copy the generated `MASTER_KEY` value into `backend/.env` and keep a
secure backup. Do not generate a new key for an existing installation
without a key-migration plan.

## Installation and Setup

### 1. Clone the repository

``` bash
git clone <your-repository-url>
cd Trustshare-final
```

### 2. Create and activate a Python virtual environment

From the project root:

``` bash
python -m venv backend/venv
```

Activate it:

**Windows PowerShell**

``` powershell
.\backend\venv\Scripts\Activate.ps1
```

**Windows Command Prompt**

``` bat
backend\venv\Scripts\activate.bat
```

**macOS/Linux**

``` bash
source backend/venv/bin/activate
```

Install dependencies:

``` bash
pip install -r requirements.txt
```

If not already included, install packages for document extraction, MFA,
S3, and tests:

``` bash
pip install pypdf python-docx python-pptx openpyxl pyotp "qrcode[pil]" boto3 pytest
```

### 3. Configure the environment

Create `backend/.env` with the database URL, master key, and AWS S3
values described above.

### 4. Prepare the database

From the `backend/` directory:

``` bash
python run_migration.py
```

This runs the project's `migration.sql` against the database configured
by `DATABASE_URL`.

### 5. Start the backend

From the `backend/` directory:

``` bash
uvicorn main:app --reload
```

API base URL: `http://127.0.0.1:8000`

Interactive API documentation: `http://127.0.0.1:8000/docs`

### 6. Start the frontend

Open a second terminal:

``` bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

The frontend API URL is configured in `frontend/src/App.jsx`. If the
backend URL changes, update that setting and configure the backend CORS
origins for the frontend's actual origin.

## API Overview

Use `/docs` on the running backend to verify the exact endpoints and
request schemas in your version.

  ----------------------------------------------------------------------------
  Area                                Example endpoints
  ----------------------------------- ----------------------------------------
  Authentication                      `POST /register`, `POST /login`,
                                      `POST /login/mfa`, `GET /me`

  MFA                                 `GET /mfa/status`, `POST /mfa/setup`,
                                      `POST /mfa/enable`, `POST /mfa/disable`

  Files                               `POST /upload`,
                                      `GET /download/{file_id}`,
                                      `GET /preview/{file_id}`,
                                      `DELETE /files/{file_id}`

  Folders                             `POST /folders`, `GET /folders`

  Recycle bin                         `GET /recycle-bin` and
                                      restore/permanent-delete routes

  Sharing                             `POST /files/{file_id}/share`,
                                      `POST /files/{file_id}/share-account`,
                                      `GET /shared-with-me`, `GET /sent-files`

  Monitoring                          `GET /activity`, `GET /notifications`,
                                      `GET /security-alerts`,
                                      `GET /analytics`, `GET /security-check`

  AI                                  `POST /ai/ask`,
                                      `POST /ai/file/{file_id}/summary`,
                                      `POST /ai/file/{file_id}/insights`

  Health                              `GET /`, `GET /health`
  ----------------------------------------------------------------------------

Protected endpoints require a bearer token:

``` http
Authorization: Bearer <access_token>
```

## Database and Storage

### PostgreSQL

PostgreSQL stores structured application records, including users, file
metadata, shares, folders, file versions, activity logs, notifications,
and security alerts, depending on the tables enabled by the migrations.

Example audit and monitoring queries:

``` sql
SELECT * FROM activity_logs ORDER BY created_at DESC;
SELECT * FROM notifications ORDER BY created_at DESC;
SELECT * FROM security_alerts ORDER BY created_at DESC;
```

If your database version uses a different timestamp-column name, inspect
the table schema and adjust the query.

### Amazon S3

With `STORAGE_BACKEND=s3` and valid S3 configuration, encrypted file
objects are stored in Amazon S3. PostgreSQL stores the associated
metadata and wrapped encryption-key information. The S3 bucket should
remain private, and file access should be mediated by the backend's
authorisation checks.

## Testing

Run encryption tests from the `backend/` directory:

``` bash
pytest
```

If included in your checkout, test S3 connectivity after configuring AWS
credentials:

``` bash
python test_s3_connection.py
```

Run cloud tests only against AWS resources you own or are authorised to
access.




