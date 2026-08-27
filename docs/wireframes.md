# TrustShare – UI Wireframes & Workflow

1. Login

┌─────────────────────────────┐
│         TRUSTSHARE          │
│                             │
│  Email:    [____________]   │
│  Password: [____________]   │
│                             │
│        [ LOGIN ]            │
│                             │
│     Create Account          │
└─────────────────────────────┘

2. Register

┌─────────────────────────────┐
│       CREATE ACCOUNT        │
│                             │
│ Name:     [____________]    │
│ Email:    [____________]    │
│ Password: [____________]    │
│                             │
│       [ REGISTER ]          │
│                             │
│       Back to Login         │
└─────────────────────────────┘

3. Dashboard

┌─────────────────────────────────────┐
│ TRUSTSHARE                 Logout   │
├─────────────────────────────────────┤
│                                     │
│  Welcome, User                      │
│                                     │
│  [ Upload File ]                    │
│  [ My Files ]                       │
│  [ Shared With Me ]                 │
│  [ Share Data ]                     │
│                                     │
└─────────────────────────────────────┘

4. My Files

┌─────────────────────────────────────┐
│              MY FILES               │
├─────────────────────────────────────┤
│ File Name       Owner       Action  │
│ document.pdf    Me          Share   │
│ project.docx    Me          Share   │
│ report.pdf      Me          Share   │
└─────────────────────────────────────┘

5. Share File

┌─────────────────────────────┐
│        SHARE FILE           │
│                             │
│ Select File: [__________]   │
│ Recipient:   [__________]   │
│                             │
│       [ SHARE FILE ]        │
└─────────────────────────────┘




Admin Workflow

Since I have also implemented RBAC:

Login
  ↓
JWT Authentication
  ↓
Check Role
  ↓
 ┌───────────────┐
 │               │
User            Admin
 │               │
 ▼               ▼
Dashboard     Admin Panel
                 │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
    View Users Change     Delete
              Role        User