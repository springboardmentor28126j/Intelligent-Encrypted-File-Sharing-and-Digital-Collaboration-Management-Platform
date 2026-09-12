# TrustShare

Secure file-sharing platform. Milestone 1 (authentication, file
upload/download, full dashboard UI) and Milestone 2 (AES-256 encryption,
secure sharing links, S3 storage) are both complete.

## What's included
- `DESIGN.md` — architecture + DB schema
- `backend/` — FastAPI app: JWT auth, forgot/reset password, file
  upload/list/download, activity feed, Postgres + MongoDB + Redis
- `frontend/` — Next.js app: login/register, forgot/reset password, a
  top-navbar dashboard (Overview, My files, Upload file, Folders,
  Activity, Profile)
- `docker-compose.yml` — Postgres, MongoDB, Redis, backend

## How to run

```bash
# 1. Start backend + databases
docker-compose up --build

# 2. In a separate terminal, start the frontend
cd frontend
npm install
npm run dev
```

- Backend: http://localhost:8000 (docs at /docs)
- Frontend: http://localhost:3000 (opens automatically once ready)

## Try it
1. Open http://localhost:3000 → Register a new account
2. Land on the Overview dashboard → see stats, recent files, recent activity
3. Upload a file from the Upload file page → see it listed under My files
4. Click Download to confirm it works
5. Try "Forgot password?" on the login page → generates a reset link
   (shown directly on screen for now, since no email service is wired up yet)

## What's implemented

**Milestone 1**
- [x] Architecture + DB schema design (`DESIGN.md`)
- [x] FastAPI backend with JWT auth (register/login)
- [x] Forgot password / reset password flow
- [x] File upload, list, download endpoints (auth-protected)
- [x] Activity feed (login/register/upload/download/password events)
- [x] Full dashboard UI: Overview, My files, Upload file, Activity, Profile
- [x] PostgreSQL (users, files), MongoDB (activity_logs), Redis configured

**Milestone 2**
- [x] AES-256-GCM server-side encryption, per-file key with envelope encryption
- [x] Encrypted file storage in AWS S3
- [x] Secure shareable links with expiration (Redis-backed tokens)
- [x] Direct user-to-user sharing with read/write permission levels
- [x] In-memory decryption on download (plaintext never persisted)
- [x] Shared PostgreSQL database (Supabase) for team-wide development

## What's next (Milestone 3 — Monitoring, Notifications & Analytics)
- Security/audit logging beyond the current activity feed
- Notification system (share alerts, download/access alerts, security warnings)
- Storage usage and sharing activity analytics dashboard
- Suspicious activity / unauthorized access detection
- Role-based access control (role field exists on the user model but isn't enforced yet)
