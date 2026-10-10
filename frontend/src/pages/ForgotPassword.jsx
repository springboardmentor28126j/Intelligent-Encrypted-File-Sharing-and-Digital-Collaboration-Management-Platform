import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/auth/forgot-password`,
        {
          email: email.trim(),
        }
      );

      setMessage(response.data.message);
      setEmail("");
    } catch (err) {
      
      setError(
        err.response?.data?.detail ||
         err.message ||

          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ts-recovery-page">

      <style>{`
        * {
          box-sizing: border-box;
        }

        .ts-recovery-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 20px;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 10% 10%,
              rgba(99, 102, 241, 0.13),
              transparent 30%
            ),
            radial-gradient(
              circle at 90% 90%,
              rgba(124, 58, 237, 0.11),
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

        /* BACKGROUND DECORATION */

        .ts-recovery-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .ts-recovery-orb-one {
          width: 280px;
          height: 280px;
          top: -150px;
          left: -100px;
          border: 1px solid rgba(99, 102, 241, 0.12);
        }

        .ts-recovery-orb-two {
          width: 360px;
          height: 360px;
          bottom: -210px;
          right: -160px;
          border: 1px solid rgba(124, 58, 237, 0.10);
        }

        /* MAIN CARD */

        .ts-recovery-wrapper {
          width: 100%;
          max-width: 480px;
          position: relative;
          z-index: 1;
        }

        .ts-recovery-brand {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          margin-bottom: 26px;
        }

        .ts-recovery-logo {
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

        .ts-recovery-brand-name {
          font-size: 21px;
          font-weight: 750;
          letter-spacing: -0.6px;
        }

        .ts-recovery-card {
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(226, 232, 240, 0.9);
          border-radius: 24px;
          padding: 42px;
          box-shadow:
            0 25px 70px rgba(15, 23, 42, 0.09);
          backdrop-filter: blur(18px);
        }

        /* ICON */

        .ts-recovery-icon {
          width: 66px;
          height: 66px;
          margin: 0 auto 22px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(
              135deg,
              #eef2ff,
              #f5f3ff
            );
          border: 1px solid #e0e7ff;
          font-size: 28px;
        }

        .ts-recovery-heading {
          text-align: center;
        }

        .ts-recovery-heading h1 {
          margin: 0;
          font-size: 29px;
          letter-spacing: -1px;
          color: #172033;
        }

        .ts-recovery-heading p {
          margin: 10px auto 0;
          max-width: 350px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.65;
        }

        /* FORM */

        .ts-recovery-form {
          margin-top: 30px;
          display: flex;
          flex-direction: column;
          gap: 17px;
        }

        .ts-recovery-label {
          font-size: 12px;
          font-weight: 650;
          color: #334155;
          margin-bottom: 7px;
          display: block;
        }

        .ts-recovery-input {
          width: 100%;
          height: 50px;
          border: 1px solid #dbe1ea;
          border-radius: 12px;
          background: #ffffff;
          padding: 0 15px;
          font-size: 13px;
          color: #172033;
          outline: none;
          transition: 0.2s ease;
        }

        .ts-recovery-input:hover {
          border-color: #c7d2fe;
        }

        .ts-recovery-input:focus {
          border-color: #6366f1;
          box-shadow:
            0 0 0 3px rgba(99, 102, 241, 0.10);
        }

        .ts-recovery-input::placeholder {
          color: #94a3b8;
        }

        .ts-recovery-button {
          width: 100%;
          height: 50px;
          border: none;
          border-radius: 12px;
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
            0 10px 24px rgba(79, 70, 229, 0.20);
          transition: 0.2s ease;
        }

        .ts-recovery-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow:
            0 14px 30px rgba(79, 70, 229, 0.25);
        }

        .ts-recovery-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* MESSAGES */

        .ts-recovery-message {
          margin-top: 18px;
          padding: 12px 14px;
          border-radius: 11px;
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #15803d;
          font-size: 11px;
          line-height: 1.5;
          text-align: center;
        }

        .ts-recovery-error {
          background: #fef2f2;
          border-color: #fecaca;
          color: #b91c1c;
        }

        /* FOOTER */

        .ts-recovery-back {
          text-align: center;
          margin-top: 25px;
        }

        .ts-recovery-back a {
          color: #4f46e5;
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
        }

        .ts-recovery-back a:hover {
          text-decoration: underline;
        }

        .ts-recovery-security {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 7px;
          margin-top: 22px;
          color: #94a3b8;
          font-size: 10px;
        }

        .ts-recovery-security span {
          color: #16a34a;
        }

        @media (max-width: 520px) {
          .ts-recovery-page {
            padding: 20px 14px;
          }

          .ts-recovery-card {
            padding: 30px 22px;
            border-radius: 20px;
          }

          .ts-recovery-heading h1 {
            font-size: 26px;
          }
        }
      `}</style>

      <div className="ts-recovery-orb ts-recovery-orb-one"></div>
      <div className="ts-recovery-orb ts-recovery-orb-two"></div>

      <main className="ts-recovery-wrapper">

        <div className="ts-recovery-brand">

          <div className="ts-recovery-logo">
            T
          </div>

          <div className="ts-recovery-brand-name">
            TrustShare
          </div>

        </div>

        <section className="ts-recovery-card">

          <div className="ts-recovery-icon">
            ✉️
          </div>

          <div className="ts-recovery-heading">

            <h1>
              Forgot your password?
            </h1>

            <p>
              No worries. Enter the email address associated
              with your TrustShare account and we'll send you
              a secure reset link.
            </p>

          </div>

          <form
            className="ts-recovery-form"
            onSubmit={handleSubmit}
          >

            <div>

              <label
                className="ts-recovery-label"
                htmlFor="recovery-email"
              >
                Email address
              </label>

              <input
                id="recovery-email"
                className="ts-recovery-input"
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

            <button
              className="ts-recovery-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Sending reset link..."
                : "Send Reset Link →"}
            </button>

          </form>

          {message && (
            <div className="ts-recovery-message">
              {message}
            </div>
          )}

          {error && (
            <div className="ts-recovery-message ts-recovery-error">
              {error}
            </div>
          )}

          <div className="ts-recovery-back">
            <Link to="/login">
              ← Back to Login
            </Link>
          </div>

          <div className="ts-recovery-security">
            <span>●</span>
            Secure password recovery
          </div>

        </section>

      </main>
    </div>
  );
}

export default ForgotPassword;