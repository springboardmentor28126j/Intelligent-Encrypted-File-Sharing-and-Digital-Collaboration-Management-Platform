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

## Secure storage

Storage is selected on the backend with `STORAGE_BACKEND=local` or `STORAGE_BACKEND=s3`. Local mode stores encrypted objects in `backend/uploads/`. S3 mode uploads only AES-256-GCM ciphertext to a private bucket using random internal object keys. AWS credentials are backend-only and must never be placed in the frontend environment.

For S3 mode, configure these backend variables:

```env
STORAGE_BACKEND=s3
AWS_ACCESS_KEY_ID=your_backend_access_key
AWS_SECRET_ACCESS_KEY=your_backend_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-private-bucket
AWS_S3_PREFIX=files
```

Block all public access on the bucket. TrustShare continues to use `GET /api/files/{file_id}/download`; the backend checks authorization, retrieves ciphertext, decrypts it, and returns the file. No S3 URL is sent to React.