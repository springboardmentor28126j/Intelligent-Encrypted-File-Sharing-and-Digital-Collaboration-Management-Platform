import { useRouter } from "next/router";
import { useState } from "react";
import api from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [devResetToken, setDevResetToken] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setMessage(res.data.message);
      setSubmitted(true);
      if (res.data.reset_token) {
        setDevResetToken(res.data.reset_token);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong");
    }
  };

  const handleContinue = () => {
    router.push(`/reset-password?token=${devResetToken}`);
  };

  const inputStyle = {
    display: "block",
    width: "100%",
    marginBottom: 12,
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    fontSize: 14,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "0 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 36,
        }}
      >
        {!submitted && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Reset your password</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 0, marginBottom: 24 }}>
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              {error && (
                <p style={{ color: "var(--danger)", background: "var(--danger-bg)", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "12px 0",
                  background: "var(--forest)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Send reset link
              </button>
            </form>
          </>
        )}

        {submitted && (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--lime)",
                color: "var(--forest)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 700,
                margin: "0 auto 18px",
              }}
            >
              ✓
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Check your email</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14, margin: "0 0 20px" }}>{message}</p>

            {devResetToken && (
              <>
                <button
                  onClick={handleContinue}
                  style={{
                    width: "100%",
                    padding: "12px 0",
                    background: "var(--forest)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Continue to reset password
                </button>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
                  Dev mode: no email service is connected yet, so this button takes you straight to
                  the reset page instead of waiting for an email.
                </p>
              </>
            )}
          </div>
        )}

        <p style={{ marginTop: 20, textAlign: "center", fontSize: 14 }}>
          <a href="/" style={{ color: "var(--lime-dark)", textDecoration: "none" }}>
            Back to log in
          </a>
        </p>
      </div>
    </div>
  );
}