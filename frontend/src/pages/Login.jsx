import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../services/authService';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await loginUser({ email, password });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h2 style={styles.heading}>TrustShare Login</h2>
        {error && <p style={styles.error}>{error}</p>}
        
        <div style={styles.inputGroup}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            required
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            required
            style={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" style={styles.button}>Login</button>
        
        <p style={styles.text}>
          Don’t have an account? <Link to="/register" style={styles.link}>Register here</Link>
        </p>
        <p style={{ ...styles.text, marginTop: '10px' }}>
  <Link to="/forgot-password" style={styles.link}>Forgot Password?</Link>
</p>
      </form>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' },
  card: { backgroundColor: '#ffffff', padding: '35px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width: '380px', display: 'flex', flexDirection: 'column' },
  heading: { fontSize: '24px', fontWeight: 'bold', textAlign: 'center', color: '#111827', marginBottom: '20px' },
  error: { color: '#dc2626', fontSize: '14px', textAlign: 'center', marginBottom: '15px' },
  inputGroup: { marginBottom: '15px', display: 'flex', flexDirection: 'column' },
  label: { fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '5px' },
  input: { padding: '12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' },
  button: { backgroundColor: '#2563eb', color: '#ffffff', padding: '12px', borderRadius: '6px', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  text: { fontSize: '14px', textAlign: 'center', color: '#4b5563', marginTop: '20px' },
  link: { color: '#2563eb', fontWeight: 'bold', textDecoration: 'none' }
};

export default Login;