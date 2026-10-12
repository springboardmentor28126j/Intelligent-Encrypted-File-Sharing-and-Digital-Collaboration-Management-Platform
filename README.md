# 🛡️ TrustShare
**Intelligent Encrypted File Sharing and Digital Collaboration Management Platform**

## 1. About the Project

TrustShare is a web-based application that helps users store and share files securely. It allows users to create accounts, log in, upload files, and share them with other registered users.

The main goal of TrustShare is to protect files from unauthorized access. Users can control who can view their files, manage permissions, and remove access whenever needed. The system also records file activities and sends security notifications to help users monitor their accounts.

## 2. Problem Statement

Sharing files through traditional methods can sometimes put sensitive information at risk.

Some common problems are:
- Unauthorized people accessing files.
- Files not being properly encrypted.
- Difficulty controlling who can access shared files.
- Lack of information about who accessed or shared files.
- Risk of sensitive data being exposed.

TrustShare helps solve these problems by providing secure login, file encryption, permission-based sharing, and activity monitoring in one application.

## 3. Key Features

- **Secure Registration and Login:** Users can create accounts and log in securely.
- **JWT Authentication:** JWT tokens help protect pages and APIs that require authentication.
- **File Encryption:** Files are encrypted using AES-GCM encryption to protect their contents.
- **File Management:** Users can upload, view, download, and manage their files according to their permissions.
- **Secure File Sharing:** Users can share files with other registered users.
- **Permission Control:** File owners can decide whether recipients can view or download shared files.
- **Access Revocation:** Owners can remove a user's access when necessary.
- **User and Admin Roles:** Normal users manage their files, while administrators can manage users and their roles.
- **Activity Monitoring:** The system records important actions, such as logins, uploads, and file sharing.
- **Audit Logs:** Recorded activities help users and administrators review system operations.
- **Security Notifications:** Users receive notifications about important security events.
- **File Activity Reports:** Users can review file-related activities and security information.

## 4. System Architecture

TrustShare works through three main components:

1. **Frontend:** HTML, CSS, and JavaScript provide the interface that users interact with.
2. **Backend:** Python and FastAPI process requests, verify permissions, handle encryption, and manage file operations.
3. **Database and Storage:** PostgreSQL stores application data, while encrypted files are stored securely.

The frontend communicates with the backend through REST APIs. The backend connects to the database and handles file storage and security operations.

## 5. Technology Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Python, FastAPI
- **Database:** PostgreSQL
- **Authentication:** JWT
- **Password Security:** bcrypt password hashing
- **File Encryption:** AES-GCM
- **File Storage:** Local storage and Backblaze B2 cloud storage
- **Deployment:** Docker and Render

## 6. How TrustShare Works

### A. Login Process

1. The user enters their email and password.
2. The backend checks the login details.
3. If the details are correct, the system provides a JWT token.
4. The token is used to access protected features.
5. The system records the login activity.

### B. File Upload Process

1. The user selects a file to upload.
2. The file is sent to the FastAPI backend.
3. The backend encrypts the file using AES-GCM.
4. The encrypted file is stored.
5. The system records the upload activity.

### C. File Sharing Process

1. The owner selects a file.
2. The owner enters the recipient's email address.
3. The owner selects the required permission.
4. The recipient can access the file according to the granted permission.
5. The owner can revoke access whenever needed.

## 7. User Roles

### Normal User

A normal user can:
- Manage their profile.
- Upload and manage files.
- Share files with registered users.
- Access files shared with them.
- View relevant notifications and activities.

### Administrator

An administrator can:
- View and manage users.
- Change user roles.
- Perform administrative operations.
- Monitor security-related activities.

## 8. Activity Monitoring

TrustShare records important actions performed within the application. These include successful and failed login attempts, file uploads, file sharing, and other file-related events.

The system also provides activity reports, notifications, and security alerts for relevant events. This helps users understand what is happening in their accounts and helps administrators monitor suspicious activity.

## 9. Project Structure

The project is organized into three main folders:

- **backend:** Contains the FastAPI application, backend logic, database operations, and related configuration files.
- **frontend:** Contains the HTML pages, CSS styles, and JavaScript files.
- **docs:** Contains project documentation and supporting materials.

## 10. How to Run the Project

### Start the Backend

Open a terminal and run:

```bash
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload
```

Backend URL: http://127.0.0.1:8000

API documentation: http://127.0.0.1:8000/docs

### Start the Frontend

Open another terminal and run:

```bash
cd frontend
python -m http.server 5500
```

Frontend URL: http://127.0.0.1:5500

Make sure the database and required environment variables are configured before starting the application.

## 11. Practical Applications

TrustShare can be useful in:
- Colleges and educational institutions.
- Companies and business organizations.
- Software development teams.
- Organizations that handle confidential documents.
- Teams that need controlled and secure file sharing.

## 12. Future Improvements

Possible future improvements include:
- More advanced AI-based suspicious activity detection.
- Real-time security alerts.
- A mobile application.
- Multi-factor authentication.
- Improved document collaboration.
- Advanced file version management.

## 13. Project Summary

TrustShare is designed to make file sharing safer and easier. It combines secure login, file encryption, access permissions, user roles, and activity monitoring in one platform.

Users can upload files, share them with specific people, control their permissions, and revoke access when needed. Activity logs and security notifications also help users monitor important events.

The main objective of TrustShare is to provide a secure and reliable platform for managing and sharing digital files.

**Project Name:** TrustShare  
**Domain:** Secure File Sharing and Digital Collaboration  
**Backend:** Python and FastAPI  
**Frontend:** HTML, CSS, and JavaScript  
**Database:** PostgreSQL
