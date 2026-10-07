# TrustShare — Milestone 4 Report (Week 7 & 8: Testing, Deployment & Documentation)

This document closes out the six official Milestone 4 tasks with what was
actually done, what was found, and what's still open. It's meant to sit
alongside `DESIGN.md`, `README.md`, and `DEPLOYMENT.md` as the final record
for this milestone — not replace them.

---

## (i) Security testing and workflow validation

### Code-level route audit
Every route file was checked for correct auth enforcement:

| File | Result |
|---|---|
| `files.py` | All 12 endpoints require `Depends(get_current_user)`; ownership/share permission re-checked per file via `_get_accessible_file_or_404` / `_get_owned_file_or_404` |
| `folders.py` | All endpoints require `get_current_user`; ownership re-checked |
| `notifications.py` | All endpoints require `get_current_user`, scoped to the caller |
| `activity.py` | Requires `get_current_user`, scoped to the caller |
| `analytics.py` | Per-user endpoint uses `get_current_user`; platform-wide endpoints use `get_current_admin` |
| `admin.py` | Both endpoints require `get_current_admin` |
| `auth.py` | Public endpoints (`register`, `login`, `forgot-password`, `reset-password`) are intentionally open; `/me` requires `get_current_user` |
| `share.py` | `/share/{token}/download` is intentionally unauthenticated — the random, Redis-backed token *is* the credential, matching the design in `DESIGN.md` §5 |

No route was found exposing another user's data without an explicit
permission/ownership check.

### Storage and crypto checks
- Uploaded files are stored under a server-generated `{uuid}.enc` key, never
  the user-supplied filename — rules out path traversal via a malicious
  filename.
- JWTs are signed with `HS256` using `JWT_SECRET` from the environment, carry
  a `typ` claim (`access` vs `reset`) so a reset token can't be replayed as a
  login token, and expire (`ACCESS_TOKEN_EXPIRE_MINUTES`, 15 min for reset).
- Passwords are hashed with bcrypt via `passlib`, never stored or logged in
  plaintext.
- Re-ran the Milestone 2 encryption round trip by hand after the dependency
  upgrade below: generate key → encrypt → wrap → unwrap → decrypt returns the
  original bytes, and a tampered ciphertext correctly raises `InvalidTag`.

### Dependency vulnerability scan (new — this is what M4 actually asked for)
Ran `pip-audit` on the backend and `npm audit` on the frontend.

**Backend — before → after:**
| Package | Was | Now | Notes |
|---|---|---|---|
| `python-jose` | 3.3.0 (2 known CVEs) | 3.4.0 | fixed |
| `python-multipart` | 0.0.9 (8 known CVEs) | 0.0.18 | fixed |
| `pymongo` | 4.9.1 (4 known CVEs) | 4.18.2 | fixed (required `dnspython` → 2.8.0) |
| `cryptography` | 43.0.1 (7 known CVEs) | 48.0.1 | fixed |
| `starlette` (transitive, via `fastapi`) | 0.38.6 (multiple CVEs) | — | **not fixed**: the pinned `fastapi==0.115.0` caps starlette here; the real fix is a `fastapi` major-version bump, which is a bigger change than is safe to make without a full regression pass against a live environment this sandbox can't reach. Documented as a known, accepted risk rather than silently left out. |
| `pyasn1` (transitive, via `python-jose`) | 0.4.8 (3 known CVEs) | — | **not fixed**: `python-jose` itself pins `pyasn1<0.5`, so this can only be resolved by replacing `python-jose` with an actively maintained JWT library (e.g. `PyJWT`) — a real fix, but a separate, deliberate piece of work, not a drop-in bump. |
| `ecdsa` | 0.19.2 (1 known issue, PYSEC-2026-1325) | — | no fix version exists upstream for this advisory (a timing-attack class issue in the `ecdsa` library itself) |

Verified the three applied bumps don't break anything: reinstalled, then
re-ran password hashing, JWT encode/decode, and the full envelope-encryption
round trip (encrypt → wrap → unwrap → decrypt, plus the tamper-detection
check) against the upgraded libraries — all passed.

**Frontend — before → after:**
| Package | Was | Now | Notes |
|---|---|---|---|
| `next` | 14.2.5 (12 CVEs incl. 1 critical RCE) | 14.2.35 | fixed — same major/minor line, verified `npm run build` still succeeds |
| `source-map-js` | 1.0.0–1.2.1 (1 CVE) | latest via `npm audit fix` | fixed |
| `postcss` (transitive, via `next`) | ≤8.5.22 (3 CVEs) | — | **not fixed**: only resolvable by jumping to `next@16`, a breaking major-version change not safe to force through without testing against the live Vercel deployment |

### What this task does *not* include
No automated penetration test, no fuzzing, no rate-limiting was added (there
currently is none beyond the suspicious-login *detection* in `admin.py` —
worth naming as a limitation, not a strength, if asked). This was a manual
code audit plus a real dependency scan, which is a reasonable and honest
scope for this milestone.

---

## (ii) UI responsiveness and system optimization

### Bugs found and fixed
1. **Missing viewport meta tag** — the single biggest issue. Next.js's Pages
   Router doesn't inject `<meta name="viewport">` automatically; without a
   custom `_document.js`, mobile browsers render the desktop layout shrunk
   down rather than actually reflowing it. Added `frontend/pages/_document.js`
   with `width=device-width, initial-scale=1`. This is what makes every other
   responsive rule below actually take effect on a phone.
2. **Fixed-width auth cards** — `index.js` (login), `forgot-password.js`, and
   `reset-password.js` all had `width: 380` with no constraint relative to
   the viewport, which overflows horizontally on any screen narrower than
   ~450px (most phones in portrait). Changed to `width: "100%", maxWidth: 380`
   with `16px` of side padding on the outer container.
3. **Fixed side padding on every dashboard page** — `Layout.js`'s `<header>`
   and `<main>` used a flat `32px`/`48px` padding regardless of screen size.
   Moved this into CSS classes (`.ts-header`, `.ts-main`) with media queries
   that scale padding down at `≤768px` and `≤480px`, so content isn't
   needlessly cramped on tablets/phones.
4. **Dashboard "Folders" stat hardcoded to 0** (found earlier, included here
   for completeness) — fixed by fetching the real count from `GET /folders`.

The existing layout code (flex-wrap on the nav and stat cards, `minWidth: 0`
on text that needs to truncate) was already written defensively — these
fixes close the gaps rather than rebuild it.

### Verified
`npm run build` succeeds after all of the above with no new errors or
warnings beyond the pre-existing dependency notice (now resolved).

### What this task does *not* include
No bundle-size/Lighthouse performance audit, no database query profiling —
scope was a genuine responsiveness pass plus the one functional bug found,
which matches what's reasonable for a capstone milestone.

---

## (iii) Deploy using Docker and cloud environments — ✅ done
Backend runs as the Docker image Render builds directly from
`backend/Dockerfile` (no docker-compose in production). Frontend deployed on
Vercel. No further action needed here — see `DEPLOYMENT.md`.

## (iv) Configure production infrastructure — ✅ done
MongoDB Atlas, Upstash Redis, Supabase Postgres, AWS S3, environment
variables, and CORS are all configured and confirmed working against the
live deployment. See `DEPLOYMENT.md` for the exact steps taken, including
the TLS/CA-certificate and IP-allowlist fixes.

---

## (v) Final documentation and presentation

This file, together with `DESIGN.md` (architecture + schema), `README.md`
(feature list + how to run), and `DEPLOYMENT.md` (cloud setup), is the
complete documentation set for the project. The milestone-review slide deck
covers the presentation half.

## (vi) Demonstrate the complete platform

The platform is live and demo-ready. Suggested demo script:

1. **Register** a new account on the deployed frontend.
2. **Land on the dashboard** — point out the stats (now showing the real
   folder count) and the storage-by-type breakdown.
3. **Upload a file** — note out loud that it's encrypted (AES-256-GCM) before
   it ever leaves the backend, then stored in S3.
4. **Share it two ways**: by email to another account (read/write
   permission), and via an expiring link (open it in an incognito window to
   show it needs no login).
5. **Download it back** — show the content is identical, i.e. the
   encrypt/decrypt round trip works in production, not just in a unit test.
6. **Check the notification bell** — show the share/download alert.
7. **If using an admin account**: open the Admin page — audit log,
   suspicious-login detector, storage analytics, security summary.
8. **Resize the browser narrow** (or open on a phone) to show the
   responsiveness fix from this milestone.

This step itself — walking a mentor or panel through the above live — is on
you to actually perform; everything it depends on is in place.

---

## Files changed in this milestone's work
- `backend/requirements.txt` — dependency version bumps (security)
- `frontend/package.json` — `next` version bump (security)
- `frontend/pages/_document.js` — **new**, viewport meta tag
- `frontend/pages/index.js`, `forgot-password.js`, `reset-password.js` —
  responsive auth card width
- `frontend/components/Layout.js`, `frontend/styles/globals.css` — responsive
  header/main padding
- `frontend/pages/dashboard.js` — real folder count (carried over from
  earlier in this milestone's work)