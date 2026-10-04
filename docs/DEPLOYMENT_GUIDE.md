# TrustShare – Enterprise Deployment Guide

## 1. Quick Start via Docker Compose (Recommended)

### Prerequisites
- Docker Engine 24+ & Docker Compose v2+
- Git

### Step-by-Step Deployment

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-org/trustshare.git
   cd trustshare
   ```

2. **Configure Environment Variables**:
   Create a `.env` in the root directory:
   ```env
   # Database
   POSTGRES_USER=trustshare
   POSTGRES_PASSWORD=trustshare_secret
   POSTGRES_DB=trustshare_db

   # Cryptography
   MASTER_KEY_HEX=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
   SECRET_KEY=supersecretjwtkey_change_in_production_32chars

   # Cloud Storage (Optional S3)
   STORAGE_BACKEND=local
   AWS_ACCESS_KEY_ID=
   AWS_SECRET_ACCESS_KEY=
   AWS_REGION=us-east-1
   AWS_S3_BUCKET_NAME=trustshare-encrypted-files
   ```

3. **Build and Launch All Containers**:
   ```bash
   docker-compose up --build -d
   ```

4. **Verify Service Health**:
   ```bash
   docker-compose ps
   curl -s http://localhost:8000/health | jq .
   ```

5. **Access Application**:
   - **Frontend UI**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:8000](http://localhost:8000)
   - **Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 2. Bare-Metal / Local Development Setup

### Backend (FastAPI & Python 3.12)
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (Next.js 14)
```bash
# In the root project directory:
npm install
npm run dev
```

---

## 3. AWS S3 Integration Configuration

To store ciphertext objects in AWS S3:
1. Create an Amazon S3 private bucket (e.g. `trustshare-encrypted-files`).
2. Block all public access on the S3 bucket.
3. In `backend/.env`, configure:
   ```env
   STORAGE_BACKEND=s3
   AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
   AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   AWS_REGION=us-east-1
   AWS_S3_BUCKET_NAME=trustshare-encrypted-files
   ```
4. Restart backend services. Files uploaded will automatically be encrypted and stored directly in your private S3 bucket.
