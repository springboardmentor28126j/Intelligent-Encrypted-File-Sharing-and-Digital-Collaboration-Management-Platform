# TrustShare – User & Administrator Operational Manual

## 1. Getting Started

### 1.1 Account Registration & Login
1. Navigate to `http://localhost:3000/register`.
2. Fill in your **Full Name**, **Work Email**, and strong **Password**.
3. Click **Create Account**.
4. Log in at `http://localhost:3000/login` with your credentials.

---

## 2. File Vault & Encryption Management

### 2.1 Uploading & Encrypting Files
1. Drag and drop any file (PDF, Word, Excel, Images, ZIP archives up to 50MB) into the upload area or click to select from your file explorer.
2. (Optional) Provide a file description or tags.
3. The system generates an ephemeral AES-256 key, encrypts the file locally, and uploads only ciphertext.
4. The encrypted file appears immediately in your **Vault Files** table.

### 2.2 Decrypting & Downloading Files
1. In the **Vault Files** table, click the ⬇️ (Download) button on any owned file.
2. The server authenticates your ownership, retrieves the encrypted ciphertext, decrypts it in-flight using your envelope-encrypted DEK, and streams the decrypted file to your browser.

### 2.3 Inspecting Cryptographic Metadata
1. Click the 🔍 (Inspect) button next to any file.
2. View SHA-256 integrity hashes, storage keys, and encryption algorithm validation.

---

## 3. Secure File Sharing

### 3.1 Generating Temporary Share Links
1. Click the 🔗 (Share) button on a file.
2. Select **Temporary Link** mode.
3. Choose an expiration window (1 hour, 24 hours, 7 days, 30 days, or Never).
4. Select permission:
   - **Allow Download & Decryption**: Recipient can download the decrypted plaintext.
   - **View Only**: Restricts direct binary downloads.
5. Click **Generate Encrypted Share Link** and copy the generated link.

### 3.2 Sharing Directly with Registered Users
1. In the share modal, select **Registered User** mode.
2. Enter the recipient's registered email address.
3. Click **Grant Access to User**.
4. The recipient receives an instant in-app notification and sees the file in their **Shared with Me** tab.

### 3.3 Revoking Active Shares
1. Open the share modal on the file.
2. Under **Active Grants**, click **Revoke** on any link to immediately terminate access.

---

## 4. Analytics & Security Audit

### 4.1 Analytics Dashboard
- Switch to the **Analytics & Trends** tab to review real-time storage metrics, 7-day upload/download volume charts, category distribution, and live transfer streams.

### 4.2 Security Audit Logs
- Switch to the **Security Audit** tab to inspect all system actions, failed logins, file transfers, and IP addresses.
