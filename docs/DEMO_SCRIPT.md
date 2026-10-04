# TrustShare – Live Demonstration Script

This script provides a 5-minute walkthrough to demonstrate all completed milestones of the TrustShare platform.

---

## Step 1: Authentication & Health Diagnostics
1. **Open Application**: Navigate to `http://localhost:3000`.
2. **Health Indicator Inspection**: Note the 4 live system status pills in the top navbar:
   - `PostgreSQL`: Live connection to user/RBAC schema.
   - `MongoDB`: Live metadata storage.
   - `Redis`: Token blacklist & rate limiter.
   - `AES-256-GCM`: Cryptographic pipeline ready.
3. **Register/Login**:
   - Register a new test user (e.g. `evaluator@trustshare.io`).
   - Log in and verify JWT issuance.

---

## Step 2: Encrypted File Upload & Storage
1. Drag and drop a document (e.g. `sample_report.pdf`) into the upload dropzone.
2. Observe upload progress bar.
3. Verify file appears in **Vault Files** table with `🔒 AES-256-GCM` badge.
4. Click the 🔍 (Metadata) button: Show the SHA-256 integrity hash and unique ciphertext UUID. Show that plaintext is NEVER stored on disk.

---

## Step 3: Secure Sharing & Access Control
1. Click the 🔗 (Share) button on the uploaded file.
2. Generate a 24-hour temporary share link with `can_download` permission.
3. Copy the link and open it in an Incognito window:
   - View the clean public share card.
   - Click **Download File**: Verify decrypted plaintext downloads smoothly.
4. Return to main window and click **Revoke**.
5. Refresh the Incognito window: Verify access is blocked with `410 Gone / Revoked`.

---

## Step 4: Notifications & Activity Stream
1. Share a file directly with another user (`alice@example.com`).
2. Observe the in-app notification count badge update on the top navbar.
3. Switch to the **Notifications** tab: View the formatted notification card and click **Mark as Read**.

---

## Step 5: Security Audit Log & Suspicious Activity Detection
1. Switch to the **Security Audit** tab:
   - Review immutable log entries for `upload`, `download`, `share`, and `revoke_share`.
   - Inspect recorded client IP addresses and user agents.
2. Demonstrate Threat Prevention:
   - Attempt 5 failed logins with wrong passwords.
   - Observe the immediate generation of a `multiple_failed_logins` security alert notification and flagged audit entry.

---

## Step 6: Analytics Dashboard
1. Switch to the **Analytics & Trends** tab:
   - Show summary cards (Total Files, Storage MB, Total Downloads, Total Shares).
   - Show the 7-day Upload vs. Download velocity trends.
   - Show category storage percentage distribution bars.
