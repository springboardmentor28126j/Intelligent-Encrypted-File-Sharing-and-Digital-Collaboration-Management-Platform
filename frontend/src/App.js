import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = isLogin
        ? 'http://127.0.0.1:8000/login'
        : 'http://127.0.0.1:8000/signup';

      const response = await axios.post(url, { email, password });

      if (isLogin) {
        setMessage('Login successful!');
        localStorage.setItem('token', response.data.access_token);
      } else {
        setMessage('Signup successful! Please login.');
        setIsLogin(true);
      }
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Something went wrong');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'Arial' }}>
      <h2>{isLogin ? 'Login' : 'Signup'} - TrustShare</h2>
      <form onSubmit={handleSubmit}>
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

export default App;
