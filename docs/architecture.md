# TrustShare — System Architecture

## 1. Architecture Overview

TrustShare follows a client-server architecture consisting of a React frontend, FastAPI backend, database services, file storage, and security components.

The frontend provides the user interface while the FastAPI backend handles authentication, authorization, file management, sharing, and communication with the databases.

## 2. High-Level Architecture

```text
                         ┌─────────────────────┐
                         │       User          │
                         │   Web Browser       │
                         └──────────┬──────────┘
                                    │
                                    │ HTTPS
                                    ↓
                         ┌─────────────────────┐
                         │   React Frontend    │
                         │  User Interface     │
                         └──────────┬──────────┘
                                    │
                                    │ REST API
                                    ↓
                         ┌─────────────────────┐
                         │   FastAPI Backend   │
                         │                     │
                         │ Authentication      │
                         │ Authorization       │
                         │ File Management     │
                         │ File Sharing        │
                         │ Security            │
                         └──────┬──────┬───────┘
                                │      │
                   ┌────────────┘      └────────────┐
                   ↓                               ↓
          ┌─────────────────┐              ┌─────────────────┐
          │   PostgreSQL    │              │    MongoDB      │
          │                 │              │                 │
          │ Users           │              │ Activity Logs   │
          │ Roles           │              │ Audit Logs      │
          │ Files Metadata  │              │ Security Events │
          │ Permissions     │              │                 │
          └─────────────────┘              └─────────────────┘

                                │
                                ↓
                       ┌─────────────────┐
                       │      Redis      │
                       │                 │
                       │ Cache           │
                       │ Sessions        │
                       │ Temporary Data  │
                       └─────────────────┘
```

## 3. Frontend Layer

The frontend will be developed using React.

Responsibilities:

- User registration and login interface.
- File management dashboard.
- File upload interface.
- File listing and search.
- File sharing interface.
- User profile and settings.
- Notifications and security alerts.

## 4. Backend Layer

The backend will use FastAPI.

Responsibilities:

- Authentication and authorization.
- JWT token handling.
- Role-Based Access Control (RBAC).
- File upload validation.
- File metadata management.
- File sharing and permission management.
- Temporary access links.
- Activity tracking.
- Communication with databases.

## 5. PostgreSQL

PostgreSQL will store structured application data.

Main data includes:

- Users.
- Roles.
- Files and file metadata.
- File permissions.
- Sharing information.
- Temporary access information.

## 6. MongoDB

MongoDB will be used for activity and audit information.

Examples:

- File access events.
- Download events.
- Login events.
- Security events.
- User activity logs.

## 7. Redis

Redis will provide fast temporary data storage.

Possible uses:

- Session information.
- Temporary tokens.
- Caching.
- Rate limiting support.

## 8. Security Architecture

The platform will use multiple security layers:

```text
HTTPS/TLS
    ↓
Authentication
    ↓
JWT Verification
    ↓
Role-Based Access Control
    ↓
Permission Verification
    ↓
File Validation
    ↓
Secure File Processing
    ↓
Activity Logging
```

## 9. API Communication

The React frontend communicates with FastAPI through REST APIs.

Example:

```text
React Frontend
      ↓
POST /auth/login
      ↓
FastAPI
      ↓
Authentication
      ↓
JWT Token
      ↓
React Frontend
```

Protected operations include:

```text
POST   /files/upload
GET    /files
GET    /files/{id}
DELETE /files/{id}
POST   /files/{id}/share
```

## 10. Architecture Goals

The architecture is designed to provide:

- Security.
- Scalability.
- Separation of responsibilities.
- Maintainability.
- Controlled access.
- Reliable file management.
- Activity monitoring.