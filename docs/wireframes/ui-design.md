# TrustShare — UI Wireframes and Screen Design

## 1. UI Design Overview

TrustShare provides a secure and simple interface for authentication, file management, file sharing, notifications, and user settings.

The interface is designed around the following main screens:

- Login
- Registration
- Dashboard
- File Management
- File Upload
- File Sharing
- Notifications
- User Profile and Settings

---

## 2. Login Screen

```text
┌─────────────────────────────────────────────┐
│                  TrustShare                 │
│                                             │
│              Secure File Sharing            │
│                                             │
│   Email                                      │
│   ┌─────────────────────────────────────┐   │
│   │ Enter your email                    │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   Password                                   │
│   ┌─────────────────────────────────────┐   │
│   │ Enter your password                 │   │
│   └─────────────────────────────────────┘   │
│                                             │
│              [ Login ]                      │
│                                             │
│         Forgot Password?                    │
│                                             │
│      Don't have an account? Sign Up         │
└─────────────────────────────────────────────┘
```

### Main Functions

- Email/password login
- Authentication
- Forgot password
- Navigation to registration
- Error messages for invalid credentials

---

## 3. Registration Screen

```text
┌─────────────────────────────────────────────┐
│                  TrustShare                 │
│                                             │
│              Create Account                 │
│                                             │
│   Full Name                                  │
│   ┌─────────────────────────────────────┐   │
│   │ Enter your name                     │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   Email                                      │
│   ┌─────────────────────────────────────┐   │
│   │ Enter your email                    │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   Password                                   │
│   ┌─────────────────────────────────────┐   │
│   │ Create password                     │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   Confirm Password                           │
│   ┌─────────────────────────────────────┐   │
│   │ Confirm password                    │   │
│   └─────────────────────────────────────┘   │
│                                             │
│              [ Register ]                    │
│                                             │
│          Already registered? Login           │
└─────────────────────────────────────────────┘
```

---

## 4. Dashboard

```text
┌────────────────────────────────────────────────────────┐
│ TrustShare                              🔔   👤 Roshan │
├───────────────┬────────────────────────────────────────┤
│               │                                        │
│ Dashboard     │             Dashboard                  │
│               │                                        │
│ My Files      │  ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ Shared Files  │  │ My Files│ │ Shared  │ │ Storage │ │
│ Upload        │  │   24    │ │   12    │ │  2.4 GB │ │
│               │  └─────────┘ └─────────┘ └─────────┘ │
│ Notifications │                                        │
│               │  Recent Files                          │
│ Settings      │  ┌──────────────────────────────────┐ │
│               │  │ 📄 Project_Report.pdf            │ │
│ Logout        │  │ 📄 Database_Design.docx          │ │
│               │  │ 📄 Presentation.pptx              │ │
│               │  └──────────────────────────────────┘ │
└───────────────┴────────────────────────────────────────┘
```

### Main Functions

- File statistics
- Recent files
- Storage usage
- Navigation
- Notifications
- User profile
- Quick file upload

---

## 5. File Management Screen

```text
┌────────────────────────────────────────────────────────┐
│ TrustShare                              🔔   👤 Roshan │
├───────────────┬────────────────────────────────────────┤
│               │                                        │
│ Dashboard     │  My Files                              │
│               │                                        │
│ My Files      │  [ Upload File ]                       │
│ Shared Files  │                                        │
│ Upload        │  🔍 Search files...                    │
│               │                                        │
│ Notifications │  Name             Type      Size       │
│               │  ────────────────────────────────────  │
│ Settings      │  📄 Report.pdf     PDF       2.4 MB    │
│               │  📄 Notes.docx     DOCX      1.2 MB    │
│ Logout        │  📄 Image.png      PNG       800 KB    │
│               │                                        │
└───────────────┴────────────────────────────────────────┘
```

### Main Functions

- View files
- Search files
- File categorization
- File metadata
- Download
- Delete
- Share
- File version information

---

## 6. File Upload Screen

```text
┌─────────────────────────────────────────────┐
│              Upload File                    │
│                                             │
│        ┌─────────────────────────┐          │
│        │                         │          │
│        │   Drag & Drop File      │          │
│        │        Here             │          │
│        │                         │          │
│        │     [ Browse Files ]    │          │
│        └─────────────────────────┘          │
│                                             │
│ File Name:                                  │
│ Project_Report.pdf                          │
│                                             │
│ File Size: 2.4 MB                           │
│                                             │
│ Access Permission:                          │
│ ○ Private                                   │
│ ○ Shared                                    │
│                                             │
│              [ Upload ]                     │
│                                             │
└─────────────────────────────────────────────┘
```

### Main Functions

- Select file
- Drag and drop
- File validation
- File size validation
- Permission selection
- Upload progress
- Upload status

---

## 7. File Sharing Screen

```text
┌────────────────────────────────────────────────┐
│              Share File                        │
│                                                │
│ File: Project_Report.pdf                       │
│                                                │
│ Share with:                                    │
│ ┌────────────────────────────────────────────┐ │
│ │ user@example.com                            │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ Permission:                                    │
│ [ View ▼ ]                                     │
│                                                │
│ Expiration:                                    │
│ [ Select expiration ]                          │
│                                                │
│ Download Limit:                                │
│ [ 5 ]                                          │
│                                                │
│              [ Create Share ]                  │
│                                                │
└────────────────────────────────────────────────┘
```

### Main Functions

- Select recipient
- Configure permission
- Set expiration
- Set download limit
- Generate secure sharing access

---

## 8. Notifications Screen

```text
┌────────────────────────────────────────────────────────┐
│                    Notifications                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│ 🔔 File shared with you                                │
│    Project_Report.pdf                                   │
│    10 minutes ago                                       │
│                                                        │
│ 🔔 File downloaded                                     │
│    Database_Design.docx                                 │
│    30 minutes ago                                       │
│                                                        │
│ ⚠ Security alert                                      │
│    New login detected                                   │
│    1 hour ago                                           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 9. User Profile and Settings

```text
┌────────────────────────────────────────────────────────┐
│                    Profile & Settings                   │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Profile                                                │
│                                                        │
│ Name:       Roshan Yadav                               │
│ Email:      user@example.com                           │
│ Role:       User                                       │
│                                                        │
│ Security                                               │
│ ─────────────────────────────────────────────────────  │
│ Change Password                                        │
│ Two-Factor Authentication                              │
│ Active Sessions                                         │
│                                                        │
│ Preferences                                            │
│ ─────────────────────────────────────────────────────  │
│ Notification Settings                                  │
│                                                        │
│              [ Save Changes ]                          │
└────────────────────────────────────────────────────────┘
```

---

## 10. Navigation Structure

```text
TrustShare
│
├── Login
├── Registration
│
└── Authenticated User
    │
    ├── Dashboard
    │
    ├── My Files
    │   ├── Upload
    │   ├── View
    │   ├── Download
    │   ├── Delete
    │   └── Share
    │
    ├── Shared Files
    │
    ├── Notifications
    │
    └── Settings
        ├── Profile
        ├── Security
        └── Preferences
```

## 11. UI Design Principles

The interface should follow these principles:

- Simple navigation.
- Clear file-management actions.
- Consistent layout.
- Responsive design.
- Clear authentication states.
- Visible security notifications.
- Clear permission controls.
- Confirmation before destructive actions.
- Clear upload and download status.
- Accessible interface elements.