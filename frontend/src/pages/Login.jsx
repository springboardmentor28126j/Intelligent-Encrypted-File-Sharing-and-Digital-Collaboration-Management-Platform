import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/auth/login`,
        {
          email,
          password,
        }
      );

      localStorage.setItem(
        "access_token",
        response.data.access_token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(response.data)
      );

      setMessage("Login successful! 🔐");

      setTimeout(() => {
        navigate("/dashboard");
      }, 500);
    } catch (error) {
      console.log(error);

      setMessage(
        error.response?.data?.detail ||
          "Invalid email or password"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ts-login-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .ts-login-page {
          min-height: 100vh;
          display: flex;
          background:
            radial-gradient(
              circle at 15% 20%,
              rgba(99,102,241,0.20),
              transparent 30%
            ),
            radial-gradient(
              circle at 85% 80%,
              rgba(124,58,237,0.18),
              transparent 30%
            ),
            #f8fafc;
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          color: #172033;
        }

        /* LEFT PANEL */

        .ts-login-visual {
          width: 50%;
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 80% 15%,
              rgba(139,92,246,0.35),
              transparent 28%
            ),
            linear-gradient(
              145deg,
              #111827,
              #1e1b4b 55%,
              #312e81
            );
          color: white;
          padding: 55px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }

        .ts-login-visual::before {
          content: "";
          position: absolute;
          width: 360px;
          height: 360px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 50%;
          right: -130px;
          top: 80px;
        }

        .ts-login-visual::after {
          content: "";
          position: absolute;
          width: 260px;
          height: 260px;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 50%;
          left: -120px;
          bottom: 80px;
        }

        .ts-visual-content {
          position: relative;
          z-index: 1;
          max-width: 520px;
        }

        .ts-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ts-logo {
          width: 48px;
          height: 48px;
          border-radius: 15px;
          background:
            linear-gradient(
              135deg,
              #6366f1,
              #8b5cf6
            );
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 800;
          box-shadow:
            0 12px 30px rgba(99,102,241,0.35);
        }

        .ts-brand-name {
          font-size: 24px;
          font-weight: 750;
          letter-spacing: -0.7px;
        }

        .ts-brand-subtitle {
          color: #a5b4fc;
          font-size: 9px;
          letter-spacing: 1.5px;
          margin-top: 2px;
        }

        .ts-visual-main {
          margin-top: auto;
          margin-bottom: auto;
          padding: 70px 0;
        }

        .ts-visual-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 11px;
          border-radius: 30px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          color: #c4b5fd;
          font-size: 10px;
          letter-spacing: 0.7px;
          margin-bottom: 20px;
        }

        .ts-pulse {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow:
            0 0 0 5px rgba(34,197,94,0.10),
            0 0 14px rgba(34,197,94,0.7);
        }

        .ts-visual-main h2 {
          font-size: clamp(34px, 4vw, 54px);
          line-height: 1.08;
          letter-spacing: -2px;
          margin: 0;
          max-width: 500px;
        }

        .ts-gradient-text {
          color: #a5b4fc;
        }

        .ts-visual-description {
          margin-top: 20px;
          color: #cbd5e1;
          font-size: 14px;
          line-height: 1.7;
          max-width: 450px;
        }

        /* SECURITY CARDS */

        .ts-security-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 11px;
          margin-top: 30px;
          max-width: 480px;
        }

        .ts-security-card {
          padding: 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(8px);
        }

        .ts-security-icon {
          font-size: 20px;
          margin-bottom: 7px;
        }

        .ts-security-title {
          font-size: 11px;
          font-weight: 700;
        }

        .ts-security-text {
          color: #94a3b8;
          font-size: 9px;
          margin-top: 3px;
        }

        .ts-visual-footer {
          position: relative;
          z-index: 1;
          color: #64748b;
          font-size: 10px;
        }

        /* LOGIN SIDE */

        .ts-login-form-side {
          width: 50%;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 35px;
        }

        .ts-login-card {
          width: 100%;
          max-width: 430px;
        }

        .ts-mobile-brand {
          display: none;
        }

        .ts-login-heading {
          margin-bottom: 28px;
        }

        .ts-login-heading h1 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -1px;
        }

        .ts-login-heading p {
          color: #64748b;
          font-size: 13px;
          margin-top: 8px;
        }

        .ts-form {
          display: flex;
          flex-direction: column;
          gap: 19px;
        }

        .ts-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .ts-field label {
          font-size: 12px;
          font-weight: 650;
          color: #334155;
        }

        .ts-input-wrapper {
          position: relative;
        }

        .ts-input {
          width: 100%;
          height: 49px;
          border: 1px solid #dbe1ea;
          border-radius: 11px;
          background: white;
          padding: 0 14px;
          font-size: 13px;
          color: #172033;
          outline: none;
          transition: 0.2s ease;
        }

        .ts-input-password {
          padding-right: 48px;
        }

        .ts-input:focus {
          border-color: #6366f1;
          box-shadow:
            0 0 0 3px rgba(99,102,241,0.10);
        }

        .ts-input::placeholder {
          color: #94a3b8;
        }

        .ts-password-toggle {
          position: absolute;
          right: 9px;
          top: 7px;
          height: 35px;
          min-width: 35px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          cursor: pointer;
          font-size: 15px;
        }

        .ts-password-toggle:hover {
          background: #f1f5f9;
        }

        .ts-login-button {
          height: 50px;
          border: 0;
          border-radius: 11px;
          background:
            linear-gradient(
              135deg,
              #4f46e5,
              #7c3aed
            );
          color: white;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow:
            0 10px 22px rgba(79,70,229,0.20);
          transition: 0.2s ease;
          margin-top: 4px;
        }

        .ts-login-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow:
            0 14px 28px rgba(79,70,229,0.27);
        }

        .ts-login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .ts-message {
          margin-top: 17px;
          padding: 11px 13px;
          border-radius: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          font-size: 11px;
          text-align: center;
        }

        .ts-success-message {
          background: #ecfdf5;
          border-color: #bbf7d0;
          color: #15803d;
        }

        .ts-register {
          text-align: center;
          margin-top: 25px;
          color: #64748b;
          font-size: 12px;
        }

        .ts-register a {
          color: #4f46e5;
          font-weight: 700;
          text-decoration: none;
        }

        .ts-register a:hover {
          text-decoration: underline;
        }

        .ts-login-security {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-top: 25px;
          color: #64748b;
          font-size: 10px;
        }

        .ts-login-security span {
          color: #16a34a;
        }

        @media (max-width: 850px) {
          .ts-login-visual {
            display: none;
          }

          .ts-login-form-side {
            width: 100%;
            min-height: 100vh;
            padding: 25px;
          }

          .ts-mobile-brand {
            display: flex;
            justify-content: center;
            margin-bottom: 40px;
          }
        }

        @media (max-width: 450px) {
          .ts-login-form-side {
            padding: 20px;
          }

          .ts-login-heading h1 {
            font-size: 26px;
          }
        }
      `}</style>

      {/* LEFT SECURITY PANEL */}

      <section className="ts-login-visual">

        <div className="ts-brand">

          <div className="ts-logo">
            T
          </div>

          <div>
            <div className="ts-brand-name">
              TrustShare
            </div>

            <div className="ts-brand-subtitle">
              SECURE COLLABORATION
            </div>
          </div>

        </div>

        <div className="ts-visual-main">

          <div className="ts-visual-badge">
            <span className="ts-pulse"></span>
            SECURITY SYSTEM ONLINE
          </div>

          <h2>
            Your files.
            <br />
            <span className="ts-gradient-text">
              Your control.
            </span>
          </h2>

          <p className="ts-visual-description">
            Store, manage and share your files through a secure
            workspace designed around encryption and controlled access.
          </p>

          <div className="ts-security-grid">

            <div className="ts-security-card">
              <div className="ts-security-icon">
                🔐
              </div>

              <div className="ts-security-title">
                AES-256-GCM
              </div>

              <div className="ts-security-text">
                Files encrypted before storage
              </div>
            </div>

            <div className="ts-security-card">
              <div className="ts-security-icon">
                ☁️
              </div>

              <div className="ts-security-title">
                Secure Cloud
              </div>

              <div className="ts-security-text">
                Encrypted cloud file storage
              </div>
            </div>

            <div className="ts-security-card">
              <div className="ts-security-icon">
                👥
              </div>

              <div className="ts-security-title">
                Access Control
              </div>

              <div className="ts-security-text">
                Controlled file permissions
              </div>
            </div>

            <div className="ts-security-card">
              <div className="ts-security-icon">
                ⏳
              </div>

              <div className="ts-security-title">
                Expiring Access
              </div>

              <div className="ts-security-text">
                Time-limited sharing
              </div>
            </div>

          </div>

        </div>

        <div className="ts-visual-footer">
          TrustShare · Intelligent Encrypted File Sharing
        </div>

      </section>

      {/* LOGIN FORM */}

      <section className="ts-login-form-side">

        <div className="ts-login-card">

          <div className="ts-mobile-brand">

            <div className="ts-brand">

              <div className="ts-logo">
                T
              </div>

              <div>
                <div className="ts-brand-name">
                  TrustShare
                </div>

                <div className="ts-brand-subtitle">
                  SECURE COLLABORATION
                </div>
              </div>

            </div>

          </div>

          <div className="ts-login-heading">

            <h1>
              Welcome back 👋
            </h1>

            <p>
              Sign in to access your secure workspace.
            </p>

          </div>

          <form
            className="ts-form"
            onSubmit={handleLogin}
          >

            <div className="ts-field">

              <label htmlFor="email">
                Email address
              </label>

              <input
                id="email"
                className="ts-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                autoComplete="email"
                required
              />

            </div>

            <div className="ts-field">

              <label htmlFor="password">
                Password
              </label>

              <div className="ts-input-wrapper">

                <input
                  id="password"
                  className="ts-input ts-input-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="ts-password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>

              </div>

            </div>

            <button
              className="ts-login-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "🔐 Signing in..."
                : "Sign In →"}
            </button>

          </form>

          {message && (
            <div
              className={`ts-message ${
                message.includes("successful")
                  ? "ts-success-message"
                  : ""
              }`}
            >
              {message}
            </div>
          )}

          <div className="ts-register">

            <div style={{ marginBottom: "12px" }}>
              <Link to="/forgot-password">
                Forgot Password?
              </Link>
            </div>

            Don't have a TrustShare account?{" "}

            <Link to="/register">
              Create one
            </Link>

          </div>

          <div className="ts-login-security">

            <span>●</span>

            Secure authentication · Protected workspace

          </div>

        </div>

      </section>

    </div>
  );
}

export default Login;
