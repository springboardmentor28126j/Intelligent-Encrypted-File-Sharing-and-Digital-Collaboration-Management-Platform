import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sendRegisterOtp, verifyAndRegister } from '../services/authService';

function Register() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', otp: '' });
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill Name, Email and Password first');
      return;
    }
    setError('');
    setMsg('');
    setLoading(true);
    try {
      await sendRegisterOtp(formData.email);
      setMsg('OTP sent to your email! Enter OTP to complete registration.');
      setIsOtpSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    if (!formData.otp) {
      setError('Please enter the OTP');
      return;
    }
    setError('');
    setMsg('');
    setLoading(true);
    try {
      await verifyAndRegister(formData);
      setMsg('Registration successful! Redirecting to Login...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Create Account</h2>
        {error && <p style={styles.error}>{error}</p>}
        {msg && <p style={styles.success}>{msg}</p>}

        <form onSubmit={isOtpSent ? handleVerifyAndRegister : handleSendOtp}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Full Name</label>
            <input
              type="text"
              name="name"
              placeholder="Enter your name"
              required
              disabled={isOtpSent}
              style={styles.input}
              value={formData.name}
              onChange={handleChange}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              required
              disabled={isOtpSent}
              style={styles.input}
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              name="password"
              placeholder="Enter password"
              required
              disabled={isOtpSent}
              style={styles.input}
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          {isOtpSent && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Enter 6-Digit OTP</label>
              <input
                type="text"
                name="otp"
                placeholder="Enter OTP from Email"
                required
                maxLength="6"
                style={{ ...styles.input, borderColor: '#2563eb', fontWeight: 'bold' }}
                value={formData.otp}
                onChange={handleChange}
              />
            </div>
          )}

          {!isOtpSent ? (
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'Sending OTP...' : 'Send Verification OTP'}
            </button>
          ) : (
            <button type="submit" disabled={loading} style={styles.verifyButton}>
              {loading ? 'Verifying...' : 'Verify & Register'}
            </button>
          )}
        </form>

        <p style={styles.text}>
          Already have an account? <Link to="/login" style={styles.link}>Login</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh'},
  card: { backgroundColor: '#ffffff', padding: '35px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width: '380px', display: 'flex', flexDirection: 'column' },
  heading: { fontSize: '24px', fontWeight: 'bold', textAlign: 'center', color: '#111827', marginBottom: '20px' },
  error: { color: '#dc2626', fontSize: '14px', textAlign: 'center', marginBottom: '15px' },
  success: { color: '#16a34a', fontSize: '14px', textAlign: 'center', marginBottom: '15px' },
  inputGroup: { marginBottom: '15px', display: 'flex', flexDirection: 'column' },
  label: { fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '5px' },
  input: { padding: '12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' },
  button: { backgroundColor: '#2563eb', color: '#ffffff', padding: '12px', borderRadius: '6px', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  verifyButton: { backgroundColor: '#16a34a', color: '#ffffff', padding: '12px', borderRadius: '6px', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  text: { fontSize: '14px', textAlign: 'center', color: '#4b5563', marginTop: '20px' },
  link: { color: '#2563eb', fontWeight: 'bold', textDecoration: 'none' }
};

export default Register;