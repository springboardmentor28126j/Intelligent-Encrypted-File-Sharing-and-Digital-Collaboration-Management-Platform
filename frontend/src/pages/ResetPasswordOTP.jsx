import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { resetPasswordWithOtp } from '../services/authService';

function ResetPasswordOTP() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await resetPasswordWithOtp(email, otp, newPassword);
      setMsg('Password updated successfully! Redirecting...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed');
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h2 style={styles.heading}>Reset Password</h2>
        {error && <p style={styles.error}>{error}</p>}
        {msg && <p style={styles.success}>{msg}</p>}

        <div style={styles.inputGroup}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            required
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Enter 6-Digit OTP</label>
          <input
            type="text"
            placeholder="6-digit OTP"
            required
            maxLength="6"
            style={styles.input}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>New Password</label>
          <input
            type="password"
            placeholder="Enter new password"
            required
            style={styles.input}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <button type="submit" style={styles.button}>Update Password</button>
      </form>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', },
  card: { backgroundColor: '#ffffff', padding: '35px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width: '380px', display: 'flex', flexDirection: 'column' },
  heading: { fontSize: '24px', fontWeight: 'bold', textAlign: 'center', color: '#111827', marginBottom: '20px' },
  error: { color: '#dc2626', fontSize: '14px', textAlign: 'center', marginBottom: '15px' },
  success: { color: '#16a34a', fontSize: '14px', textAlign: 'center', marginBottom: '15px' },
  inputGroup: { marginBottom: '15px', display: 'flex', flexDirection: 'column' },
  label: { fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '5px' },
  input: { padding: '12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' },
  button: { backgroundColor: '#16a34a', color: '#ffffff', padding: '12px', borderRadius: '6px', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }
};

export default ResetPasswordOTP;