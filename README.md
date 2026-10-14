# TrustShare — Secure File-Sharing System

## About the Project

TrustShare is a secure file-sharing web application designed to help users upload, manage, download, and share files while maintaining privacy and security. It integrates user authentication, file encryption, activity monitoring, notifications, and email-based security alerts into a centralized platform.

The application provides controlled access to files and helps users monitor file-related activities through a dashboard. It also includes security analytics to identify repeated failed login attempts and configured suspicious activity patterns.

## Problem Statement

Traditional file-sharing methods may expose users to unauthorized access, inadequate access controls, and privacy risks. Users may also have limited visibility into who accesses shared files and what activities occur within their accounts.

TrustShare addresses these challenges by combining authentication, file encryption, controlled file sharing, activity logging, and security notifications in a single application.

## Key Features

### User Authentication and Access Control

- User registration and login
- JWT-based authentication
- Password hashing using bcrypt
- Protected access to user-specific resources

### Secure File Management

- Upload and manage files
- Retrieve files associated with the authenticated user
- Download files through backend endpoints
- Maintain organized file management workflows

### File Encryption

- File encryption and decryption functionality
- Backend-based encryption operations
- Improved confidentiality for stored and shared files

### Secure File Sharing

- Share files with other users
- Support access to shared files
- Track file-sharing and shared-file download activities

### Activity Monitoring

- Record important file and account activities
- Maintain activity logs with timestamps
- Display recent activities through the application dashboard

### Notifications and Email Alerts

- Display application notifications
- Track read and unread notification status
- Mark individual notifications or all notifications as read
- Send email alerts for configured security events

### Security Analytics

- Monitor relevant security events
- Detect repeated failed login attempts using rule-based logic
- Identify configured suspicious activity patterns
- Generate security notifications
- Maintain security-related activity records

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Python, FastAPI |
| Database and Backend Services | Supabase |
| Database Connectivity | PostgreSQL, psycopg2 where configured |
| Authentication | JSON Web Tokens (JWT) |
| Password Security | bcrypt |
| API Documentation | FastAPI Swagger UI |
| Configuration Management | python-dotenv |
| Email Notifications | Gmail SMTP |

## System Architecture

TrustShare follows a frontend-backend architecture in which each component has a specific responsibility.

### Frontend

The frontend is developed using HTML, CSS, and JavaScript. It provides the user interface for authentication, file management, sharing, notifications, activity monitoring, and security information.

### Backend

The backend is developed using Python and FastAPI. It processes authentication requests, manages file operations, handles sharing workflows, and provides APIs for notifications, activity logs, and security analytics.

### Database

Supabase provides the database and backend services used to manage application records, including activity logs and notifications.

### File Security

The backend incorporates encryption and decryption functionality to help protect file contents. Authentication and access-control checks support secure file operations.

### Email Service

Gmail SMTP is used to send configured email notifications, including security alerts and password-reset emails where implemented.

## Project Structure

The project is organized into frontend pages, styling files, JavaScript modules, and backend components.


TrustShare/
|
├── frontend1/
│   ├── css/
│   │   ├── style.css
│   │   ├── dashboard.css
│   │   └── share.css
│   │
│   ├── js/
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── files.js
│   │   ├── share.js
│   │   └── upload.js
│   │
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   ├── files.html
│   ├── shared-files.html
│   ├── share.html
│   ├── activity.html
│   ├── notifications.html
│   ├── reset-password.html
│   └── security-report.html
│
├── main.py
├── requirements.txt
├── .env
├── .gitignore
└── README.md


The backend may also include separate modules for encryption, authentication, database operations, and security analytics. The structure shown above should be adjusted to match the actual project files.

## Security Features

TrustShare incorporates multiple security mechanisms to support safer file management and sharing.

- **JWT Authentication:** Supports authenticated access to protected API endpoints.
- **Password Hashing:** Uses bcrypt to hash passwords rather than storing them as plaintext.
- **File Encryption:** Provides encryption and decryption functionality to help protect file contents.
- **Access Control:** Restricts access to resources according to the implemented authorization checks.
- **Activity Logging:** Records important operations for traceability.
- **Security Monitoring:** Uses rule-based checks to identify configured suspicious activity.
- **Email Alerts:** Notifies users about configured security events.
- **Password Recovery:** Supports a password-reset workflow where implemented.

The effectiveness of these features depends on correct implementation, configuration, and access-control validation.

## Practical Applications

TrustShare can be useful in scenarios where files need to be shared while maintaining controlled access and activity visibility.

- **Academic Collaboration:** Sharing project documents, assignments, and study materials.
- **Team Collaboration:** Exchanging work-related documents between authorized users.
- **Personal File Management:** Organizing and accessing files through a centralized application.
- **Business Document Sharing:** Supporting controlled document exchange within teams.
- **Security Monitoring:** Reviewing file activities and receiving alerts about configured security events.

These are potential use cases; suitability for sensitive or regulated data depends on the application's security validation and deployment environment.

## Future Enhancements

TrustShare can be extended with additional capabilities to improve security, usability, and scalability.

- Multi-factor authentication
- Expiring file-sharing links and download limits
- Advanced suspicious-activity detection
- File integrity verification
- Downloadable security and activity reports
- Improved storage analytics
- Administrative monitoring and audit trails
- Automated testing and cloud deployment

## Conclusion

TrustShare combines secure file management, authentication, encryption, file sharing, activity monitoring, and security analytics in one web application. By integrating these capabilities, the project aims to improve file confidentiality, provide better visibility into account activities, and support more controlled file sharing.

**TrustShare — Secure File Sharing with Authentication, Encryption, and Security Monitoring.**
