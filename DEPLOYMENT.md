# Deploying TrustShare (free tiers)

Stack: **Vercel** (frontend) + **Render** (backend) + **MongoDB Atlas** (replaces local Mongo) + **Upstash** (replaces local Redis) + your existing **Supabase** (Postgres) and **AWS S3**.

Local `docker-compose.yml` still works exactly as before for development — none of this changes that. These are separate, cloud-hosted replacements used only for the deployed version.

---

## 0. Before you start: rotate your secrets

Your `.env` has real credentials in it (Supabase DB password, Gmail app password, AWS keys) that have been pasted into chat and files several times over this project. Before going live, rotate:

- **Supabase DB password**: Project Settings → Database → "Reset database password"
- **AWS access key**: IAM → your `trustshare-app` user → deactivate the old key, create a new one
- **Gmail app password**: Google Account → Security → App passwords → revoke the old one, generate a new one

None of this blocks the steps below — just do it before (or right after) you consider this "live" for real use.

---

## 1. MongoDB Atlas (replaces local Mongo)

1. Sign up at mongodb.com/cloud/atlas → create a free **M0** cluster.
2. Database Access → add a database user (username + password).
3. Network Access → Add IP Address → **Allow access from anywhere** (`0.0.0.0/0`) — Render's IPs aren't static, so this is the simplest option for a free-tier project.
4. Database → Connect → Drivers → copy the `mongodb+srv://...` string, and fill in your password.
5. Save that as `MONGO_URL` for step 4 below.

## 2. Upstash (replaces local Redis)

1. Sign up at upstash.com → Create Database → Redis, pick a region close to where Render will run.
2. On the database page, copy the **`rediss://...`** URL (note the double "s" — Upstash requires TLS).
3. Save that as `REDIS_URL`.

## 3. Push the updated code to GitHub

These files were added/changed for deployment: `backend/Dockerfile`, `backend/requirements.txt`, `backend/app/main.py`, `backend/app/core/config.py`, `backend/.env.example`, `docker-compose.yml`, `render.yaml`, `frontend/vercel.json`. Commit and push all of them to your `SreeTeja` branch (or `main`, whichever you deploy from).

## 4. Deploy the backend to Render

1. render.com → New → **Blueprint** → connect your GitHub repo → it'll detect `render.yaml` automatically.
2. It creates a `trustshare-backend` web service and prompts you to fill in every env var marked `sync: false`. Fill these in (from your `.env`, but with the Atlas/Upstash values from steps 1-2):
   - `DATABASE_URL` (Supabase — use the **Session Pooler** connection string, not the direct one; port 5432)
   - `MONGO_URL` (from Atlas, step 1)
   - `REDIS_URL` (from Upstash, step 2)
   - `JWT_SECRET`, `MASTER_ENCRYPTION_KEY` (reuse existing, or generate fresh — see comment in `.env.example`)
   - `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
   - `FRONTEND_URL` and `CORS_ORIGINS` — leave a placeholder for now (e.g. `https://placeholder.vercel.app`), you'll update both after step 5 once you know your real Vercel URL
3. Deploy. Once live, note your backend's URL — something like `https://trustshare-backend.onrender.com`.
4. Visit `https://trustshare-backend.onrender.com/health` — should return `{"status": "ok"}`.

**Render free tier note**: the service spins down after 15 minutes of no traffic and takes ~30-60 seconds to wake back up on the next request. That's expected on the free plan, not a bug.

## 5. Deploy the frontend to Vercel

1. vercel.com → Add New → Project → import the same GitHub repo.
2. In the import screen, set **Root Directory** to `frontend` (this repo has backend and frontend side by side, so Vercel needs to know which folder to build).
3. Add one environment variable: `NEXT_PUBLIC_API_URL` = your Render backend URL from step 4 (e.g. `https://trustshare-backend.onrender.com`).
4. Deploy. Note your Vercel URL — something like `https://trustshare.vercel.app`.

## 6. Wire the two together

Now that you have both real URLs, go back to Render → your backend service → Environment, and update:
- `FRONTEND_URL` = your real Vercel URL
- `CORS_ORIGINS` = `https://your-real-app.vercel.app` (add `,http://localhost:3000` too if you still want local frontend dev to work against this deployed backend)

Save → Render redeploys automatically. Then open your Vercel URL and test registration/login end to end.

---

## Troubleshooting

- **Frontend loads but API calls fail / CORS errors in browser console**: `CORS_ORIGINS` on Render doesn't match your actual Vercel URL exactly (check for trailing slashes, http vs https).
- **500 errors on every request right after deploy**: check Render's logs — almost always a missing/misspelled env var (compare against `.env.example`).
- **Mongo connection errors mentioning DNS or SRV**: Atlas needs `dnspython`, which is now in `requirements.txt` — make sure Render actually rebuilt after you pushed that change.
- **"Connection refused" to Supabase**: use the **Session Pooler** connection string (port 5432, host `aws-0-<region>.pooler.supabase.com`), not the direct connection — Render's network, like your campus WiFi before, may not reach the direct IPv6 endpoint.
