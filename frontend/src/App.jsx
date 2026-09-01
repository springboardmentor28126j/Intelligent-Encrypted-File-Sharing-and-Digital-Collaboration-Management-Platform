import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout, Protected } from './components/common'
import { ForgotPassword, Login, Register, ResetPassword, VerifyOTP } from './pages/AuthPages'
import Activity from './pages/Activity'
import Dashboard from './pages/Dashboard'
import FileDetails from './pages/FileDetails'
import Folders from './pages/Folders'
import MyFiles from './pages/MyFiles'
import Profile from './pages/Profile'
import SharedWithMe from './pages/SharedWithMe'
import UploadFile from './pages/UploadFile'

function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/verify-otp" element={<VerifyOTP />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="*" element={<Protected><Layout><Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/files" element={<MyFiles />} />
      <Route path="/files/upload" element={<UploadFile />} />
      <Route path="/files/:id" element={<FileDetails />} />
      <Route path="/shared-with-me" element={<SharedWithMe />} />
      <Route path="/folders" element={<Folders />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/activity" element={<Activity />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes></Layout></Protected>} />
  </Routes>
}

export default AppRoutes
