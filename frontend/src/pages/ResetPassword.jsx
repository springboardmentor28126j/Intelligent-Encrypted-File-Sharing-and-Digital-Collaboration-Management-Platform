import { useState } from "react";
import axios from "axios";
import {
  Link,
  useSearchParams,
  useNavigate,
} from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;
function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordLength = password.length;

  const handleReset = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!token) {
      setError(
        "This password reset link is invalid or missing."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters long."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/auth/reset-password`,
        {
          token,
          new_password: password,
        }
      );

      setMessage(response.data.message);

      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to reset password. The link may be invalid or expired."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ts-reset-page">

      <style>{`
        * {
          box-sizing: border-box;
        }

        .ts-reset-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 20px;
          background:
            radial-gradient(
              circle at 85% 10%,
              rgba(99, 102, 241, 0.13),
              transparent 30%
            ),
            radial-gradient(
              circle at 10% 90%,
              rgba(139, 92, 246, 0.10),
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

        .ts-reset-wrapper {
          width: 100%;
          max-width: 900px;
        }

        /* TOP BRAND */

        .ts-reset-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 25px;
        }

        .ts-reset-logo {
          width: 42px;
          height: 42px;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(
              135deg,
              #6366f1,
              #8b5cf6
            );
          color: white;
          font-size: 20px;
          font-weight: 800;
          box-shadow:
            0 10px 25px rgba(99, 102, 241, 0.22);
        }

        .ts-reset-brand-name {
          font-size: 21px;
          font-weight: 750;
          letter-spacing: -0.6px;
        }

        /* LAYOUT */

        .ts-reset-layout {
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          background: rgba(255,255,255,0.9);
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          overflow: hidden;
          box-shadow:
            0 25px 70px rgba(15, 23, 42, 0.09);
        }

        /* INFO SIDE */

        .ts-reset-info {
          padding: 45px;
          background:
            linear-gradient(
              150deg,
              #f5f3ff,
              #eef2ff
            );
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .ts-reset-shield {
          width: 70px;
          height: 70px;
          border-radius: 21px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border: 1px solid #ddd6fe;
          font-size: 31px;
          box-shadow:
            0 10px 25px rgba(99,102,241,0.10);
          margin-bottom: 25px;
        }

        .ts-reset-info h2 {
          margin: 0;
          font-size: 28px;
          line-height: 1.15;
          letter-spacing: -1px;
        }

        .ts-reset-highlight {
          color: #6366f1;
        }

        .ts-reset-info p {
          color: #64748b;
          font-size: 12px;
          line-height: 1.7;
          margin-top: 13px;
          max-width: 300px;
        }

        .ts-reset-points {
          margin-top: 25px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ts-reset-point {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #475569;
          font-size: 11px;
        }

        .ts-reset-point-icon {
          width: 27px;
          height: 27px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border: 1px solid #e0e7ff;
          font-size: 13px;
        }

        /* FORM SIDE */

        .ts-reset-form-side {
          padding: 45px;
          display: flex;
          align-items: center;
        }

        .ts-reset-form-container {
          width: 100%;
          max-width: 400px;
          margin: auto;
        }

        .ts-reset-heading h1 {
          margin: 0;
          font-size: 28px;
          letter-spacing: -1px;
        }

        .ts-reset-heading p {
          margin-top: 8px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.6;
        }

        .ts-reset-form {
          margin-top: 27px;
          display: flex;
          flex-direction: column;
          gap: 17px;
        }

        .ts-reset-label {
          display: block;
          font-size: 12px;
          font-weight: 650;
          color: #334155;
          margin-bottom: 7px;
        }

        .ts-reset-input {
          width: 100%;
          height: 49px;
          padding: 0 14px;
          border: 1px solid #dbe1ea;
          border-radius: 11px;
          background: white;
          color: #172033;
          font-size: 13px;
          outline: none;
          transition: 0.2s ease;
        }

        .ts-reset-input:focus {
          border-color: #6366f1;
          box-shadow:
            0 0 0 3px rgba(99,102,241,0.10);
        }

        .ts-reset-input::placeholder {
          color: #94a3b8;
        }

        /* PASSWORD STRENGTH */

        .ts-reset-strength {
          margin-top: 8px;
        }

        .ts-reset-strength-bar {
          height: 4px;
          border-radius: 10px;
          background: #e2e8f0;
          overflow: hidden;
        }

        .ts-reset-strength-fill {
          height: 100%;
          border-radius: 10px;
          background:
            linear-gradient(
              90deg,
              #6366f1,
              #8b5cf6
            );
          transition: width 0.25s ease;
        }

        .ts-reset-strength-text {
          margin-top: 5px;
          font-size: 9px;
          color: #94a3b8;
          text-align: right;
        }

        /* BUTTON */

        .ts-reset-button {
          width: 100%;
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
          margin-top: 3px;
          box-shadow:
            0 10px 22px rgba(79,70,229,0.20);
          transition: 0.2s ease;
        }

        .ts-reset-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow:
            0 14px 28px rgba(79,70,229,0.27);
        }

        .ts-reset-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* MESSAGES */

        .ts-reset-message {
          margin-top: 17px;
          padding: 12px;
          border-radius: 10px;
          text-align: center;
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #15803d;
          font-size: 11px;
          line-height: 1.5;
        }

        .ts-reset-error {
          background: #fef2f2;
          border-color: #fecaca;
          color: #b91c1c;
        }

        .ts-reset-back {
          text-align: center;
          margin-top: 22px;
        }

        .ts-reset-back a {
          color: #4f46e5;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
        }

        .ts-reset-back a:hover {
          text-decoration: underline;
        }

        .ts-reset-security {
          text-align: center;
          color: #94a3b8;
          font-size: 9px;
          margin-top: 20px;
        }

        @media (max-width: 760px) {
          .ts-reset-layout {
            grid-template-columns: 1fr;
          }

          .ts-reset-info {
            padding: 30px;
            border-right: 0;
            border-bottom: 1px solid #e2e8f0;
          }

          .ts-reset-form-side {
            padding: 30px;
          }

          .ts-reset-info h2 {
            font-size: 24px;
          }
        }

        @media (max-width: 450px) {
          .ts-reset-page {
            padding: 18px 12px;
          }

          .ts-reset-info,
          .ts-reset-form-side {
            padding: 24px 20px;
          }

          .ts-reset-layout {
            border-radius: 19px;
          }
        }
      `}</style>

      <main className="ts-reset-wrapper">

        <div className="ts-reset-brand">

          <div className="ts-reset-logo">
            T
          </div>

          <div className="ts-reset-brand-name">
            TrustShare
          </div>

        </div>

        <div className="ts-reset-layout">

          {/* INFORMATION SIDE */}

          <section className="ts-reset-info">

            <div className="ts-reset-shield">
              🔐
            </div>

            <h2>
              Protect your
              <br />
              <span className="ts-reset-highlight">
                workspace.
              </span>
            </h2>

            <p>
              Set a new password to continue using your
              secure TrustShare workspace.
            </p>

            <div className="ts-reset-points">

              <div className="ts-reset-point">

                <div className="ts-reset-point-icon">
                  ✓
                </div>

                At least 8 characters

              </div>

              <div className="ts-reset-point">

                <div className="ts-reset-point-icon">
                  ⏳
                </div>

                Secure reset link

              </div>

              <div className="ts-reset-point">

                <div className="ts-reset-point-icon">
                  🛡️
                </div>

                Protected credentials

              </div>

            </div>

          </section>

          {/* FORM SIDE */}

          <section className="ts-reset-form-side">

            <div className="ts-reset-form-container">

              <div className="ts-reset-heading">

                <h1>
                  Reset Password
                </h1>

                <p>
                  Create a new password for your account.
                </p>

              </div>

              <form
                className="ts-reset-form"
                onSubmit={handleReset}
              >

                <div>

                  <label
                    className="ts-reset-label"
                    htmlFor="new-password"
                  >
                    New password
                  </label>

                  <input
                    id="new-password"
                    className="ts-reset-input"
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    autoComplete="new-password"
                    required
                  />

                  <div className="ts-reset-strength">

                    <div className="ts-reset-strength-bar">

                      <div
                        className="ts-reset-strength-fill"
                        style={{
                          width: `${Math.min(
                            passwordLength * 12.5,
                            100
                          )}%`,
                        }}
                      />

                    </div>

                    <div className="ts-reset-strength-text">
                      {passwordLength === 0
                        ? "Enter a password"
                        : passwordLength < 8
                        ? "Keep going..."
                        : "Password length looks good"}
                    </div>

                  </div>

                </div>

                <div>

                  <label
                    className="ts-reset-label"
                    htmlFor="confirm-password"
                  >
                    Confirm password
                  </label>

                  <input
                    id="confirm-password"
                    className="ts-reset-input"
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    autoComplete="new-password"
                    required
                  />

                </div>

                <button
                  className="ts-reset-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? "🔐 Updating password..."
                    : "Update Password →"}
                </button>

              </form>

              {message && (
                <div className="ts-reset-message">
                  {message}
                  <div style={{ marginTop: "5px" }}>
                    Redirecting to login...
                  </div>
                </div>
              )}

              {error && (
                <div className="ts-reset-message ts-reset-error">
                  {error}
                </div>
              )}

              <div className="ts-reset-back">

                <Link to="/login">
                  ← Back to Login
                </Link>

              </div>

              <div className="ts-reset-security">
                🔒 Your password is securely protected
              </div>

            </div>

          </section>

        </div>

      </main>

    </div>
  );
}

export default ResetPassword;