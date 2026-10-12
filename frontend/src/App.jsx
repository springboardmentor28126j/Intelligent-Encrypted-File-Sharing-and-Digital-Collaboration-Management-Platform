import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout, Protected, PublicOnly } from './components/common'
import { ForgotPassword, Login, Register, ResetPassword, VerifyOTP } from './pages/AuthPages'
import Activity from './pages/Activity'
import Dashboard from './pages/Dashboard'
import FileDetails from './pages/FileDetails'
import Folders from './pages/Folders'
import MyFiles from './pages/MyFiles'
import Profile from './pages/Profile'
import Security from './pages/Security'
import SharedWithMe from './pages/SharedWithMe'
import UploadFile from './pages/UploadFile'
import PublicShare from './pages/PublicShare' // 1. Import new page
import Notifications from './pages/Notifications'
import { useEffect } from 'react'

function AppRoutes() {
  const location = useLocation()

  useEffect(() => {
    const path = location.pathname
    const title = path === '/login'
      ? 'Sign in'
      : path === '/register'
        ? 'Create account'
        : path.startsWith('/folders')
          ? 'Folders'
          : path === '/dashboard'
            ? 'Overview'
            : 'Secure file sharing'
    document.title = `TrustShare | ${title}`
  }, [location.pathname])

  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/verify-otp" element={<PublicOnly><VerifyOTP /></PublicOnly>} />
      <Route path="/reset-password" element={<PublicOnly><ResetPassword /></PublicOnly>} />

      {/* 2. Public route for temporary download links */}
      <Route path="/share/:token" element={<PublicShare />} />

      {/* Protected routes */}
      <Route
        path="*"
        element={
          <Protected>
            <Layout>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/files" element={<MyFiles />} />
                <Route path="/files/upload" element={<UploadFile />} />
                <Route path="/files/:id" element={<FileDetails />} />
                <Route path="/shared-with-me" element={<SharedWithMe />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/folders" element={<Folders />} />
                <Route path="/folders/:folderId" element={<Folders />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/security" element={<Security />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </Routes>
            </Layout>
          </Protected>
        }
      />
    </Routes>
  )
}

export default AppRoutes