# TrustShare

TrustShare is the current working baseline of the Intelligent Encrypted File Sharing and Digital Collaboration Management Platform.

## Included in this package
- FastAPI backend
- SQLite database
- User registration
- Password hashing with bcrypt
- User login
- JWT access tokens
- CORS for the React frontend
- React + Vite frontend
- React Router pages: Login, Register, Dashboard
- Axios API integration
- Basic clean UI

## Project structure

TrustShare/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── database.py
│   │   ├── main.py
│   │   └── models.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   └── Dashboard.jsx
    │   ├── App.jsx
    │   ├── App.css
    │   ├── index.css
    │   └── main.jsx
    ├── package.json
    └── vite.config.js

## Backend setup

Open PowerShell in the backend folder:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Backend:
http://127.0.0.1:8000

Swagger:
http://127.0.0.1:8000/docs

## Frontend setup

Open another PowerShell in the frontend folder:

```powershell
npm install
npm run dev
```

Frontend:
http://localhost:5173/

## Test order

1. Start backend.
2. Open Swagger.
3. Test POST /auth/register.
4. Test POST /auth/login.
5. Start frontend.
6. Register through the frontend.
7. Login using the same credentials.
8. Dashboard should open.

The SQLite database file is created automatically as `trustshare.db` after the backend starts.

## Important

This package is the cleaned working baseline of the features built so far. Full encrypted file storage, sharing permissions, download links, audit logs, and production deployment are still future steps.
