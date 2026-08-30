import { useState } from 'react'
import './App.css'

function App() {
  const [isSignup, setIsSignup] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('user')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleLogin = (e) => {
    e.preventDefault()

    if (!email || !password) {
      alert('Please enter your email and password.')
      return
    }

    alert('Login will be connected to the FastAPI backend next.')
  }

  const handleSignup = (e) => {
    e.preventDefault()

    if (!name || !email || !password || !confirmPassword) {
      alert('Please fill in all required fields.')
      return
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match.')
      return
    }

    alert('Registration will be connected to the FastAPI backend next.')
  }

  return (
    <div className="app">
      <div className="login-card">

        {/* Logo */}
        <div className="logo-section">
          <div className="logo">🔐</div>

          <h1>TrustShare</h1>

          <p>
            Secure File Sharing & Digital Collaboration
          </p>
        </div>

        {!isSignup ? (
          /* ================= LOGIN ================= */
          <div className="form-section">

            <h2>Welcome Back</h2>

            <p className="subtitle">
              Sign in to securely access your files and collaborations.
            </p>

            <form onSubmit={handleLogin}>

              <label htmlFor="email">
                Email Address
              </label>

              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <label htmlFor="password">
                Password
              </label>

              <div className="password-container">

                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  type="button"
                  className="show-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>

              </div>

              <div className="form-options">

                <label className="remember">
                  <input type="checkbox" />
                  Remember me
                </label>

                <a href="#forgot">
                  Forgot password?
                </a>

              </div>

              <button
                type="submit"
                className="login-button"
              >
                Sign In
              </button>

            </form>

            <div className="divider">
              <span>OR</span>
            </div>

            <p className="signup-text">
              Don't have an account?{' '}

              <button
                type="button"
                className="link-button"
                onClick={() => setIsSignup(true)}
              >
                Create an account
              </button>
            </p>

          </div>

        ) : (

          /* ================= SIGNUP ================= */
          <div className="form-section">

            <h2>Create Account</h2>

            <p className="subtitle">
              Create your secure TrustShare account.
            </p>

            <form onSubmit={handleSignup}>

              <label htmlFor="name">
                Full Name
              </label>

              <input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <label htmlFor="signup-email">
                Email Address
              </label>

              <input
                id="signup-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <label htmlFor="signup-password">
                Password
              </label>

              <div className="password-container">

                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  type="button"
                  className="show-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>

              </div>

              <label htmlFor="confirm-password">
                Confirm Password
              </label>

              <div className="password-container">

                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <button
                  type="button"
                  className="show-password"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>

              </div>

              <label htmlFor="role">
                Account Role
              </label>

              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="user">User</option>
                <option value="admin">Administrator</option>
              </select>

              <button
                type="submit"
                className="login-button"
              >
                Create Account
              </button>

            </form>

            <div className="divider">
              <span>OR</span>
            </div>

            <p className="signup-text">
              Already have an account?{' '}

              <button
                type="button"
                className="link-button"
                onClick={() => setIsSignup(false)}
              >
                Back to Login
              </button>
            </p>

          </div>
        )}

        <div className="security-note">
          🔒 Your data is protected with secure authentication.
        </div>

      </div>
    </div>
  )
}

export default App