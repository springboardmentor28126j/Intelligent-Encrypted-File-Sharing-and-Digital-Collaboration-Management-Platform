# 🛡️ TrustShare

### Intelligent Encrypted File Sharing and Digital Collaboration Management Platform

TrustShare is a **secure web-based file sharing and collaboration platform** designed to protect sensitive files and provide controlled access between users.

It allows users to securely **register, login, upload files, encrypt files, share files with specific users, manage permissions, and monitor file activities**.

---

## 🎯 Problem Statement

Traditional file-sharing methods can expose sensitive information to unauthorized users.

Common problems include:

* Unauthorized file access
* Lack of encryption
* Poor access control
* No proper activity tracking
* Risk of data leakage

**TrustShare solves these problems by combining encryption, authentication, access control and activity monitoring in one platform.**

---

## 💡 Key Features

* 🔐 Secure Registration & Login
* 🎫 JWT Authentication
* 🔒 AES-256 File Encryption
* 📁 Secure File Upload & Management
* 🤝 File Sharing with Registered Users
* 👁️ Permission-Based File Access
* 🚫 Access Revocation
* 👥 Role-Based Access Control (User/Admin)
* 📊 Activity Monitoring
* 📝 Audit Logging
* 🔔 Security Notifications
* 📄 File Activity Reports

---

## 🏗️ System Architecture

```text
User
  │
  ▼
HTML / CSS / JavaScript
  │
  ▼
FastAPI REST APIs
  │
  ├──────────────► PostgreSQL
  │
  ├──────────────► AES-256 Encryption
  │
  └──────────────► Encrypted File Storage
```

---

## 🛠️ Technology Stack

| Layer             | Technology              |
| ----------------- | ----------------------- |
| Frontend          | HTML, CSS, JavaScript   |
| Backend           | Python, FastAPI         |
| Database          | PostgreSQL              |
| Authentication    | JWT                     |
| Password Security | bcrypt                  |
| File Encryption   | AES-256                 |
| Storage           | Local Encrypted Storage |
| Deployment        | Docker                  |

---

## 🔐 Security Workflow

### Login

```text
User Login
   ↓
Credentials Verification
   ↓
JWT Token
   ↓
Protected APIs
```

### File Upload

```text
Select File
   ↓
FastAPI Backend
   ↓
AES-256 Encryption
   ↓
Encrypted Storage
```

### File Sharing

```text
Owner
  ↓
Select File
  ↓
Recipient Email
  ↓
Select Permission
  ↓
Recipient Access
```

The owner can also **revoke access** when required.

---

## 👥 User Roles

### Normal User

* Upload and manage files
* Share files
* Access shared files
* View relevant activities

### Administrator

* Manage users
* Manage user roles
* Monitor security-related activities
* Perform administrative operations

---

## 📊 Activity Monitoring

TrustShare records important activities such as:

* Login
* File upload
* File sharing
* File access
* Security-related events

This helps users and administrators monitor what is happening in the system.

---

## 📂 Project Structure

```text
TrustShare/
│
├── backend/
│   ├── app/
│   ├── uploads/
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── HTML files
│   ├── CSS
│   ├── JavaScript
│   └── Dockerfile
│
└── docs/
```

---

## ▶️ How to Run

### Backend

```powershell
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

Swagger API documentation:

```text
http://127.0.0.1:8000/docs
```

### Frontend

```powershell
cd frontend
python -m http.server 5500
```

Frontend:

```text
http://127.0.0.1:5500
```

---

## 🎯 Practical Applications

TrustShare can be used for:

* Educational institutions
* Companies
* Development teams
* Organizations handling sensitive documents
* Secure internal file sharing

---

## 🚀 Future Scope

Future improvements can include:

* ☁️ Cloud storage integration
* 🤖 AI-based suspicious activity detection
* 🔔 Advanced real-time security alerts
* 📱 Mobile application
* 🔑 Multi-factor authentication
* 👥 Advanced collaboration and document versioning

---

## 📌 Project Summary

**TrustShare provides a secure way to store, share and manage files using:**

> **JWT Authentication + AES-256 Encryption + RBAC + Permission Control + Activity Monitoring**

The project focuses on making digital file sharing **secure, controlled and easy to manage**.

---

## 👨‍💻 Team

**Project:** TrustShare
**Type:** Academic Project
**Domain:** Cybersecurity / Secure File Sharing

