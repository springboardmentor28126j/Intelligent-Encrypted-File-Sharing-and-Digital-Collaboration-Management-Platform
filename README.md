# TrustShare

Secure file-sharing platform. Milestone 1 scope: authentication, file
upload/download, and a full dashboard UI. Encryption (AES-256) and secure
sharing links are Milestone 2, not yet implemented.

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
- [x] Architecture + DB schema design (`DESIGN.md`)
- [x] FastAPI backend with JWT auth (register/login)
- [x] Forgot password / reset password flow
- [x] File upload, list, download endpoints (auth-protected)
- [x] Activity feed (login/register/upload/download/password events)
- [x] Full dashboard UI: Overview, My files, Upload file, Activity, Profile
- [x] PostgreSQL (users, files), MongoDB (activity_logs), Redis configured

## What's next (Week 2 / Milestone 2)
- AES-256 server-side encryption of stored files
- Secure shareable links with expiration
- OAuth2 login, MFA
- Folder organization (currently a placeholder page)
- Access-level permissions
