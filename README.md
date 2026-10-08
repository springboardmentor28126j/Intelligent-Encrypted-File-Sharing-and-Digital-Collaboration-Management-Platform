# TrustShare — Secure File-Sharing System

A full-stack secure file-sharing and digital collaboration platform built with FastAPI, React, PostgreSQL, MongoDB, and Redis.

## Features

### Authentication & Access Control
- JWT-based signup/login with bcrypt password hashing
- Role-based access control (admin/standard user)
- Forgot password with email-based reset codes
- Two-factor authentication (email OTP)

### File Management
- Secure file upload with type and size validation
- AES-256-GCM server-side encryption (unique key per file)
- Encrypted cloud storage (Supabase Storage)
- File download with automatic decryption
- File delete with permission checks

### Secure Sharing
- Recipient-based share links with expiry (1 hour to 7 days)
- Share link revocation
- Access logging for shared files

### Monitoring & Security
- Full activity audit log (upload, download, delete, share)
- Suspicious activity detection (failed logins, rapid downloads, rapid deletes)
- Email security alerts
- File owner notifications on access by others
- Storage analytics dashboard (file types, top uploaders, totals)
- CSV activity/security report export

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, Uvicorn |
| Frontend | React.js, Axios |
| Database | PostgreSQL (via SQLAlchemy ORM) |
| Caching / Sessions | Redis Cloud |
| Activity Logging | MongoDB |
| File Storage | Supabase Storage |
| Encryption | AES-256-GCM (cryptography library) |
| Authentication | JWT (python-jose), bcrypt |
| Email | Gmail SMTP |
| Containerization | Docker |

## Project Structure

```
trustshare/
├── backend/
│   ├── main.py              # API routes
│   ├── models.py             # Database models
│   ├── schemas.py            # Pydantic schemas
│   ├── auth.py                # JWT + password hashing
│   ├── database.py           # PostgreSQL connection
│   ├── encryption.py         # AES-256-GCM encrypt/decrypt
│   ├── storage_client.py     # Supabase Storage client
│   ├── redis_client.py       # Redis connection
│   ├── mongo.py               # MongoDB connection
│   ├── email_service.py      # Email sending
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   └── App.css
│   └── Dockerfile
└── docker-compose.yml
```

## Setup Instructions

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL
- Docker (optional, for containerized deployment)

### Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Docker Setup (Alternative)
```bash
docker-compose up --build
```

Backend runs on `http://localhost:8000`, frontend on `http://localhost:3000`.

## Live Demo
   Frontend: https://trustshare-frontend-ohp5.onrender.com
   Backend API: https://trustshare-backend-lhed.onrender.com

## Environment Variables

Create a `.env` file in `backend/` with:
```
EMAIL_ADDRESS=your_gmail@gmail.com
EMAIL_APP_PASSWORD=your_app_password
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
```

## API Endpoints (Summary)

| Endpoint | Method | Description |
|---|---|---|
| `/signup` | POST | Create account |
| `/login` | POST | Authenticate, returns JWT or MFA challenge |
| `/verify-mfa` | POST | Complete MFA login |
| `/forgot-password` | POST | Request reset code |
| `/reset-password` | POST | Reset password with code |
| `/upload` | POST | Upload & encrypt a file |
| `/files` | GET | List files (role-filtered) |
| `/download/{id}` | GET | Download & decrypt a file |
| `/files/{id}` | DELETE | Delete a file |
| `/share/{id}` | POST | Create a share link |
| `/shared/{token}` | GET | Access a file via share link |
| `/share-links` | GET | List active share links |
| `/activity-log` | GET | View activity/audit log |
| `/analytics` | GET | Storage usage analytics |
| `/report` | GET | Download CSV activity report |
| `/mfa/enable-request` | POST | Request MFA setup code |
| `/mfa/enable-confirm` | POST | Confirm and enable MFA |

## Known Limitations (Future Work)

- Cloud storage uses Supabase instead of AWS S3 (no card available for AWS free tier)
- Email sending uses Gmail SMTP (suitable for testing, not production scale)
- Folder/category organization not yet implemented

## Author

Divya P — TrustShare Internship Project