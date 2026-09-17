import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/auth/register",
        {
          username,
          email,
          password,
        }
      );

      setMessage(
        response.data.message || "Account created successfully!"
      );

      setTimeout(() => {
        navigate("/login");
      }, 1000);

    } catch (error) {
      console.log("REGISTER ERROR:", error);
      console.log("SERVER RESPONSE:", error.response?.data);

      setMessage(
        error.response?.data?.detail ||
          "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ts-register-page">

      <style>{`
        * {
          box-sizing: border-box;
        }

        .ts-register-page {
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

        .ts-register-visual {
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

        .ts-register-visual::before {
          content: "";
          position: absolute;
          width: 360px;
          height: 360px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 50%;
          right: -130px;
          top: 80px;
        }

        .ts-register-visual::after {
          content: "";
          position: absolute;
          width: 260px;
          height: 260px;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 50%;
          left: -120px;
          bottom: 80px;
        }

        .ts-register-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          z-index: 1;
        }

        .ts-register-logo {
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

        .ts-register-brand-name {
          font-size: 24px;
          font-weight: 750;
          letter-spacing: -0.7px;
        }

        .ts-register-brand-subtitle {
          color: #a5b4fc;
          font-size: 9px;
          letter-spacing: 1.5px;
          margin-top: 2px;
        }

        .ts-register-main {
          position: relative;
          z-index: 1;
          margin-top: auto;
          margin-bottom: auto;
          padding: 70px 0;
        }

        .ts-register-badge {
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

        .ts-register-pulse {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow:
            0 0 0 5px rgba(34,197,94,0.10),
            0 0 14px rgba(34,197,94,0.7);
        }

        .ts-register-main h2 {
          font-size: clamp(34px, 4vw, 54px);
          line-height: 1.08;
          letter-spacing: -2px;
          margin: 0;
          max-width: 500px;
        }

        .ts-register-gradient {
          color: #a5b4fc;
        }

        .ts-register-description {
          margin-top: 20px;
          color: #cbd5e1;
          font-size: 14px;
          line-height: 1.7;
          max-width: 450px;
        }

        /* BENEFITS */

        .ts-benefits {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 11px;
          margin-top: 30px;
          max-width: 480px;
        }

        .ts-benefit {
          padding: 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(8px);
        }

        .ts-benefit-icon {
          font-size: 20px;
          margin-bottom: 7px;
        }

        .ts-benefit-title {
          font-size: 11px;
          font-weight: 700;
        }

        .ts-benefit-text {
          color: #94a3b8;
          font-size: 9px;
          margin-top: 3px;
        }

        .ts-register-footer {
          position: relative;
          z-index: 1;
          color: #64748b;
          font-size: 10px;
        }

        /* FORM SIDE */

        .ts-register-form-side {
          width: 50%;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 35px;
        }

        .ts-register-card {
          width: 100%;
          max-width: 430px;
        }

        .ts-mobile-register-brand {
          display: none;
        }

        .ts-register-heading {
          margin-bottom: 27px;
        }

        .ts-register-heading h1 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -1px;
        }

        .ts-register-heading p {
          color: #64748b;
          font-size: 13px;
          margin-top: 8px;
        }

        .ts-register-form {
          display: flex;
          flex-direction: column;
          gap: 17px;
        }

        .ts-register-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .ts-register-field label {
          font-size: 12px;
          font-weight: 650;
          color: #334155;
        }

        .ts-register-input-wrapper {
          position: relative;
        }

        .ts-register-input {
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

        .ts-register-input-password {
          padding-right: 48px;
        }

        .ts-register-input:focus {
          border-color: #6366f1;
          box-shadow:
            0 0 0 3px rgba(99,102,241,0.10);
        }

        .ts-register-input::placeholder {
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

        .ts-register-button {
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
          margin-top: 5px;
        }

        .ts-register-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow:
            0 14px 28px rgba(79,70,229,0.27);
        }

        .ts-register-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .ts-register-message {
          margin-top: 17px;
          padding: 11px 13px;
          border-radius: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          font-size: 11px;
          text-align: center;
        }

        .ts-register-success {
          background: #ecfdf5;
          border-color: #bbf7d0;
          color: #15803d;
        }

        .ts-login-link {
          text-align: center;
          margin-top: 24px;
          color: #64748b;
          font-size: 12px;
        }

        .ts-login-link a {
          color: #4f46e5;
          font-weight: 700;
          text-decoration: none;
        }

        .ts-login-link a:hover {
          text-decoration: underline;
        }

        .ts-register-security {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-top: 24px;
          color: #64748b;
          font-size: 10px;
        }

        .ts-register-security span {
          color: #16a34a;
        }

        @media (max-width: 850px) {

          .ts-register-visual {
            display: none;
          }

          .ts-register-form-side {
            width: 100%;
            min-height: 100vh;
            padding: 25px;
          }

          .ts-mobile-register-brand {
            display: flex;
            justify-content: center;
            margin-bottom: 40px;
          }

        }

        @media (max-width: 450px) {

          .ts-register-form-side {
            padding: 20px;
          }

          .ts-register-heading h1 {
            font-size: 26px;
          }

        }
      `}</style>

      {/* LEFT PANEL */}

      <section className="ts-register-visual">

        <div className="ts-register-brand">

          <div className="ts-register-logo">
            T
          </div>

          <div>
            <div className="ts-register-brand-name">
              TrustShare
            </div>

            <div className="ts-register-brand-subtitle">
              SECURE COLLABORATION
            </div>
          </div>

        </div>

        <div className="ts-register-main">

          <div className="ts-register-badge">
            <span className="ts-register-pulse"></span>
            BUILD YOUR SECURE WORKSPACE
          </div>

          <h2>
            Create your
            <br />
            <span className="ts-register-gradient">
              secure space.
            </span>
          </h2>

          <p className="ts-register-description">
            Join TrustShare and manage your files with encryption,
            controlled sharing and secure cloud storage.
          </p>

          <div className="ts-benefits">

            <div className="ts-benefit">
              <div className="ts-benefit-icon">
                🔐
              </div>

              <div className="ts-benefit-title">
                Private by Design
              </div>

              <div className="ts-benefit-text">
                Encryption protects your files
              </div>
            </div>

            <div className="ts-benefit">
              <div className="ts-benefit-icon">
                ☁️
              </div>

              <div className="ts-benefit-title">
                Cloud Storage
              </div>

              <div className="ts-benefit-text">
                Access files from your workspace
              </div>
            </div>

            <div className="ts-benefit">
              <div className="ts-benefit-icon">
                👥
              </div>

              <div className="ts-benefit-title">
                Smart Sharing
              </div>

              <div className="ts-benefit-text">
                Control who can access files
              </div>
            </div>

            <div className="ts-benefit">
              <div className="ts-benefit-icon">
                🛡️
              </div>

              <div className="ts-benefit-title">
                Secure Access
              </div>

              <div className="ts-benefit-text">
                Protected authentication
              </div>
            </div>

          </div>

        </div>

        <div className="ts-register-footer">
          TrustShare · Intelligent Encrypted File Sharing
        </div>

      </section>

      {/* REGISTER FORM */}

      <section className="ts-register-form-side">

        <div className="ts-register-card">

          <div className="ts-mobile-register-brand">

            <div className="ts-register-brand">

              <div className="ts-register-logo">
                T
              </div>

              <div>
                <div className="ts-register-brand-name">
                  TrustShare
                </div>

                <div className="ts-register-brand-subtitle">
                  SECURE COLLABORATION
                </div>
              </div>

            </div>

          </div>

          <div className="ts-register-heading">

            <h1>
              Create your account ✨
            </h1>

            <p>
              Set up your secure TrustShare workspace.
            </p>

          </div>

          <form
            className="ts-register-form"
            onSubmit={handleRegister}
          >

            <div className="ts-register-field">

              <label htmlFor="username">
                Username
              </label>

              <input
                id="username"
                className="ts-register-input"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                autoComplete="username"
                required
              />

            </div>

            <div className="ts-register-field">

              <label htmlFor="register-email">
                Email address
              </label>

              <input
                id="register-email"
                className="ts-register-input"
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

            <div className="ts-register-field">

              <label htmlFor="register-password">
                Password
              </label>

              <div className="ts-register-input-wrapper">

                <input
                  id="register-password"
                  className="ts-register-input ts-register-input-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  autoComplete="new-password"
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
              className="ts-register-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "🔐 Creating account..."
                : "Create Account →"}
            </button>

          </form>

          {message && (
            <div
              className={`ts-register-message ${
                message.toLowerCase().includes("success") ||
                message.toLowerCase().includes("created")
                  ? "ts-register-success"
                  : ""
              }`}
            >
              {message}
            </div>
          )}

          <div className="ts-login-link">

            Already have a TrustShare account?{" "}

            <Link to="/login">
              Sign in
            </Link>

          </div>

          <div className="ts-register-security">

            <span>●</span>

            Secure registration · Protected workspace

          </div>

        </div>

      </section>

    </div>
  );
}

export default Register;