import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ForgotPassword from './pages/ForgotPassword';
import ResetPasswordOTP from './pages/ResetPasswordOTP';
import FileManager from './pages/FileManager';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password-otp" element={<ResetPasswordOTP />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/files" element={<FileManager />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;