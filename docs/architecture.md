# TrustShare - System Architecture

## 1. Project Overview

TrustShare is a secure file-sharing and collaboration system.

The system allows registered users to:

- Create an account
- Log in securely
- Upload files
- View their uploaded files
- Share files with other registered users
- View files shared with them

The system uses authentication and access control to ensure that users can access only the resources they are permitted to access.

---

## 2. System Architecture



The basic flow is:

User → Frontend → FastAPI Backend → Authentication → Database/File Storage

More specifically:

                 ┌──────────────────────┐
                 │        USERS         │
                 │ Admin / Normal User  │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │     FRONTEND         │
                 │ HTML + CSS + JS      │
                 │ Login / Dashboard    │
                 │ Upload / Share Files │
                 └──────────┬───────────┘
                            │ HTTP Requests
                            ▼
                 ┌──────────────────────┐
                 │    FASTAPI BACKEND   │
                 │                      │
                 │ Authentication       │
                 │ JWT Authorization    │
                 │ RBAC / Admin         │
                 │ File Upload          │
                 │ File Sharing         │
                 └───────┬───────┬──────┘
                         │       │
             ┌───────────┘       └────────────┐
             ▼                                ▼
   ┌──────────────────┐             ┌──────────────────┐
   │   PostgreSQL     │             │  File Storage    │
   │                  │             │                  │
   │ Users            │             │ Uploaded files   │
   │ Shared Files     │             │                  │
   └──────────────────┘             └──────────────────┘


2. Security Architecture

Your project already has several security components:

Password hashing using bcrypt
JWT authentication
Role-Based Access Control (RBAC)
Admin authorization
User-specific file access
Backend validation of requests
Protected API endpoints

For example:

User Login
    ↓
Email + Password
    ↓
Verify hashed password
    ↓
Generate JWT token
    ↓
Token sent with requests
    ↓
Backend verifies token
    ↓
Check user role
    ↓
Allow / Deny operation


3. Database Schema

Your PostgreSQL database can contain these main tables.

Users Table
Column	Type	Purpose
id	Integer	Unique user ID
name	String	User name
email	String	Login email
password	String	Hashed password
role	String	user / admin

Example:

USERS
--------------------------------
id          PK
name
email
password
role
Shared Files Table
Column	Type	Purpose
id	Integer	File ID
filename	String	Uploaded file name
owner_id	Integer	File owner
sender_id	Integer	Person sharing
recipient_id	Integer	Person receiving
SHARED_FILES
--------------------------------
id             PK
filename
owner_id       FK → users.id
sender_id      FK → users.id
recipient_id   FK → users.id


4. Relationship
             USERS
        ┌──────────────┐
        │ id           │
        │ name         │
        │ email        │
        │ password     │
        │ role         │
        └──────┬───────┘
               │
        owns / shares
               │
               ▼
       ┌────────────────┐
       │ SHARED_FILES   │
       │                │
       │ id             │
       │ filename       │
       │ owner_id       │
       │ sender_id      │
       │ recipient_id   │
       └────────────────┘


Execution Flow
1. Start PostgreSQL
        ↓
2. Start FastAPI Backend
        ↓
   http://127.0.0.1:8000
        ↓
3. Start Frontend Server
        ↓
   http://127.0.0.1:5500
        ↓
4. Open TrustShare in Browser
        ↓
5. Register / Login
        ↓
6. JWT Authentication
        ↓
7. Role Verification (Admin/User)
        ↓
8. Upload / Share / Manage Files


In a separate "How to Run the Project" section:

Backend:
python -m uvicorn app.main:app --reload

Frontend:
python -m http.server 5500

Then:

Frontend → http://127.0.0.1:5500
Backend  → http://127.0.0.1:8000
Swagger  → http://127.0.0.1:8000/docs

