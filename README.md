# TrustShare — Week 1 Deliverable

Secure file-sharing platform (Milestone 1 scope: auth + file upload/download,
no encryption yet — that's Milestone 2).

## What's included
- `DESIGN.md` — architecture + DB schema
- `backend/` — FastAPI app (JWT auth, file upload/list/download, Postgres + Mongo)
- `frontend/` — Next.js app (login/register page, dashboard)
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
- Frontend: http://localhost:3000

## Try it
1. Open http://localhost:3000 → Register a new account
2. You'll land on the dashboard → upload a file
3. See it listed → click Download to confirm it works

## What's implemented (Week 1)
- [x] Architecture + DB schema design (`DESIGN.md`)
- [x] FastAPI backend with JWT auth (register/login)
- [x] File upload, list, download endpoints (auth-protected)
- [x] Next.js frontend: login/register + dashboard
- [x] PostgreSQL (users, files), MongoDB (activity_logs), Redis configured

## What's next (Week 2 / Milestone 2)
- AES-256 server-side encryption of stored files
- Secure shareable links with expiration
- OAuth2 login, MFA
- Access-level permissions
