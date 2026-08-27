import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (loggedIn) {
      fetchFiles();
    }
  }, [loggedIn]);

  const fetchFiles = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/files');
      setFiles(response.data);
    } catch (error) {
      console.log('Error fetching files');
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = isLogin
        ? 'http://127.0.0.1:8000/login'
        : 'http://127.0.0.1:8000/signup';

      const response = await axios.post(url, { email, password });

      if (isLogin) {
        setMessage('Login successful!');
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('email', email);
        setLoggedIn(true);
      } else {
        setMessage('Signup successful! Please login.');
        setIsLogin(true);
      }
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Something went wrong');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setMessage('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await axios.post('http://127.0.0.1:8000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage('File uploaded successfully!');
      setSelectedFile(null);
      fetchFiles();
    } catch (error) {
      setMessage('File upload failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    setLoggedIn(false);
    setEmail('');
    setPassword('');
    setFiles([]);
  };

  // ---------- LOGIN / SIGNUP PAGE ----------
  if (!loggedIn) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'Arial' }}>
        <h2>{isLogin ? 'Login' : 'Signup'} - TrustShare</h2>
        <form onSubmit={handleAuthSubmit}>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <button type="submit" style={{ width: '100%', padding: '10px' }}>
            {isLogin ? 'Login' : 'Signup'}
          </button>
        </form>
        {message && <p style={{ color: 'blue' }}>{message}</p>}
        <p onClick={() => setIsLogin(!isLogin)} style={{ cursor: 'pointer', color: 'green' }}>
          {isLogin ? "Don't have an account? Signup" : "Already have an account? Login"}
        </p>
      </div>
    );
  }

  // ---------- DASHBOARD PAGE (AFTER LOGIN) ----------
  return (
    <div style={{ maxWidth: '700px', margin: '50px auto', fontFamily: 'Arial' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>TrustShare Dashboard</h2>
        <button onClick={handleLogout} style={{ padding: '8px 16px' }}>Logout</button>
      </div>
      <p>Welcome, {localStorage.getItem('email')}</p>

      <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>Upload a File</h3>
        <form onSubmit={handleFileUpload}>
          <input
            type="file"
            onChange={(e) => setSelectedFile(e.target.files[0])}
            style={{ marginBottom: '10px' }}
          />
          <br />
          <button type="submit" style={{ padding: '8px 16px' }}>Upload</button>
        </form>
        {message && <p style={{ color: 'blue' }}>{message}</p>}
      </div>

      <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
        <h3>Your Files</h3>
        {files.length === 0 ? (
          <p>No files uploaded yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc' }}>
                <th style={{ textAlign: 'left', padding: '8px' }}>Filename</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Uploaded By</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px' }}>{f.filename}</td>
                  <td style={{ padding: '8px' }}>{f.owner_email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;
