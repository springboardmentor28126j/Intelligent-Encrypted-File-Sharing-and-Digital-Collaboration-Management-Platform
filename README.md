# TrustShare

Secure file-sharing platform. All four milestones are complete —
authentication and dashboard, AES-256 encryption with secure sharing,
activity monitoring / notifications / analytics, and final testing,
deployment, and documentation. Folder organization is also implemented,
ahead of its original schedule. See `MILESTONE4_REPORT.md` for the full
Milestone 4 write-up (security audit, UI responsiveness fixes, deployment
details, demo script).

## What's included
- `DESIGN.md` — architecture + DB schema
- `backend/` — FastAPI app: JWT auth, forgot/reset password (real email),
  AES-256-GCM envelope encryption, AWS S3 storage, secure sharing (durable
  + expiring links), folder organization, audit logging, in-app + email
  notifications, admin dashboard endpoints, storage analytics, security
  reports. Postgres (Supabase, shared team database) + MongoDB + Redis.
- `frontend/` — Next.js app: login/register, forgot/reset password, a
  top-navbar dashboard (Overview, My files, Shared with me, Upload file,
  Folders, Activity, Admin, Profile), a notification bell with unread count.
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

Database connection points at a shared Supabase Postgres instance
(see `backend/.env.example`) so the whole team works against the same data.

## Try it
1. Open http://localhost:3000 → Register a new account
2. Land on the Overview dashboard → see stats, recent files, recent activity
3. Upload a file → it's encrypted (AES-256-GCM) before it ever leaves the
   backend, then stored in AWS S3
4. Share it — either with a specific person by email (read/write) or via
   an expiring link — from the file's Share menu
5. On the recipient's account, check the "Shared with me" page to see it
   (download/preview, plus rename if given write access)
6. Create a folder from the Folders page and move files into it
7. Check the bell icon for notifications (shares, downloads of your files,
   security alerts)
8. If your account has the admin role, an "Admin" nav link appears with
   platform-wide audit logs, suspicious-login detection, storage
   analytics, and a security summary report

## What's implemented

**Milestone 1 — Core setup**
- [x] Architecture + DB schema design (`DESIGN.md`)
- [x] FastAPI backend with JWT auth (register/login)
- [x] Forgot password / reset password flow, sent via real email
- [x] File upload, list, download endpoints (auth-protected)
- [x] Full dashboard UI: Overview, My files, Upload file, Activity, Profile
- [x] PostgreSQL, MongoDB, Redis configured

**Milestone 2 — Encryption & secure sharing**
- [x] AES-256-GCM envelope encryption — unique key per file, wrapped with
      a separate master key
- [x] Encrypted file storage in AWS S3, scoped IAM access
- [x] Durable sharing by email (read/write permissions, enforced)
- [x] Expiring share links (Redis-backed, auto-expire via TTL)
- [x] In-memory-only decryption on download
- [x] "Shared with me" page — files someone else owns show up here for the
      recipient, with their permission level (read/write) shown

**Milestone 3 — Monitoring, notifications & analytics**
- [x] Audit logging — every action logged, including failed logins as a
      security-tagged event
- [x] Admin-only audit log viewer, platform-wide (not just one user)
- [x] Suspicious login detection — flags 5+ failed attempts in 15 minutes,
      with a real-time alert to the account owner
- [x] Notifications — in-app (bell icon, unread count) and real email,
      for shares, downloads of your files, and security alerts
- [x] Storage analytics — per-user and platform-wide, via the Admin page
- [x] Security summary report — action counts over a configurable window
- [x] Admin dashboard cards load independently (not blocked on the slowest
      one), and the suspicious-login check is a single batched query across
      all users instead of one query per user

**Milestone 4 — Testing, deployment & documentation**
- [x] Security audit — every route checked for correct auth enforcement,
      storage/crypto round-trip re-verified, dependency vulnerability scan
      (`pip-audit` / `npm audit`) with before/after fix table in
      `MILESTONE4_REPORT.md` (two low-severity CVEs documented as accepted
      risk rather than silently dropped)
- [x] UI responsiveness pass — fixed a missing viewport meta tag (the root
      cause of most mobile layout issues), fixed-width elements that
      overflowed on small screens, and non-scaling page padding
- [x] Deployed to Docker + cloud (backend on Render, frontend on Vercel)
- [x] Production infra configured: MongoDB Atlas, Upstash Redis, Supabase
      Postgres, AWS S3, environment variables, CORS
- [x] Final documentation: `DESIGN.md`, this README, `DEPLOYMENT.md`,
      `MILESTONE4_REPORT.md`
- [ ] Live demonstration — walking a mentor/panel through the platform;
      script is in `MILESTONE4_REPORT.md`, performing it is on you

**Bonus — Folder organization** (originally scheduled later)
- [x] Create, list, and delete folders
- [x] Move files into/out of a folder