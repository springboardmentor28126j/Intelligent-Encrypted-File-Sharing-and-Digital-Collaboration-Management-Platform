# TrustShare — Intelligent Encrypted File Sharing and Digital Collaboration Management Platform

TrustShare is a secure file-sharing and digital collaboration platform developed to protect files, manage sharing permissions, and monitor user activities. The project was completed through four milestones, covering application development, encryption, monitoring, and final testing.

## Milestone 1 — Core Setup and Authentication

**Activities completed:**

- Designed the initial system architecture and database structure.
- Developed the backend using FastAPI.
- Implemented user registration and login functionality.
- Integrated JWT-based authentication for protected API requests.
- Developed the frontend using Next.js.
- Created the login page and dashboard interface.
- Implemented file upload, file listing, and file download APIs.
- Implemented forgot-password functionality.
- Connected the frontend and backend for application workflows.
- Configured PostgreSQL for application data.

## Milestone 2 — Encryption and Secure File Sharing

**Activities completed:**

- Integrated AES-256-GCM encryption for protecting file contents.
- Implemented encrypted file storage in the backend.
- Developed authenticated file upload and download workflows.
- Implemented file-sharing functionality.
- Created share links for sharing files with other users.
- Implemented an API to list sharing links.
- Implemented sharing-link revocation.
- Added authentication and access-control checks to file-related endpoints.
- Tested file upload and download through the API documentation interface.

## Milestone 3 — Activity Monitoring, Notifications, and Analytics

**Activities completed:**

- Implemented audit logging for relevant application activities.
- Added activity-monitoring functionality to the application.
- Developed dashboard pages for displaying file and activity information.
- Worked on analytics and security-related dashboard interfaces.
- Implemented backend endpoints for retrieving application information.
- Improved the dashboard and file-management user interface.
- Added frontend pages for security information and analytics.
- Worked on notification-related functionality and account management.

## Milestone 4 — Testing, Deployment, and Documentation

**Activities completed:**

- Tested the backend health endpoint.
- Tested login and authenticated API requests.
- Uploaded a file and verified that the API returned the uploaded file information.
- Tested file listing and downloading.
- Tested the creation and listing of file-sharing links.
- Tested the sharing-link revocation endpoint.
- Improved the frontend interface and shared UI components.
- Created and integrated reusable TrustShare logo and sidebar components.
- Updated dashboard, login, analytics, security, and file-detail pages.
- Ran the frontend production build and reported successful completion.
- Prepared an email-testing script to check SMTP configuration.
- Updated project files and pushed changes to the `jolsna_joy` Git branch.
- Reviewed the project documentation and identified the need to complete the README.


## Technologies Used

- **Frontend:** Next.js, React, JavaScript, CSS
- **Backend:** Python, FastAPI
- **Database:** PostgreSQL
- **Authentication:** JWT
- **Encryption:** AES-256-GCM
- **Tools:** Visual Studio Code, Git, GitHub, Swagger UI

## How to Run the Project

### Start the Backend

```powershell
cd "C:\Users\jolsn\Desktop\sprinboard project\Intelligent-Encrypted-File-Sharing-and-Digital-Collaboration-Management-Platform\backend"
python -m uvicorn app.main:app --reload
```

Backend: http://localhost:8000

API documentation: http://localhost:8000/docs

### Start the Frontend

Open a separate terminal:

```powershell
cd "C:\Users\jolsn\Desktop\sprinboard project\Intelligent-Encrypted-File-Sharing-and-Digital-Collaboration-Management-Platform\frontend"
npm install
npm run dev
```

Frontend: http://localhost:3000

## Conclusion

TrustShare was developed through four milestones, progressing from core authentication and file management to encryption, secure sharing, activity monitoring, analytics, and testing. The core file-management and sharing workflows have been tested locally. Additional deployment and security verification is required before the project can be described as fully deployed and production-ready.
