# Intelligent-Encrypted-File-Sharing-and-Digital-Collaboration-Management-Platform

## Server-side file encryption

New uploads use AES-256-GCM on the FastAPI server before they are written to `backend/uploads/`. Each file gets a random data-encryption key; that key is wrapped with the server-only `FILE_ENCRYPTION_MASTER_KEY` and stored as encryption metadata in PostgreSQL. The React app never receives encryption keys.

Set `FILE_ENCRYPTION_MASTER_KEY` in `backend/.env` to a URL-safe Base64 value encoding exactly 32 random bytes. For example, generate one with Python from PowerShell:

```powershell
python -c "import base64, secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

Run the backend tests with:

```powershell
python -m unittest discover -s tests -v
```

Files uploaded before encryption metadata was introduced remain legacy plaintext files. They are not decrypted as encrypted files; migrate them explicitly before deleting or replacing them.