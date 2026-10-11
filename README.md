# TrustShare – Intelligent Encrypted File Sharing and Digital Collaboration Management Platform

TrustShare is a full-stack file-sharing and digital collaboration platform built to help users upload, manage, and share files with controlled access permissions. The application includes a web dashboard, a FastAPI backend, database services, and file storage.

> **Implementation note:** Keep claims about encryption algorithms, key rotation, MFA, OAuth, audit logging, and advanced security features only if they are implemented and tested in your current codebase.

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Key Features](#key-features)
- [Application Workflow](#application-workflow)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Database Architecture](#database-architecture)
- [Notification Workflow](#notification-workflow)
- [Getting Started](#getting-started)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Security Considerations](#security-considerations)
- [Testing Checklist](#testing-checklist)
- [Milestone Summary](#milestone-summary)
- [Future Enhancements](#future-enhancements)
- [Contributing](#contributing)
- [License](#license)

## Overview

TrustShare is designed to make file sharing easier to manage by combining a web dashboard, backend APIs, file management, and permission-aware sharing workflows.

The main workflow is:

**Register / Login → Dashboard → Upload File → Manage Files → Share File → Recipient Views or Downloads According to Permission**

The frontend communicates with the FastAPI backend through REST APIs. The backend processes authentication, file metadata, sharing permissions, and requests to access shared files.

## Problem Statement

Traditional file-sharing workflows can make it difficult to control who can access a file and what actions they can perform. Users need a way to manage shared files and define clear permissions.

TrustShare addresses these challenges through:
- User registration and login.
- A dashboard for managing files.
- Sharing files with other registered users.
- **View Only** and **Download** permissions.
- Expiration handling for shared access where configured.
- Backend-side permission checks for protected file actions.

## Key Features

### User Access
- User account creation and login.
- Authenticated access to dashboard features.

### File Management
- Upload files through the dashboard.
- View and manage uploaded files.
- Access files shared with the current user.

### Controlled File Sharing
- Share a file with another registered user.
- Select **View Only** or **Download** permission.
- Configure share expiration where supported.
- View shared-file details and permissions.

### File Access
- View shared files when viewing is permitted.
- Download shared files when downloading is permitted.
- Reject expired shares or actions that are not allowed, as enforced by the backend.

### Data and Notifications
- PostgreSQL for relational application data.
- MongoDB for document-oriented data where configured.
- Redis for fast-access or notification-related state where configured.

## Application Workflow

```text
User
 |
 v
Register / Login
 |
 v
Dashboard
 |
 +-------------------------+
 |                         |
 v                         v
Upload File             View Files
 |                         |
 v                         v
File Management       Select File to Share
                           |
                           v
                    Choose Recipient
                           |
                           v
                    Set Permission
                    (View / Download)
                           |
                           v
                      Create Share
                           |
                           v
                  Recipient Dashboard
                           |
                           v
                View or Download File
                according to permission
```

## System Architecture

```text
+--------------------------------+
|        Next.js Frontend        |
|       React / TypeScript       |
| Login, Dashboard, File Sharing |
+----------------+---------------+
                 |
                 | REST API
                 v
+--------------------------------+
|         FastAPI Backend        |
| Authentication and API Routes |
| File and Share Operations      |
+----------------+---------------+
                 |
        +--------+---------+
        |        |         |
        v        v         v
+------------+ +---------+ +---------+
| PostgreSQL | | MongoDB | |  Redis  |
| Relational | | Document| | Cache / |
| Data       | | Data    | | Notify* |
+------------+ +---------+ +---------+
        |
        v
+-------------------------------+
| Configured File Storage       |
| (for example, Cloudinary if   |
| enabled in the current setup) |
+-------------------------------+
```

`*` Redis notification behavior depends on the notification service and endpoints implemented in the backend. Confirm the actual behavior in your running application before describing it as complete.

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js | Web application framework |
| UI | React | User interface components |
| Language | TypeScript | Frontend application code |
| Backend | Python, FastAPI | REST API and application logic |
| Relational database | PostgreSQL | Structured user, file, and sharing data |
| Document database | MongoDB | Document-oriented data, such as activity records if implemented |
| In-memory data store | Redis | Fast-access state or notification data if implemented |
| API server | Uvicorn | Runs the FastAPI application |
| File storage | Configured storage provider | Stores uploaded files |

## Database Architecture

### PostgreSQL
Used for relational data such as users, file metadata, and sharing records, depending on the models in the current backend.

### MongoDB
Used for document-oriented data where configured. A possible use is activity or audit records, provided that this functionality exists in the implementation.

### Redis
Used for fast-access state or notification-related data where configured. Redis-backed notifications typically require the backend to create notification entries, an endpoint to retrieve them, and frontend UI to display and mark them as read.

> The precise responsibility of each data store should match your backend configuration and code. Do not put credentials or connection strings in this README.

## Notification Workflow

If Redis-backed notifications are enabled in the current implementation, the expected flow is:

```text
Application Event
 (for example, a file is shared)
          |
          v
Backend Notification Logic
          |
          v
Redis Notification Data
          |
          v
Authenticated Notifications API
          |
          v
Frontend Notification Bell / List
          |
          v
User Reads Notification
```

For this workflow to function end to end, verify that:
1. The backend creates a notification when the relevant event occurs.
2. The notification is associated with the correct recipient.
3. The notifications API returns the recipient's notifications.
4. The frontend fetches and displays the notifications.
5. The mark-as-read action updates the notification state.

Redis is an in-memory data store; if notifications must survive Redis restarts, persistence and recovery behavior should be configured appropriately.

## Getting Started

### Prerequisites

Install:
- Python
- Node.js and npm
- Git
- A configured PostgreSQL database
- MongoDB and Redis if your current backend requires them
- Any external file-storage service required by your configuration

### 1. Clone the repository

Replace the placeholder with your actual GitHub repository URL:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd IntelligentFileSharing
```

### 2. Set up the backend

From the project root, run:

```powershell
cd backend
python -m venv ifs
.\ifs\Scripts\Activate.ps1
```

If your backend has a `requirements.txt` file, install dependencies:

```powershell
pip install -r requirements.txt
```

Configure the environment variables needed for the database, authentication, MongoDB, Redis, and file storage. Never commit actual passwords, tokens, encryption keys, or `.env` files to GitHub.

### 3. Start the backend

From the `backend` directory:

```powershell
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Local backend addresses:
- API base URL: `http://127.0.0.1:8000`
- Swagger API documentation: `http://127.0.0.1:8000/docs`

### 4. Set up the frontend

Open a second terminal:

```powershell
cd frontend
npm install
```

### 5. Start the frontend

```powershell
npm run dev -- --webpack
```

Open the local URL shown in the terminal, typically:

`http://localhost:3000`

## API Documentation

When the backend is running, FastAPI provides interactive API documentation:

- **Swagger UI:** `http://127.0.0.1:8000/docs`
- **OpenAPI JSON:** `http://127.0.0.1:8000/openapi.json`

The exact endpoints depend on the routers registered in `backend/main.py`. Use Swagger UI to verify current route names, required authentication, and request formats.

Common API areas in a file-sharing application include:
- Authentication and user accounts.
- File upload and file management.
- File sharing and shared-file access.
- Notifications and monitoring, if implemented.

## Security Considerations

- Keep database credentials, access tokens, API keys, and encryption secrets out of source control.
- Store configuration and secrets in environment variables.
- Enforce authentication and authorization in the backend, not only in the frontend.
- Check share permissions and expiration for every protected file action.
- Validate file uploads and handle storage errors safely.
- Use HTTPS and appropriate secret management for public deployment.
- Document encryption, key rotation, MFA, OAuth, and audit logging only when the corresponding code is implemented and tested.

## Testing Checklist

Before presenting or deploying the project, test these workflows:

- [ ] Register a new account.
- [ ] Log in with valid credentials.
- [ ] Confirm invalid login attempts are rejected.
- [ ] Upload a file and confirm it appears in file management.
- [ ] Share a file with another registered user.
- [ ] Confirm a View Only recipient can view but cannot download the file.
- [ ] Confirm a Download recipient can download the file.
- [ ] Confirm expired shares are rejected.
- [ ] Confirm a user cannot access files that are not owned by or shared with them.
- [ ] If notifications are implemented, confirm sharing generates a notification for the correct recipient.
- [ ] Check backend errors and frontend build output.

## Milestone Summary

### Core Application
- Frontend and backend setup.
- User registration and login.
- File upload and file management.
- Database configuration.

### File Sharing
- Sharing files with registered users.
- View Only and Download permissions.
- Shared-file access and download flow.
- Expiration handling where implemented.

### Data Services
- PostgreSQL for relational data.
- MongoDB and Redis for the roles configured in the application.

### Testing and Documentation
- Validate important user flows.
- Test permission enforcement.
- Document setup and API usage.
- Prepare a project demonstration.

Update these milestone descriptions to reflect only work completed in the current branch.

## Future Enhancements

Potential future improvements, if not already implemented:
- Complete notification center and unread notification count.
- Activity history and audit reporting.
- More advanced file search and organization.
- Automated security and permission tests.
- Production deployment with HTTPS and managed infrastructure.
- Additional authentication options.
- Improved monitoring and error reporting.

## Contributing

1. Create a branch for your change.
2. Make a focused update.
3. Test the affected frontend and backend workflows.
4. Commit changes with a clear message.
5. Open a pull request if your repository uses pull requests.

## License

Add a license after deciding how the project may be reused. For an academic or internship project, check the requirements of your institution or program before publishing a license.

---

**TrustShare — Share files with clear permissions and controlled access.**
